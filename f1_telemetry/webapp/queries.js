import { InfluxDB } from 'https://cdn.jsdelivr.net/npm/@influxdata/influxdb-client@1.27.0/dist/index.browser.mjs'

const url = `http://${host}:8086`

const influxDB = new InfluxDB({ url, token })

function queryLapData(session, lap, queried) {
    const queryApi = influxDB.getQueryApi(org)

    let [date, t, location] = session.split("|")
    let measurement = `${session}|${lap}`

    var values = {}, time = []
    var minTime = -1
    queryApi.queryRows(
        `from(bucket: "f1-telemetry")
        |> range(start: ${date}T00:00:00Z, stop: ${date}T23:59:59Z)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        `, {
        next(row, tableMeta) {
            const obj = tableMeta.toObject(row)
            const timestamp = toTimestamp(obj._time)
            if (minTime < 0) {
                minTime = timestamp
            }
            else {
                minTime = Math.min(minTime, timestamp)
            }
            var series = values[obj._field]
            if (series == undefined) {
                series = []
                values[obj._field] = series
            }

            series.push(obj._value)

            if (time.length < series.length) {
                time.push(timestamp)
            }
        },
        error(error) {
            console.log('QUERY FAILED: ' + error)
        },
        complete() {
            time = time.map(t => (t - minTime) / 1000)
            queried(time, values)
        },
    });
}

function onSessionSelected(e, session) {
    removePlots();
    removeLaps();
    hideInfo();

    const queryApi = influxDB.getQueryApi(org)

    let data = []

    d3.select('#session_list')
        .selectAll('li')
        .classed("highlighted", false);

    d3.select(this).classed("highlighted", true);

    queryApi.queryRows(
        `import "strings"
        import "influxdata/influxdb/schema"
        schema.measurements(bucket: "f1-telemetry")
        |> filter(fn: (r) => strings.hasPrefix(prefix: "${session}", v: r._value))
        `, {
        next(row, tableMeta) {
            data.push(tableMeta.toObject(row)._value.split("|")[3])
        },
        error(error) {
            log('QUERY FAILED', error)
        },
        complete() {
            var item = d3.select('#lap_list')
                .selectAll('li')
                .data(data)
                ;

            item.enter()
                .append('li')
                .attr('class', 'item')
                .on("click", function onLapSelected(e, lap) {
                    if (d3.select(this).classed("highlighted")) {
                        return;
                    }
                    removePlots();
                    hideInfo();

                    d3.select('#lap_list')
                        .selectAll('li')
                        .classed("highlighted", false);

                    d3.select(this).classed("highlighted", true);

                    queryLapData(session, lap, (time, values) => {
                        setLapData(values);
                        plotLapTraces(time, values);
                        showInfo();
                    })
                })
                .append("div")
                .text(d => d);
        },
    })
}

export function getSessions() {
    const queryApi = influxDB.getQueryApi(org)

    let seenData = {}
    let data = []

    queryApi.queryRows(
        `import "influxdata/influxdb/schema"
        schema.measurements(bucket: "f1-telemetry")`, {
        next(row, tableMeta) {
            if (tableMeta.toObject(row)._value != "live") {
                const sessionId = tableMeta.toObject(row)._value;

                let parts = sessionId.split("|");
                if (parts.length != 4) {
                    return;
                }

                let [date, time, location, lap] = parts;
                let sessionPrefix = `${date}|${time}|${location}`;

                if (seenData[sessionPrefix]) {
                    seenData[sessionPrefix]++;
                    return;
                }

                data.push(sessionPrefix);
                seenData[sessionPrefix] = 1;
            }
        },
        error(error) {
            log('QUERY FAILED', error)
        },
        complete() {
            var item = d3.select('#session_list')
                .selectAll('li')
                .data(data.reverse())
                ;

            item.enter()
                .append('li')
                .attr('class', 'item')
                .on("click", onSessionSelected)
                .append("div")
                .html(d => parseSessionId(d, seenData[d]));
        },
    })
}

