const fs = require('fs')
const path = require('path')

function getSavedContractAddresses() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, '../contract-addresses.json'))
    } catch (err) {
        json = '{}'
    }
    const addrs = JSON.parse(json)
    return addrs
}

function saveContractAddress(network, contract, address) {
    const addrs = getSavedContractAddresses()
    addrs[network] = addrs[network] || {}
    addrs[network][contract] = address
    fs.writeFileSync(path.join(__dirname, '../contract-addresses.json'), JSON.stringify(addrs, null, '    '))
}

module.exports = {
    getSavedContractAddresses,
    saveContractAddress,
}
