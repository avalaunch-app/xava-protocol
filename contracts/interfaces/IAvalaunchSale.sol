// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

/**
 * IAvalaunchSale contract.
 * Date created: 3.3.22.
 */
interface IAvalaunchSale {
    event TokensSold(address user, uint256 amount);
    event UserRegistered(address user, uint256 roundId);
    event TokenPriceSet(uint256 newPrice);
    event MaxParticipationSet(uint256 roundId, uint256 maxParticipation);
    event TokensWithdrawn(address user, uint256 amount);
    event SaleCreated(
        address saleOwner,
        uint256 tokenPriceInAVAX,
        uint256 amountOfTokensToSell,
        uint256 saleEnd,
        uint256 tokenPriceInUSD
    );
    event RegistrationTimeSet(
        uint256 registrationTimeStarts,
        uint256 registrationTimeEnds
    );
    event RoundAdded(
        uint256 roundId,
        uint256 startTime,
        uint256 maxParticipation
    );
    event RegistrationAVAXRefunded(address user, uint256 amountRefunded);
    event TokensWithdrawnToDexalot(address user, uint256 amount);
    event GateClosed(uint256 time);
    event ParticipationMigrated(address user, uint256 vaultId);
    event VaultBurned(address user, uint256 vaultId);
    event ParticipationBoosted(address user, uint256 amountAVAX, uint256 amountTokens);

    function autoParticipate(
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    ) external payable;

    function boostParticipation(
        address user,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId
    )
    external payable;
}
