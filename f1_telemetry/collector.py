from f1.handler import PacketHandler
from f1.packets import TYRES, TRACKS

from datetime import datetime
from f1_telemetry.live import enqueue


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


def _track_name(packet):
    return TRACKS[packet.track_id]


class TelemetryCollector(PacketHandler):
    def __init__(self, listener, sink):
        super().__init__(listener)

        self.sink = sink

        self.session = None
        self.lap = 0
        self.sector = 0
        self.sectors = [0, 0, 0]
        self.total_time = None
        self.motion_data = None
        self.session_id = None
        self.tyre = None
        self.tyre_age = None
        self.track = None
        self.last_live_data = {}

    def init_session(self):
        self.session = f'{datetime.now().strftime("%Y-%m-%d|%H:%M")}|{self.track}'
        self.lap = 0
        self.sector = 0
        self.sectors = [0, 0, 0]

    def on_new_lap(self):
        self.sector = 0
        self.sectors[:] = [0, 0, 0]

    def push(self, lap, fields):
        if self.session is None or not lap:
            return

        self.sink.write(f"{self.session}|{lap:002}", fields)

    def push_live(self, _type, data):
        if self.session is None:
            return

        live_data = {"type": _type, "data": data}
        if live_data == self.last_live_data.get(_type, None):
            return

        if enqueue({"type": _type, "data": data}):
            self.last_live_data[_type] = live_data

    def handle_SessionData(self, packet):
        if self.session_id != packet.session_link_identifier:
            self.session_id = packet.session_link_identifier
            self.track = _track_name(packet)
            self.init_session()

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

    def handle_CarTelemetryData(self, packet):
        if self.motion_data is None:
            return

        try:
            data = packet.car_telemetry_data[_player_index(packet)].to_dict()
        except IndexError:
            return

        data.update(self.motion_data)
        self.motion_data = None

        self.push_live("tyre_temp", data["tyres_surface_temperature"])

        for k, v in dict(data).items():
            if isinstance(v, list) and len(v) == len(TYRES):
                _flatten_tyre_values(data, k)

        self.push(self.lap, data)

    def handle_CarStatusData(self, packet):
        try:
            data = packet.car_status_data[_player_index(packet)].to_dict()
        except IndexError:
            return

        self.tyre = {16: "Soft", 17: "Medium", 18: "Hard", 7: "Inter", 8: "Wet"}[
            data["visual_tyre_compound"]
        ]
        self.tyre_age = data["tyres_age_laps"]

    def emit_tyre_data(self):
        if self.tyre is None:
            return

        self.push(
            self.lap,
            {
                "tyre_compound": self.tyre,
                "tyre_age": self.tyre_age,
            },
        )

    def handle_CarDamageData(self, packet):
        try:
            data = packet.car_damage_data[_player_index(packet)].to_dict()
        except IndexError:
            return

        for k, v in dict(data).items():
            if isinstance(v, list) and len(v) == len(TYRES):
                _flatten_tyre_values(data, k)

        self.push_live("car_status", data)

    def handle_FinalClassificationData(self, packet):
        self.emit_lap_data()

    def emit_lap_data(self):
        self.sectors[2] = self.total_time - sum(self.sectors)

        lap_data = {f"sector_{i+1}_ms": t for i, t in enumerate(self.sectors)}
        lap_data["total_time_ms"] = self.total_time

        self.push(self.lap, lap_data)

    def handle_LapData(self, packet):
        try:
            data = packet.lap_data[_player_index(packet)]
        except IndexError:
            return

        if data.sector != self.sector:
            self.sector = data.sector
            if self.sector > 0:
                sector_time = getattr(data, f"sector{self.sector}_time_in_ms")
                if sector_time > 0:
                    self.sectors[self.sector - 1] = sector_time

        total_time = self.total_time = data.last_lap_time_in_ms
        if data.current_lap_num != self.lap:
            if all(_ > 0 for _ in self.sectors[:2]):
                self.sectors[2] = total_time - sum(self.sectors)
                secs, ms = divmod(total_time, 1000)
                mins, secs = divmod(secs, 60)
                print(
                    f"Lap {self.lap}: {mins}:{secs:02}.{ms:03}",
                    [f"{_ / 1000:.03f}" for _ in self.sectors],
                )

            self.emit_lap_data()
            self.emit_tyre_data()

            self.on_new_lap()

        self.lap = data.current_lap_num

    def handle_MotionData(self, packet):
        try:
            self.motion_data = packet.car_motion_data[_player_index(packet)].to_dict()
        except IndexError:
            return

    def collect(self):
        return self.handle()
