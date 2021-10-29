const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const Airdrop = await hre.ethers.getContractFactory("Airdrop");
    const token = '0x937E077aBaEA52d3abf879c9b9d3f2eBd15BAA21';
    const airdropContract = await Airdrop.deploy(token, contracts['Admin']);
    await airdropContract.deployed();


    console.log("AirdropOH contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropOH3", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
