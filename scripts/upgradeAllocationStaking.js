// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses } = require('./utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const AllocationStaking = await ethers.getContractFactory("AllocationStaking");
    console.log('Allocation Staking Proxy: ', contracts['AllocationStakingProxy']);


    const allocationStaking = await upgrades.upgradeProxy(contracts['AllocationStakingProxy'], AllocationStaking);
    console.log("AllocationStaking contract upgraded");
    let proxyAdminContract = await upgrades.admin.getInstance();
    let implementation = await proxyAdminContract.getProxyImplementation(contracts['AllocationStakingProxy']);
    console.log(implementation);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
