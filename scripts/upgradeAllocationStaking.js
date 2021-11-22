// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses, getSavedProxyABI } = require('./utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxyAdminAbi = getSavedProxyABI()['ProxyAdmin'];

    console.log(proxyAdminAbi);
    const proxyAdmin = await hre.ethers.getContractAt(proxyAdminAbi, contracts['ProxyAdmin']);

    const allocationStakingProxy = contracts["AllocationStakingProxy"];
    console.log("Proxy:", allocationStakingProxy);
    const allocationStakingImplementation = contracts["AllocationStaking"];
    console.log("Implementation:", allocationStakingImplementation);

    await proxyAdmin.upgrade(allocationStakingProxy, allocationStakingImplementation);
    console.log("AllocationStaking contract upgraded");
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
