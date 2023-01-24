// scripts/upgrade-box.js
const { getSavedContractAddresses } = require('../utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const avalaunchMarketplace = await hre.ethers.getContractAt(
        'AvalaunchMarketplace',
        contracts['AvalaunchMarketplaceProxy']
    );

    let salesFactory = await avalaunchMarketplace.factory();
    console.log(salesFactory);

    await avalaunchMarketplace.setFactory(contracts['SalesFactory']);

    salesFactory = await avalaunchMarketplace.factory();
    console.log(salesFactory);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });