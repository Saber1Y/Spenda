# Spenda - AI Agent Spending Control Plane

Spenda is the control plane for autonomous agent spending.
It gives users an on-chain vault that fences what an AI agent can spend, while a paymaster sponsors all gas.

The agent holds nothing.
It requests, the vault decides, the paymaster pays.

## Live Deployment (BOT Chain Mainnet, chainId 677)

| Role | Address |
|---|---|
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Bundler | `https://bundler.botchain.ai/rpc` |
| EntryPoint (ERC-4337 v0.8) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| USDT (official bridged) | `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` |
| Vault | `0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b` |
| Paymaster | `0xfB88d06289EaDD3aE23ef5C7bEF816baFfbf4000` |
| Restricted Agent Factory | `0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66` |
| Pilot restricted agent | `0x13bb632f03083782D639d37bdaA35bbd930eF70E` |
| Vault/agent owner EOA | `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84` |

The live pilot policy on the agent is max 0.50 USDT per transaction and 1.00 USDT per day.
USDT and the pilot vendor are the only allowlisted target and token.

### Verified Mainnet Proof Transactions

- Approved: [`0xaa189540...`](https://scan.botchain.ai/tx/0xaa18954018e266b28928d20bf7ab0cef37dfcf9aeb9c5861c2aa4e3d0c0fc52d) - 0.50 USDT paid to the vendor, gas sponsored by the paymaster.
- Blocked: [`0x5dae47f9...`](https://scan.botchain.ai/tx/0x5dae47f911325bcfdb21b9a67768bbcdcd28ee1f327bd5bdb35bd57506a1fcc8) - 3.00 USDT held with reason `exceeds maxPerTx`, zero USDT moved.

## Stack

- **Smart contracts**: `BOTSpendVault`, `BOTSpendPaymaster`, `RestrictedAgentAccountFactory` (ERC-4337)
- **Chain**: BOT Chain mainnet 677 (RPC `rpc.botchain.ai`, bundler `bundler.botchain.ai`)
- **Account abstraction**: ERC-4337 UserOperations, verifying paymaster, sponsored gas
- **Frontend**: Next.js 15, Tailwind, wagmi + viem, custom design system
- **Backend sync**: Base44 entities, functions, auth, real-time sync

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
It can only propose spending transactions through its restricted account.
The account rejects arbitrary calls and only forwards `executeSpend` to its bound vault.
The vault enforces spending policy on-chain before any transfer executes.
The paymaster sponsors gas so the agent does not need native tokens.

## Smart Contracts

### BOTSpendVault

The vault holds ERC-20 funds and enforces policy on every agent action.

Key functions:
- `setPolicy(maxPerTx, dailyCap, expiry)` - set spending limits
- `setAgentPolicy(agent, maxPerTx, dailyCap, expiry, active)` - per-agent policy
- `allowedTarget(agent, target)` / `allowedToken(agent, token)` - allowlist reads
- `setAllowedTarget(agent, target, allowed)` / `setAllowedToken(agent, token, allowed)` - allowlist writes
- `revokeAgent(agent)` - emergency off-switch
- `remainingDailyCap(agent)` - remaining daily allowance

Events:
- `AgentActionApproved(agent, target, token, amount, actionId)` - policy passed
- `AgentActionBlocked(agent, target, token, amount, reason)` - policy rejected
- `ReceiptIssued(...)` - settlement receipt

### BOTSpendPaymaster

ERC-4337 verifying paymaster that sponsors gas for valid agent actions.
A server-side verifying signer authorizes UserOps before sponsorship.
Deposit native BOT into the EntryPoint against the paymaster to fund gasless operations.

### RestrictedAgentAccountFactory

Deploys vault-bound ERC-4337 agent accounts.
Each account is bound to one vault and one paymaster at creation and permits only `executeSpend` calls through EntryPoint.

## Dashboard

### Pages

| Route | Purpose |
|---|---|
| `/dashboard/overview` | KPIs, live agent status, Run-the-agent panel, analytics, recent activity |
| `/dashboard/commerce` | Merchant sandbox: create intents, see policy decisions, execute approved spends |
| `/dashboard/approvals` | High-risk intents awaiting exact, wallet-signed human consent |
| `/dashboard/policies` | Policy status, edit form, daily cap meter, emergency revoke |
| `/dashboard/agents` | Agent list (on-chain policy filter), self-serve creation, budgets from chain |
| `/dashboard/receipts` | Every approved/blocked decision read directly from vault events |
| `/dashboard/risk` | Deterministic intent-scoring policy (open and reproducible) |
| `/dashboard/allowlist` | Approved targets and tokens, add/remove controls |
| `/dashboard/gas` | Paymaster deposit, security invariants, fund paymaster |

Legacy routes (`spending`, `monitoring`, `audit`, `deploy`) remain but are hidden
from the sidebar during the pilot.

### Commerce Sandbox Flow

1. Connect your wallet on **Agents** and create an agent - your wallet signs one
   message; the treasury provisions the account, policy, and allowlists on-chain.
2. Open **Commerce**, pick your paying agent, and select a merchant.
3. The intent engine reads the live policy and returns a decision:
   - Routine purchases (domain renewal, subscriptions, small AI/compute
     top-ups) - auto-approved, pay with one signature.
   - Elevated risk - the RWA invoice always escalates; agent-to-agent data
     escalates once you have spent today - queued on **Approvals** for an exact
     EIP-712 consent before execution.
   - Over cap (the Enterprise RWA bundle) or unknown vendor - blocked by the
     on-chain fence with zero funds moved.
4. Every decision and payment appears under **Receipts** with a BOTScan link.

### Key Components and Libraries

| File | Purpose |
|---|---|
| `components/dashboard/RunAgentPanel.tsx` | Preset + custom spend buttons, live sponsored UserOp submission |
| `app/api/sponsor/route.ts` | Validates request, signs paymaster + UserOp, submits to bundler |
| `lib/sponsor/signer.ts` | Paymaster sponsorship logic and policy guards |
| `lib/contracts.ts` | Canonical mainnet addresses, ABIs, `getActiveContracts()` |
| `lib/proof.ts` | Landing-page live proof decoded from mainnet receipts |
| `lib/bundler.ts` | UserOp submission, receipt polling, outcome resolution |
| `lib/reads.ts` | `readVaultState()`, `readActions()`, event log parsing |
| `scripts/RotateMainnetPaymaster.s.sol` | Deploy a fresh paymaster + factory around an existing vault |

## Running

```bash
cd web
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `VERIFYING_SIGNER_KEY` | Private key matching the paymaster's verifyingSigner |
| `AGENT_OWNER_KEY` | Private key matching the agent owner EOA |
| `SPENDA_VERIFYING_SIGNER_ADDRESS` | Expected signer address override |
| `SPENDA_AGENT_OWNER_ADDRESS` | Expected agent owner address override |
| `DIRECT_PILOT_ENABLED` | Set to `true` to enable the live run panel |
| `NEXT_PUBLIC_SITE_URL` | Deployed URL for OG metadata |

Keys are generated locally and never committed.
Recommended storage is outside the repo (for example `~/.spenda-paymaster-signer.wallet`) loaded into env at runtime.

### Testing the Spend Flow

1. Run `bash scripts/preflight-deployment.sh deployments/mainnet.json`.
2. Start the app with the signer, owner key, and `DIRECT_PILOT_ENABLED=true` set.
3. Open `/dashboard/overview` and confirm vault balance, caps, and sponsor deposit read live.
4. Click **Spend 0.50 USDT** - expect approval and vendor payment.
5. Click **Try 3 USDT (blocked)** - expect `exceeds maxPerTx` with zero movement.
6. Verify both receipts on scan.botchain.ai.

## Spend Token Policy

- `BOT` is the native gas token on BOT Chain.
  It funds transaction fees and the paymaster deposit.
- The only supported spend token is BOT Chain's official bridged USDT: `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`.
- No mock or mintable test token exists on mainnet deployments.

## Brand Assets

The Spenda mark ("spend gate") lives in `web/app/icon.svg` with PNG renders ready for reuse:

| Asset | Path |
|---|---|
| Favicon source SVG | `web/app/icon.svg` |
| Favicon PNG | `web/app/icon.png` (512px) |
| Apple touch icon | `web/app/apple-icon.png` (180px) |
| Mark PNG for decks/posts | `web/public/spenda-mark-512.png`, `web/public/spenda-mark-1024.png` |
| Mark SVG for print/large use | `web/public/spenda-mark.svg` |

Brand colors: orange primary `#fe6a00`, dark surface `#1e1e24`, neutral line `#3d3c44`.

## Roadmap

Shipped: vault custody, restricted agents, per-agent policies, allowlists, approve/block fence with reasons, gasless ERC-4337 execution, receipts, dashboard, live mainnet proof.

Next: intent-based spending, per-intent budgets, agent-to-agent payments, risk scoring, human-approval escalation, RWA spending category, org-chart UI for agent fleets.
