import typing as t
from bisect import bisect_left
from collections import deque

from f1.handler import PacketHandler
from f1.packets import TYRES
from f1.packets import Packet
from f1.packets import PacketCarTelemetryData
from f1.packets import PacketEventData
from f1.packets import PacketFinalClassificationData
from f1.packets import PacketLapData
from f1.packets import PacketParticipantsData
from f1.packets import PacketSessionData

from f1_telemetry.live import enqueue
from f1_telemetry.model import Session
from f1_telemetry.model import SessionEventHandler
from f1_telemetry.report import HumanCounter
from f1_telemetry.report import QualifyingReport
from f1_telemetry.report import RaceReport
from f1_telemetry.view import SessionPrinter


def closest(values, value):
    pos = bisect_left(values, value)
    if pos == 0:
        return pos
    if pos == len(values):
        return pos - 1
    before = values[pos - 1]
    after = values[pos]
    if after - value < value - before:
        return pos
    return pos - 1


def _flatten_tyre_values(data, name):
    temps = data.pop(name)
    data.update(
        {f"{name}_{tyre.name.lower()}": temp for tyre, temp in zip(TYRES, temps)}
    )


def _player_index(packet: Packet) -> int:
    return packet.header.player_car_index


def player_name(player) -> str:
    name = player.name.decode()
    return f"{name}{player.network_id}" if name == "Player" else name


def _weather(packet: PacketSessionData) -> t.Tuple[str, str]:
    return {
        0: ("☀️", "Clear"),
        1: ("🌥️", "Light cloud"),
        2: ("☁️", "Overcast"),
        3: ("🌦️", "Light rain"),
        4: ("🌧️", "Heavy rain"),
        5: ("⛈️", "Storm"),
    }[packet.weather]


class TelemetryCollector(PacketHandler, SessionEventHandler):
    def __init__(self, listener, sink, report=False):
        super().__init__(listener)

        self.sink = sink
        self.queue = deque()  # To handle flashbacks

        self.session = Session(self)
        self.motion_data = None
        self.tyre_data_emitted = False

        self.last_live_data = {}
        self.printer = SessionPrinter()

        self.gap = 0.0  # meters
        self.leader_distance = []
        self.leader_time = []
        self.leader_timestamp = []
        self.rival_index = 255
        self.distance = 0.0
        self.rival_distance = 0.0

        self.report = report
        self.drivers = {} if report else None
        self.human_count = HumanCounter() if report else None

    def push(self, fields: t.Dict[str, t.Any]):
        current_time = self.session.time
        if (
            self.session is None
            or self.session.lap == 0
            or self.distance < 0
            or current_time is None
        ):
            return

        self.queue.append((current_time, self.session.lap, fields))

        # Flush data outside the flashback window
        flashback_time = current_time - 16.0
        while self.queue:
            time, lap, data = self.queue[0]
            if time >= flashback_time:
                break
            self.queue.popleft()
            self.sink.write(f"{self.session.slug}|{lap:002}", data)

    def flush(self):
        while self.queue:
            _, lap, data = self.queue.popleft()
            self.sink.write(f"{self.session.slug}|{lap:002}", data)

    def push_live(self, _type: str, data: t.Dict[str, t.Any]):
        if self.session is None:
            return

        live_data = {"type": _type, "data": data}
        if live_data == self.last_live_data.get(_type, None):
            return

        if enqueue({"type": _type, "data": data}):
            self.last_live_data[_type] = live_data

    def collect(self):
        return self.handle()

    # ---- SessionEventHandler ----

    def on_sector(self, n: int, lap: int, time: float, best: bool) -> None:
        self.push({f"sector_{n}_ms": time})
        if time <= 0:
            return

        best_time = sum(self.session.best_lap_sectors[1 : n + 1])
        current_time = sum(self.session.sectors[1 : n + 1])

        self.printer.print_sector(
            n, lap, time, best, best_time == 0 or current_time < best_time
        )

    def on_new_lap(self, current_lap, previous_lap, previous_sectors, best):
        last_lap_time = sum(previous_sectors)
        if last_lap_time > 0:
            self.push({"total_time_ms": last_lap_time})
            self.printer.print_lap_time(previous_lap, last_lap_time, best)
            if self.tyre_data_emitted:
                self.printer.print_tyre(self.session.tyre, self.session.tyre_age)

        if current_lap:
            self.printer.print_lap(current_lap)

        self.tyre_data_emitted = False
        self.leader_distance.clear()
        self.leader_time.clear()

    def on_finish(self, lap, sectors, best):
        self.on_new_lap(None, lap, sectors, best)
        print("🏁")

    def on_new_session(self, session):
        self.printer.print_session(session.slug)
        self.flush()

        self.queue.clear()

        self.motion_data = None
        self.tyre_data_emitted = False

        self.last_live_data.clear()

        self.gap = 0.0  # meters
        self.leader_distance.clear()
        self.leader_time.clear()
        self.rival_index = 255
        self.distance = 0.0
        self.rival_distance = 0.0

        if self.report:
            self.drivers.clear()
            self.human_count.clear()

    # ---- PacketHandler ----

    def handle_SessionData(self, packet):
        self.session.refresh(packet)

        self.push_live(
            "weather_data",
            {
                "weather": _weather(packet),
                "forecasts": [
                    (sample.time_offset, *_weather(sample), sample.rain_percentage)
                    for _, sample in zip(
                        range(4),
                        (
                            s
                            for s in packet.weather_forecast_samples
                            if s.time_offset > 0
                            and s.session_type == packet.session_type
                        ),
                    )
                ],
            },
        )

    def handle_CarTelemetryData(self, packet: PacketCarTelemetryData):
        if self.motion_data is None:
            return

        try:
            data = packet.car_telemetry_data[_player_index(packet)].to_dict()
        except IndexError:
            return

        data.update(self.motion_data)
        self.motion_data = None

        data["distance"] = self.distance
        if self.session.type == 13:
            data["gap"] = self.gap
            if self.rival_index != 255:
                rival = packet.car_telemetry_data[self.rival_index]
                data["rival_throttle"] = rival.throttle
                data["rival_brake"] = rival.brake
                data["rival_gear"] = rival.gear
                data["rival_speed"] = rival.speed
                data["rival_distance"] = self.rival_distance

        self.push_live("tyre_temp", data["tyres_inner_temperature"])

        for k, v in dict(data).items():
            if isinstance(v, list) and len(v) == len(TYRES):
                _flatten_tyre_values(data, k)

        self.push(data)

    def handle_CarStatusData(self, packet):
        try:
            data = packet.car_status_data[_player_index(packet)]
        except IndexError:
            return

        self.session.car_status_data(data)

        if not self.tyre_data_emitted:
            self.push(
                {
                    "tyre_compound": self.session.tyre,
                    "tyre_age": self.session.tyre_age,
                },
            )
            self.tyre_data_emitted = True

        self.push_live("fuel", data.fuel_remaining_laps)

    def handle_CarDamageData(self, packet):
        try:
            data = packet.car_damage_data[_player_index(packet)].to_dict()
        except IndexError:
            return

        for k, v in dict(data).items():
            if isinstance(v, list) and len(v) == len(TYRES):
                _flatten_tyre_values(data, k)

        self.push_live("car_status", data)

    def handle_FinalClassificationData(self, packet: PacketFinalClassificationData):
        self.flush()
        self.session.final_classification()

        if self.report:
            if self.session.is_qualifying():
                QualifyingReport(
                    self.drivers, packet.classification_data, self.human_count
                ).generate(f"{self.session.slug.replace('|', '_').replace(':', '')}-Q")
            elif self.session.is_race():
                RaceReport(
                    self.drivers, packet.classification_data, self.human_count
                ).generate(f"{self.session.slug.replace('|', '_').replace(':', '')}-R")
            else:
                print(f"No report generated for session type {self.session.type}")

    def handle_LapData(self, packet: PacketLapData):
        try:
            data = packet.lap_data[_player_index(packet)]
            self.rival_index = rival_index = packet.time_trial_rival_car_idx
            if rival_index != 255:
                rival = packet.lap_data[rival_index]
                gap = rival.lap_distance - data.lap_distance
                self.leader_timestamp.append(packet.header.session_time)
                if gap >= 0.0:
                    self.leader_distance.append(rival.lap_distance)
                    self.leader_time.append(rival.current_lap_time_in_ms)
                    i = closest(self.leader_distance, data.lap_distance)
                    self.gap = data.current_lap_time_in_ms - self.leader_time[i]
                else:
                    self.leader_distance.append(data.lap_distance)
                    self.leader_time.append(data.current_lap_time_in_ms)
                    i = closest(self.leader_distance, rival.lap_distance)
                    self.gap = self.leader_time[i] - rival.current_lap_time_in_ms
                self.gap /= 1000.0
                self.rival_distance = rival.lap_distance
            self.distance = data.lap_distance

        except IndexError:
            return

        self.session.lap_data(data)

    def handle_MotionData(self, packet):
        try:
            self.motion_data = packet.car_motion_data[_player_index(packet)].to_dict()
        except IndexError:
            return

    def handle_EventData(self, packet: PacketEventData):
        event = bytes(packet.event_string_code).decode()
        if event == "FLBK":
            # Flashback
            flashback_time = packet.event_details.flashback.flashback_session_time

            # Clean up leader data
            if self.leader_timestamp:
                i = closest(self.leader_timestamp, flashback_time)
                del self.leader_distance[i:]
                del self.leader_time[i:]
                del self.leader_timestamp[i:]

            # Remove events that are in the future w.r.t. the flashback time
            while self.queue:
                time, lap, _ = self.queue[-1]
                if time <= flashback_time:
                    self.session.lap = lap
                    break
                self.queue.pop()

            # We can flush the rest as we won't be flashing back beyond this
            # point in time.
            self.flush()

    def handle_ParticipantsData(self, packet: PacketParticipantsData):
        if not self.report:
            return

        human_drivers = {
            i: player_name(p)
            for i, p in enumerate(packet.participants)
            if p.name and not p.ai_controlled
        }

        # Measure the "humanity" of the drivers
        self.human_count.update(human_drivers.values())

        self.drivers.update(human_drivers)
