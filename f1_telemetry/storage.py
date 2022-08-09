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
        except:
            raise InfluxDBSinkError("InfluxDB not available")
        self._write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.bucket = bucket

    def __enter__(self):
        self.client.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.client.__exit__(exc_type, exc_value, traceback)

    def write(self, label, fields):
        p = Point(label)

        p._fields.update(fields)
        p.time(datetime.utcnow(), WritePrecision.MS)

        self._write_api.write(bucket=self.bucket, record=p)
