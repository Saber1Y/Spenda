# Security model

[← README](./README.md) · [Architecture](./architecture.md) · [Adversarial Testing](./adversarialtesting.md)

Spenda's safety rests on two independent fences and a set of invariants that keep them independent.
This document states the guarantees, the deliberate tradeoffs, and the known v1 limitation — honestly.

---

## Guarantees

1. **An off-policy action can't be broadcast.** The agent account holds zero BOT, so every action needs
   sponsorship. The paymaster's off-chain signer only signs UserOps whose calldata is `execute(dest =
   vault)` from a registered account. No signature → no gas → the op never enters a bundle.
2. **Value only moves inside policy.** For any sponsored call, `SpendaVault.executeSpend` checks
   active/expiry, token allowlist, target allowlist, per-tx cap, rolling-24h daily cap, and actionId
   dedup **before** the transfer (checks-effects-interactions).
3. **Every decision is on-chain.** Blocked actions emit `AgentActionBlocked(agent, target, token, amount,
   reason)` and return `false` — they never revert. Approved actions emit `AgentActionApproved` +
   `ReceiptIssued`. The dashboard and any auditor reconstruct the full history from events.
4. **The agent holds nothing.** Owner EOA balance, SimpleAccount native balance, and SimpleAccount
   EntryPoint deposit are all 0 — verified live in the acceptance run.

## The no-revert-on-policy design

Policy violations **emit + return false**; they do not revert. A revert would erase the event and the
audit trail. Reverts are reserved for **genuine safety**: `NotOwner()`, `Reentrancy()`, and
`NativeTransferFailed()` (native-transfer atomicity). The tradeoff — a caller could ignore the returned
`approved` bool — is closed by the agent client branching on it, and by the fact that a blocked action
moves nothing regardless.

## Contract-layer safety

- **Reentrancy:** hand-rolled `nonReentrant` guard on `executeSpend`; state (`usedAction`, `spentToday`)
  updates **before** the external transfer/call. A malicious token that re-enters hits the guard and the
  nested call reverts — proven by an explicit attacker test.
- **CEI:** effects precede interactions; a failed transfer reverts the whole op (nothing partial).
- **Owner controls:** `setAgentPolicy`, allowlists, and `revokeAgent` (hard off-switch) are `onlyOwner`.

## The storage-free paymaster invariant (Fence 1 stays stake-free)

The on-chain paymaster validation reads **only immutables** (`verifyingSigner`, `VAULT`), performs an
ECDSA recover, decodes calldata, and returns an **empty context**. It performs **no** `SLOAD`/`SSTORE`,
no external calls, no `BALANCE`.

Why this matters under ERC-7562 (bundler simulation rules):
- No non-sender storage access → the paymaster is **not a "staked entity"** → the bundler's `checkStake`
  is never reached → **no stake required** (a funded EntryPoint *deposit* is enough; deposit is
  withdrawable with no delay, unlike stake).
- Empty context → `postOp` is skipped → the **EREP-050** unstaked-paymaster rule is sidestepped.

**All spend policy lives off-chain in the signer**, precisely so the on-chain path can stay storage-free.
Any on-chain mapping, mutable signer, or nonce would void the stake exemption.

### getHash must be byte-identical

The off-chain signer's `getHash` must match the on-chain `getHash` exactly, or the recovered signer never
equals `verifyingSigner` and **every** op is silently rejected (`SIG_VALIDATION_FAILED`). Our
`getHash`/`parsePaymasterAndData` are reproduced **verbatim** from eth-infinitism `VerifyingPaymaster` v0.7.0
and pinned by a differential fuzz (Solidity-vs-reference) and a TS-vs-on-chain equivalence test — see
[adversarialtesting.md](./adversarialtesting.md#differential-and-equivalence).

Two distinct digests are never crossed: the signer signs the paymaster `getHash`; the account owner signs
the EntryPoint `userOpHash`.

## F6 — the paymaster pays for blocked actions

Because Fence 1 gates *destination* and Fence 2 gates *policy*, an over-cap call to the vault **is
sponsored**, lands on-chain, and is then blocked — and the paymaster pays gas for that blocked action.
This is **intentional and bounded**: the sponsor's exposure is gas for value-less vault calls, the
deposit is sized for it, and the blocked artifact is a feature (a permanent record of the fence working).
When the deposit empties, runs pause cleanly with `AA31` rather than crashing.

## Key management

- The **verifyingSigner** and **agent-owner** private keys live **only** in server env (the `/api/sponsor`
  route handler runs on the Node runtime). They are never `NEXT_PUBLIC_`, never shipped to the client, and
  never committed. The client bundle was grep-verified to contain zero key material and none of the
  server-only signer/send code.
- The public `/api/sponsor` endpoint is bounded by the signer (only `execute→vault` from the demo agent)
  and rate-limited (token bucket + min gap) so it can't be spammed to drain the deposit. It validates
  input at the trust boundary and refuses cleanly (structured JSON) — never throws, never partial-submits.
- Repo hygiene: `internal/` (PRD + `keys.json`) and Foundry `cache/` (which holds forge-script "sensitive
  values") are gitignored. No private key is committed.

## Legacy testnet limitation and mainnet replacement

**Invariant "the agent account holds nothing" is not on-chain-enforceable.** Anyone can call
`EntryPoint.depositTo(agentAccount)` (permissionless), and a funded `SimpleAccount`'s *unrestricted*
`execute` could then self-sponsor a call to **any** target — bypassing Fence 1. v1 enforces the invariant
**operationally** (never fund/deposit the account; asserted 0/0 before the gasless run).

The repository now includes `RestrictedAgentAccount` and `RestrictedAgentAccountFactory` for new deployments.
The account binds validation to one paymaster, never prefunds EntryPoint from account funds, accepts execution only from EntryPoint, and permits only zero-value `vault.executeSpend(...)` calls to its configured vault.
Dedicated tests force-fund the account and its EntryPoint deposit and verify that a UserOperation using another paymaster is rejected.

The currently hosted demo addresses still refer to the legacy `SimpleAccount` deployment.
They must not be represented as the restricted mainnet deployment.
Mainnet launch requires deploying the new factory and accounts, configuring the deployment manifest, and rerunning fork and live bundler acceptance tests against those addresses.

## Responsible disclosure

This is a hackathon testnet deployment (BOT Chain 968) using a `MockUSD` test asset — no real funds at
risk. Issues can be raised on the repository.
