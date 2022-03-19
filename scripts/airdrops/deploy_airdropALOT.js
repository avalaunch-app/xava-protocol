const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const token = '0x093783055F9047C2BfF99c4e414501F8A147bC69';
    const airdropContract = await Airdrop.deploy(token, contracts['Admin']);
    await airdropContract.deployed();


    console.log("Airdrop contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropALOT", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
