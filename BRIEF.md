# Spenda - What We Built

## One-liner

Spenda is a control plane for autonomous agent spending - a Base44-powered dashboard that lets you deploy ERC-4337 smart wallets, set spending policies, and watch an AI agent request payments in real time while an on-chain paymaster covers gas.

## The Problem

AI agents need to spend money on behalf of users (buying cloud compute, paying vendors, executing trades). But giving an LLM a private key is insane. Spenda solves this: the agent never holds funds. It submits spending requests that pass through policy checks, and only approved payments execute on-chain.

## What We Built (Base44 Focus)

### Entities (Data Model)

Base44 entities store the entire application state:

- **Vault** - The on-chain BOTSpendVault smart contract's off-chain mirror. Stores contract address, chain ID, token info, balances, paymaster deposit, sync timestamps.
- **Policy** - Spending rules per agent: max per-transaction, daily cap, expiry, spent-today tracking.
- **Agent** - Registered spending agents with wallet addresses, owner EOAs, deployment status.
- **AllowlistEntry** - Whitelisted recipients and tokens per agent. Only approved addresses can receive payments.
- **Transaction** - Every payment request and its outcome (APPROVED, EXECUTED, BLOCKED, FAILED) with on-chain tx hashes.
- **AuditLog** - Immutable timeline of every decision: vault creation, policy changes, agent registrations, payment approvals/blocks.

### Backend Functions (Deno Runtime)

All entity reads/writes go through Base44 functions using `createClientFromRequest(req)` with `asServiceRole` permissions:

- **syncVaultState** - Reads on-chain state via raw RPC calls (vault balance, policy params, paymaster deposit, agent deployment status) and creates/updates Vault, Policy, Agent, AllowlistEntry, and AuditLog entities.
- **syncTransactions** - Fetches AgentActionApproved/Blocked events from the chain, decodes them, and creates Transaction entities.
- **queryEntities** - Generic read function that the frontend calls via `functions.invoke()`. Supports filtering by any field, sorting, and pagination. This solved the permission mismatch where client-side SDK reads returned empty.
- **recordAuditLogBE** - Creates AuditLog entries from the frontend (e.g., when a spend button is clicked).
- **recordTransactionRequest** - Creates Transaction entities when the agent requests a payment.
- **updateTransactionStatus** - Updates transaction status and creates corresponding AuditLog entries.
- **evaluatePolicy** - Server-side policy evaluation (used by the sponsor route).

### Frontend (Next.js + Base44 SDK)

The dashboard is a single-page app with 7 routes, all reading from Base44 entities:

- **Overview** - KPI cards (vault balance, policy status, agent health, daily spend), analytics charts, recent activity feed.
- **Spending** - Transaction table with filters, RunAgentPanel for triggering spend requests (4 mUSD approved, 6 mUSD blocked), custom mUSD input.
- **Policies** - Policy status display, edit form, daily cap visualization, emergency revoke.
- **Agents** - Agent wallet info, deployment status, on-chain balances.
- **Allowlist** - Whitelisted targets and tokens with add/remove controls.
- **Gas Sponsorship** - Paymaster deposit info, fund controls, security invariants.
- **Audit Log** - Timeline view of every decision with event type, actor, details, and tx hashes.

### The Sponsor Route (Gasless Transactions)

`/api/sponsor` is the critical bridge between frontend and chain:

1. Frontend sends `{recipient, amount, token}` to the sponsor route.
2. Route creates a Policy entity with `evaluatePolicy` function.
3. Builds an ERC-4337 UserOperation (callData = transfer, paymasterData = signed policy hash).
4. Signs the paymaster data with the verifying signer key.
5. Submits to the Skandha bundler on BOT Chain testnet.
6. Returns the UserOp hash and tx hash to the frontend.
7. Frontend creates Transaction and AuditLog entities via backend functions.

### Key Technical Decisions

**Why backend functions for entity reads?** The Base44 client-side SDK operates at user-level permissions. Entities created by `asServiceRole` in backend functions are invisible to client reads. Solution: route all reads through `queryEntities` function.

**Why raw RPC instead of viem?** The `npm:viem` package fails in Base44's Deno runtime. All on-chain reads use raw `eth_call` via `fetch()` to the BOT Chain RPC endpoint.

**Why localStorage for vault config?** The app supports multiple vault deployments. `localStorage` stores the active vault's contract address, paymaster, agent, and owner EOA. Fallback defaults point to the demo vault.

### On-Chain Infrastructure (BOT Chain Testnet 968)

- **BOTSpendVault** - ERC-4337 smart wallet with policy-gated spending. Owner sets policies, agent submits spending requests, vault validates against allowlists and daily caps.
- **BOTSpendPaymaster** - Gas sponsorship contract. Validates spending policies in the paymaster validation phase, so invalid spending attempts fail at the mempool level (no gas wasted).
- **SimpleAccountFactory** - Deploys ERC-4337 accounts (vaults) with deterministic addresses.
- **MockUSD (mUSD)** - Test token for spending. 6 decimals, used for all demo transactions.
- **EntryPoint** - Standard ERC-4337 entry point contract.

### The Flow

```
User clicks "Spend 4 mUSD"
  -> Frontend builds UserOp (to: vendor, value: 4e6, paymasterData: signed policy hash)
  -> POST /api/sponsor
  -> Sponsor route submits to Skandha bundler
  -> Bundler calls EntryPoint.handleOps()
  -> Paymaster.validatePaymasterUserOp() checks policy on-chain
  -> Vault.execute() transfers mUSD to vendor
  -> Frontend records Transaction + AuditLog entities in Base44
  -> Dashboard updates in real time
```

### File Structure

```
base44/
  entities/          # 6 entity definitions (Vault, Policy, Agent, etc.)
  functions/         # 7 Deno functions (sync, query, record, evaluate)
  shared/            # Constants and chain utilities
  auth/              # Base44 auth config

web/
  app/dashboard/     # 7 page routes + layout
  components/        # Dashboard components (Sidebar, Panels, etc.)
  lib/               # Core logic (base44 client, hooks, reads, bundler, proof)
  public/            # Static assets
```
