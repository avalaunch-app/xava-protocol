const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const { ethers, web3 } = hre
const BigNumber = ethers.BigNumber

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const startSecond = 1622314800;

    const rewardsPerSecond = ethers.utils.parseEther("0.5");

    const allocPoints = {
        lp: 400,
        xava: 200,
        placeHolder: 2850
    };

    const FarmingXava = await hre.ethers.getContractFactory('FarmingXava');

    const farmingXava = await FarmingXava.deploy(
        contracts["XavaToken"],
        rewardsPerSecond,
        startSecond
    );
    await farmingXava.deployed();
    console.log('FarmingXava deployed: ', farmingXava.address);
    saveContractAddress(hre.network.name, 'FarmingXava', farmingXava.address);

    await farmingXava.add(allocPoints.lp, contracts['LpToken'], true);
    await farmingXava.add(allocPoints.xava, contracts['XavaToken'], true);
    await farmingXava.add(allocPoints.placeHolder, contracts['DevToken'], true);

    const xava = await hre.ethers.getContractAt('XavaToken', contracts['XavaToken']);
    const devToken = await hre.ethers.getContractAt('DevToken', contracts['DevToken']);

    let totalRewards = ethers.utils.parseEther("500000");
    await xava.approve(farmingXava.address, totalRewards);
    console.log('Approval for farm done properly.');

    const totalSupplyDevToken = ethers.utils.parseEther('10000');
    await devToken.approve(farmingXava.address, totalSupplyDevToken);
    console.log('Dev token successfully approved.');

    await farmingXava.deposit(2, totalSupplyDevToken);
    console.log('Dev token deposited amount: ', totalSupplyDevToken);

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
