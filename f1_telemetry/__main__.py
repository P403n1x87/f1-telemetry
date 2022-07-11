from argparse import ArgumentParser
from f1.listener import PacketListener
from f1_telemetry.collector import TelemetryCollector
from f1_telemetry.storage import InfluxDBSink


DEFAULT_BUCKET = "f1-telemetry"


def main():
    argp = ArgumentParser(prog="f1-tel")

    argp.add_argument("org", help="InfluxDB Org", type=str)
    argp.add_argument("token", help="InfluxDB Token", type=str)
    argp.add_argument(
        "-b", "--bucket", help="InfluxDB Bucket", type=str, default=DEFAULT_BUCKET
    )

    args = argp.parse_args()

    try:
        with InfluxDBSink(org=args.org, token=args.token, bucket=args.bucket) as sink:
            print("Connected to InfluxDB")
            listener = PacketListener()
            collector = TelemetryCollector(listener, sink)

            print("Listening for telemetry data ...")
            collector.collect()

    except KeyboardInterrupt:
        print("\nBOX BOX.")


if __name__ == "__main__":
    main()
