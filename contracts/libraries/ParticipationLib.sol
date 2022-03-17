// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../sales/SaleVault.sol";
import "../libraries/VestingLib.sol";

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
        bool isParticipationBoosted;
        uint256 boostedAmountAVAXPaid;
        uint256 boostedAmountBought;
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

    function setPortionWithdrawn(
        Participation storage p,
        VestingLib.VestingConfig storage vestingConfig,
        uint256 portionId
    ) external returns (uint256) {
        require(portionId < vestingConfig.vestingPercentPerPortion.length, "Portion id out of range.");
        require(!p.isPortionWithdrawn[portionId], "Portion already withdrawn.");
        if (portionId > 0) {
            require(vestingConfig.vestingPortionsUnlockTime[portionId] <= block.timestamp, "Portion not unlocked yet.");
        }
        p.isPortionWithdrawn[portionId] = true;
        return
            p.amountBought.mul(vestingConfig.vestingPercentPerPortion[portionId]).div(
                vestingConfig.portionVestingPrecision
            );
    }

    function boost(
        Participation storage p,
        uint256 boostedAmountAVAXPaid,
        uint256 amountOfTokensBuying
    ) external {
        require(!p.isParticipationBoosted, "User's participation already boosted.");
        // Mark participation as boosted
        p.isParticipationBoosted = true;
        // Add msg.value to boosted avax paid
        p.boostedAmountAVAXPaid = boostedAmountAVAXPaid;
        // Add amountOfTokensBuying as boostedAmount
        p.boostedAmountBought = amountOfTokensBuying;
    }
}
