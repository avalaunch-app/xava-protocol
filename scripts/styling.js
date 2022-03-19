const b = "\x1b[1m";  // Brightness
const u = "\x1b[4m";  // Underline
const g = "\x1b[32m"; // Green
const r = "\x1b[31m"; // Red
const e = "\x1b[0m";  // End style

const greenOut = (text) => {
    return g + text + e;
}

const redOut = (text) => {
    return r + text + e;
}

const boldOut = (text) => {
    return b + text + e;
}

module.exports = {
    b,
    u,
    g,
    r,
    e,
    greenOut,
    redOut,
    boldOut
}
