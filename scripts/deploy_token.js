const hre = require("hardhat");
const { saveContractAddress } = require('./utils')

async function main() {
  const tokenName = "Avalaunch";
  const symbol = "XAVA";
  const totalSupply = "100000000000000000000000000";
  const decimals = 18;

  const XavaToken = await hre.ethers.getContractFactory("XavaToken");
  const token = await XavaToken.deploy(tokenName, symbol, totalSupply, decimals);
  await token.deployed();
  console.log("Xava Token deployed to: ", token.address);

  saveContractAddress(hre.network.name, "XavaToken", token.address);
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
