const unixTimestampToReadableDate = (timestamp) => {
    return (new Date(timestamp * 1000)).toLocaleString()
}

module.exports = {
    unixTimestampToReadableDate
}