const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    // Add array of ERC20 tokens to distribute (allowed to be empty)
    const tokenAddresses = [];
    // Mark if AVAX airdrop is included
    const includesAVAX = true;
    // Set sale suffix - main token symbol
    const saleSuffix = '';

    const Airdrop = await hre.ethers.getContractFactory("AirdropSale");
    const airdropContract = await Airdrop.deploy(tokenAddresses, contracts['Admin'], includesAVAX);
    await airdropContract.deployed();

    console.log("Airdrop contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, `Airdrop${saleSuffix}`, airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
