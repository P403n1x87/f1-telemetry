// ---- Elements ----

const frontWingL = d3.select("#front-wing-l").select("tspan");
const frontWingR = d3.select("#front-wing-r").select("tspan");

const flWing = d3.select("#fl-wing");
const frWing = d3.select("#fr-wing");

const flWear = d3.select("#fl-wear").select("tspan");
const frWear = d3.select("#fr-wear").select("tspan");
const rlWear = d3.select("#rl-wear").select("tspan");
const rrWear = d3.select("#rr-wear").select("tspan");

const flTyre = d3.select("#fl-tyre");
const frTyre = d3.select("#fr-tyre");
const rlTyre = d3.select("#rl-tyre");
const rrTyre = d3.select("#rr-tyre");

const flTemp = d3.select("#fl-temp").select("tspan");
const frTemp = d3.select("#fr-temp").select("tspan");
const rlTemp = d3.select("#rl-temp").select("tspan");
const rrTemp = d3.select("#rr-temp").select("tspan");

const flTyreTemp = d3.select("#fl-tyre-temp");
const frTyreTemp = d3.select("#fr-tyre-temp");
const rlTyreTemp = d3.select("#rl-tyre-temp");
const rrTyreTemp = d3.select("#rr-tyre-temp");

const weatherIcon = d3.select("#weather-icon");
const weatherCond = d3.select("#weather-cond");

const fuelField = d3.select("#fuel").select("tspan");

const gapField = d3.select("#gap");

// ---- Scales and colors ----

const wearScale = d3.scaleLinear().domain([0, 100]).range([0.5, 1]);
const tyreTempScale = d3.scaleLinear([0, 200], [0, 1]);
const gapScale = d3.scaleLinear([3, -3], [0.25, 0.75]);

function wearColor(value) {
    return d3.color(d3.interpolateTurbo(wearScale(value)))
}

function tyreColor(value) {
    return d3.color(d3.interpolateTurbo(tyreTempScale(value)));
}

function gapColor(value) {
    return d3.color(d3.interpolateBrBG(gapScale(value)));
}

// ---- Updaters ----

function updateFrontWing(data) {
    const flWingDamage = data["front_left_wing_damage"];
    const frWingDamage = data["front_right_wing_damage"];

    frontWingL.text(`${flWingDamage}%`);
    frontWingR.text(`${frWingDamage}%`);

    flWing.style("fill", wearColor(flWingDamage).darker());
    flWing.style("stroke", wearColor(flWingDamage));

    frWing.style("fill", wearColor(frWingDamage).darker());
    frWing.style("stroke", wearColor(frWingDamage));
}

function updateTyreWear(data) {
    const flTyreWear = Math.trunc(data["tyres_wear_fl"]);
    const frTyreWear = Math.trunc(data["tyres_wear_fr"]);
    const rlTyreWear = Math.trunc(data["tyres_wear_rl"]);
    const rrTyreWear = Math.trunc(data["tyres_wear_rr"]);

    flWear.text(`${flTyreWear}%`);
    frWear.text(`${frTyreWear}%`);
    rlWear.text(`${rlTyreWear}%`);
    rrWear.text(`${rrTyreWear}%`);

    flTyre.style("fill", wearColor(flTyreWear).darker());
    flTyre.style("stroke", wearColor(flTyreWear));

    frTyre.style("fill", wearColor(frTyreWear).darker());
    frTyre.style("stroke", wearColor(frTyreWear));

    rlTyre.style("fill", wearColor(rlTyreWear).darker());
    rlTyre.style("stroke", wearColor(rlTyreWear));

    rrTyre.style("fill", wearColor(rrTyreWear).darker());
    rrTyre.style("stroke", wearColor(rrTyreWear));
}

function updateTyreTemp(data) {
    const [rl, rr, fl, fr] = data;

    flTemp.text(`${fl}°C`);
    frTemp.text(`${fr}°C`);
    rlTemp.text(`${rl}°C`);
    rrTemp.text(`${rr}°C`);

    flTyreTemp.style("fill", tyreColor(fl).darker());
    flTyreTemp.style("stroke", tyreColor(fl));

    frTyreTemp.style("fill", tyreColor(fr).darker());
    frTyreTemp.style("stroke", tyreColor(fr));

    rlTyreTemp.style("fill", tyreColor(rl).darker());
    rlTyreTemp.style("stroke", tyreColor(rl));

    rrTyreTemp.style("fill", tyreColor(rr).darker());
    rrTyreTemp.style("stroke", tyreColor(rr));
}

function updateWeather(data) {
    weatherIcon.text(data.weather[0]);
    weatherCond.text(data.weather[1]);

    for (let i = 0; i < 4; i++) {
        const forecast = data.forecasts[i];
        let j = i + 1;
        d3.select(`#forecast${j}-icon`).text(forecast ? forecast[1] : "");
        d3.select(`#forecast${j}-cond`).text(forecast ? forecast[2] : "no data");
        d3.select(`#forecast${j}-offset`).text(forecast ? `+${forecast[0]}m` : "");
        d3.select(`#forecast${j}-pp`).text(forecast ? `${forecast[3]}%` : "");
    }
    for (let i = 0; i < 4; i++) {
        const forecast = data.nforecasts[i];
        d3.select(`#nforecast${i + 1}`).text(forecast || "");
    }
}

function updateFuel(data) {
    fuelField.text(`${data.toFixed(2)}`);
    fuelField.style("fill", data > 0 ? "lime" : "red");
}

function updateGap(data) {
    gapField.text(`${data.toFixed(2)}`);
    gapField.style("color", gapColor(data));
}

function updateTrace(data) {
    pushTraceData(
        [data.distance, data.throttle, data.brake],
        [data.rival_distance, data.rival_throttle, data.rival_brake]
    );
}

// ---- WebSocket ----

let socket = new WebSocket(`ws://${host}:20775`);

socket.onopen = event => {
    console.log("[open] Connection established");
};

socket.onmessage = event => {
    message = JSON.parse(event.data);

    switch (message.type) {
        case "car_status":
            updateFrontWing(message.data);
            updateTyreWear(message.data);
            break;

        case "tyre_temp":
            updateTyreTemp(message.data);
            break;

        case "weather_data":
            updateWeather(message.data);
            break;

        case "fuel":
            updateFuel(message.data);
            break;

        case "trace":
            updateTrace(message.data);
            updateGap(message.data.gap);
            break;

        default:
            console.log("Unknown message type:", message.type);
    }
};

socket.onclose = event => {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died');
    }
};

socket.onerror = function (error) {
    console.log(`[error] ${error.message}`);
};


// ---- UI primer ----

initData = {
    front_left_wing_damage: 0,
    front_right_wing_damage: 0,
    tyres_wear_fl: 0,
    tyres_wear_fr: 0,
    tyres_wear_rl: 0,
    tyres_wear_rr: 0,
};

initForecast = [
    [5, "☀️", "Clear", 0],
    [10, "☀️", "Clear", 0],
    [15, "☀️", "Clear", 0],
    [30, "☀️", "Clear", 0]
]

initNForecast = ["☀️", "☀️", "☀️", "☀️"]

updateFrontWing(initData);
updateTyreWear(initData);
updateTyreTemp([60, 60, 60, 60]);
updateWeather({ weather: ["☀️", "Clear"], forecasts: initForecast, nforecasts: initNForecast })
updateFuel(0);
updateGap(0);
