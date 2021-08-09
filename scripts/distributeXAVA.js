const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const wallets = [
        "0x464cCB46f2D12950667DdA4025a420DCa7066C3d","0x4ebEE2a376E2dBD0BEb49128aE00D66c98a14f55","0x93d9b6C68330eE19356052562fAf3781b055CE12","0x3c5843a32920dA42934b0d52aA0f5980da2f3B54","0x46F8779cBD8e3Ef132fFa3AA1cfc3CAC17437D20","0x99a5Dc7b00F58419285Eb0cD3D447f5dA552d2d9","0x48DfF8dF421c208343804579a90a2cB360f145dd","0x05E9d3b044bf812C6845f33FabfFF0509C3290c7","0x519D5fBA523cf4Fa844d28524AC93d80c9c493D2","0x91CA96f95e3f352036E5cC0199A9df410CA3F10a","0x6B90ABcD35BB0E3977bCb2D6f992d6303fa4f927","0x8E02fe775433a704216f5cbb0e0835F3dbeF8e82","0x78a8447e3aB52BdeC9af409c0ad3d5BB4c27C4Cb","0xe3756018b41F19777BEa4e04C894acB5eD352D77","0x6BcCaCFbCaAc44bd84E52A844E9B30eAb40Ad4BB","0x21A8652b81adb2420477Ccd3D156002E43D1BbD3","0xFcCA7C390767b347549e3D2242dd8d30be925c28","0xCD7ebeC46A35fd1e0CaDC367202343e67Ac7C562","0xf25a82A7089b47c278EFB94D78CaC13aAc99867b","0xC1B0e8983B8cD4A5f120D5F14f38Ee8Da5312112","0xb00126BFa30B08014CCc63589b0E8eF0F54799Ee","0x75590093A908d2D413d3caE8c670C13f380668d6","0x5b1c38BFeBC1D71a991D0Cc4f0772DB25F6365e7","0xFF0c80920f69A5D1d8F913065642Af45E8CBadA7","0x7e2a3b38Dc783F852360d73962C604B4b875eD07","0x85a139E8932e0C5CD5314bBDa0E26e07B708fd8E","0x00131601ac5e26219038056144e0b055deA37075","0x9c868F3299E212B46E6E96B951B5A7a17Bff3940","0x9dd6D33dcC532D1278e655c4001E064ac257B2c2","0x2eec1678f7eEb2f0bd41446aea83689D756e5087"
    ];

    const amount = ethers.utils.parseEther('1000');

    const xavaMock = await hre.ethers.getContractAt('XavaToken', contracts['MOCK-XAVA']);

    for (let i=0; i < wallets.length; i++) {
        await xavaMock.transfer(
            wallets[i],
            amount
        );
        console.log(`${i+1}. Sent 1000 MOCK-XAVA to ${wallets[i]}`);
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
