from datetime import datetime
from f1.packets import PacketSessionData, TRACKS, LapData, CarStatusData


class Session:
    def __init__(self, packet=None, on_lap_changed=None, on_sector_changed=None):
        self.on_sector_changed = on_sector_changed
        self.on_lap_changed = on_lap_changed

        self.link = packet.session_link_identifier if packet else None

        self.lap = 0
        self.best_lap_time = 0
        self.sector = 1
        self.sectors = [None, 0, 0, 0]
        self.best_sectors = [None, 0, 0, 0]
        self.motion_data = None
        self.session_id = None
        self.tyre = None
        self.tyre_age = None
        self.current_time = 0
        self.track = TRACKS[packet.track_id] if packet else None
        self.on_track = False
        self.slug = f'{datetime.now().strftime("%Y-%m-%d|%H:%M")}|{self.track}'

    def refresh(self, packet: PacketSessionData) -> bool:
        """Refresh the current session.

        If the session has changed, return True.
        """
        if self.link != packet.session_link_identifier:
            self.__init__(
                packet,
                on_lap_changed=self.on_lap_changed,
                on_sector_changed=self.on_sector_changed,
            )
            return True

        return False

    def _close_lap(self, total_time, next_lap):
        if self.sector == 3:
            sector_time = self.sectors[3] = total_time - sum(self.sectors[1:3])
            if sector_time == total_time:
                sector_time = 0
            best = (
                self.best_sectors[self.sector] == 0
                or self.best_sectors[self.sector] > sector_time
            )
            if best:
                self.best_sectors[self.sector] = sector_time

            if self.on_sector_changed:
                self.on_sector_changed(3, sector_time, best)

        last_lap_time = sum(self.sectors[1:])
        best = self.best_lap_time == 0 or self.best_lap_time > last_lap_time
        if best:
            self.best_lap_time = last_lap_time

        if self.on_lap_changed:
            self.on_lap_changed(next_lap, last_lap_time, best)

    def lap_data(self, data: LapData):
        self.on_track = data.driver_status in (1, 4)
        if not self.on_track:
            return

        self.current_time = data.current_lap_time_in_ms
        current_lap = data.current_lap_num
        current_sector = data.sector + 1
        if current_lap > self.lap or self.sector > current_sector:
            self.sector = 3

            self._close_lap(data.last_lap_time_in_ms, current_lap)

            self.sector = current_sector
            self.sectors[:] = [None, 0, 0, 0]
            self.lap = current_lap

        elif self.sector < current_sector:
            sector_time = getattr(data, f"sector{self.sector}_time_in_ms")
            self.sectors[self.sector] = sector_time
            best = (
                self.best_sectors[self.sector] == 0
                or self.best_sectors[self.sector] > sector_time
            )
            if best:
                self.best_sectors[self.sector] = sector_time

            if self.on_sector_changed:
                self.on_sector_changed(self.sector, sector_time, best)

            self.sector = current_sector

    def car_status_data(self, data: CarStatusData):
        self.tyre = {16: "Soft", 17: "Medium", 18: "Hard", 7: "Inter", 8: "Wet"}[
            data.visual_tyre_compound
        ]
        self.tyre_age = data.tyres_age_laps

    def final_classification(self):
        self._close_lap(self.current_time, None)
