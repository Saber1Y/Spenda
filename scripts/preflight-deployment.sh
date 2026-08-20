#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:-deployments/testnet-968.json}"

if ! command -v cast >/dev/null 2>&1; then
  printf 'error: Foundry cast is required\n' >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf 'error: jq is required\n' >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  printf 'error: manifest not found: %s\n' "$MANIFEST" >&2
  exit 1
fi

CHAIN_ID=$(jq -r '.chainId' "$MANIFEST")
RPC_URL=$(jq -r '.rpcUrl' "$MANIFEST")
VAULT=$(jq -r '.vault' "$MANIFEST")
PAYMASTER=$(jq -r '.paymaster' "$MANIFEST")
ENTRYPOINT=$(jq -r '.entryPoint' "$MANIFEST")
TOKEN=$(jq -r '.mockUsd // .supportedToken' "$MANIFEST")
FACTORY=$(jq -r '.restrictedAccountFactory' "$MANIFEST")
AGENT=$(jq -r '.demoAgent // empty' "$MANIFEST")
OWNER=$(jq -r '.owner' "$MANIFEST")

if [ "$CHAIN_ID" = "0" ] || [ -z "$RPC_URL" ] || [ -z "$VAULT" ] || [ -z "$PAYMASTER" ] || [ -z "$ENTRYPOINT" ] || [ -z "$TOKEN" ] || [ -z "$FACTORY" ] || [ -z "$OWNER" ]; then
  printf 'error: manifest is incomplete\n' >&2
  exit 1
fi

ACTUAL_CHAIN=$(cast chain-id --rpc-url "$RPC_URL")
if [ "$ACTUAL_CHAIN" != "$CHAIN_ID" ]; then
  printf 'error: expected chain %s, got %s\n' "$CHAIN_ID" "$ACTUAL_CHAIN" >&2
  exit 1
fi

check_code() {
  local name="$1"
  local address="$2"
  local code
  code=$(cast code "$address" --rpc-url "$RPC_URL")
  if [ "$code" = "0x" ]; then
    printf 'error: %s has no deployed code: %s\n' "$name" "$address" >&2
    exit 1
  fi
  printf 'ok: %-28s %s\n' "$name" "$address"
}

check_code "EntryPoint" "$ENTRYPOINT"
check_code "Vault" "$VAULT"
check_code "Paymaster" "$PAYMASTER"
check_code "Token" "$TOKEN"
check_code "RestrictedFactory" "$FACTORY"

VAULT_OWNER=$(cast call "$VAULT" 'owner()(address)' --rpc-url "$RPC_URL")
VAULT_OWNER_LOWER=$(printf '%s' "$VAULT_OWNER" | tr '[:upper:]' '[:lower:]')
OWNER_LOWER=$(printf '%s' "$OWNER" | tr '[:upper:]' '[:lower:]')
if [ "$VAULT_OWNER_LOWER" != "$OWNER_LOWER" ]; then
  printf 'error: vault owner mismatch: manifest=%s chain=%s\n' "$OWNER" "$VAULT_OWNER" >&2
  exit 1
fi

PAYMASTER_VAULT=$(cast call "$PAYMASTER" 'VAULT()(address)' --rpc-url "$RPC_URL")
PAYMASTER_VAULT_LOWER=$(printf '%s' "$PAYMASTER_VAULT" | tr '[:upper:]' '[:lower:]')
VAULT_LOWER=$(printf '%s' "$VAULT" | tr '[:upper:]' '[:lower:]')
if [ "$PAYMASTER_VAULT_LOWER" != "$VAULT_LOWER" ]; then
  printf 'error: paymaster vault binding mismatch\n' >&2
  exit 1
fi

FACTORY_VAULT=$(cast call "$FACTORY" 'vault()(address)' --rpc-url "$RPC_URL")
FACTORY_PAYMASTER=$(cast call "$FACTORY" 'paymaster()(address)' --rpc-url "$RPC_URL")
FACTORY_VAULT_LOWER=$(printf '%s' "$FACTORY_VAULT" | tr '[:upper:]' '[:lower:]')
FACTORY_PAYMASTER_LOWER=$(printf '%s' "$FACTORY_PAYMASTER" | tr '[:upper:]' '[:lower:]')
PAYMASTER_LOWER=$(printf '%s' "$PAYMASTER" | tr '[:upper:]' '[:lower:]')
if [ "$FACTORY_VAULT_LOWER" != "$VAULT_LOWER" ] || [ "$FACTORY_PAYMASTER_LOWER" != "$PAYMASTER_LOWER" ]; then
  printf 'error: restricted factory binding mismatch\n' >&2
  exit 1
fi

printf 'ok: chain id                    %s\n' "$ACTUAL_CHAIN"
printf 'ok: vault owner                 %s\n' "$VAULT_OWNER"
printf 'ok: paymaster and factory bind to vault\n'

if [ -n "$AGENT" ]; then
  check_code "DemoAgent" "$AGENT"
  AGENT_VAULT=$(cast call "$AGENT" 'vault()(address)' --rpc-url "$RPC_URL")
  AGENT_PAYMASTER=$(cast call "$AGENT" 'paymaster()(address)' --rpc-url "$RPC_URL")
  AGENT_OWNER=$(cast call "$AGENT" 'owner()(address)' --rpc-url "$RPC_URL")
  AGENT_VAULT_LOWER=$(printf '%s' "$AGENT_VAULT" | tr '[:upper:]' '[:lower:]')
  AGENT_PAYMASTER_LOWER=$(printf '%s' "$AGENT_PAYMASTER" | tr '[:upper:]' '[:lower:]')
  if [ "$AGENT_VAULT_LOWER" != "$VAULT_LOWER" ] || [ "$AGENT_PAYMASTER_LOWER" != "$PAYMASTER_LOWER" ]; then
    printf 'error: demo agent binding mismatch\n' >&2
    exit 1
  fi
  printf 'ok: demo agent owner             %s\n' "$AGENT_OWNER"
fi

printf 'preflight passed: %s\n' "$MANIFEST"
