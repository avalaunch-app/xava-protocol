const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];

    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);

    const tx = await salesFactory.deploySale();
    console.log('Sale deployed.');

    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    console.log('Deployed Sale is: ', lastDeployedSale);

    const numberOfSales = await salesFactory.getNumberOfSalesDeployed();

    const Token = await hre.ethers.getContractFactory("XavaToken");
    const token = await Token.deploy(`MOCK-TEST-${numberOfSales.toString()}`, `MCK-${numberOfSales.toString()}`, ethers.utils.parseEther('200000'), 18);
    await token.deployed();
    console.log("Sale Token deployed to: ", token.address);

    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);

    const totalTokens = ethers.utils.parseEther('2000');
    const tokenPriceInAvax = ethers.utils.parseEther("0.001");

    const signer = await ethers.provider.getSigner();

    const saleOwner = await signer.getAddress();

    const registrationStart = 1629906000;

    const registrationEnd = registrationStart + 360; //6hrs
    const validatorRound = registrationEnd + 360; // 2hrs
    const stakingRound = validatorRound + 360; //
    const publicRound = stakingRound + 360;
    const saleEndTime = publicRound + 360;
    const tokensUnlockTime = saleEndTime + 360;

    await sale.setSaleParams(
        token.address,
        saleOwner,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        tokensUnlockTime
    );

    console.log('Params set.');

    console.log(registrationStart, registrationEnd);

    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );

    console.log('Registration time set.');

    await sale.setRounds(
        [validatorRound, stakingRound, publicRound],
        [ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000')]
    );

    const unlockingTimes = [1629908160, 1629908260, 1629908360, 1629908460, 1629908560, 1629908660, 1629908860];
    const percents = [30,20,17,13,10,5,5];

    await sale.setVestingParams(unlockingTimes, percents);

    console.log('Rounds set.');

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


    await token.approve(sale.address, totalTokens);
    await sale.depositTokens();
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
