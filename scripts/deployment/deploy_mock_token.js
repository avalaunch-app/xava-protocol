const hre = require("hardhat");
const { saveContractAddress } = require('../utils')

async function main() {
  const tokenName = "COB - Mock ERC20";
  const symbol = "COB";
  const totalSupply = "2000000000000000000000000";
  const decimals = 18;

  const MCK1 = await hre.ethers.getContractFactory("XavaToken");
  const token = await MCK1.deploy(tokenName, symbol, totalSupply, decimals);
  await token.deployed();
  console.log("COB deployed to: ", token.address);

  saveContractAddress(hre.network.name, "COB-MOCK-TOKEN", token.address);
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
