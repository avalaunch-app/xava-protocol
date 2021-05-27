const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const { ethers, web3 } = hre
const BigNumber = ethers.BigNumber

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const startSecond = 1622132697;
    const rewardsPerSecond = ethers.utils.parseEther("2");

    const LPToken = await hre.ethers.getContractFactory("XavaToken");
    const lpToken = await LPToken.deploy('LP mock token', 'LPToken', ethers.utils.parseEther('10000'), 18);
    await lpToken.deployed();
    console.log("LP token deployed to: ", lpToken.address);

    const FarmingXava = await hre.ethers.getContractFactory('FarmingXava');

    const farmingXava = await FarmingXava.deploy(
        contracts["XavaToken"],
        rewardsPerSecond,
        startSecond
    );
    await farm.deployed();

    console.log('FarmingXava deployed: ', farmingXava.address);
    saveContractAddress(hre.network.name, 'FarmingXava', farmingXava.address);

    await farmingXava.addPool(700, lpToken.address, true);
    await farmingXava.addPool(300, contracts['XavaToken'], true);

    const xava = ethers.getContractAt('XavaToken', contracts['XavaToken']);
    let totalRewards = ethers.utils.parseEther("200200");
    await xava.approve(farmingXava.address, totalRewards);
    console.log('Approval for farm done properly.');

    await farmingXava.fund(totalRewards);
    console.log('Funded farm.');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
