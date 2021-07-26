const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre
const fs = require('fs')
const path = require('path')

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

function getSaved() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, '../snapshot.json'))
    } catch (err) {
        json = '{}'
    }
    return JSON.parse(json)
}

function saveUser(file) {
    fs.writeFileSync(path.join(__dirname, '../snapshot.json'), JSON.stringify(file, null, '    '))
}


async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];
    const sale = await hre.ethers.getContractAt('AvalaunchSale', '0x2b6f9f0B9a8871fafD66e01c1346b7A27d5A4307');

    const admin = await hre.ethers.getContractAt('Admin', contracts['Admin']);
    await admin.addAdmin('0x2655D93eF7FfBF780aB9259825A8bF2b3d8A703A')
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
