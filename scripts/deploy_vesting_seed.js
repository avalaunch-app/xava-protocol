const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress } = require('./utils')
const config = require('./config.json');

const delay = ms => new Promise(res => setTimeout(res, ms));


async function main() {

    await hre.run('compile')

    const ParticipationVestingSeed = await hre.ethers.getContractFactory('ParticipationVestingSeed');

    const participationVestingContract = await ParticipationVestingSeed.deploy(
        config[hre.network.name].numberOfPortions,
        config[hre.network.name].timeBetweenPortions,
        config[hre.network.name].distributionStartDate,
        config[hre.network.name].firstPortionUnlock,
        config[hre.network.name].adminWallet,
        getSavedContractAddresses()[hre.network.name]["XavaToken"]
    );

    await participationVestingContract.deployed();
    console.log("Participation Vesting Seed contract deployed to: ", participationVestingContract.address);
    saveContractAddress(hre.network.name, 'ParticipationVestingSeed', participationVestingContract.address);

    const seed = [
        "0xe90950A1B7Ad930d2dfBb3A4cDFD54669dE06B3e",
        "0x2821E2DEcE4150649096644686baac3A73607f46",
        "0x5e08bf95DcDd45B17963DbB7F9271Bb4a8A49194",
        "0xf019675Ce68fe13089EeA5DABDC743c1a1155C0e",
        "0x1D893D40d13254F86becC73ba3f15cA21e9F1A76",
        "0x7B17a951B040644318AD2FFF3F47C9348fF854Cd",
        "0x3A9103378E96CD9179c5fD226044d1e2936d7A59",
        "0x205ecb4dbEf2eC61D6F1B92c4276Cdd7929F503d",
        "0x99D1d7890bfC58Df34eaCA892dFde98Fa6118c44",
        "0x8233484c7648f59086CeEA05f0A8D6a976CdAa75",
        "0xa97e743fC09861a4AB3b38cB7a8F64BDF24EbeaC",
        "0x6167FF49E5F873a5Aeae485dbc1B6f03d8F82bFC",
        "0x773a1FD0f9D8048B0fd24e234feD69495C0fa15b",
        "0x737dE5e58835A7CEfBE3de73f443c885cD245BCb",
        "0x54b5f900014Ed1B842cDb79672b732A21f134fa8",
        "0xe1bAf2857197C89CF7E2738E90beFe2FbB838Ce7"
    ];

    const seedAmounts = [
        '1250000000000000000000000',
        '750000000000000000000000',
        '500000000000000000000000',
        '1250000000000000000000000',
        '1000000000000000000000000',
        '750000000000000000000000',
        '500000000000000000000000',
        '500000000000000000000000',
        '1250000000000000000000000',
        '1250000000000000000000000',
        '750000000000000000000000',
        '750000000000000000000000',
        '1000000000000000000000000',
        '500000000000000000000000',
        '1000000000000000000000000',
        '1025000000000000000000000'
    ];

    const totalTokens = '14025000000000000000000000';

    let token = await hre.ethers.getContractAt('XavaToken', getSavedContractAddresses()[hre.network.name]["XavaToken"]);
    await token.transfer(participationVestingContract.address, totalTokens);
    console.log('Transfer done');

    await participationVestingContract.registerParticipants(
        seed,
        seedAmounts
    );
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
