const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const AirdropAVAX = await hre.ethers.getContractFactory("AirdropAVAX");
    const airdropContract = await AirdropAVAX.deploy(contracts['Admin']);
    await airdropContract.deployed();

    const tokenAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    const tokenInstance = await hre.ethers.getContractAt('IERC20Metadata', tokenAddress);
    const symbol = await tokenInstance.symbol();

    console.log("AirdropAVAX contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, `AirdropAVAX-${symbol}`, airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
