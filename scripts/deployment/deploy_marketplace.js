const hre = require("hardhat");
const { saveContractAddress} = require('../utils');

async function main() {
    const marketplaceFactory = await hre.ethers.getContractFactory("AvalaunchMarketplace");
    const marketplace = await marketplaceFactory.deploy();
    await marketplace.deployed();

    console.log(`Marketplace implementation address: ${marketplace.address}`);
    saveContractAddress(hre.network.name, "AvalaunchMarketplace", marketplace.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
