// scripts/upgrade-box.js
const { ethers, upgrades } = require("hardhat");
const { getSavedContractAddresses, getSavedProxyABI, saveContractAddress} = require('../utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxyAdminAbi = getSavedProxyABI()['ProxyAdmin'];

    //console.log(proxyAdminAbi);
    const proxyAdmin = await hre.ethers.getContractAt(proxyAdminAbi, contracts['ProxyAdmin']);

    const collateralProxy = contracts["AvalaunchCollateralProxy"];
    console.log("Proxy:", collateralProxy);

    const CollateralFactory = await ethers.getContractFactory("AvalaunchCollateral");
    const collateralImplementation = await CollateralFactory.deploy();
    await collateralImplementation.deployed();

    console.log("New Implementation:", collateralImplementation.address);

    await proxyAdmin.upgrade(collateralProxy, collateralImplementation.address);
    console.log("Collateral contract upgraded");
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
