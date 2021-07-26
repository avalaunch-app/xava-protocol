const hre = require("hardhat");
const { getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const rewardsToAdd = ethers.utils.parseEther("500");

    // Get instance of Farm V2
    const farm = await hre.ethers.getContractAt('FarmingXava', contracts['FarmingXavaV2']);
    const token = await hre.ethers.getContractAt('XavaToken', contracts['XavaToken']);

    // Approve Farm to take tokens
    await token.approve(farm.address, rewardsToAdd);
    console.log('Approved Farm to take tokens.');

    await farm.fund(rewardsToAdd);
    console.log('Farm fulfilled with more rewards.');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
