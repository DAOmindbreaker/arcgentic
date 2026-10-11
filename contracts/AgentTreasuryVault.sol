// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AgentTreasuryVault {
    using SafeERC20 for IERC20;
    address public immutable owner;
    address public aiAgent;
    address public immutable usdcToken;

    uint256 public dailyLimit;
    uint256 public spentToday;
    uint256 public lastResetTimestamp;

    mapping(address => bool) public allowedProtocols;

    event AgentUpdated(address indexed newAgent);
    event StrategyExecuted(address indexed protocol, uint256 amount, string strategyType);
    event EmergencyWithdraw(address indexed owner, uint256 amount);
    event ProtocolAllowlistUpdated(address indexed protocol, bool allowed);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: Only owner");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == aiAgent || msg.sender == owner, "Vault: Unauthorized sender");
        _;
    }

    constructor(address _usdcToken, address _aiAgent, uint256 _dailyLimit) {
        require(_usdcToken != address(0), "Vault: Zero address");
        require(_aiAgent != address(0), "Vault: Zero address");
        owner = msg.sender;
        usdcToken = _usdcToken;
        aiAgent = _aiAgent;
        dailyLimit = _dailyLimit;
        lastResetTimestamp = block.timestamp;
    }

    function setAllowedProtocol(address protocol, bool allowed) external onlyOwner {
        allowedProtocols[protocol] = allowed;
        emit ProtocolAllowlistUpdated(protocol, allowed);
    }

    function updateDailyLimit(uint256 newLimit) external onlyOwner {
        uint256 oldLimit = dailyLimit;
        dailyLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    function updateAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "Vault: Zero address");
        aiAgent = newAgent;
        emit AgentUpdated(newAgent);
    }

    function executeStrategy(address targetProtocol, uint256 amount, bytes calldata data, string calldata strategyType) external onlyAgentOrOwner {
        require(allowedProtocols[targetProtocol], "Vault: Protocol not allowed");

        if (block.timestamp >= lastResetTimestamp + 1 days) {
            spentToday = 0;
            lastResetTimestamp = block.timestamp;
        }

        require(spentToday + amount <= dailyLimit, "Vault: Exceeds agent daily limit");
        spentToday += amount;

        emit StrategyExecuted(targetProtocol, amount, strategyType);

        IERC20(usdcToken).forceApprove(targetProtocol, amount);
        require(targetProtocol.code.length > 0, "Vault: Not a contract");
        (bool success, ) = targetProtocol.call(data);
        IERC20(usdcToken).forceApprove(targetProtocol, 0);
        require(success, "Vault: Strategy execution failed");
    }

    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        require(balance > 0, "Vault: Zero balance");
        IERC20(usdcToken).safeTransfer(owner, balance);
        emit EmergencyWithdraw(owner, balance);
    }
}
