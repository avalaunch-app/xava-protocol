const hre = require("hardhat");
const { saveContractAddress } = require('./utils')

async function main() {
  const tokenName = "MOCK-TOKEN";
  const symbol = "MCK";
  const totalSupply = "1000000000000000000000000000";
  const decimals = 18;

  const MCK1 = await hre.ethers.getContractFactory("XavaToken");
  const token = await MCK1.deploy(tokenName, symbol, totalSupply, decimals);
  await token.deployed();
  console.log("MCK1 deployed to: ", token.address);

  saveContractAddress(hre.network.name, "MOCK-TOKEN", token.address);
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
