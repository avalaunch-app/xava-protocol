// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses } = require('../utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const allocationStaking = await hre.ethers.getContractAt(
        'AllocationStaking',
        contracts['AllocationStakingProxy']
    );

    let salesFactory = await allocationStaking.salesFactory();
    console.log(salesFactory);

    await allocationStaking.setSalesFactory(contracts['SalesFactory']);

    salesFactory = await allocationStaking.salesFactory();
    console.log(salesFactory);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
