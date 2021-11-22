// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses } = require('./utils')
const hre = require("hardhat");

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const allocationStaking = await hre.ethers.getContractAt(
        'AllocationStaking',
        contracts['AllocationStakingProxy']
    );

    const payload = await allocationStaking.depositFeePrecision();
    console.log(payload.toString());
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
