const fs = require('fs')
const path = require('path')

function getSavedContractAddresses() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, '../deployments/contract-addresses.json'))
    } catch (err) {
        json = '{}'
    }
    const addrs = JSON.parse(json)
    return addrs
}
function getSavedContractABI() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, `../deployments/contract-abis.json`))
    } catch (err) {
        json = '{}'
    }
    return JSON.parse(json)
}

function getSavedProxyABI() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, `../deployments/proxy-abis.json`))
    } catch (err) {
        json = '{}'
    }
    return JSON.parse(json)
}

function saveContractAbi(network, contract, abi) {
    const abis = getSavedContractABI()
    abis[network] = abis[network] || {}
    abis[network][contract] = abi
    fs.writeFileSync(path.join(__dirname, `../deployments/contract-abis.json`), JSON.stringify(abis, null, '    '))
}

function saveContractAddress(network, contract, address) {
    const addrs = getSavedContractAddresses()
    addrs[network] = addrs[network] || {}
    addrs[network][contract] = address
    fs.writeFileSync(path.join(__dirname, '../deployments/contract-addresses.json'), JSON.stringify(addrs, null, '    '))
}

module.exports = {
    getSavedContractAddresses,
    saveContractAddress,
    saveContractAbi,
    getSavedContractABI,
    getSavedProxyABI
}
