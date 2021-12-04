const ethUtil = require("ethereumjs-util");
const {ethers} = require("hardhat");

function generateSignature(digest, privateKey) {
    // prefix with "\x19Ethereum Signed Message:\n32"
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/issues/890
    const prefixedHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(digest));

    // sign message
    const {v, r, s} = ethUtil.ecsign(prefixedHash, Buffer.from(privateKey, 'hex'))

    // generate signature by concatenating r(32), s(32), v(1) in this order
    // Reference: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/76fe1548aee183dfcc395364f0745fe153a56141/contracts/ECRecovery.sol#L39-L43
    const vb = Buffer.from([v]);
    const signature = Buffer.concat([r, s, vb]);

    return signature;
}

function signTokenWithdrawal(beneficiary, amount, contractAddress, privateKey) {
    // compute keccak256(abi.encodePacked(user, roundId, address(this)))
    const digest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ['address', 'uint256', 'address'],
            [beneficiary, amount, contractAddress]
        )
    );

    return generateSignature(digest, privateKey);
}

module.exports = {
    signTokenWithdrawal
}
