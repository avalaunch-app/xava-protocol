const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const wallets = [
        '0x237cAE81FB69a40C424F315ec2009157F5880a32','0xfAc9a12C61Fd8784F115c53bF9d6dbd502F07e34','0xf89676d1443B2867d9221066Ed853F1ff281f9F2','0xbEb78f0B3f39e3f3Fc59838a860B2C5b45561d4F','0x464cCB46f2D12950667DdA4025a420DCa7066C3d','0x0341aFBC8c74edEC52Ab52A56a8415370B0fEAa2','0xf7d3168f0cb6F64C284dEA2eEFE72b3D497a525D','0x9E092Bfdf8854179562B3d8F63e00B4C9feDF10a','0x166A0E0DF66Ca33cCc3B97bD83f692Cf83fBd420','0x4ebEE2a376E2dBD0BEb49128aE00D66c98a14f55','0x85CA630b883baDb2f4121faE3C22c11DB1C60757','0xEfcE847D41Ebe1Ced1b7C7212Ce2ea239855a6E1','0x36eAb166cb30E30cBC7dF6071C224fdc9dC4d34F','0x7e9B1AB31a5f7FF1c89DCcB39Bc6760946e2c618','0x93d9b6C68330eE19356052562fAf3781b055CE12','0x0c3e4509ee2EdD1BE61230BdE49b2FfC7a8ca88b','0x8b2d98EDC5e3fAeAeF3d45Cb1D3A7Be2d65A5B72'
    ];

    const amount = ethers.utils.parseEther('800');

    const xavaMock = await hre.ethers.getContractAt('XavaToken', contracts['MOCK-XAVA']);

    for (let i=0; i < wallets.length; i++) {

        await xavaMock.transfer(
            wallets[i],
            amount
        );
        console.log(`Sent 800 MOCK-XAVA to ${wallets[i]}`);
    }


}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
