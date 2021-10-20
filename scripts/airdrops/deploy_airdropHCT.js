const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses} = require('../../utils')

async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const AirdropHCT = await hre.ethers.getContractFactory("AirdropHCT");
    const hctToken = '0x45c13620b55c35a5f539d26e88247011eb10fdbd';
    const airdropContract = await AirdropHCT.deploy(hctToken, contracts['Admin']);
    await airdropContract.deployed();


    console.log("AirdropHCT contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropHCT", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
