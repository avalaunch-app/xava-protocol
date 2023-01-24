const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress} = require('../utils');
const { ethers } = hre;

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const saleFactory = await ethers.getContractFactory("AvalaunchSaleV2");
    const saleImplementation = await saleFactory.deploy();
    await saleImplementation.deployed();

    saveContractAddress(hre.network.name, "Sale-Implementation", saleImplementation.address);
    console.log('Sale implementation deployed to: ', saleImplementation.address);

    const salesFactory = await ethers.getContractAt("SalesFactory", contracts['SalesFactory']);
    await salesFactory.setImplementation(saleImplementation.address);
    console.log('Sale implementation set on SalesFactory!');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
