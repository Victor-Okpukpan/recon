// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReconAccess} from "../src/ReconAccess.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract ReconAccessTest is Test {
    MockPyth mockPyth;
    ReconAccess recon;

    bytes32 constant FEED_ID = bytes32(uint256(1));
    uint256 constant PRICE_USD_CENTS = 100; // $1.00 per market unlock
    address owner = address(this);
    address user = address(0xBEEF);

    // $1.00 per MON, expo -8, so PRICE_USD_CENTS of 100 == exactly 1 MON.
    int64 constant MON_PRICE = 100_000_000;
    int32 constant MON_EXPO = -8;

    function setUp() public {
        mockPyth = new MockPyth(60, 1 wei);
        recon = new ReconAccess(address(mockPyth), FEED_ID, PRICE_USD_CENTS, owner);
        vm.deal(user, 10 ether);
    }

    function _updateData(int64 price, uint64 publishTime) internal view returns (bytes[] memory data) {
        data = new bytes[](1);
        data[0] = mockPyth.createPriceFeedUpdateData(
            FEED_ID, price, 1000, MON_EXPO, price, 1000, publishTime, publishTime == 0 ? 0 : publishTime - 1
        );
    }

    function test_RequiredMonWei_OneDollarPerMon() public view {
        assertEq(recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO), 1 ether);
    }

    function test_RequiredMonWei_HalfDollarPerMon() public view {
        // at $0.50/MON, $1.00 unlock costs 2 MON
        assertEq(recon.requiredMonWei(PRICE_USD_CENTS, 50_000_000, MON_EXPO), 2 ether);
    }

    function test_PayForAccess_Success() public {
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);
        bytes32 marketId = bytes32(uint256(42));

        vm.prank(user);
        recon.payForAccess{value: fee + required}(marketId, data);

        assertTrue(recon.hasAccess(marketId, user));
        ReconAccess.Receipt memory r = recon.getReceipt(marketId, user);
        assertEq(r.amountPaidWei, required);
        assertEq(r.paidAt, block.timestamp);
        assertTrue(r.paid);
    }

    function test_RevertWhen_InsufficientPayment() public {
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);
        bytes32 marketId = bytes32(uint256(42));

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ReconAccess.InsufficientPayment.selector, fee + required, fee + required - 1));
        recon.payForAccess{value: fee + required - 1}(marketId, data);
    }

    function test_RevertWhen_AlreadyPaid() public {
        bytes32 marketId = bytes32(uint256(42));
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);

        vm.prank(user);
        recon.payForAccess{value: fee + required}(marketId, data);

        vm.prank(user);
        vm.expectRevert(ReconAccess.AlreadyPaid.selector);
        recon.payForAccess{value: fee + required}(marketId, data);
    }

    function test_RevertWhen_PriceStale() public {
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);
        bytes32 marketId = bytes32(uint256(42));

        skip(120); // past MAX_PRICE_AGE_SECS (60s) and MockPyth's own validTimePeriod (60s)

        vm.prank(user);
        vm.expectRevert();
        recon.payForAccess{value: fee + required}(marketId, data);
    }

    function test_DifferentMarketsAndUsersAreIndependent() public {
        bytes32 marketA = bytes32(uint256(1));
        bytes32 marketB = bytes32(uint256(2));
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);

        vm.prank(user);
        recon.payForAccess{value: fee + required}(marketA, data);

        assertTrue(recon.hasAccess(marketA, user));
        assertFalse(recon.hasAccess(marketB, user));
        assertFalse(recon.hasAccess(marketA, address(0xCAFE)));
    }

    function test_Withdraw_OnlyOwner() public {
        bytes[] memory data = _updateData(MON_PRICE, uint64(block.timestamp));
        uint256 fee = mockPyth.getUpdateFee(data);
        uint256 required = recon.requiredMonWei(PRICE_USD_CENTS, MON_PRICE, MON_EXPO);
        bytes32 marketId = bytes32(uint256(42));

        vm.prank(user);
        recon.payForAccess{value: fee + required}(marketId, data);

        vm.prank(user);
        vm.expectRevert();
        recon.withdraw(payable(user), required);

        uint256 balBefore = owner.balance;
        recon.withdraw(payable(owner), required);
        assertEq(owner.balance, balBefore + required);
    }

    function test_RevertWhen_WithdrawExceedsBalance() public {
        vm.expectRevert();
        recon.withdraw(payable(owner), 1 ether);
    }

    receive() external payable {}
}
