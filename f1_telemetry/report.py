import csv
import typing as t
from collections import Counter
from datetime import timedelta

from f1.packets import FinalClassificationData


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
        with open(f"{report_name}.csv", "w", newline="") as final_file:
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
            final_data.append(
                (
                    data.position,
                    name,
                    data.best_lap_time_in_ms,
                    fmtt(data.best_lap_time_in_ms),
                    data.total_race_time * 1000,
                    fmtt(data.total_race_time * 1000),
                    data.num_laps,
                    result_status(data),
                    data.penalties_time,
                    round(self.human_pct.get(name, 0.0)),
                )
            )

        return sorted(final_data, key=lambda _: _[0])
