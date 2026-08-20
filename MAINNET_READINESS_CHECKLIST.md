# Spenda Mainnet Readiness Checklist

This checklist is intentionally separate from testnet readiness.
Do not broadcast a mainnet deployment until every required value is verified.

## Network and Contracts

- [x] Official BOT Chain mainnet chain ID confirmed: `677`.
- [x] Official mainnet RPC confirmed: `https://rpc.botchain.ai`.
- [ ] Official mainnet bundler confirmed.
- [ ] Official mainnet EntryPoint address confirmed.
- [x] Official supported stablecoin confirmed: USDT at `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`, 6 decimals.
- [ ] Contract source verified on the mainnet explorer.
- [ ] `BOTSpendVault` owner constructor address verified.
- [ ] `BOTSpendPaymaster.VAULT()` matches the deployed vault.
- [ ] `RestrictedAgentAccountFactory.vault()` matches the deployed vault.
- [ ] `RestrictedAgentAccountFactory.paymaster()` matches the deployed paymaster.

## Key Separation

- [ ] Mainnet vault owner is a dedicated multisig or protected owner wallet.
- [ ] Mainnet paymaster verifying signer is a separate key.
- [ ] Mainnet agent owner keys are separate from the vault owner where possible.
- [ ] No testnet private key is reused for mainnet.
- [ ] Key backup and rotation procedure is documented.

## Funding and Limits

- [ ] Initial vault funding amount approved.
- [ ] Initial paymaster deposit approved.
- [ ] Agent max transaction limits approved.
- [ ] Agent daily caps approved.
- [ ] RWA approval thresholds approved.
- [ ] Auto-approval is disabled for the first pilot or limited to a very small amount.
- [ ] Emergency revocation procedure tested.

## Monitoring and Incident Response

- [ ] Monitoring snapshot runs against mainnet.
- [ ] Paymaster low-balance alert tested.
- [ ] Vault low-balance alert tested.
- [ ] Agent custody violation alert tested.
- [ ] Stuck execution reconciliation tested.
- [ ] RPC and bundler outage response tested.
- [ ] Incident runbook reviewed by the project owner.

## Pilot Gate

- [ ] One low-value real-token transaction succeeds.
- [ ] One policy-blocked transaction is observed.
- [ ] One human approval transaction succeeds.
- [ ] Receipts contain chain-derived transaction hashes.
- [ ] No agent holds native funds or EntryPoint deposits.
- [ ] Independent security review completed.
