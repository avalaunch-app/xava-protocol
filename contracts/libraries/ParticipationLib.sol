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

    function normalize(Participation storage p)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            // bool[] memory,
            // bool[] memory,
            bool,
            uint256,
            uint256
        )
    {
        return (
            p.amountBought,
            p.amountAVAXPaid,
            p.timeParticipated,
            p.roundId,
            // p.isPortionWithdrawn,
            // p.isPortionWithdrawnToDexalot,
            p.isParticipationBoosted,
            p.boostedAmountAVAXPaid,
            p.boostedAmountBought
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
/*
    function boost_(
        Participation storage p,
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) external payable {
        require(msg.sender == address(collateral), "Only collateral contract may call this function.");
        require(admin.isAdmin(tx.origin), "Call must originate from an admin.");
        require(roundId == boosterRoundId && roundId == getCurrentRound(), "Invalid round.");

        // Check user has participated before
        require(isParticipated[user], "User needs to participate first.");

        Participation storage p = userToParticipation[user];
        require(!p.isParticipationBoosted, "User's participation already boosted.");
        // Mark participation as boosted
        p.isParticipationBoosted = true;

        // Compute the amount of tokens user is buying
        uint256 amountOfTokensBuying =
            (msg.value).mul(uint(10) ** IERC20Metadata(address(sale.token)).decimals()).div(sale.tokenPriceInAVAX);


        require(amountOfTokensBuying < amount, "Trying to buy more than allowed.");

        require(
            amountOfTokensBuying <= roundIdToRound[stakingRoundId].maxParticipation,
            "Overflowing maximal participation for this round."
        );

        // Add msg.value to boosted avax paid
        p.boostedAmountAVAXPaid = msg.value;
        // Add amountOfTokensBuying as boostedAmount
        p.boostedAmountBought = amountOfTokensBuying;


        // Increase amount of sold tokens
        sale.totalTokensSold = sale.totalTokensSold.add(amountOfTokensBuying);

        // Increase amount of AVAX raised
        sale.totalAVAXRaised = sale.totalAVAXRaised.add(msg.value);

        // Burn / Redistribute XAVA from this user.
        allocationStakingContract.redistributeXava(
            0,
            user,
            amountXavaToBurn
        );

        // Emit participation boosted event
        emit ParticipationBoosted(user, p.boostedAmountAVAXPaid, p.boostedAmountBought);
    }
*/
}
