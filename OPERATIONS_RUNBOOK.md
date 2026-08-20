# Spenda Operations Runbook

Spenda monitoring is read-only and never retries UserOperations or moves funds automatically.

## Alerts

- `LOW_PAYMASTER`: fund the paymaster through the owner wallet after verifying the EntryPoint deposit.
- `LOW_VAULT_BALANCE`: fund the vault with a supported token after verifying the recipient and token allowlists.
- `AGENT_CUSTODY_VIOLATION`: pause or revoke the affected agent immediately and investigate unexpected native or EntryPoint balances.
- `STUCK_EXECUTION`: do not resubmit blindly; inspect the UserOperation hash, bundler receipt, EntryPoint nonce, and vault action ID before reconciliation.
- RPC or indexer degradation: stop autonomous execution and use the owner wallet to revoke agents if chain state cannot be read reliably.

## Emergency Response

1. Open the Monitoring page and record the latest snapshot and alert evidence.
2. Revoke the affected agent from the Agents page using the vault owner wallet.
3. Confirm the on-chain policy is inactive.
4. Do not fund agent accounts or EntryPoint deposits.
5. Preserve the UserOperation hash, transaction hash, block number, and action ID.
6. Reconcile uncertain executions only after checking on-chain events.

The vault remains the final authorization boundary.
