const hre = require("hardhat");
const { getSavedContractAddresses } = require('./utils');
const config = require('./saleConfig.json');

async function main() {
    const c = config[hre.network.name];
    const allocationStakingProxyAddress = getSavedContractAddresses()[hre.network.name]["AllocationStaking"];
    const allocationStakingProxy = await hre.ethers.getContractAt("AllocationStaking", allocationStakingProxyAddress);



    await allocationStakingProxy.setPostSaleWithdrawPenaltyPercentAndLength(
        c.postSaleWithdrawPenaltyPercent,
        c.postSaleWithdrawPenaltyLength
    );
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
});
