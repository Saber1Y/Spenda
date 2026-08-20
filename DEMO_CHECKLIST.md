# Spenda Testnet Demo Checklist

Run `scripts/preflight-deployment.sh deployments/testnet-968.json` before the demo.

## Setup

- Connect the vault owner wallet on BOT Chain testnet 968.
- Confirm the Monitoring page has a fresh healthy snapshot.
- Confirm the paymaster deposit is nonzero.
- Confirm all agent native balances and EntryPoint deposits are zero.
- Confirm the active agent has an allowlisted token and target.

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
