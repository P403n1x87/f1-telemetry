import csv
import typing as t
from collections import Counter
from datetime import timedelta

from f1.packets import FinalClassificationData
from f1.packets import Penalty


class HumanCounter(Counter):
    def __init__(self, *args, **kwargs):
        self.total = -1  # Update is called on instance creation
        super().__init__(*args, **kwargs)

    def update(self, *args, **kwargs):
        self.total += 1
        super().update(*args, **kwargs)

    def clear(self):
        self.total = 0
        super().clear()

    def get_percents(self):
        return {
            name: 100.0 * count / self.total if self.total > 0 else 0
            for name, count in self.items()
        }


def result_status(data: FinalClassificationData) -> str:
    return {
        0: "INV",
        1: "INA",
        2: "ACT",
        3: "FIN",
        4: "DNF",
        5: "DQ",
        6: "NC",
        7: "DNF",  # "RET",
    }[data.result_status]


def fmtt(millis: int) -> str:
    result = str(timedelta(milliseconds=millis))[:-3]
    if result.startswith("0:"):
        return result[2:]
    return result


class Report:
    def __init__(
        self,
        drivers: t.Dict[int, str],
        data: t.List[FinalClassificationData],
        human_count: HumanCounter,
    ) -> None:
        self.drivers = drivers
        self.data = data
        self.human_pct = human_count.get_percents()

    def rows(self) -> t.Iterator[t.Tuple]:
        pass

    def generate(self, report_name: str) -> None:
        with open(
            f"{report_name}.csv", "w", newline="", encoding="utf-8"
        ) as final_file:
            writer = csv.writer(final_file)
            for row in self.rows():
                writer.writerow(row)


class QualifyingReport(Report):
    def rows(self):
        final_data = []
        for i, name in self.drivers.items():
            data = self.data[i]
            final_data.append(
                (
                    data.position,
                    name,
                    data.best_lap_time_in_ms,
                    fmtt(data.best_lap_time_in_ms),
                )
            )

        return sorted(final_data, key=lambda x: x[0])


class RaceReport(Report):
    def rows(self):
        final_data = []
        for i, name in self.drivers.items():
            data = self.data[i]

            total_time = int((data.total_race_time + data.penalties_time) * 1000)

            final_data.append(
                (
                    data.position,
                    name,
                    data.best_lap_time_in_ms,
                    fmtt(data.best_lap_time_in_ms),
                    total_time,
                    fmtt(total_time),
                    data.num_laps,
                    result_status(data),
                    data.penalties_time,
                    round(self.human_pct.get(name, 0.0)),
                )
            )

        return sorted(final_data, key=lambda _: _[0])


class RaceDirector(Report):
    INCIDENT_TYPES = {
        0: "Drive through",
        1: "Stop Go",
        2: "Grid penalty",
        3: "Penalty reminder",
        4: "Time penalty",
        5: "Warning",
        6: "Disqualified",
        7: "Removed from formation lap",
        8: "Parked too long timer",
        9: "Tyre regulations",
        10: "This lap invalidated",
        11: "This and next lap invalidated",
        12: "This lap invalidated without reason",
        13: "This and next lap invalidated without reason",
        14: "This and previous lap invalidated",
        15: "This and previous lap invalidated without reason",
        16: "Retired",
        17: "Black flag timer",
    }

    INCIDENT_DETAILS = {
        0: "Blocking by slow driving",
        1: "Blocking by wrong way driving",
        2: "Reversing off the start line",
        3: "Big Collision",
        4: "Small Collision",
        5: "Collision failed to hand back position single",
        6: "Collision failed to hand back position multiple",
        7: "Corner cutting gained time",
        8: "Corner cutting overtake single",
        9: "Corner cutting overtake multiple",
        10: "Crossed pit exit lane",
        11: "Ignoring blue flags",
        12: "Ignoring yellow flags",
        13: "Ignoring drive through",
        14: "Too many drive throughs",
        15: "Drive through reminder serve within n laps",
        16: "Drive through reminder serve this lap",
        17: "Pit lane speeding",
        18: "Parked for too long",
        19: "Ignoring tyre regulations",
        20: "Too many penalties",
        21: "Multiple warnings",
        22: "Approaching disqualification",
        23: "Tyre regulations select single",
        24: "Tyre regulations select multiple",
        25: "Lap invalidated corner cutting",
        26: "Lap invalidated running wide",
        27: "Corner cutting ran wide gained time minor",
        28: "Corner cutting ran wide gained time significant",
        29: "Corner cutting ran wide gained time extreme",
        30: "Lap invalidated wall riding",
        31: "Lap invalidated flashback used",
        32: "Lap invalidated reset to track",
        33: "Blocking the pitlane",
        34: "Jump start",
        35: "Safety car to car collision",
        36: "Safety car illegal overtake",
        37: "Safety car exceeding allowed pace",
        38: "Virtual safety car exceeding allowed pace",
        39: "Formation lap below allowed speed",
        40: "Formation lap parking",
        41: "Retired mechanical failure",
        42: "Retired terminally damaged",
        43: "Safety car falling too far back",
        44: "Black flag timer",
        45: "Unserved stop go penalty",
        46: "Unserved drive through penalty",
        47: "Engine component change",
        48: "Gearbox change",
        49: "Parc Fermé change",
        50: "League grid penalty",
        51: "Retry penalty",
        52: "Illegal time gain",
        53: "Mandatory pitstop",
        54: "Attribute assigned",
    }

    def __init__(self, drivers):
        super().__init__(drivers, [], HumanCounter())

    def record_incident(self, penalty: Penalty) -> None:
        if penalty.vehicle_idx not in self.drivers:
            return

        try:
            self.data.append(
                (
                    self.drivers[penalty.vehicle_idx],
                    self.INCIDENT_TYPES[penalty.penalty_type],
                    self.INCIDENT_DETAILS[penalty.infringement_type],
                    penalty.lap_num,
                    self.drivers.get(penalty.other_vehicle_idx, ""),
                )
            )
        except KeyError:
            print(
                "ERROR: Unknown penalty type:",
                penalty.penalty_type,
                penalty.infringement_type,
            )

    def rows(self):
        return self.data
