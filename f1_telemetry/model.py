import typing as t
from abc import ABC
from abc import abstractmethod
from datetime import datetime
from enum import Enum

from f1.packets import TRACKS
from f1.packets import CarStatusData
from f1.packets import LapData
from f1.packets import PacketSessionData
from f1.packets import SessionType


class SessionState(Enum):
    INIT = 0
    IN_GARAGE = 1
    ON_TRACK = 2
    FINISHED = 3


class SessionEventHandler(ABC):
    @abstractmethod
    def on_new_session(self, session: "Session") -> None: ...

    @abstractmethod
    def on_new_lap(
        self,
        current_lap: int,
        previous_lap: int,
        previous_sectors: t.Tuple[int, int, int],
        best: bool,
    ) -> None: ...

    @abstractmethod
    def on_sector(self, n: int, lap: int, time: float, best: bool) -> None: ...

    @abstractmethod
    def on_finish(
        self, lap: int, sectors: t.Tuple[int, int, int], best: bool
    ) -> None: ...


class Session:
    def __init__(self, handler: SessionEventHandler) -> None:
        self.handler = handler

        self.state = SessionState.INIT

        self.lap = 0
        self.sector = 0
        self.sectors = [None, 0, 0, 0]
        self.best_lap_time = 0
        self.best_sectors = [None, 0, 0, 0]
        self.best_lap_sectors = [None, 0, 0, 0]
        self.tyre: t.Optional[str] = None
        self.tyre_age = None
        self.slug: t.Optional[str] = None
        self.session_uid = None
        self.track = None
        self.type = None
        self.time = None  # seconds
        self.fuel = None

        self._lap_data = None

    def step(self):
        self.state = getattr(self, f"handle_{self.state.name}")()

    def handle_INIT(self):
        if self._lap_data is None:
            return SessionState.INIT

        return (
            SessionState.ON_TRACK
            if self._lap_data.driver_status in (1, 4)
            else SessionState.IN_GARAGE
        )

    def _update_sector_3(self):
        if self._lap_data is None:
            return

        total_time = self._lap_data.last_lap_time_in_ms
        sector_time = self.sectors[3] = (
            0
            if any(_ == 0 for _ in self.sectors[1:3])
            else total_time - sum(self.sectors[1:3])
        )
        best = self.best_sectors[3] == 0 or self.best_sectors[3] > sector_time
        if best:
            self.best_sectors[3] = sector_time

        return best

    def _update_last_lap(self) -> bool:
        if self._lap_data is None:
            return False

        total_time = self._lap_data.last_lap_time_in_ms
        best = self.best_lap_time == 0 or self.best_lap_time > total_time
        if best:
            self.best_lap_time = total_time
            self.best_lap_sectors = tuple(self.sectors)
        return best

    def handle_IN_GARAGE(self):
        if self._lap_data is None:
            return SessionState.INIT

        self.lap = self._lap_data.current_lap_num
        self.sector = self._lap_data.sector + 1

        return (
            SessionState.ON_TRACK
            if self._lap_data.driver_status != 0
            else SessionState.IN_GARAGE
        )

    def handle_ON_TRACK(self):
        if self._lap_data is None:
            return SessionState.INIT

        try:
            current_lap = self._lap_data.current_lap_num
            current_sector = self._lap_data.sector + 1

            if self._lap_data.driver_status == 0:
                return SessionState.IN_GARAGE

            if (self.lap, self.sector) < (current_lap, current_sector):
                # Flashback
                pass

            if self.lap < current_lap:  # new lap
                best = self._update_sector_3()

                self.handler.on_sector(3, self.lap, self.sectors[3], best)

                best = self._update_last_lap()

                self.handler.on_new_lap(
                    current_lap, self.lap, tuple(self.sectors[1:]), best
                )

            elif self.sector < current_sector:  # new sector
                sector_time = getattr(
                    self._lap_data, f"sector{self.sector}_time_ms_part"
                )
                sector_time += (
                    getattr(self._lap_data, f"sector{self.sector}_time_minutes_part")
                    * 60
                    * 1000
                )
                self.sectors[self.sector] = sector_time
                best = (
                    self.best_sectors[self.sector] == 0
                    or self.best_sectors[self.sector] > sector_time
                )
                if best:
                    self.best_sectors[self.sector] = sector_time

                self.handler.on_sector(self.sector, self.lap, sector_time, best)

            return SessionState.ON_TRACK

        finally:
            self.lap = current_lap
            self.sector = current_sector

    def handle_FINISHED(self):
        best = self._update_sector_3()
        self.handler.on_sector(3, self.lap, self.sectors[3], best)

        best = self._update_last_lap()
        self.handler.on_finish(self.lap, tuple(self.sectors[1:]), best)

        self.session_uid = None

        return SessionState.INIT

    def refresh(self, packet: PacketSessionData):
        """Refresh the current session."""
        self.time = packet.header.session_time

        if self.session_uid == packet.header.session_uid:
            return

        self.__init__(self.handler)

        self.session_uid = packet.header.session_uid
        self.track = TRACKS[packet.track_id]
        self.slug = f'{datetime.now().strftime("%Y-%m-%d|%H:%M")}|{self.track}'
        self.type = packet.session_type

        self.handler.on_new_session(self)

        self.step()

    def lap_data(self, data: LapData):
        self._lap_data = data

        self.step()

    def car_status_data(self, data: CarStatusData):
        self.tyre = {16: "Soft", 17: "Medium", 18: "Hard", 7: "Inter", 8: "Wet"}.get(
            data.visual_tyre_compound, "Unknown"
        )
        self.tyre_age = data.tyres_age_laps
        self.fuel = data.fuel_remaining_laps

    def final_classification(self):
        self.state = SessionState.FINISHED

        self.step()

    def is_qualifying(self):
        if self.type is None:
            return False

        return SessionType.Q <= self.type <= SessionType.OSSQ

    def is_race(self):
        if self.type is None:
            return False

        return SessionType.RACE <= self.type <= SessionType.RACE_3
