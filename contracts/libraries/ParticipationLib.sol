// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../sales/SaleVault.sol";

library ParticipationLib {
    using SafeMath for uint256;
    using ECDSA for bytes32;
    // Participation structure
    struct Participation {
        uint256 amountBought;
        uint256 amountAVAXPaid;
        uint256 timeParticipated;
        uint256 roundId;
        bool[] isPortionWithdrawn;
        bool[] isPortionWithdrawnToDexalot;
    }

    // Migrate participation details from user to vault NFT
    function migrate(Participation storage p, SaleVault saleVault) external returns (uint256) {
        // Check if there are portions left to withdraw
        uint256 portionsLeft;

        for (uint256 i = 0; i < p.isPortionWithdrawn.length; i++) {
            if (!p.isPortionWithdrawn[i]) portionsLeft++;
        }

        require(portionsLeft > 0, "All portions withdrawn");

        uint256 vaultId = saleVault.currentId();
        saleVault.mint(msg.sender);
        return vaultId;
    }

    function burn(
        Participation storage p,
        SaleVault saleVault,
        uint256 vaultId
    ) external returns (uint256) {
        // Check if there are portions left to withdraw
        uint256 portionsLeft;

        for (uint256 i = 0; i < p.isPortionWithdrawn.length; i++) {
            if (!p.isPortionWithdrawn[i]) portionsLeft++;
        }

        require(portionsLeft == 0, "Not all portions withdrawn");

        // Burn NFT
        saleVault.burn(vaultId);
    }

    function normalize(Participation storage p)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            bool[] memory,
            bool[] memory
        )
    {
        return (
            p.amountBought,
            p.amountAVAXPaid,
            p.timeParticipated,
            p.roundId,
            p.isPortionWithdrawn,
            p.isPortionWithdrawnToDexalot
        );
    }
}
