# Semgrep rule fixtures

Regression fixtures for Vigilo's custom Solidity Semgrep ruleset
(`.semgrep/vigilo-rules.yml`).

## Purpose

The ruleset is a fast, low-noise first pass that runs before the full
agent-driven audit. These fixtures pin its behaviour so that a Semgrep upgrade
(or an accidental edit to the rules) cannot silently break detection or start
producing false positives.

- `vulnerable/` — minimal contracts that **should** trigger a specific rule.
  Each file targets exactly one rule and names it in a comment.
- `safe/` — the safe/fixed counterparts that **should not** trigger any rule
  (e.g. checks-effects-interactions ordering, `require()` on a `transfer`
  return, `msg.sender` auth, a zero-address guard).

## Coverage

Every rule in `.semgrep/vigilo-rules.yml` has at least one positive fixture:

| Rule ID                                  | Vulnerable fixture                       |
| ---------------------------------------- | ---------------------------------------- |
| `reentrancy-external-call-before-state`  | `vulnerable/Reentrancy.sol`              |
| `unchecked-transfer-return`              | `vulnerable/UncheckedTransfer.sol`       |
| `tx-origin-authentication`               | `vulnerable/TxOriginAuth.sol`            |
| `unprotected-selfdestruct`               | `vulnerable/UnprotectedSelfdestruct.sol` |
| `arbitrary-delegatecall`                 | `vulnerable/ArbitraryDelegatecall.sol`   |
| `block-timestamp-manipulation`           | `vulnerable/BlockTimestamp.sol`          |
| `uninitialized-storage-pointer`          | `vulnerable/UninitializedStoragePointer.sol` |
| `missing-zero-address-check`             | `vulnerable/MissingZeroAddressCheck.sol` |
| `unsafe-erc20-approve`                   | `vulnerable/UnsafeApprove.sol`           |
| `hardcoded-gas-amount`                   | `vulnerable/HardcodedGas.sol`            |
| `unprotected-low-level-call-value`       | `vulnerable/UnprotectedLowLevelCallValue.sol` |

## Running locally

```sh
# All fixtures (vulnerable + safe)
make semgrep
# or directly — pass the .sol files EXPLICITLY. A bare `tests/semgrep-fixtures`
# directory is skipped (semgrep's built-in .semgrepignore excludes tests/ and a
# directory scan only covers git-tracked files), so it would report "0 files".
semgrep --config .semgrep/vigilo-rules.yml \
  tests/semgrep-fixtures/vulnerable/*.sol tests/semgrep-fixtures/safe/*.sol
```

The regression test (`semgrep-rules.test.ts`) asserts that every vulnerable
fixture trips its expected rule and that the safe fixtures trip nothing. It
**skips gracefully** when the `semgrep` binary is not installed.

## A note for fixture authors

Semgrep's Solidity support is experimental. Two gotchas the rules ran into:

1. An operator metavariable (`block.timestamp $OP $X`) is **not** valid in the
   Solidity grammar — it raises a parse error and disables the whole rule.
   Enumerate the operators (`<`, `<=`, `>`, ...) instead.
2. A bare visibility metavariable (`function $F(...) $VIS { ... }`) does not
   bind, so such a pattern silently matches nothing. Omit it.
