const hre = require("hardhat");
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
const { ethers, web3 } = hre

async function getCurrentBlockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {

    const contracts = getSavedContractAddresses()[hre.network.name];


    const salesFactory = await hre.ethers.getContractAt('SalesFactory', contracts['SalesFactory']);
    await salesFactory.setAllocationStaking(contracts['AllocationStaking']);
    const tx = await salesFactory.deploySale();
    console.log('Sale deployed.');

    const lastDeployedSale = await salesFactory.getLastDeployedSale();
    console.log('Deployed Sale is: ', lastDeployedSale);

    const numberOfSales = await salesFactory.getNumberOfSalesDeployed();

    const Token = await hre.ethers.getContractFactory("XavaToken");
    const token = await Token.deploy(`MOCK-SALE-${numberOfSales.toString()}`, `MOCK-SALE-${numberOfSales.toString()}`, ethers.utils.parseEther('5000000'), 18);
    await token.deployed();
    console.log("Sale Token deployed to: ", token.address);

    const sale = await hre.ethers.getContractAt('AvalaunchSale', lastDeployedSale);
    const currentTimestamp = await getCurrentBlockTimestamp();


    const totalTokens = ethers.utils.parseEther('25000');
    const tokenPriceInAvax = ethers.utils.parseEther("0.001");
    const saleOwner = '0x2655D93eF7FfBF780aB9259825A8bF2b3d8A703A';

    const registrationStart = currentTimestamp + 300;
    const registrationEnd = registrationStart + 300;
    const validatorRound = registrationEnd + 120; //
    const stakingRound = validatorRound + 180; // validator round 30 mins
    const publicRound = stakingRound + 180; // Staking round 2 hours
    const saleEndTime = currentTimestamp + 1250;
    const tokensUnlockTime = currentTimestamp + 1350;

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
        [ethers.utils.parseEther('8300'),ethers.utils.parseEther('8300'),ethers.utils.parseEther('8300')]
    );

    console.log('Rounds set.');

    console.log({
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
