const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress} = require('../utils');
const { ethers } = hre;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const SalesFactory = await ethers.getContractFactory("SalesFactory");
    const salesFactory = await SalesFactory.deploy(
        contracts['Admin'], 
        contracts['AllocationStakingProxy'], 
        contracts['AvalaunchCollateralProxy'],
        ZERO_ADDRESS,
        '0x0c3e4509ee2EdD1BE61230BdE49b2FfC7a8ca88b' // Staging mod
    );
    await salesFactory.deployed();

    saveContractAddress(hre.network.name, "SalesFactory", salesFactory.address);
    console.log('Sales factory deployed to: ', salesFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
