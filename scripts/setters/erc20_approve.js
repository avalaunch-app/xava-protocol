const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('../utils')
const { ethers, web3 } = hre


async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const amount = ethers.utils.parseEther('720000');
    //Arrow markets token
    const token = await hre.ethers.getContractAt('XavaToken', '0x5c5e384Bd4e36724B2562cCAA582aFd125277C9B');
    // Avalaunch sale.
    const spender = "0xC354D85c24A724FdA55084075fDf25c9e9cf35Aa";

    const resp = await token.approve(
        spender,
        amount
    );

    console.log(`Successfully approved ${spender} to spend ${amount}. \n TxHash: ${resp.hash}`);
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
