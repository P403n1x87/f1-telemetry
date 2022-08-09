from argparse import ArgumentParser
from threading import Thread

from f1.listener import PacketListener

from f1_telemetry import live
from f1_telemetry.collector import TelemetryCollector
from f1_telemetry.server import serve
from f1_telemetry.storage import InfluxDBSink
from f1_telemetry.storage import InfluxDBSinkError


DEFAULT_BUCKET = "f1-telemetry"


def main():
    argp = ArgumentParser(prog="f1-tel")

    argp.add_argument("org", help="InfluxDB Org", type=str)
    argp.add_argument("token", help="InfluxDB Token", type=str)
    argp.add_argument(
        "-b", "--bucket", help="InfluxDB Bucket", type=str, default=DEFAULT_BUCKET
    )

    args = argp.parse_args()

    collector = None

    try:
        with InfluxDBSink(org=args.org, token=args.token, bucket=args.bucket) as sink:
            print("Connected to InfluxDB")

            listener = PacketListener()
            collector = TelemetryCollector(listener, sink)

            server_thread = Thread(target=serve, args=(args.org, args.token))
            server_thread.daemon = True
            server_thread.start()

            print("Listening for telemetry data ...")
            collector_thread = Thread(target=collector.collect)
            collector_thread.daemon = True
            collector_thread.start()

            print("Starting live data websocket server")
            # FIXME: Mixing asyncio and threads is yuck!
            live.serve()

    except InfluxDBSinkError as e:
        print("Error:", e)

    except KeyboardInterrupt:
        if collector is not None:
            collector.flush()
        print("\nBOX BOX.")


if __name__ == "__main__":
    main()
