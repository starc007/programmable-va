# Programmable Virtual Addresses

A TIP-1022 split-routing forwarder on Tempo. A virtual address that automatically fans incoming deposits out to N recipients based on declarative rules.

> "Superfluid for deposits — declarative, atomic, no special senders required."

## What it does

When a sender pays a virtual address, TIP-1022 routes the transfer to a master contract (`SplitForwarder`). The forwarder distributes the deposit to recipients according to per-`userTag` rules — atomically, with no awareness required from the sender.

**Use cases:** creator splits, DAO contributions, affiliate commissions, subscription pools, per-listing marketplace splits.

## Stack

- **contracts/** — Solidity (Foundry). `SplitForwarder.sol` with idempotent processing, pull-based fallback, and dust-safe rounding.
- **packages/sdk/** — TypeScript SDK. Virtual address derivation via `ox/tempo`, contract client, event watcher.
- **packages/keeper/** — Cloudflare Worker (cron, 15s). Polls RPC for deposits, calls `processBatch`.
- **apps/demo/** — Next.js demo. Deploy forwarder → set rules → generate virtual addresses → watch live splits.

## Architecture

```
Sender → Virtual Address (masterId || 0xfdfd...fdfd || userTag)
                              ↓ (TIP-1022 forwards)
                       SplitForwarder.sol
                              ↓ (keeper calls processBatch every 15s)
                    Recipient A | Recipient B | Recipient C
```

## Repo

```
programmable-va/
  contracts/          # Foundry — SplitForwarder.sol
  packages/
    sdk/              # @programmable-vas/sdk
    keeper/           # Cloudflare Worker
  apps/
    demo/             # Next.js operator UI + live watch
```

## Run locally

```bash
pnpm install

# demo
cd apps/demo && pnpm dev

# keeper (needs wrangler.toml configured + KEEPER_PRIVATE_KEY secret)
cd packages/keeper && pnpm dev

# contracts
cd contracts && forge build
```

## Deploy

```bash
# 1. deploy contract to Moderato testnet
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.moderato.tempo.xyz \
  --broadcast \
  --private-key $PRIVATE_KEY

# 2. deploy keeper
cd packages/keeper
wrangler secret put KEEPER_PRIVATE_KEY
wrangler kv namespace create STATE
# update wrangler.toml with KV namespace ID and FORWARDER_ADDRESS
wrangler deploy

# 3. deploy demo
cd apps/demo && vercel
```

## Key design decisions

| Decision | Why |
|---|---|
| `percentBps` sum = 10000 | Basis points enforce precision, validated at `setRule` |
| Last recipient absorbs dust | 33/33/34 split — deterministic, no leftover wei |
| `(userTag, depositId)` idempotency | Keeper retries are safe |
| Pull-based `claim()` fallback | Recipients never stuck if keeper goes down |
| Cron polling, no webhooks | Simpler infra, no webhook setup required |

## Background

- [TIP-1022](https://docs.tempo.xyz/protocol/tips/tip-1022) — virtual address spec
- [ox/tempo VirtualAddress](https://github.com/wevm/ox) — encoding/parsing
- [ox/tempo VirtualMaster](https://github.com/wevm/ox) — salt mining + registration
