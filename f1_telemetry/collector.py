from f1.handler import PacketHandler
from f1.packets import (
    TYRES,
    PacketCarTelemetryData,
    PacketFinalClassificationData,
)

from datetime import timedelta
from f1_telemetry.live import enqueue
from f1_telemetry.model import Session
import typing as t


def _flatten_tyre_values(data, name):
    temps = data.pop(name)
    data.update(
        {f"{name}_{tyre.name.lower()}": temp for tyre, temp in zip(TYRES, temps)}
    )


def _player_index(packet):
    return packet.header.player_car_index


def _weather(packet):
    return {
        0: "☀️ Clear",
        1: "🌥️ Light cloud",
        2: "☁️ Overcast",
        3: "🌦️ Light rain",
        4: "🌧️ Heavy rain",
        5: "⛈️ Storm",
    }[packet.weather]


class TelemetryCollector(PacketHandler):
    def __init__(self, listener, sink):
        super().__init__(listener)

        self.sink = sink

        self.session = Session(
            None,
            on_lap_changed=self.on_lap_changed,
            on_sector_changed=self.on_sector_changed,
        )
        self.motion_data = None
        self.tyre_data_emitted = False

        self.last_live_data = {}

    def push(self, fields):
        if self.session is None or self.session.lap == 0:
            return

        self.sink.write(f"{self.session.slug}|{self.session.lap:002}", fields)

    def push_live(self, _type, data):
        if self.session is None:
            return

        live_data = {"type": _type, "data": data}
        if live_data == self.last_live_data.get(_type, None):
            return

        if enqueue({"type": _type, "data": data}):
            self.last_live_data[_type] = live_data

    def on_sector_changed(self, n, time, best):
        self.push({f"sector_{n}_ms": time})

        best_time = sum(self.session.best_sectors[1 : n + 1])
        current_time = sum(self.session.sectors[1 : n + 1])

        if best:
            bg = "105"
        elif current_time < best_time:
            bg = "102"
        else:
            bg = "103"

        if time > 0:
            print(
                f"\033[30;{bg}m" + f"{time/1000:02.3f}".center(10) + "\033[0m",
                end="",
                flush=True,
            )

    def on_lap_changed(self, lap: t.Optional[int], last_lap_time, best):
        if last_lap_time != 0:
            self.push({"total_time_ms": last_lap_time})

            time = str(timedelta(milliseconds=last_lap_time))[2:-3].center(13)
            if best:
                print(f"\033[95m" + f"{time}".center(10) + "\033[0m", end="")
            else:
                print(time, end="")

        if lap is not None:
            print(f"\nLap {lap:<6}", end="", flush=True)

        self.tyre_data_emitted = False

    def handle_SessionData(self, packet):
        self.session.refresh(packet)

        self.push_live(
            "weather_data",
            {
                "weather": _weather(packet),
                "forecasts": [
                    (sample.time_offset, _weather(sample), sample.rain_percentage)
                    for _, sample in zip(
                        range(4),
                        (
                            s
                            for s in packet.weather_forecast_samples
                            if s.time_offset > 0
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

    def collect(self):
        return self.handle()
