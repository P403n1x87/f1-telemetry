const urlParams = new URLSearchParams(window.location.search);

const host = window.location.hostname;
const org = urlParams.get("org")
const token = urlParams.get("token")

let nav = d3.select('#nav');
nav.attr('href', `${nav.attr('href')}?org=${org}&token=${token}&host=${host}`);

function toTimestamp(date) {
    return new Date(date).getTime()
}

function parseSessionId(sessionId, laps) {
    let [date, time, location] = sessionId.split('|');
    return `<span class="location">${location} </span><span class="info">(${laps} lap${laps == 1 ? "" : "s"})</span><br/><span class="info">${date} at ${time}</span>`;
}

function arrayEquals(a, b) {
    return Array.isArray(a) && Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}
