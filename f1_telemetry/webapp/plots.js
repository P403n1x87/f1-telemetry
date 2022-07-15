function syncMultiTimeSeries(container, time, values, fields, group, attributes) {
    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 1, bottom: 30, left: 0 },
        width = 460 - margin.left - margin.right,
        height = 160 - margin.top - margin.bottom;

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

    // Process the X data and create the scale
    const minTime = d3.min(time);
    const maxTime = d3.max(time);
    let x = time;

    const xDomain = d3.extent(x)
    const xScale = d3.scaleLinear(xDomain, [0, width]);
    const xAxisGen = d3.axisBottom(xScale)
        .ticks(10)
        .tickFormat(d => d == 0 ? "" : d3.timeFormat('%M:%S')(new Date(0).setSeconds(d)))
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
            const extent = event.selection

            // Lock zooming to force a single loop.
            group.zooming_lock = true;
            group.forEach(p => p.zoom(extent));
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
        var plot = svg.append("path")
            .datum(values[field.name])
            .classed("sync-plot", true)
            .style("filter", "url(#glow)")
            .attr("fill", "none")
            .attr("stroke", field.color)
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x((_, i) => xScale(x[i]))
                .y(d => yScale(d))
            )
            ;

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
            let y = values[field.name];
            let value = arrayEquals(yDomain, [0, 1]) ? `${Math.trunc(y[i] * 100)}%` : Math.trunc(y[i] * 100) / 100;
            valueLabel
                .text(`${field.label} ${value}`)
                .attr("x", x[i] > (maxTime - minTime) / 2 ? - 4 : 4)
                .attr("text-anchor", x[i] > (maxTime - minTime) / 2 ? "end" : "start")
                .attr("transform", `translate(0,${labelScale(y[i])})`)
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
                    .x((_, i) => xScale(x[i]))
                    .y(d => yScale(d))
                );
        }
    };

    svg.name = container;

    // Add the plot to the list of synchronised plots
    group.push(svg);
}


let range = n => [...Array(n).keys()]

function traceTrack(time, data, group) {
    x = data["world_position_x"];
    y = data["world_position_z"];

    let [xMin, xMax] = d3.extent(x);
    let [yMin, yMax] = d3.extent(y);

    let xSize = xMax - xMin;
    let ySize = yMax - yMin;

    const track = d3.select("#track")
    track.selectAll("svg").remove();

    const svg = track.append("svg")
        .attr("viewBox", [xMin - 32, yMin - 32, xSize + 64, ySize + 64])
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

    // Trace the track
    svg.append("path")
        .datum(range(x.length))
        .style("filter", "url(#track-glow)")
        .attr("fill", "none")
        .attr("stroke", "#f0f0f0")
        .attr("stroke-width", 16)
        .attr("d", d3.line()
            .x((_, i) => x[i])
            .y((_, i) => y[i])
        );

    // Add the position bullet
    const point = svg.append("circle")
        .attr("r", 24)
        .style("filter", "url(#track-glow)")
        .style("display", "none")
        .attr("fill", "white")
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

    svg.zoom = extent => { }

    group.push(svg);
}
