function toTimestamp(date) {
    return new Date(date).getTime()
}

function parseSessionId(sessionId) {
    let dateIndex = (sessionId.indexOf("#") + 1) || (sessionId.indexOf(":") + 1);
    let timeIndex = sessionId.indexOf("@") + 1;

    if (timeIndex < dateIndex) {
        dateIndex = 0;
    }

    let location = sessionId.substring(0, dateIndex - 1).toUpperCase() || "Unknown location";
    let date = d3.timeFormat("%d %b %Y")(new Date(sessionId.substring(dateIndex, timeIndex - 1)));
    let time = sessionId.substring(timeIndex);

    return `<span class="location">${location}</span><br/><span class="datetime">${date} at ${time}</span>`;
}

function arrayEquals(a, b) {
    return Array.isArray(a) && Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}
