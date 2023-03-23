var n = 500,
    random = d3.randomUniform(0, 1),
    primaryData = [],
    secondaryData = [];

var svg = d3.select("#live-trace").append("svg");
svg.attr("width", "800");
svg.attr("height", "192");
var margin = { top: 0, right: 0, bottom: 0, left: 0 },
    width = +svg.attr("width") - margin.left - margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// svg.style("background-color", "#404040");

xDomain = [0, n]

var x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

var y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

function makeLine(j) {
    return d3.line()
        .x(function (d, i) { return x(d[0]); })
        .y(function (d, i) { return y(d[j]); });
}

g.append("defs").append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", width)
    .attr("height", height);

let rb = addTrace(secondaryData, "rivalBrakeLine");
let rt = addTrace(secondaryData, "rivalThrottleLine");

let b = addTrace(primaryData, "brakeLine");
let t = addTrace(primaryData, "throttleLine");

function addTrace(data, style) {
    return g.append("g")
        .attr("clip-path", "url(#clip)")
        .append("path")
        .datum(data)
        .attr("class", style)
}

let line1 = makeLine(1);
let line2 = makeLine(2);

function pushTraceData(p, s) {
    while (primaryData.length > 0 && primaryData.at(-1)[0] >= p[0]) {
        primaryData.pop();
    }
    while (secondaryData.length > 0 && secondaryData.at(-1)[0] >= s[0]) {
        secondaryData.pop();
    }

    // Push a new data point onto the back.
    primaryData.push(p);
    secondaryData.push(s);

    // Redraw the line.
    t.attr("d", line1).attr("transform", null);
    b.attr("d", line2).attr("transform", null);
    rt.attr("d", line1).attr("transform", null);
    rb.attr("d", line2).attr("transform", null);

    // Pop the old data point off the front.
    let [lo, hi] = xDomain
    if (primaryData.at(-1)[0] > hi) {
        let delta = primaryData.at(-1)[0] - hi
        xDomain = [lo + delta, hi + delta]
        x = d3.scaleLinear()
            .domain(xDomain)
            .range([0, width]);
    }
    else if (primaryData.at(0)[0] < lo) {
        let delta = lo - primaryData.at(0)[0]
        xDomain = [Math.max(lo - delta, 0), Math.max(hi - delta, n)]
        x = d3.scaleLinear()
            .domain(xDomain)
            .range([0, width]);
    }
    while (primaryData.length > 0 && primaryData.at(0)[0] < lo) {
        primaryData.shift();
    }
    while (secondaryData.length > 0 && secondaryData.at(0)[0] < lo) {
        secondaryData.shift();
    }
}


// Test data

// setInterval(ticker, 100);

// function ticker() {
//     // Push a new data point onto the back.
//     let lo = primaryData.length > 0 ? primaryData.at(-1)[0] : 0;
//     let mo = secondaryData.length > 0 ? secondaryData.at(-1)[0] : 0;
//     if (lo > 4 * n) {
//         lo = 3 * n + 10;
//         mo = lo + 25;
//     }
//     let p = [lo + random(), random(), random()];
//     let s = [mo + random(), random(), random()];
//     pushTraceData(p, s);
// }
