// scripts/upgrade-box.js
const { ethers } = require("hardhat");
const { getSavedContractAddresses, saveContractAddress, getSavedProxyABI} = require('../utils')
const hre = require("hardhat");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxyAdminAbi = getSavedProxyABI()['ProxyAdmin'];

    const proxyAdmin = await hre.ethers.getContractAt(proxyAdminAbi, contracts['ProxyAdmin']);

    const marketplaceProxy = contracts["AvalaunchMarketplaceProxy"];
    console.log("Proxy:", marketplaceProxy);

    const MarketplaceFactory = await ethers.getContractFactory("AvalaunchMarketplace");
    const marketplaceImplementation = await MarketplaceFactory.deploy();
    await marketplaceImplementation.deployed();

    console.log("New Implementation:", marketplaceImplementation.address);
    saveContractAddress(hre.network.name, "AvalaunchMarketplace", marketplaceImplementation.address);

    await proxyAdmin.upgrade(marketplaceProxy, marketplaceImplementation.address);
    console.log("Marketplace contract upgraded");
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
