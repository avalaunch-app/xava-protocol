const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");

const delay = ms => new Promise(res => setTimeout(res, ms));
const delayLength = 3000;

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    // Token which is being airdropped
    const tokenAddress = '0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4';

    const numberOfPortions = 26;

    let airdropContract;

    let deployedAirdropContracts = [];

    const tokenInstance = await hre.ethers.getContractAt('IERC20Metadata', tokenAddress);
    const symbol = await tokenInstance.symbol();

    for(let i = 0; i < numberOfPortions; i++) {
        airdropContract = await Airdrop.deploy(tokenAddress, contracts['Admin']);
        await airdropContract.deployed();
        deployedAirdropContracts.push(airdropContract.address);
        console.log(airdropContract.address);
        await delay(delayLength);
        saveContractAddress(hre.network.name, `Airdrop${symbol}-Portion-${i+1}`, airdropContract.address);
    }

    console.log("Vested Airdrop contracts are deployed to the following addresses: ", deployedAirdropContracts);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
