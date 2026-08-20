# Spenda Testnet Demo Checklist

Run `scripts/preflight-deployment.sh deployments/testnet-968.json` before the demo.

## Setup

- Connect the vault owner wallet on BOT Chain testnet 968.
- Confirm the Monitoring page has a fresh healthy snapshot.
- Confirm the paymaster deposit is nonzero.
- Confirm all agent native balances and EntryPoint deposits are zero.
- Confirm the active agent has an allowlisted token and target.
- Confirm the Research Agent has a separate 10 mUSD max transaction and 50 mUSD daily cap.

## Story

1. Open Commerce and select the paying agent.
2. Create the Spotify or AI API credit intent.
3. Show the deterministic risk decision and automatic execution.
4. Open Receipts and show the UserOperation and transaction hash.
5. Create a new-recipient or higher-value intent.
6. Open Approvals and show the risk factors.
7. Approve it with the owner wallet.
8. Show the receipt after chain reconciliation.
9. Create an RWA-category intent and show its risk multiplier.
10. Open Agents and pause the paying agent.
11. Attempt another Commerce request and show that no active paying agent is available.
12. Resume the agent and confirm its budget projection refreshes.
13. Demonstrate a policy block using an amount above the agent max transaction limit.
14. Open Monitoring and show the operational snapshot.
15. On the Agents page, register the Research Agent in the authenticated Base44 session if it is not already listed.
16. Return to Commerce and switch between the Procurement Agent and Research Agent.
17. Create a request above the Research Agent's 10 mUSD max transaction limit and show the policy block.

## Evidence

Capture the following for every executed flow:

- Intent ID.
- Agent address.
- Action ID.
- UserOperation hash.
- Transaction hash.
- BOTScan transaction URL.
- Receipt decision.
- Risk score and policy version.

The Merchant Sandbox simulates fulfillment.
The Spenda payment authorization and transaction are real BOT Chain testnet activity.

## Current Testnet Agents

- Primary Procurement Agent: `0x2649495B56e8c06C6682549438ac9279599A3aD8`
  - Salt: `0`
  - Max transaction: `50 mUSD`
  - Daily cap: `250 mUSD`
- Research Agent: `0x02B56f3Bd6fb799AE3acF9053A69FA99EE3899b5`
  - Salt: `1`
  - Max transaction: `10 mUSD`
  - Daily cap: `50 mUSD`
