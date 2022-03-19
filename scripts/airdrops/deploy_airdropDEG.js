const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const token = '0x9f285507Ea5B4F33822CA7aBb5EC8953ce37A645';
    const airdropContract = await Airdrop.deploy(token, contracts['Admin']);
    await airdropContract.deployed();


    console.log("Airdrop contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropDEG", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
