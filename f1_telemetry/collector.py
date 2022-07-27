from f1.handler import PacketHandler
from f1.packets import (
    TYRES,
    PacketCarTelemetryData,
    PacketFinalClassificationData,
    Packet,
    PacketSessionData,
)

from f1_telemetry.live import enqueue
from f1_telemetry.model import Session, SessionEventHandler
import typing as t
from f1_telemetry.view import SessionPrinter


def _flatten_tyre_values(data, name):
    temps = data.pop(name)
    data.update(
        {f"{name}_{tyre.name.lower()}": temp for tyre, temp in zip(TYRES, temps)}
    )


def _player_index(packet: Packet) -> int:
    return packet.header.player_car_index


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
    def __init__(self, listener, sink):
        super().__init__(listener)

        self.sink = sink

        self.session = Session(self)
        self.motion_data = None
        self.tyre_data_emitted = False

        self.last_live_data = {}
        self.printer = SessionPrinter()

    def push(self, fields: t.Dict[str, t.Any]):
        if self.session is None or self.session.lap == 0:
            return

        self.sink.write(f"{self.session.slug}|{self.session.lap:002}", fields)

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

        self.tyre_data_emitted = False

    def on_finish(self, lap, sectors, best):
        self.on_new_lap(None, lap, sectors, best)
        print("🏁")

    def on_new_session(self, session):
        self.printer.print_session(session.slug)

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
        self.session.final_classification()

    def handle_LapData(self, packet):
        try:
            data = packet.lap_data[_player_index(packet)]
        except IndexError:
            return

        self.session.lap_data(data)

    def handle_MotionData(self, packet):
        try:
            self.motion_data = packet.car_motion_data[_player_index(packet)].to_dict()
        except IndexError:
            return
