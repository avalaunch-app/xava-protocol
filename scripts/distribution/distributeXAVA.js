const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('../utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const wallets = [
        '0x6818eDffA6367e7EE365047BB711AF2E180e9dD3',
        '0x67A776Ce18c5E71abb01273A2971E32469F5Bbe1',
        '0xB4c92006CeFE40E0BFD57cee81A3A95b06Ffa5ff',
        '0x8408656B59758f1bb8dec232C5F62eE7Bfa9A017',
        '0xA4fF8f36E5bD5b1Df9f1Fe261bd68F45db1a1b9E',
        '0x5DE5BDaF5F673bd01D91379b0Fc9386E41F0B177',
        '0x5E1c8C3E8a256F414b4731CC11B796cBc10c7d00',
        '0x7b72Fcc48fF3e534659b74d95b57141E1174Fb59',
        '0xd98b7EC2CF985EdFF3959DE5De5a4bc1F151D70A',
        '0xA57e3dDE79298aDe6d2Ca66032Bd7D636E2387A2',
        '0x25f1c595cd8aA9a9E1eb16AC970b94e13637f1f0',
        '0x339cf62CB6a2E4F87eB1B6b3661F3f6c3a130328',
        '0xc86C61654f3176fDe88963Fc62EbE73324E04412',
        '0x49760D434FE42CB0379EDc5D04Fbbe3909ACc482',
        '0x410C62978a8784709906A084834a71E07e9572D4',
        '0xAf4Dff2bA4234f02bFe187EC55eB58b6bFa630E5',
        '0x76B9E19EBA8e4cD90dd46E642D642813723d626E',
        '0x7Fb3D0b92ADF411b3BC1aaDAe0670eA641b0b9Bc',
        '0xC8Ea6fB14D82F88a8A5075774571d1D4cd1AF00E',
        '0xfB42e80921013200413DeccdBA07C30A39B9D17E',
        '0x9218E2b14A09Cf707a2980f303B967eeE0BC3890',
        '0x0B8eFD8174398222d3F922eb6EbE9375d71C23De',
        '0xf001d3fe81F45Cc47e6cd94c8eA130dDD128a68f',
        '0x98873638a695dc8b5443BdfC704191387d788C9D',
        '0x306A7750f0A861214A4f1413822b6F3A12767E89',
        '0x6d1C24cFC33e2df39223e6bd4d7FA000e3cCA450'
    ];

    console.log('Wallets to receive: ', wallets.length);

    const amount = ethers.utils.parseEther('10');

    const token = await hre.ethers.getContractAt('XavaToken', '0xd1c3f94DE7e5B45fa4eDBBA472491a9f4B166FC4');
    const symbol = await token.symbol();

    for (let i=0; i < wallets.length; i++) {
        let resp = await token.transfer(
            wallets[i],
            amount
        );
        console.log(`${i+1}: Done. Sent 10 ${symbol} to: ${wallets[i]}`);
        console.log(`${i+1}: TxHash:`, resp.hash);
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
