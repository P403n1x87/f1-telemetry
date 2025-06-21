from datetime import timedelta


class SessionPrinter:
    def __init__(self):
        self.last_lap = 0
        self.last_sector = 0
        self.last_sectors = [None] * 4
        self.lap_ended = False

    def print_session(self, slug: str) -> None:
        print(f"Session {slug}")

    def print_lap(self, lap: int) -> None:
        if lap == self.last_lap:
            # Go back and clean the line
            print("\r" + " " * 60, end="\r", flush=True)
        else:
            print()
            self.last_sectors = [None] * 4

        print(f"Lap {lap:<6}", end="", flush=True)

        self.last_lap = lap
        self.last_sector = 0
        self.lap_ended = False

    def _reprint_sectors(self, n: int, lap: int) -> None:
        if not all(_ is None for _ in self.last_sectors):
            for sector in self.last_sectors[1:n]:
                if sector is not None:
                    self.print_sector(*sector)
                else:
                    print(" " * 11, end="", flush=True)
                    self.last_sector += 1

    def print_sector(
        self, n: int, lap: int, time: float, best_sector: bool, best_time: bool
    ) -> None:
        if lap != self.last_lap or n != self.last_sector + 1:
            # Refresh lap
            self.print_lap(lap)
            self.last_sectors[n + 1 :] = [None] * (3 - n)
            self.last_sectors[n] = (n, lap, time, best_sector, best_time)
            self._reprint_sectors(n, lap)
        else:
            self.last_sectors[n] = (n, lap, time, best_sector, best_time)

        if best_sector:
            bg = "105"
        elif best_time:
            bg = "102"
        else:
            bg = "103"

        print(
            f"\033[30;{bg}m" + f"{time/1000:02.3f}".center(10) + "\033[0m",
            end=" ",
            flush=True,
        )

        self.last_sector = n

    def print_lap_time(self, lap: int, time: float, best: float) -> None:
        if lap != self.last_lap or self.lap_ended:
            self.print_lap(lap)
            self._reprint_sectors(4, lap)

        time_repr = str(timedelta(milliseconds=time))[2:-3].center(13)
        if best:
            print(
                f"\033[95m" + f"{time_repr}".center(10) + "\033[0m", end="", flush=True
            )
        else:
            print(time_repr, end="", flush=True)

        self.lap_ended = True

    def print_tyre(self, tyre: str, tyre_age: int, wear_rate: int) -> None:
        t = tyre[0]
        color = {"S": "31", "M": "33", "H": "37", "I": "32", "W": 34}[t]
        print(
            f"\033[30;{color}m(\033[0m"
            + t
            + f"\033[30;{color}m)\033[0m  {tyre_age}  ({round(wear_rate)}% deg)",
            end="",
            flush=True,
        )

    def print_fuel(self, current_fuel: float, previous_fuel: float) -> None:
        current_color = "32" if current_fuel >= 0 else "31"
        delta_color = "32" if current_fuel - previous_fuel >= 0 else "31"

        print(
            f"  fuel \033[30;{current_color}m{current_fuel:.2f}\033[0m "
            f"(Δ: \033[30;{delta_color}m{current_fuel-previous_fuel:.2f}\033[0m)",
            end="",
            flush=True,
        )

    def print_top_speed(self, speed: int) -> None:
        print(f"  top speed \033[30;34m{speed}\033[0m", end="", flush=True)
