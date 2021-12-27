const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const wallets = [
        "0x49Ca181191897E10e15930097D6Ac44592F45B58",
        "0x5318D1490FfE7ef83A1B63E2bB1533378906dfeA",
        "0xECEE8B16C6E24f3c8EAFb460c99F62208CB18b39",
        "0xbfB6a1425Fda2B09CfC761a40eFE536fE0bEf842",
        "0x08FC7cA108FF179FC381cdbB551385a1DaFC3f20",
        "0xAed406313f216dCD1892BdD68540364bb2dDb9a9",
        "0x3F58D93477E6b555f2FE2808b787BF69380ac8a7",
        "0x16108a6EE1C45a0e7D12Af0f934d110Ea11d43E5",
        "0x3e1A1F5a9dc367a82ED2B868e2122c9D48C3F3d7",
        "0xc90d206768131767e3E56ECd8Fb352D4C3F25060",
        "0x5C3D31104036f890195eA380662acA9a1F8Ed70C",
        "0x5e2F141BB237E71f045a497C431144A72b5077A5"
    ];

    console.log('Wallets to receive: ', wallets.length);

    const amount = ethers.utils.parseEther('62500');

    const xavaMock = await hre.ethers.getContractAt('XavaToken', '0x22d4002028f537599be9f666d1c4fa138522f9c8');

    for (let i=0; i < wallets.length; i++) {
        let resp = await xavaMock.transfer(
            wallets[i],
            amount
        );
        console.log(`${i+1}: Done. Sent 75000 PTP to: ${wallets[i]}`);
        console.log(`${i+1}: TxHash:`, resp.hash);
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
