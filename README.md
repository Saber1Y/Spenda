# Spenda — AI Agent Spending Control Plane

Spenda is the control plane for autonomous agent spending.
It gives users an on-chain vault that fences what an AI agent can spend, while a paymaster sponsors all gas.

The agent holds nothing.
It requests, the vault decides, the paymaster pays.

## Stack

- **Smart contracts**: `BOTSpendVault`, `BOTSpendPaymaster`, `SimpleAccountFactory` (ERC-4337)
- **Chain**: BOT Chain Testnet 968 (RPC `rpc.bohr.life`, Skandha bundler `bundler.bohr.life`)
- **Account abstraction**: ERC-4337 UserOperations, Skandha bundler, paymaster-sponsored gas
- **Backend**: Base44 entities, functions, auth, real-time sync
- **Frontend**: Next.js 15, Tailwind, wagmi + viem, custom design system

## Architecture

```
AGENT REQUESTS
    |
    v
POLICY DECIDES       <-- on-chain: maxPerTx, dailyCap, allowlists, expiry
    |
    v
VAULT ENFORCES       <-- on-chain: approve/hold, emit events
    |
    v
PAYMASTER SPONSORS   <-- on-chain: pays EntryPoint gas, zero agent balance
```

The AI agent never holds user funds.
It can only propose spending transactions.
The vault enforces spending policy on-chain before any transfer executes.
The paymaster sponsors gas so the agent does not need native tokens.

## Smart Contracts

### BOTSpendVault

The vault holds ERC-20 funds and enforces policy on every agent action.

Key functions:
- `setPolicy(maxPerTx, dailyCap, expiry)` — set spending limits
- `setAgentPolicy(agent, maxPerTx, dailyCap, expiry, active)` — per-agent policy
- `allowedTarget(agent, target)` — check if target is allowlisted
- `allowedToken(agent, token)` — check if token is allowlisted
- `setAllowedTarget(agent, target, allowed)` — add/remove target
- `setAllowedToken(agent, token, allowed)` — add/remove token
- `revokeAgent(agent)` — emergency off-switch
- `remainingDailyCap(agent)` — remaining daily allowance

Events:
- `AgentActionApproved(agent, target, token, amount, actionId)` — policy passed
- `AgentActionBlocked(agent, target, token, amount, reason)` — policy rejected

### BOTSpendPaymaster

ERC-4337 paymaster that sponsors gas for approved agent actions.
Deposit native BOT to the EntryPoint to fund gasless operations.

### SimpleAccountFactory

Creates and manages ERC-4337 smart accounts for agents.
Each agent gets its own account controlled by an owner EOA.

## Dashboard

### Pages

| Route | Purpose |
|---|---|
| `/dashboard/overview` | KPIs, agent status, analytics charts, recent activity, sync controls |
| `/dashboard/spending` | Transaction history with filters (All/Approved/Blocked), Run Agent panel |
| `/dashboard/policies` | Policy status, edit form, daily cap meter, emergency revoke |
| `/dashboard/agents` | Agent wallet, vault connection, gasless status, balances |
| `/dashboard/allowlist` | Approved targets and tokens, add/remove controls |
| `/dashboard/gas` | Paymaster deposit, security invariants, fund paymaster |
| `/dashboard/audit` | Full audit log table with timestamps, events, decisions, transactions |

### Design

- Dark sidebar navigation with active route highlighting
- Dark hero header on Overview with glassmorphism KPI cards
- Light content area below the hero
- Consistent Base44 brand: orange primary (`#fe6a00`), dark secondary (`#1e1e24`)
- Custom pill-based design system (chips, buttons, stat tiles, state badges)

### Components

| Component | Location | Purpose |
|---|---|---|
| `Sidebar` | `components/dashboard/Sidebar.tsx` | Persistent dark sidebar with nav + wallet |
| `RunAgentPanel` | `components/dashboard/RunAgentPanel.tsx` | Preset + custom spend buttons, live UserOp submission |
| `GaslessStatusBadge` | `components/dashboard/GaslessStatusBadge.tsx` | Paymaster funded + agent holds nothing indicator |
| `DailyCapMeter` | `components/dashboard/DailyCapMeter.tsx` | Visual daily spending progress bar |
| `PolicyPanel` | `components/dashboard/PolicyPanel.tsx` | Policy display and edit form |
| `OwnerControls` | `components/dashboard/OwnerControls.tsx` | Fund vault, fund paymaster, allowlist, revoke |
| `SyncPanel` | `components/dashboard/SyncPanel.tsx` | Pull on-chain state into Base44 entities |
| `Panel` | `components/dashboard/Panel.tsx` | Reusable card with title + action slot |
| `StatTile` | `components/ui/StatTile.tsx` | Labelled stat with value + subtitle |
| `Chip` | `components/ui/Chip.tsx` | Pill badge (neutral, lavender, mint, blush, outline) |
| `CopyChip` | `components/ui/Chip.tsx` | Click-to-copy address chip |
| `TxChip` | `components/ui/Chip.tsx` | Explorer link chip |
| `StateBadge` | `components/ui/StateBadge.tsx` | Approved (mint) / Blocked (blush) badge |

### Hooks

| Hook | File | Purpose |
|---|---|---|
| `useVaultState` | `lib/hooks.ts` | Batched on-chain vault state read |
| `useActionHistory` | `lib/hooks.ts` | Incremental action history from on-chain events |
| `useVaultEntities` | `lib/base44-hooks.ts` | Base44 vault entity query |
| `useTransactionEntities` | `lib/base44-hooks.ts` | Base44 transaction entity query |
| `useAuditLogEntities` | `lib/base44-hooks.ts` | Base44 audit log entity query |
| `useOwnerWrite` | `lib/useOwnerWrite.ts` | Owner wallet write transaction helper |

### Key Libraries

| File | Purpose |
|---|---|
| `lib/chain.ts` | BOT Chain 968 public client, explorer URL helpers |
| `lib/contracts.ts` | Contract ABIs, addresses, `getActiveContracts()` |
| `lib/reads.ts` | `readVaultState()`, `readActions()`, event log parsing |
| `lib/bundler.ts` | UserOp submission, receipt polling, outcome resolution |
| `lib/proof.ts` | Transaction proof fetch from on-chain logs |
| `lib/format.ts` | `formatMusd`, `formatBot`, `truncateAddress`, `timeAgo` |
| `lib/deployVault.ts` | Full stack deployment (vault + paymaster + agent + policy + funding) |
| `lib/activeVault.ts` | localStorage vault config with fallback to demo defaults |
| `lib/audit.ts` | Base44 audit log recording |
| `lib/artifacts.ts` | Compiled contract bytecodes for frontend deployment |

## Running

```bash
cd web
npm install
cp .env.local.example .env.local   # set PRIVATE_KEY, VERIFYING_SIGNER_KEY, AGENT_OWNER_KEY
npm run dev
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE44_PROJECT_ID` | Base44 project ID (defaults to `6a631622f530d0be34c151e0`) |
| `VERIFYING_SIGNER_KEY` | Private key matching the paymaster's verifyingSigner |
| `AGENT_OWNER_KEY` | Private key matching the agent owner EOA |
| `NEXT_PUBLIC_SITE_URL` | Deployed URL for OG metadata |

### Testing the Spend Flow

1. Connect wallet (owner EOA)
2. Navigate to Spending page
3. Click "Spend 4 mUSD" — should approve (within policy)
4. Click "Spend 6 mUSD" — should block (exceeds per-tx cap)
5. Enter custom amount in the input field — policy decides

### Deploying a New Vault

Navigate to `/dashboard/deploy` to deploy a fresh vault stack:
- BOTSpendVault
- BOTSpendPaymaster
- SimpleAccountFactory
- Agent account creation
- Policy configuration
- Allowlist setup
- Paymaster funding

## Contract Addresses (Testnet)

| Contract | Address |
|---|---|
| Vault | `0xf23147dfe0e9e38d0e8d20d780f7ca9301ea182b` |
| Paymaster | `0xde609e52...e62ec2` |
| Agent | `0xFdFa27C2089598...` |
| EntryPoint | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| MockUSD | `0x981a7E272F309193D846dc585b64E4a2f172aD21` |
| Owner EOA | `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84` |
