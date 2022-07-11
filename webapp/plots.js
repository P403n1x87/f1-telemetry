TRACK_WIDTH = 200;
TRACK_HEIGHT = 200;

var trackData = null;


function scatterPlot(name, raw_data, time, fields, labels, colors = [], yaxis = {}, filled = false) {
    let table = {}

    for (let d in raw_data) {
        let field = raw_data[d]._field
        if (fields.includes(field)) {
            if (table[field] == undefined) {
                table[field] = []
            }
            table[field].push(raw_data[d]._value)
        }
    }

    traces = []
    for (let f in fields) {
        let field = fields[f]
        traces.push({
            x: time,
            y: table[field],
            type: "scatter",
            name: labels[f],
            fill: filled ? 'tozeroy' : 'none',
            line: {
                color: colors[f],
                width: 1
            }

        })
    }

    Plotly.newPlot(name, traces, {
        plot_bgcolor: "rgba(0, 0, 0, 0)",
        paper_bgcolor: "rgba(0, 0, 0, 0)",
        showlegend: false,
        margin: {
            l: 8,
            r: 8,
            t: 8,
            b: 32,
            pad: 16
        },
        hovermode: "x",
        height: 160,
        width: (window.innerWidth - 40) / 2,
        xaxis: {
            showspikes: true,
            spikemode: "across",
            spikesnap: "cursor",
            spikethickness: 1,
            spikedash: "solid",
            spikecolor: "rgb(96, 96, 96)",
            gridwidth: 1,
            gridcolor: "rgb(96, 96, 96)",
        },
        yaxis: yaxis === undefined ? {} : yaxis
    }, {
        displayModeBar: false,
        responsive: true
    });
}



function toTimestamp(date) {
    return new Date(date).getTime()
}

function updateTrackPos(x, z) {
    if (arguments.length == 1) {
        const i = trackData.time.indexOf(x);

        if (i) {
            Plotly.restyle('track', {
                x: [[trackData.pos[i][1]]],
                y: [[trackData.pos[i][0]]]
            }, 1);
        }
    } else {
        Plotly.restyle('track', {
            x: [[z]],
            y: [[x]]
        }, 1);
    }
}

function bindEventHandlers() {
    const track = document.getElementById("track")

    const plots = ["speed", "input", "gears", "tstemp", "titemp"].map(p => document.getElementById(p))

    for (let p in plots) {
        let plot = plots[p]
        plot.on("plotly_hover", function (d) {
            if (d._propagated) return;
            d._propagated = true;
            for (let o in plots) {
                let otherPlot = plots[o]
                if (otherPlot === plot) continue;
                Plotly.Fx.hover(otherPlot, d.event)
                updateTrackPos(d.points[0].x)
            }
        });

        plot.on("plotly_relayout", function (d) {
            if (d._propagated) return;
            d._propagated = true;
            for (let o in plots) {
                let otherPlot = plots[o]
                if (otherPlot === plot) continue;
                Plotly.relayout(otherPlot, d)
            }
        });
    }

    track.on("plotly_hover", function (d) {
        updateTrackPos(d.points[0].y, d.points[0].x)

        for (let p in trackData.pos) {
            let [x, y] = trackData.pos[p]
            if (x == d.points[0].y && y == d.points[0].x) {
                for (let q in plots) {
                    let plot = plots[q]
                    Plotly.Fx.hover(plot, {
                        xval: trackData.time[p]
                    })
                }
                break;
            }
        }
    });
}

function plotTrack(raw_data, time) {
    let data_x = [], data_z = [];

    for (let d in raw_data) {
        switch (raw_data[d]._field) {
            case "world_position_x":
                data_x.push(raw_data[d]._value)
                break;
            case "world_position_z":
                data_z.push(raw_data[d]._value)
                break;
        }
    }

    pos = []
    for (let t in time) {
        pos.push([data_x[t], data_z[t]])
    }

    trackData = {
        pos: pos,
        time: time
    }
    var track = {
        x: data_z,
        y: data_x,
        type: "scattergl",
        name: "track",
        hoverinfo: "none",
        line: {
            color: 'rgb(192, 192, 192)',
            width: 2
        }
    };

    var pos = {
        x: [data_z[0]],
        y: [data_x[0]],
        hoverinfo: "none",
        mode: 'markers',
        name: "position",
        marker: {
            color: 'rgb(128, 128, 192)',
            size: 8
        }
    }

    var data = [track, pos];

    Plotly.newPlot('track', data, {
        autosize: false,
        plot_bgcolor: "rgba(0, 0, 0, 0)",
        paper_bgcolor: "rgba(0, 0, 0, 0)",
        showlegend: false,
        margin: {
            l: 16,
            r: 16,
            b: 16,
            t: 16,
            pad: 16
        },
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        xaxis: {
            visible: false,
            fixedrange: true
        },
        yaxis: {
            scaleanchor: "x",
            scaleratio: 1,
            visible: false,
            fixedrange: true
        },
    }, {
        displayModeBar: false,
        responsive: true
    });
}

function plotInput(raw_data, time) {
    scatterPlot(
        "input",
        raw_data,
        time,
        ["throttle", "brake"],
        ["throttle", "brake"],
        ['rgb(32, 192, 32)', 'rgb(192, 32, 32)'],
        {
            range: [0, 1],
            fixedrange: true,
            showgrid: false
        },
        filled = true
    )
}

function plotSpeed(raw_data, time) {
    scatterPlot(
        "speed",
        raw_data,
        time,
        ["speed"],
        ["speed"],
        ['rgb(192, 192, 32)'],
        yaxis = { showgrid: false },
        filled = true
    )
}

function plotGears(raw_data, time) {
    scatterPlot(
        "gears",
        raw_data,
        time,
        ["gear"],
        ["gear"],
        ['rgb(32, 192, 192)'],
        yaxis = {
            range: [0, 8],
            fixedrange: true,
            showgrid: false
        },
        filled = true
    )
}

function plotTyreSurfaceTemp(raw_data, time) {
    scatterPlot(
        "tstemp",
        raw_data,
        time,
        ["tyres_surface_temperature_fl", "tyres_surface_temperature_fr", "tyres_surface_temperature_rl", "tyres_surface_temperature_rr"],
        ["FL", "FR", "RL", "RR"],
        [],
        { showgrid: false },
    )
}

function plotTyreInnerTemp(raw_data, time) {
    scatterPlot(
        "titemp",
        raw_data,
        time,
        ["tyres_inner_temperature_fl", "tyres_inner_temperature_fr", "tyres_inner_temperature_rl", "tyres_inner_temperature_rr"],
        ["FL", "FR", "RL", "RR"],
        [],
        { showgrid: false },
    )
}
