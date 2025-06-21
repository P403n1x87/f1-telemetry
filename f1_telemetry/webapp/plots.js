function syncMultiTimeSeries(container, time, values, fields, group, attributes) {
    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 1, bottom: 30, left: 0 },
        width = 460 - margin.left - margin.right,
        height = (values["rival_distance"] === undefined ? 160 : 120) - margin.top - margin.bottom;

    // append the svg object to the body of the page
    const parent = d3.select(`#${container}`)
    parent.select("svg").remove();
    const svg = parent.append("svg")
        .classed("plot-svg", true)
        .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
        .on("pointerenter pointermove", event => group.forEach(p => p.moveLine(d3.bisectCenter(x, xScale.invert(d3.pointer(event)[0])))))
        .on("pointerleave", () => group.forEach(p => p.hideLine()))
        ;

    // add glow filter
    var defs = svg.append("defs");

    //Filter for the outside glow
    var filter = defs.append("filter")
        .attr("id", "glow");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "2")
        .attr("result", "coloredBlur");
    var feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "coloredBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    let x = values["distance"];
    let rivalX = values["rival_distance"] || x;

    // Process the X data and create the scale
    const minX = d3.min([d3.min(x), d3.min(rivalX)]);
    const maxX = d3.max([d3.max(x), d3.max(rivalX)]);

    const xDomain = [minX, maxX];
    const xScale = d3.scaleLinear(xDomain, [0, width]);
    const xAxisGen = d3.axisBottom(xScale)
        .ticks(10)
        // .tickFormat(d => d)
        ;
    const xAxis = svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .classed("axis", true)
        .style("filter", "url(#glow)")
        .call(xAxisGen)
        ;

    // Create the Y scale
    var yDomain = attributes.range;
    if (!yDomain) {
        let mins = []
        let maxs = []
        for (let i in fields) {
            let field = fields[i];
            mins.push(d3.min(values[field.name]));
            maxs.push(d3.max(values[field.name]));
        }
        let min = d3.min(mins);
        let max = d3.max(maxs);
        let delta = (max - min) / 10;
        yDomain = [min - delta, max + delta];
    }
    const yScale = d3.scaleLinear(yDomain, [height, 0]);

    // Create the X brush for zooming
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", (event, d) => {
            if (group.zooming_lock)
                return;

            let i = 0;
            let j = x.length - 1;

            const extent = event.selection
            if (extent) {
                const [a, b] = extent
                i = d3.bisectCenter(x, xScale.invert(a));
                j = d3.bisectCenter(x, xScale.invert(b));
            }

            // Lock zooming to force a single loop.
            group.zooming_lock = true;
            group.forEach(p => p.zoom(extent, [i, j]));
            group.zooming_lock = false;
        })
        ;

    svg.append("g")
        .classed("brush", true)
        .call(brush);

    let plots = [];

    for (let i in fields) {
        const field = fields[i];
        // Add the plot
        let rival = field.name.startsWith("rival");
        var plot = svg.append("path")
            .datum(values[field.name])
            .classed("sync-plot", true)
            .style("filter", "url(#glow)")
            .attr("fill", "none")
            .attr("stroke", field.color)
            .attr("stroke-width", field.width || 1.5)
            .attr("d", d3.line()
                .x((_, i) => xScale(rival ? rivalX[i] : x[i]))
                .y(d => yScale(d))
            )
            ;

        plot.rival = rival;

        plots.push(plot);
    }


    // Create the synchronised vertical line + label group
    const vLine = svg.append("g")
        .classed("v-line", true)
        .style("display", "none")
        ;

    // Create the vertical line
    vLine.append("path")
        .datum(yDomain)
        .attr("fill", "none")
        .attr("stroke", "grey")
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .x(_ => xScale(0))
            .y(d => yScale(d))
        )

    let labels = []

    for (let i in fields) {
        const field = fields[i];
        // Create the vertical line label
        const valueLabel = vLine.append("text")
            .text("0")
            .style("filter", "url(#glow)")
            .attr("x", 0)
            .attr("y", 0)
            .attr("fill", field.color)
            ;
        labels.push(valueLabel);
    }

    // The vertical line move event
    const labelScale = d3.scaleLinear(yDomain, [height - 6, 12]);
    svg.moveLine = i => {
        vLine
            .style("display", null)
            .attr("transform", `translate(${xScale(x[i])},0)`)
            ;

        for (let j in labels) {
            let valueLabel = labels[j];
            let field = fields[j];
            if (field.name.startsWith("rival")) {
                i = d3.bisectCenter(rivalX, x[i]);
            }
            let y = values[field.name];
            let value = arrayEquals(yDomain, [0, 1]) ? `${Math.trunc(y[i] * 100)}%` : Math.trunc(y[i] * 100) / 100;
            valueLabel
                .text(`${field.label} ${value}`)
                .attr("x", x[i] > (maxX - minX) / 2 ? - 4 : 4)
                .attr("text-anchor", x[i] > (maxX - minX) / 2 ? "end" : "start")
                .attr("transform", `translate(0,${labelScale(y[i]) || height})`)
                .attr("font-family", "F1")
                .attr("font-size", 12)
                ;
        }
    }

    // The vertical line hide event
    svg.hideLine = () => {
        vLine.style("display", "none");
    }

    svg.zoom = extent => {
        // If no selection, back to initial coordinate. Otherwise, update X axis domain
        if (!extent) {
            xScale.domain(xDomain)
        } else {
            xScale.domain(d3.map(extent, xScale.invert))
            svg.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
        }

        // Update axis and plot
        xAxis.transition().duration(1000).call(xAxisGen);
        for (let i in plots) {
            plot = plots[i];
            plot.transition().duration(1000)
                .attr("d", d3.line()
                    .x((_, i) => xScale(plot.rival ? rivalX[i] : x[i]))
                    .y(d => yScale(d))
                );
        }
    };

    svg.name = container;

    // Add the plot to the list of synchronised plots
    group.push(svg);
}


let range = n => [...Array(n).keys()]
const TRACK_PADDING = 32;

function traceTrack(time, data, group) {
    x = data["world_position_x"];
    y = data["world_position_z"];

    rivalX = data["rival_world_position_x"];
    rivalY = data["rival_world_position_z"];


    let [xMin, xMax] = d3.extent(x);
    let [yMin, yMax] = d3.extent(y);

    let [xMin2, xMax2] = rivalX ? d3.extent(rivalX) : [xMin, xMax];
    let [yMin2, yMax2] = rivalY ? d3.extent(rivalY) : [yMin, yMax];

    xMin = Math.min(xMin, xMin2);
    xMax = Math.max(xMax, xMax2);
    yMin = Math.min(yMin, yMin2);
    yMax = Math.max(yMax, yMax2);

    let xSize = xMax - xMin;
    let ySize = yMax - yMin;

    const track = d3.select("#track")
    track.selectAll("svg").remove();

    const svg = track.append("svg")
        .attr("viewBox", [
            xMin - TRACK_PADDING,
            yMin - TRACK_PADDING,
            xSize + TRACK_PADDING * 2,
            ySize + TRACK_PADDING * 2
        ])
        ;

    // add glow filter
    var defs = svg.append("defs");

    var filter = defs.append("filter")
        .attr("id", "track-glow");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "36")
        .attr("result", "coloredBlur");
    var feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
        .attr("in", "coloredBlur");
    feMerge.append("feMergeNode")
        .attr("in", "SourceGraphic");

    if (rivalX && rivalY) {
        // Trace the rival track
        svg.append("path")
            .datum(range(rivalX.length))
            .style("filter", "url(#track-glow)")
            .attr("fill", "none")
            .attr("stroke", "#d1d17f")
            .attr("opacity", 0.5)
            .attr("stroke-width", 16)
            .attr("d", d3.line()
                .x((_, i) => rivalX[i])
                .y((_, i) => rivalY[i])
            );
    }

    // Trace the track
    svg.append("path")
        .datum(range(x.length))
        .style("filter", "url(#track-glow)")
        .attr("fill", "none")
        .attr("stroke", "#f0f0f0")
        .attr("opacity", 0.5)
        .attr("stroke-width", 16)
        .attr("d", d3.line()
            .x((_, i) => x[i])
            .y((_, i) => y[i])
        );

    // Add the position bullet
    const point = svg.append("circle")
        .attr("r", 32)
        .style("filter", "url(#track-glow)")
        .style("display", "none")
        .attr("fill", "powderblue")
        ;

    svg.moveLine = i => {
        point.style("display", null)
            .attr("cx", x[i])
            .attr("cy", y[i])
            ;
    }

    svg.hideLine = () => {
        point.style("display", "none");
    }

    svg.zoom = (_, interval) => {
        let [i, j] = interval;
        let [xMin, xMax] = d3.extent(x.slice(i, j));
        let [yMin, yMax] = d3.extent(y.slice(i, j));
        let xSize = xMax - xMin;
        let ySize = yMax - yMin;
        svg.transition()
            .duration(1000)
            .attr("viewBox", [
                xMin - TRACK_PADDING,
                yMin - TRACK_PADDING,
                xSize + TRACK_PADDING * 2,
                ySize + TRACK_PADDING * 2
            ])
            ;
    }

    group.push(svg);
}
