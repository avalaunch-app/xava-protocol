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
    const tokenPriceInAvax = ethers.utils.parseEther("0.002");

    const signer = await ethers.provider.getSigner();

    const saleOwner = await signer.getAddress();

    const registrationStart = 1629277200;

    const registrationEnd = registrationStart + 21600; //6hrs
    const validatorRound = registrationEnd + 7200; // 2hrs
    const stakingRound = validatorRound + 10800; //
    const publicRound = stakingRound + 21600;
    const saleEndTime = publicRound + 10800;
    const tokensUnlockTime = saleEndTime + 600;

    await sale.setSaleParams(
        token.address,
        saleOwner,
        tokenPriceInAvax,
        totalTokens,
        saleEndTime,
        tokensUnlockTime
    );

    console.log('Params set.');

    await sale.setRegistrationTime(
        registrationStart,
        registrationEnd
    );

    console.log('Registration time set.');

    await sale.setRounds(
        [validatorRound, stakingRound, publicRound],
        [ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000'),ethers.utils.parseEther('2000')]
    );

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
