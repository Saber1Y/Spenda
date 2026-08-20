# Spenda Token Policy

## Native Gas

`BOT` is BOT Chain's native utility token.
It pays transaction fees and funds the ERC-4337 paymaster deposit.
It is not the default dollar-denominated spending asset.

## Testnet

The current Spenda deployment uses `MockUSD` (`mUSD`) at `0xAD6F06ebA7927FC0f114c296C221fCfd6C5eBf58`.
It has 6 decimals and is mintable for deterministic testing.
It has no monetary value and must always be labeled test-only.

BOT Chain also publishes an official testnet USDT contract at `0x75edC9335175Fc0552D51D48439F229c10420fe3`.
Moving the demo to testnet USDT requires obtaining or bridging that token and configuring a new or updated vault allowlist.

## Mainnet

The official BOT Chain bridge supports USDT.
The published mainnet USDT contract is `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` with 6 decimals.

Mainnet deployment rules:

- Do not deploy or mint `MockUSD`.
- Configure the vault with official USDT.
- Verify `name()`, `symbol()`, `decimals()`, deployed bytecode, and the official documentation address before funding.
- Keep BOT only in the owner wallet and paymaster deposit as required for gas.
- Do not transfer BOT or USDT into restricted agent accounts.

Official sources:

- BOT Chain Quick Guide: https://dev-docs.botchain.ai/docs/Developers/quick-guide/
- Bridge supported assets: https://dev-docs.botchain.ai/docs/Bridge/supported-chains/
- Bridge contract addresses: https://dev-docs.botchain.ai/docs/Bridge/contract-addresses/
