function setLapData(data) {
    const totalTime = document.getElementById("total-time")
    const sector1 = document.getElementById("s1")
    const sector2 = document.getElementById("s2")
    const sector3 = document.getElementById("s3")
    const tyreLabel = document.getElementById("tyre-label")
    const tyreCircle = document.getElementById("tyre-circle")
    const tyreAge = document.getElementById("tyre-age")

    tyreCircle.setAttribute("class", "tyre-none");
    tyreLabel.innerHTML = "";
    tyreAge.innerHTML = "";

    let totalLapTime = data["total_time_ms"] || [0]
    totalTime.innerHTML = d3.timeFormat('%M:%S.%L')(new Date(0).setMilliseconds(totalLapTime.at(-1)));

    let s1Time = data["sector_1_ms"] || [0]
    let s2Time = data["sector_2_ms"] || [0]
    let s3Time = data["sector_3_ms"] || [0]

    sector1.innerHTML = d3.timeFormat('%S.%L')(new Date(0).setMilliseconds(s1Time.at(-1)))
    sector2.innerHTML = d3.timeFormat('%S.%L')(new Date(0).setMilliseconds(s2Time.at(-1)))
    sector3.innerHTML = d3.timeFormat('%S.%L')(new Date(0).setMilliseconds(s3Time.at(-1)))

    let compound = data["tyre_compound"] ? data["tyre_compound"][0] : "?";
    tyreLabel.innerHTML = compound.substring(0, 1);
    tyreCircle.setAttribute("class", "tyre-" + compound.toLowerCase());

    let age = data["tyre_age"] ? data["tyre_age"][0] : 0;
    tyreAge.innerHTML = age + (age == 1 ? " LAP" : " LAPS") + " OLD";
}


// --------------------------------------------------------------------------------------------------------------------


function removePlots() {
    d3.selectAll(".plot-svg").remove();
}

function removeLaps() {
    d3.select('#lap_list')
        .selectAll('li')
        .remove()
        ;
}

function hideInfo() {
    d3.select('#info').classed("hidden", true);
}

function showInfo() {
    d3.select('#info').classed("hidden", false);
}

let syncedPlots = [];

function plotLapTraces(time, values) {
    syncedPlots = [];

    const brakeThrottle = [
        {
            name: "throttle",
            label: "Throttle",
            color: "lime",
            width: 2,
        },
        {
            name: "brake",
            label: "Brake",
            color: "tomato",
            width: 2,
        }
    ];
    if (values["rival_throttle"]) {
        brakeThrottle.push({
            name: "rival_throttle",
            label: "Rival Throttle",
            color: "white",
            width: 1,
        });
    }
    if (values["rival_brake"]) {
        brakeThrottle.push({
            name: "rival_brake",
            label: "Rival Brake",
            color: "orchid",
            width: 1,
        });
    }
    syncMultiTimeSeries("input", time, values, brakeThrottle, syncedPlots, { range: [0, 1] });

    const speed = [
        {
            name: "speed",
            label: "Speed",
            color: "aqua",
        },
    ];
    if (values["rival_speed"]) {
        speed.push({
            name: "rival_speed",
            label: "Rival Speed",
            color: "white",
            width: 1,
        });
    }
    syncMultiTimeSeries("speed", time, values, speed, syncedPlots, { range: [0, 350] });

    const gears = [
        {
            name: "gear",
            label: "Gear",
            color: "yellow",
        },
    ];
    if (values["rival_gear"]) {
        gears.push({
            name: "rival_gear",
            label: "Rival Gear",
            color: "white",
            width: 1,
        });
    }
    syncMultiTimeSeries("gears", time, values, gears, syncedPlots, { range: [0, 8] });

    if (values["gap"]) {
        const gap = [
            {
                name: "gap",
                label: "Gap",
                color: "plum",
            },
        ];
        syncMultiTimeSeries("gap", time, values, gap, syncedPlots, {});
    }

    if (values["rival_steer"]) {
        const steer = [
            {
                name: "steer",
                label: "Steer",
                color: "chartreuse",
            },
            {
                name: "rival_steer",
                label: "Rival Steer",
                color: "white",
            },
        ];
        syncMultiTimeSeries("steer", time, values, steer, syncedPlots, { range: [-1, 1] });
    }

    const tyreInnerTemps = [
        {
            name: "tyres_inner_temperature_fl",
            label: "FL",
            color: "cyan",
        },
        {
            name: "tyres_inner_temperature_fr",
            label: "FR",
            color: "chartreuse",
        },
        {
            name: "tyres_inner_temperature_rl",
            label: "RL",
            color: "orange",
        },
        {
            name: "tyres_inner_temperature_rr",
            label: "RR",
            color: "pink",
        }
    ]
    syncMultiTimeSeries("titemp", time, values, tyreInnerTemps, syncedPlots, {});

    const tyreSurfaceTemps = [
        {
            name: "tyres_surface_temperature_fl",
            label: "FL",
            color: "cyan",
        },
        {
            name: "tyres_surface_temperature_fr",
            label: "FR",
            color: "chartreuse",
        },
        {
            name: "tyres_surface_temperature_rl",
            label: "RL",
            color: "orange",
        },
        {
            name: "tyres_surface_temperature_rr",
            label: "RR",
            color: "pink",
        }
    ]
    syncMultiTimeSeries("tstemp", time, values, tyreSurfaceTemps, syncedPlots, {});

    const tyreWears = [
        {
            name: "tyres_wear_fl",
            label: "FL",
            color: "cyan",
        },
        {
            name: "tyres_wear_fr",
            label: "FR",
            color: "chartreuse",
        },
        {
            name: "tyres_wear_rl",
            label: "RL",
            color: "orange",
        },
        {
            name: "tyres_wear_rr",
            label: "RR",
            color: "pink",
        }
    ]
    syncMultiTimeSeries("twear", time, values, tyreWears, syncedPlots, {});

    const tyrePressures = [
        {
            name: "tyres_pressure_fl",
            label: "FL",
            color: "cyan",
        },
        {
            name: "tyres_pressure_fr",
            label: "FR",
            color: "chartreuse",
        },
        {
            name: "tyres_pressure_rl",
            label: "RL",
            color: "orange",
        },
        {
            name: "tyres_pressure_rr",
            label: "RR",
            color: "pink",
        }
    ]
    syncMultiTimeSeries("pressures", time, values, tyrePressures, syncedPlots, {});

    traceTrack(time, values, syncedPlots);
}
