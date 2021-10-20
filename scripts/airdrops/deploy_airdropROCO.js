const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require("../utils");


async function main() {
    const contracts = getSavedContractAddresses()[hre.network.name];

    const AirdropROCO = await hre.ethers.getContractFactory("Airdrop");
    const ROCOToken = '0xb2a85C5ECea99187A977aC34303b80AcbDdFa208';
    const airdropContract = await AirdropROCO.deploy(ROCOToken, contracts['Admin']);
    await airdropContract.deployed();


    console.log("AirdropROCO contract is deployed to: ", airdropContract.address);
    saveContractAddress(hre.network.name, "AirdropROCO", airdropContract.address);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
