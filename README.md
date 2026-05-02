# Programmable Virtual Addresses

A TIP-1022 split-routing forwarder on Tempo. A virtual address that automatically fans incoming deposits out to N recipients based on declarative rules.

> "Superfluid for deposits — declarative, atomic, no special senders required."

## What it does

When a sender pays a virtual address, TIP-1022 routes the transfer to a master contract (`SplitForwarder`). The forwarder distributes the deposit to recipients according to per-`userTag` rules — atomically, with no awareness required from the sender.

**Use cases:** creator splits, DAO contributions, affiliate commissions, subscription pools, per-listing marketplace splits.

## Deployed (Tempo Moderato testnet)

| | |
|---|---|
| SplitForwarder | `0x502CD09DD40cd2169ae4e6Fbe85CD60656DA0ceC` |
| masterId | `0xef098ed8` |
| Token (pathUSD) | `0x20c0000000000000000000000000000000000000` |
| RPC | `https://rpc.moderato.tempo.xyz` |
| Explorer | `https://explore.testnet.tempo.xyz` |

## Stack

- **contracts/** — Solidity (Foundry). `SplitForwarder.sol` with idempotent processing, pull-based fallback, and dust-safe rounding.
- **packages/sdk/** — TypeScript SDK. Virtual address derivation via `ox/tempo`, contract client, event watcher.
- **packages/keeper/** — Cloudflare Worker (cron, 1 min). Polls RPC for deposits, calls `processBatch`.
- **apps/demo/** — Next.js demo. Deploy forwarder → set rules → generate virtual addresses → watch live splits.
- **scripts/deploy.ts** — Node.js deploy script for throwaway EOA (alternative to browser deploy).

## Architecture

```
Sender → Virtual Address (masterId || 0xfdfd...fdfd || userTag)
                              ↓ (TIP-1022 forwards in same tx)
                       SplitForwarder.sol
                              ↓ (keeper calls processBatch every ~1 min)
                    Recipient A | Recipient B | Recipient C
```

## Repo

```
programmable-va/
  contracts/          # Foundry — SplitForwarder.sol
  scripts/            # Node.js deploy script
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
cd packages/keeper && npx wrangler dev
```

## Deploy

### Contract

The demo app deploys via CREATE2 factory in-browser using a passkey (Tempo AA) wallet. No EOA or Foundry needed.

Alternatively, use the Node.js script with a throwaway EOA:

```bash
# fund a fresh wallet via faucet
cast rpc tempo_fundAddress <ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz

# deploy
PRIVATE_KEY=<KEY> pnpm deploy
```

### Keeper

```bash
cd packages/keeper

# generate a fresh keeper wallet (no ETH needed — Tempo uses pathUSD for gas)
cast wallet new

# set secret
echo "<PRIVATE_KEY>" | npx wrangler secret put KEEPER_PRIVATE_KEY

# update wrangler.toml: FORWARDER_ADDRESS
npx wrangler deploy
```

### Demo

```bash
cd apps/demo && vercel
```

## Key design decisions

| Decision | Why |
|---|---|
| CREATE2 factory deploy | Tempo AA wallets cannot do direct `CREATE` — factory call is a regular `to:` tx |
| WASM salt mining (`ox@0.14.20`) | `VirtualMaster.mineSaltAsync` runs ~30M hash/s via worker pool vs ~200k/s pure-JS |
| `percentBps` sum = 10000 | Basis points enforce precision, validated at `setRule` |
| Last recipient absorbs dust | 33/33/34 split — deterministic, no leftover wei |
| `(userTag, depositId)` idempotency | Keeper retries are safe |
| Pull-based `claim()` fallback | Recipients never stuck if keeper goes down |
| Cron polling, no webhooks | Simpler infra, no webhook setup required |
| pathUSD as gas token | Tempo has no native ETH — gas paid in pathUSD, `tempo_fundAddress` faucet covers it |

## Background

- [TIP-1022](https://docs.tempo.xyz/protocol/tips/tip-1022) — virtual address spec
- [ox/tempo VirtualAddress](https://github.com/wevm/ox) — encoding/parsing
- [ox/tempo VirtualMaster](https://github.com/wevm/ox) — salt mining + registration
