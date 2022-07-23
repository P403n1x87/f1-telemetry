const wearScale = d3.scaleLinear().domain([0, 100]).range([0.5, 1]);

function wearColor(value) {
    return d3.color(d3.interpolateTurbo(wearScale(value)))
}

function updateFrontWing(data) {
    const flWingDamage = data["front_left_wing_damage"];
    const frWingDamage = data["front_right_wing_damage"];

    d3.select("#front-wing-l").select("tspan").text(`${flWingDamage}%`);
    d3.select("#front-wing-r").select("tspan").text(`${frWingDamage}%`);

    d3.select("#fl-wing").style("fill", wearColor(flWingDamage).darker());
    d3.select("#fl-wing").style("stroke", wearColor(flWingDamage));

    d3.select("#fr-wing").style("fill", wearColor(frWingDamage).darker());
    d3.select("#fr-wing").style("stroke", wearColor(frWingDamage));
}

function updateTyreWear(data) {
    const flTyreWear = Math.trunc(data["tyres_wear_fl"]);
    const frTyreWear = Math.trunc(data["tyres_wear_fr"]);
    const rlTyreWear = Math.trunc(data["tyres_wear_rl"]);
    const rrTyreWear = Math.trunc(data["tyres_wear_rr"]);

    d3.select("#fl-wear").select("tspan").text(`${flTyreWear}%`);
    d3.select("#fr-wear").select("tspan").text(`${frTyreWear}%`);
    d3.select("#rl-wear").select("tspan").text(`${rlTyreWear}%`);
    d3.select("#rr-wear").select("tspan").text(`${rrTyreWear}%`);

    let scale = d3.scaleLinear().domain([0, 100]).range([0.5, 1]);

    d3.select("#fl-tyre").style("fill", wearColor(flTyreWear).darker());
    d3.select("#fl-tyre").style("stroke", wearColor(flTyreWear));

    d3.select("#fr-tyre").style("fill", wearColor(frTyreWear).darker());
    d3.select("#fr-tyre").style("stroke", wearColor(frTyreWear));

    d3.select("#rl-tyre").style("fill", wearColor(rlTyreWear).darker());
    d3.select("#rl-tyre").style("stroke", wearColor(rlTyreWear));

    d3.select("#rr-tyre").style("fill", wearColor(rrTyreWear).darker());
    d3.select("#rr-tyre").style("stroke", wearColor(rrTyreWear));
}

const tyreTempScale = d3.scaleLinear([0, 200], [0, 1]);

function tyreColor(value) {
    return d3.color(d3.interpolateTurbo(tyreTempScale(value)));
}

function updateTyreTemp(data) {
    const [rl, rr, fl, fr] = data;

    d3.select("#fl-temp").select("tspan").text(`${fl}°C`);
    d3.select("#fr-temp").select("tspan").text(`${fr}°C`);
    d3.select("#rl-temp").select("tspan").text(`${rl}°C`);
    d3.select("#rr-temp").select("tspan").text(`${rr}°C`);

    d3.select("#fl-tyre-temp").style("fill", tyreColor(fl).darker());
    d3.select("#fl-tyre-temp").style("stroke", tyreColor(fl));

    d3.select("#fr-tyre-temp").style("fill", tyreColor(fr).darker());
    d3.select("#fr-tyre-temp").style("stroke", tyreColor(fr));

    d3.select("#rl-tyre-temp").style("fill", tyreColor(rl).darker());
    d3.select("#rl-tyre-temp").style("stroke", tyreColor(rl));

    d3.select("#rr-tyre-temp").style("fill", tyreColor(rr).darker());
    d3.select("#rr-tyre-temp").style("stroke", tyreColor(rr));
}

function updateWeather(data) {
    d3.select("#weather").select("tspan").text(data.weather);
    let forecastGroup = d3.select("#forecast").selectAll("text")

    forecastGroup
        .data(data.forecasts)
        .enter()
        .append("text")
        .merge(forecastGroup)
        .text(d => `${d[0]}m ${d[1]} (${d[2]}%)`)

    forecastGroup.exit().remove();
}

function updateFuel(data) {
    let fuelField = d3.select("#fuel").select("tspan")

    fuelField.text(`${data.toFixed(2)}`);
    fuelField.style("fill", data > 0 ? "lime" : "red");
}

let socket = new WebSocket("ws://localhost:20775");

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

        default:
            console.log("Unknown message type:", message.type);
    }
};

socket.onclose = event => {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] Connection died');
    }
};

socket.onerror = function (error) {
    console.log(`[error] ${error.message}`);
};


testData = {
    front_left_wing_damage: 0,
    front_right_wing_damage: 0,
    tyres_wear_fl: 0,
    tyres_wear_fr: 0,
    tyres_wear_rl: 0,
    tyres_wear_rr: 0,
};


updateFrontWing(testData);
updateTyreWear(testData);
updateTyreTemp([60, 60, 60, 60]);
updateWeather({ weather: "waiting for data ...", forecasts: [] })
updateFuel(0);
