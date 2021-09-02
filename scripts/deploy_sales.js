const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const config = require("./yay.json");
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];
    const c = config[hre.network.name];

    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    const tx = await salesFactory.deploySale();
    console.log('Sale deployed.');

    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    console.log('Deployed Sale is: ', lastDeployedSale);


    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);
    console.log('Successfully instantiated sale contract.');


    const token = await hre.ethers.getContractAt('XavaToken', c['tokenAddress'])
    console.log('Successfully instantiated sale token contract at address: ', c['tokenAddress']);


    const totalTokens = ethers.utils.parseEther(c['totalTokens']);
    console.log('Total tokens to sell: ', c['totalTokens']);

    const tokenPriceInAvax = ethers.utils.parseEther(c['tokenPriceInAvax']);
    console.log('Token price in AVAX: ', c['tokenPriceInAvax']);


    const saleOwner = c['saleOwner'];
    console.log('Sale owner is: ', c['saleOwner']);

    const registrationStart = c['registrationStartAt'];

    const registrationEnd = registrationStart + c['registrationLength'];
    const validatorRound = registrationEnd + c['delayBetweenRegistrationAndSale'];
    const stakingRound = validatorRound + c['roundLength']; //
    const publicRound = stakingRound + c['roundLength'];
    const saleEndTime = publicRound + c['roundLength'];

    const tokensUnlockTime = c['TGE'];

    await sale.setSaleParams(
        token.address,
        saleOwner,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        tokensUnlockTime,
        c['portionVestingPrecision']
    );

    console.log('Sale Params set successfully.');


    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );

    console.log('Registration time set.');

    await sale.setRounds(
        [validatorRound, stakingRound, publicRound],
        [ethers.utils.parseEther('700000'),ethers.utils.parseEther('700000'),ethers.utils.parseEther('700000')]
    );

    const unlockingTimes = c['unlockingTimes'];
    const percents = c['portionPercents'];

    console.log('Unlocking times: ', unlockingTimes);
    console.log('Percents: ', percents);
    console.log('Precision for vesting: ', c['portionVestingPrecision']);

    await sale.setVestingParams(unlockingTimes, percents);

    console.log('Vesting parameters set successfully.');

    console.log({
        saleAddress: lastDeployedSale,
        saleToken: token.address,
        saleOwner,
        tokenPriceInAvax: tokenPriceInAvax.toString(),
        totalTokens: totalTokens.toString(),
        saleEndTime,
        tokensUnlockTime,
        registrationStart,
        registrationEnd,
        validatorRound,
        stakingRound,
        publicRound
    });
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
