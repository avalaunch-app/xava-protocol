pragma solidity ^0.6.12;

/**
 * IAvalaunchSale contract.
 * Date created: 3.3.22.
 */
interface IAvalaunchSale {
    function autoParticipate(
        bytes calldata signature,
        uint256 amount,
        uint256 amountXavaToBurn,
        uint256 roundId,
        address user
    ) external payable;
}
