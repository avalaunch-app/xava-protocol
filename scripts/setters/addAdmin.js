const hre = require("hardhat");
const { getSavedContractAddresses } = require('../utils')
const { ethers, web3 } = hre

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];
    const admin = await hre.ethers.getContractAt('Admin', contracts['Admin']);
    await admin.addAdmin('0x094028E04c1FADf12F5a4Fe6C1b9D2062a252a17')
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
