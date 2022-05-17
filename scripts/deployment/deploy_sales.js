const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('../utils')
const { redOut, greenOut } = require('../styling');
const config = require("../configs/saleConfig.json");
const { ethers } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const delayLength = 3000;

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];
    const c = config[hre.network.name];

    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    await(await salesFactory.deploySale()).wait();
    console.log('Sale is deployed successfully.');

    await delay(delayLength);

    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    console.log('Deployed Sale address is: ', lastDeployedSale);
    saveContractAddress(hre.network.name, "LatestSale", lastDeployedSale);

    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);
    console.log(`Successfully instantiated sale contract at address: ${lastDeployedSale}.`);

    const totalTokens = ethers.utils.parseEther(c['totalTokens']);
    console.log('Total tokens to sell: ', c['totalTokens']);

    const tokenPriceInAvax = ethers.utils.parseEther(c['tokenPriceInAvax']);
    console.log('Token price in AVAX: ', c['tokenPriceInAvax']);

    const registrationDepositAVAX = ethers.utils.parseEther(c['registrationDepositAVAX']);
    console.log('Registration deposit AVAX is: ', c['registrationDepositAVAX']);

    const saleOwner = c['saleOwner'];
    console.log('Sale owner is: ', c['saleOwner']);

    const registrationStart = c['registrationStartAt'];
    const registrationEnd = registrationStart + c['registrationLength'];
    const validatorRound = registrationEnd + c['delayBetweenRegistrationAndSale'];
    const stakingRound = validatorRound + c['validatorRoundLength'];
    const boosterRound = stakingRound + c['stakingRoundLength'];
    const saleEndTime = boosterRound + c['boosterRoundLength'];

    const tokensUnlockTime = c['TGE'];

    const tokenPriceInUSD = hre.ethers.utils.parseEther(c['tokenPriceInUSD']);

    await(await sale.setSaleParams(
        c['tokenAddress'],
        saleOwner,
        tokenPriceInAvax.toString(),
        totalTokens.toString(),
        saleEndTime,
        c['portionVestingPrecision'],
        c['stakingRoundId'],
        registrationDepositAVAX.toString(),
        tokenPriceInUSD
    )).wait();
    console.log('Sale Params set successfully.');

    await delay(delayLength);

    console.log('Setting registration time.');
    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );
    console.log('Registration time set.');

    await delay(delayLength);

    console.log('Setting rounds.');
    await sale.setRounds(
        [validatorRound, stakingRound, boosterRound],
        [
            ethers.utils.parseEther('7000000000'),
            ethers.utils.parseEther('7000000000'),
            ethers.utils.parseEther('7000000000')
        ]
    );

    const unlockingTimes = c['unlockingTimes'];
    const percents = c['portionPercents'];

    console.log('Unlocking times: ', unlockingTimes);
    console.log('Percents: ', percents);
    console.log('Precision for vesting: ', c['portionVestingPrecision']);
    console.log('Max vesting time shift in seconds: ', c['maxVestingTimeShift']);

    await delay(delayLength);

    console.log('Setting vesting params.');
    await sale.setVestingParams(unlockingTimes, percents, c['maxVestingTimeShift']);
    console.log('Vesting parameters set successfully.');

    await sale.setUpdateTokenPriceInAVAXParams(c['updateTokenPriceInAVAXPercentageThreshold'], c['updateTokenPriceInAVAXTimeLimit']);
    console.log('Token price updating parameters set.');

    // add dexalot portfolio support
    await sale.setAndSupportDexalotPortfolio(c['dexalotPortfolio'], c['dexalotUnlockingTime'])
        .then(() => console.log(greenOut('Dexalot supported.')))
        .catch((err) => console.log(redOut('Dexalot not supported.')));

    console.log({
        saleAddress: lastDeployedSale,
        saleToken: c['tokenAddress'],
        saleOwner,
        tokenPriceInAvax: tokenPriceInAvax.toString(),
        totalTokens: totalTokens.toString(),
        saleEndTime,
        tokensUnlockTime,
        registrationStart,
        registrationEnd,
        validatorRound,
        stakingRound,
        registrationDepositAVAX: c['registrationDepositAVAX'],
        dexalotPortfolio: c['dexalotPortfolio'] || "Not present in config",
        dexalotUnlockingTime: c['dexalotUnlockingTime'] || "Not present in config"
    });

    const collateral = await hre.ethers.getContractAt("AvalaunchCollateral", contracts['AvalaunchCollateralProxy']);
    await collateral.approveSale(sale.address);
    console.log('Sale approved on collateral.');
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
