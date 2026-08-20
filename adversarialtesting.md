# Adversarial testing

[← README](./README.md) · [Architecture](./architecture.md) · [Security](./security.md)

Every claim in [security.md](./security.md) is backed by a test. The strategy runs from hermetic units up
to live on-chain acceptance, deliberately trying to break each fence.

---

## Layers

| Layer | What it proves | Where |
|-------|----------------|-------|
| Unit (Foundry) | Every policy branch + safety revert | `test/SpendaVault.t.sol`, `test/AgentAccount.t.sol`, `test/SpendaPaymaster.t.sol` |
| Differential fuzz | `getHash` is byte-identical to the reference | `test/GetHashDifferential.t.sol` |
| Fork (Foundry) | Works against the **real** EntryPoint on 968 | `test/fork/*` |
| Equivalence + e2e (TS) | Off-chain signer ≡ on-chain; full handleOps | `client/test/*` |
| Live simulation gate | Factory + paymaster pass Skandha's ERC-7562 tracer | the `eth_estimateUserOperationGas` gate |
| On-chain acceptance | Approved + blocked, live, with tx hashes | BOT Chain 968 |

**Solidity: 43 tests, 100% coverage** of `src/` (lines/branches/functions). **TS client: 13 tests.**

## Vault — the policy surface (PRD scenarios 1–10 + more)

`test/SpendaVault.t.sol` isolates each blocked *reason* so the ordering can't mask a bug:

- Approved spend → `AgentActionApproved` + `ReceiptIssued`, funds move, `spentToday` advances.
- Blocked, one per reason: **exceeds maxPerTx**, **target not allowlisted**, **token not allowlisted**,
  **exceeds dailyCap**, **agent not active** (revoked), **policy expired**, **duplicate action** (replay).
- **Reentrancy attempt:** a malicious ERC20 re-enters `executeSpend` during its transfer; the `nonReentrant`
  guard fires (the nested call reverts) while the legitimate outer spend completes and no double-spend
  occurs.
- Native path (success + `NativeTransferFailed` safety revert), owner-guard reverts, rolling-24h daily
  reset, unregistered-agent default-inactive.

Each asserts **events + state + balances**, not just a return value.

## Account layer

`test/AgentAccount.t.sol` proves the counterfactual (CREATE2) address **equals** the deployed one (the
`getAddress`/`createAccount` initCodeHash footgun), that `owner == agent EOA`, that `execute` is gated to
owner/EntryPoint, and that a fresh account holds **0 native + 0 deposit** (invariant 2).

## Differential and equivalence

The paymaster signature only works if `getHash` matches exactly on both sides.

- **Solidity differential fuzz** (`GetHashDifferential.t.sol`): deploys the real eth-infinitism
  `VerifyingPaymaster`, `vm.etch`es its runtime onto our paymaster's address (to neutralize the
  `address(this)` field), and asserts `getHash` equality over **256 fuzzed** UserOps → byte-identical.
- **TS ↔ on-chain equivalence** (`client/test/getHash.diff.test.ts`): spins an anvil fork of 968, deploys
  the paymaster, and asserts the TypeScript `getHash` equals the deployed contract's `getHash` over sample
  + fuzzed ops; then signs and validates a round-trip (sigFailed=false, empty context).
- **End-to-end (TS)** (`client/test/signer.fork.test.ts`): the off-chain signer's sponsorship + the
  account-owner signature drive a full `EntryPoint.handleOps` on the fork — agent at 0 balance completes an
  approved `executeSpend`; the paymaster deposit pays.

## Fork against the real EntryPoint

`test/fork/*` forks `rpc.bohr.life` and runs the full gasless flow against the **canonical v0.7 EntryPoint
deployed on 968** (not a local redeploy) — proving compatibility with the exact on-chain bytecode, and
that an off-scope destination is rejected (`AA34`).

## The live simulation gate

Before any real spend, the first UserOp is estimated on the **live Skandha bundler**
(`eth_estimateUserOperationGas`) — the first time ERC-7562 tracing sees the factory `initCode` and the
paymaster validation. This confirmed the factory `initCode` traces clean and the paymaster's storage-free
validation is accepted (deposit check aside). It also surfaced, cheaply, a dummy-signature must be a
*structurally valid* ECDSA sig (recovers-to-wrong → `SIG_VALIDATION_FAILED`), not a malformed one
(reverts `AA23`).

## On-chain acceptance (live, BOT Chain 968)

The fences were exercised for real, with matching before/after deltas:

- **Approved gasless UserOp** — account deploys **and** spends in one sponsored op; agent stays 0/0,
  vendor +4 mUSD, `spentToday` advances, paymaster deposit debited. tx
  [`0xb2143fb3…`](https://scan.bohr.life/tx/0xb2143fb3de65583fa75655b068cf23189a39b1a810c98e41653f67c7f6997d2c)
- **Blocked over-cap UserOp** — sponsored (`UserOperationEvent.success = true`), `AgentActionBlocked
  "exceeds maxPerTx"`, **no** `Transfer`, vendor/`spentToday` unchanged, paymaster paid the gas (F6). tx
  [`0x299021d9…`](https://scan.bohr.life/tx/0x299021d91bdd354f3c9462629b0f10219578be08f1fe9c3e9e187e982e7f25f9)
- **End-to-end via the deployed `/api/sponsor`** — the server route (env-loaded keys, server-side
  sponsor + owner-sign, live `eth_sendUserOperation`) produced a real approved run; the client's bounded
  receipt poll resolved the outcome from the **actual event** (never optimistically).
- **Restricted-account acceptance** — a fresh `RestrictedAgentAccount` at
  `0x2649495B56e8c06C6682549438ac9279599A3aD8` executed a sponsored 4 mUSD spend while its native balance
  and EntryPoint deposit remained zero. The transaction emitted `AgentActionApproved`,
  `AgentActionDecision`, and `ReceiptIssued`: tx
  [`0xdbe5d62a...`](https://scan.bohr.life/tx/0xdbe5d62aec8ef6d9a8d8a9c7c26bf74b1d3e7ed3dbd47733543b0844c9cba50a).

### Failure modes are treated as first-class

`success == false` is investigated, not shipped: a mid-build `callGasLimit` under-buffer produced an
out-of-gas execution revert (empty reason → no `UserOperationRevertReason`); root-caused via `cast
estimate` (real cost > the bundler's estimate), fixed by flooring `callGasLimit`, and re-proven — rather
than blind-resubmitted. Idempotency is respected throughout (actionId + EntryPoint nonce make blind
resubmission unsafe; outcomes are read from chain state).

See [security.md](./security.md) for what each of these guarantees, and [architecture.md](./architecture.md)
for the design under test.
