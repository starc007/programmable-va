// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface ITIP20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IAddressRegistry {
    function registerVirtualMaster(bytes32 salt) external returns (bytes4 masterId);
}

contract SplitForwarder {
    struct Recipient {
        address addr;
        uint16 percentBps; // sum across rule must equal 10000
    }

    struct SplitRule {
        Recipient[] recipients;
        uint64 createdAt;
        bool active;
    }

    // TIP-1022 address registry precompile
    IAddressRegistry public constant REGISTRY =
        IAddressRegistry(0xfDC0000000000000000000000000000000000000);

    address public operator;
    bytes4 public masterId;

    mapping(bytes6 => SplitRule) internal _rules;
    // keccak256(abi.encode(userTag, depositId)) => processed
    mapping(bytes32 => bool) public processed;
    // keccak256(abi.encode(userTag, depositId, recipientIndex)) => claimed
    mapping(bytes32 => bool) public claimed;

    event RuleSet(bytes6 indexed userTag, uint256 recipientCount);
    event RuleDeactivated(bytes6 indexed userTag);
    event Split(bytes6 indexed userTag, address indexed token, uint256 amount, uint256 recipientCount);
    event OperatorTransferred(address indexed previous, address indexed next);
    event Registered(bytes4 masterId);

    error NotOperator();
    error InvalidPercents();
    error NoRule();
    error AlreadyProcessed();
    error AlreadyClaimed();
    error NotRecipient();
    error TransferFailed();

    constructor(address _operator) {
        operator = _operator;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @notice Register this contract as a TIP-1022 virtual master.
    /// @dev Salt must satisfy the 32-bit proof-of-work requirement.
    ///      Mine off-chain with VirtualMaster.mineSalt() from ox/tempo.
    function register(bytes32 salt) external onlyOperator returns (bytes4) {
        masterId = REGISTRY.registerVirtualMaster(salt);
        emit Registered(masterId);
        return masterId;
    }

    function setRule(bytes6 userTag, Recipient[] calldata recipients) external onlyOperator {
        uint256 total;
        for (uint256 i; i < recipients.length; i++) {
            total += recipients[i].percentBps;
        }
        if (total != 10000) revert InvalidPercents();

        delete _rules[userTag];
        SplitRule storage rule = _rules[userTag];
        for (uint256 i; i < recipients.length; i++) {
            rule.recipients.push(recipients[i]);
        }
        rule.createdAt = uint64(block.timestamp);
        rule.active = true;

        emit RuleSet(userTag, recipients.length);
    }

    function deactivate(bytes6 userTag) external onlyOperator {
        _rules[userTag].active = false;
        emit RuleDeactivated(userTag);
    }

    /// @notice Process a single deposit. Callable by anyone (keeper or recipient).
    function processDeposit(
        bytes6 userTag,
        address token,
        uint256 amount,
        bytes32 depositId
    ) public {
        SplitRule storage rule = _rules[userTag];
        if (!rule.active) revert NoRule();

        bytes32 key = keccak256(abi.encode(userTag, depositId));
        if (processed[key]) revert AlreadyProcessed();
        processed[key] = true;

        uint256 last = rule.recipients.length - 1;
        uint256 distributed;

        for (uint256 i; i < last; i++) {
            uint256 share = (amount * rule.recipients[i].percentBps) / 10000;
            if (!ITIP20(token).transfer(rule.recipients[i].addr, share)) revert TransferFailed();
            distributed += share;
        }
        // last recipient absorbs rounding dust
        if (!ITIP20(token).transfer(rule.recipients[last].addr, amount - distributed)) revert TransferFailed();

        emit Split(userTag, token, amount, rule.recipients.length);
    }

    function processBatch(
        bytes6[] calldata userTags,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata depositIds
    ) external {
        for (uint256 i; i < userTags.length; i++) {
            processDeposit(userTags[i], tokens[i], amounts[i], depositIds[i]);
        }
    }

    /// @notice Pull-based fallback — a recipient claims their share of a stuck deposit.
    function claim(
        bytes6 userTag,
        address token,
        uint256 amount,
        bytes32 depositId
    ) external {
        SplitRule storage rule = _rules[userTag];
        if (!rule.active) revert NoRule();

        bytes32 depositKey = keccak256(abi.encode(userTag, depositId));
        if (processed[depositKey]) revert AlreadyProcessed();

        uint256 last = rule.recipients.length - 1;
        bool found;

        for (uint256 i; i <= last; i++) {
            if (rule.recipients[i].addr != msg.sender) continue;

            bytes32 claimKey = keccak256(abi.encode(userTag, depositId, i));
            if (claimed[claimKey]) revert AlreadyClaimed();
            claimed[claimKey] = true;

            uint256 share;
            if (i == last) {
                // recompute remainder to match processDeposit dust logic
                uint256 distributed;
                for (uint256 j; j < last; j++) {
                    distributed += (amount * rule.recipients[j].percentBps) / 10000;
                }
                share = amount - distributed;
            } else {
                share = (amount * rule.recipients[i].percentBps) / 10000;
            }

            if (!ITIP20(token).transfer(msg.sender, share)) revert TransferFailed();
            found = true;
            break;
        }

        if (!found) revert NotRecipient();
    }

    function getRule(bytes6 userTag)
        external
        view
        returns (Recipient[] memory recipients, uint64 createdAt, bool active)
    {
        SplitRule storage rule = _rules[userTag];
        return (rule.recipients, rule.createdAt, rule.active);
    }

    function transferOperator(address newOperator) external onlyOperator {
        emit OperatorTransferred(operator, newOperator);
        operator = newOperator;
    }
}
