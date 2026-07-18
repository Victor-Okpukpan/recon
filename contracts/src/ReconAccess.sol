// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/access/Ownable.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @title ReconAccess
/// @notice Per-market paywall for Recon Digest. Price is fixed in USD cents but
/// collected in native MON, converted at call time via a Pyth pull-oracle update
/// so the price never depends on a stale hardcoded MON/USD rate.
contract ReconAccess is Ownable {
    struct Receipt {
        uint96 amountPaidWei;
        uint40 paidAt;
        bool paid;
    }

    /// @dev packed into a single slot: hasAccess, getReceipt and the "already paid"
    /// guard in payForAccess all resolve to one cold SLOAD/SSTORE per (marketId, user).
    mapping(bytes32 => mapping(address => Receipt)) private _receipts;

    /// @dev Not immutable — owner-settable via setPythContract. Pyth's own EVM contracts
    /// go through periodic upgrades (e.g. a scheduled Aug 18, 2026 upgrade on Monad
    /// testnet); pointing at a stale address fails price updates with a Wormhole
    /// "invalid guardian set" error, so this needs to be updatable without redeploying.
    IPyth public PYTH;
    bytes32 public immutable MON_USD_PRICE_ID;
    /// @dev Not immutable — owner-settable via setPriceUsdCents, e.g. to adjust for
    /// testnet MON scarcity without redeploying (and losing every existing receipt).
    uint256 public PRICE_USD_CENTS;
    uint256 public constant MAX_PRICE_AGE_SECS = 60;

    event AccessPaid(bytes32 indexed marketId, address indexed user, uint256 amountPaidWei, int64 monUsdPrice, int32 monUsdExpo);
    event PriceUpdated(uint256 oldPriceUsdCents, uint256 newPriceUsdCents);
    event PythContractUpdated(address oldPyth, address newPyth);

    error AlreadyPaid();
    error InsufficientPayment(uint256 required, uint256 sent);
    error InvalidPrice();
    error AmountTooLarge(uint256 amount);

    constructor(address pythContract, bytes32 monUsdPriceId, uint256 priceUsdCents, address initialOwner)
        Ownable(initialOwner)
    {
        PYTH = IPyth(pythContract);
        MON_USD_PRICE_ID = monUsdPriceId;
        PRICE_USD_CENTS = priceUsdCents;
    }

    /// @notice Pay to unlock full Digest for `marketId`. Caller must include fresh
    /// Pyth price update data (fetched off-chain from Hermes) and enough msg.value
    /// to cover both the Pyth update fee and the MON-equivalent of PRICE_USD_CENTS.
    /// Any msg.value above that requirement is kept as contract balance rather than
    /// refunded, so this function makes no outbound value transfer.
    function payForAccess(bytes32 marketId, bytes[] calldata priceUpdateData) external payable {
        if (_receipts[marketId][msg.sender].paid) revert AlreadyPaid();

        uint256 updateFee = PYTH.getUpdateFee(priceUpdateData);
        PYTH.updatePriceFeeds{value: updateFee}(priceUpdateData);

        PythStructs.Price memory p = PYTH.getPriceNoOlderThan(MON_USD_PRICE_ID, MAX_PRICE_AGE_SECS);
        if (p.price <= 0) revert InvalidPrice();

        uint256 required = requiredMonWei(PRICE_USD_CENTS, p.price, p.expo);
        uint256 totalRequired = updateFee + required;
        if (msg.value < totalRequired) revert InsufficientPayment(totalRequired, msg.value);
        if (required > type(uint96).max) revert AmountTooLarge(required);

        // forge-lint: disable-next-line(unsafe-typecast)
        _receipts[marketId][msg.sender] = Receipt({amountPaidWei: uint96(required), paidAt: uint40(block.timestamp), paid: true}); // safe: bounds-checked above

        emit AccessPaid(marketId, msg.sender, required, p.price, p.expo);
    }

    function hasAccess(bytes32 marketId, address user) external view returns (bool) {
        return _receipts[marketId][user].paid;
    }

    function getReceipt(bytes32 marketId, address user) external view returns (Receipt memory) {
        return _receipts[marketId][user];
    }

    /// @notice Converts a USD-cents price into required MON wei given a Pyth price/expo pair.
    /// Exposed as a pure function so the frontend can preview cost from a Hermes-parsed
    /// price without a chain read, using the exact same math the contract enforces.
    function requiredMonWei(uint256 usdCents, int64 monUsdPrice, int32 expo) public pure returns (uint256) {
        if (monUsdPrice <= 0) revert InvalidPrice();
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 price = uint256(uint64(monUsdPrice)); // safe: monUsdPrice > 0 checked above
        if (expo >= 0) {
            // Pyth crypto feeds use negative expo in practice; handle >=0 defensively.
            // forge-lint: disable-next-line(unsafe-typecast)
            return (usdCents * 1e16) / (price * (10 ** uint32(expo))); // safe: expo >= 0 here
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        uint32 negExpo = uint32(uint256(-int256(expo))); // safe: |int32| fits in uint32
        return (usdCents * 1e16 * (10 ** negExpo)) / price;
    }

    /// @notice Updates the unlock price. Owner-only so it can be tuned (e.g. for
    /// testnet MON scarcity) without redeploying and losing every existing receipt.
    function setPriceUsdCents(uint256 newPriceUsdCents) external onlyOwner {
        emit PriceUpdated(PRICE_USD_CENTS, newPriceUsdCents);
        PRICE_USD_CENTS = newPriceUsdCents;
    }

    /// @notice Points at a different Pyth contract, e.g. following one of Pyth's own
    /// EVM contract upgrades. Owner-only.
    function setPythContract(address newPyth) external onlyOwner {
        emit PythContractUpdated(address(PYTH), newPyth);
        PYTH = IPyth(newPyth);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    receive() external payable {}
}
