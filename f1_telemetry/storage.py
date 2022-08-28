from datetime import datetime

from influxdb_client import InfluxDBClient
from influxdb_client import Point
from influxdb_client import WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS


class InfluxDBSinkError(Exception):
    pass


class InfluxDBSink:
    def __init__(self, org, token, bucket, url="http://localhost:8086"):
        self.client = InfluxDBClient(url=url, token=token, org=org, debug=False)
        try:
            self.client.ready()
            self._write_api = self.client.write_api(write_options=SYNCHRONOUS)
            self.bucket = bucket
        except:
            self.client = None

    def __enter__(self):
        if self.client is not None:
            self.client.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.client is not None:
            return self.client.__exit__(exc_type, exc_value, traceback)

    @property
    def connected(self):
        return self.client is not None

    def write(self, label, fields):
        if self.client is None:
            return

        p = Point(label)

        p._fields.update(fields)
        p.time(datetime.utcnow(), WritePrecision.MS)

        try:
            self._write_api.write(bucket=self.bucket, record=p)
        except Exception as e:
            # Best effort
            print(f"[ERROR] Cannot write to InfluxDB: {e}")
