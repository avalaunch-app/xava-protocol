//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

interface IAdmin {
    function isAdmin(address user) external view returns (bool);

    function verifySignature(bytes32 _hash, bytes calldata _signature)
        external
        view
        returns (bool);
}
