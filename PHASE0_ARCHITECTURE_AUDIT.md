# Spenda Phase 0 Architecture Audit

Date: 2026-08-20

This audit documents the repository as implemented before the Mainnet feature expansion.
It is an architecture and hackathon-pace security review, not a production smart-contract audit.
Mainnet deployment with real user funds still requires independent contract review, deployment verification, and operational controls.

## Current Repository

The repository is a monorepo with three active application layers.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Contracts | `src/`, `test/`, `script/` | Vault enforcement, paymaster validation, ERC-4337 account deployment, tests, deployment scripts |
| Agent client | `client/src/`, `client/test/` | UserOperation packing, paymaster sponsorship signing, bundler submission, fork tests |
| Application | `web/`, `base44/` | Next.js dashboard, wallet writes, Base44 persistence, event synchronization, demo API route |

The repository currently targets BOT Chain testnet chain ID `968`.
The primary token is `MockUSD`/`mUSD`, with six decimals.

## Existing Execution Path

The proven spend path is:

1. An agent owner EOA controls an ERC-4337 `SimpleAccount`.
2. The account address, not the owner EOA, is registered as the agent in `BOTSpendVault`.
3. The client builds `SimpleAccount.execute(vault, 0, vault.executeSpend(...))`.
4. The server route at `web/app/api/sponsor/route.ts` validates the request shape, creates a fresh action ID, estimates gas, and asks the off-chain signer to authorize sponsorship.
5. `web/lib/sponsor/signer.ts` signs only a UserOperation from a configured sender set whose outer destination is the configured vault.
6. The agent owner signs the ERC-4337 EntryPoint UserOperation hash.
7. The bundler submits the operation to EntryPoint v0.7.
8. EntryPoint calls `SimpleAccount.execute`.
9. `BOTSpendVault.executeSpend` evaluates the agent policy and moves vault funds if all checks pass.
10. The dashboard polls `eth_getUserOperationReceipt` and resolves the result from `AgentActionApproved` or `AgentActionBlocked`, never from the requested amount.
11. Base44 functions independently synchronize vault state and vault events into `Vault`, `Agent`, `Policy`, `AllowlistEntry`, `Transaction`, and `AuditLog` entities.

## Contract Boundaries

### `BOTSpendVault`

`BOTSpendVault` is the current ultimate value boundary.
It owns no external account permissions beyond its `owner`, holds native and ERC-20 assets, and exposes `executeSpend` to any caller whose address has an active policy.

The policy checks are:

- Agent active.
- Policy not expired.
- Token allowlisted for the calling agent.
- Target allowlisted for the calling agent.
- Amount within `maxPerTx`.
- Amount within the rolling 24-hour `dailyCap`.
- `actionId` not previously used.

State is updated before external transfers and the function is protected by a reentrancy guard.
Policy failures emit `AgentActionBlocked` and return `false` without consuming the action ID.
Successful transfers emit `AgentActionApproved` and `ReceiptIssued`.

### `BOTSpendPaymaster`

The paymaster is a storage-free Fence 1.
It validates an off-chain ECDSA signature over the complete UserOperation gas and calldata commitment, checks the outer `SimpleAccount.execute` destination against an immutable vault address, and returns validation failure for invalid sponsorship.

It does not read vault policy state.
The vault remains Fence 2 for caps, allowlists, expiry, deduplication, and value movement.

This split preserves the current ERC-7562 stake-exempt design, but it means a UserOperation targeting the vault can be sponsored even when the vault later blocks its spend.

### `SimpleAccount`

The current account is the upstream unrestricted `SimpleAccount`.
Its `execute` function is callable by its owner EOA or EntryPoint and can call arbitrary destinations.
The repository documents that an agent account must remain unfunded, but this is an operational invariant rather than an on-chain invariant.

The documented mainnet hardening direction is a purpose-built restricted account that can only call the configured vault and cannot self-fund an EntryPoint deposit.

## Persistence and Synchronization

Base44 currently persists:

- `Vault`: one vault deployment and aggregate state.
- `Agent`: one SimpleAccount identity and owner EOA.
- `Policy`: a mirror of the on-chain agent policy.
- `AllowlistEntry`: target and token mirror records.
- `Transaction`: requested, executed, or blocked spend attempts.
- `AuditLog`: user, agent, and system activity.

The current `Transaction` record is the nearest extension point for receipts, but it is not yet an intent or receipt model.
It lacks a stable intent relationship, risk assessment, approval state, policy snapshot, category, and merchant metadata.

`syncTransactions` derives approved and blocked transaction data from vault events.
This is the correct trust direction for critical transaction fields, but the current implementation deduplicates by transaction hash and assumes one configured agent per sync request.

## Findings

### Blocker: the current account model is not sufficient for mainnet custody guarantees

`SimpleAccount.execute` can call arbitrary destinations when invoked by its owner EOA or EntryPoint.
Anyone can permissionlessly deposit native funds to the account or EntryPoint deposit balance.
If the account ever becomes funded, the unrestricted account can bypass the paymaster destination fence and call outside the vault.

The existing tests explicitly prove this is an operational limitation.
Do not describe the current account implementation as a complete mainnet custody guarantee.
Before real funds, introduce and test a restricted agent account or equivalent on-chain account policy that constrains destination and selector and prevents self-sponsorship paths.

### Should-fix: deployment addresses are inconsistent across active layers

The web defaults use vault `0xf23147...`, agent `0xfdfa27...`, and paymaster `0xde609e...`.
The Base44 constants and synchronization functions use vault `0xbE4e11...`, agent `0xCc19a...`, and paymaster `0x5431d8...`.
The client config also points at the older deployment.

This can produce a dashboard that submits against one deployment while Base44 syncs another deployment.
It can also create duplicate or apparently missing vault, agent, policy, and transaction records.
The first implementation change should centralize deployment configuration and pass the active vault, agent, token, and paymaster addresses through backend sync functions rather than maintaining independent hard-coded defaults.

### Should-fix: frontend input is not a safe intent boundary

`web/app/api/sponsor/route.ts` accepts `agent`, `vault`, `paymaster`, `mockUSD`, and `vendor` addresses from the request body and only checks that they look like hexadecimal addresses.
The route signs sponsorship using those request-selected values.

For the demo this is bounded by server keys and the configured sender, but it is not a mainnet-safe authorization boundary.
The server must resolve the vault, agent, policy, token, and target from authenticated ownership and persisted configuration, or verify each against an on-chain and server-side registry.
The normalized intent must be the input to this resolution, not arbitrary client-controlled execution parameters.

### Should-fix: off-chain policy evaluation is advisory and can become stale

`base44/functions/evaluatePolicy` reads current chain state and computes a result, but the vault performs the authoritative check later.
Concurrent operations can change the daily allowance after the read.
The application must treat this endpoint as a preview only and never use its result as authorization.
For Phase 1, budget reservation or on-chain accounting must remain atomic at execution time.

### Note: blocked UserOperations still consume sponsor gas

An over-cap or otherwise policy-invalid operation that targets the vault is sponsored, mined, and emits a blocked event.
This is intentional in the current design and is covered by tests, but it creates a denial-of-service and deposit-drain surface if the sponsorship endpoint is exposed without strict authentication, rate limiting, and amount/policy bounds.

### Note: Base44 request/status mutation paths need ownership hardening

The backend functions use `asServiceRole` for entity writes.
The current request and status functions validate required fields but do not yet implement the intent owner, agent authorization, state-transition, or idempotency rules required by the expanded product.
They must be moved behind server-side authorization and explicit state machines before human approvals or autonomous intents are added.

## Safe Extension Points

The Mainnet feature expansion should extend the existing system at these seams.

### Backend services

Add service modules or Base44 functions around the existing entities:

- `agentService`: agent registry and vault ownership checks.
- `budgetService`: budget preview and execution-time budget validation.
- `intentService`: schema validation, normalization, expiry, and deterministic action encoding.
- `riskService`: deterministic risk factors and configurable thresholds.
- `approvalService`: scoped approval records and wallet authorization payloads.
- `executionService`: one path into the existing UserOperation builder and vault call.
- `receiptService`: immutable decision record joined to on-chain proof.

Do not let description, metadata, merchant labels, or LLM output directly select a contract call.
Only normalized, validated fields should be converted into `executeSpend` calldata.

### Base44 entities

Retain the existing `Vault`, `Agent`, `Policy`, `AllowlistEntry`, `Transaction`, and `AuditLog` entities.
Add separate entities for `SpendIntent`, `RiskAssessment`, `ApprovalRequest`, and `SpendingReceipt` rather than overloading `Transaction` with multiple lifecycles.
Add `AgentBudget` only if the budget needs a separate lifecycle from the current on-chain `Policy`; otherwise initially treat the existing per-agent policy as the authorization budget and mirror it with an explicit budget record.

### Contracts

Do not put descriptions, merchant metadata, risk explanations, or receipt text on-chain.
Use the existing vault as the value boundary.
Only add contract fields or methods when a feature needs an on-chain authorization guarantee that cannot safely be provided by the current owner-controlled policy configuration.

Likely contract-level additions for later phases are scoped approval nonce/deadline validation and a restricted agent account.
Both require dedicated replay, expiry, concurrency, and access-control tests before deployment.

### Dashboard

Upgrade the existing routes and components.
The current `/dashboard/spending`, `/dashboard/agents`, `/dashboard/policies`, `/dashboard/audit`, and overview components already provide the navigation and visual system needed for intents, budgets, approvals, risk, receipts, and merchant sandbox scenarios.
Do not create a second application.

## Recommended Implementation Sequence

1. Centralize active deployment configuration across web, Base44, client tests, and deployment output.
2. Add normalized intent and receipt persistence without changing vault execution.
3. Add multiple agent records and explicit budget views, while preserving the vault as the custody boundary.
4. Add the deterministic risk engine and preview-only decision pipeline.
5. Add scoped human approvals and an execution path that revalidates all fields immediately before submission.
6. Add agent registry and agent-to-agent payments through the same intent path.
7. Add `rwa_purchase` as an intent category and Merchant Sandbox scenarios.
8. Replace or constrain `SimpleAccount` before describing the system as mainnet-ready.
9. Add attack simulations for compromised agents, concurrent daily-cap use, replay, expiry, revocation, token/target restrictions, approval replay, and unauthorized policy changes.

## Verification Performed

- `forge test`: 43 passed, 0 failed, including BOT Chain fork tests.
- `web`: `npm run typecheck` passed.
- `web`: `npm run build` passed with optional wallet connector module warnings and a multiple-lockfile workspace warning.
- `client`: after `npm ci`, 13 tests passed, but 3 live-send/estimate suites could not collect because the ignored `internal/keys.json` is absent.
- `client`: fork equivalence and sponsored UserOperation tests passed.
- `client`: dependency installation reported 7 npm audit vulnerabilities: 3 moderate, 3 high, and 1 critical.

The client test suite must be rerun in the configured deployment environment before relying on live estimate/send coverage.
