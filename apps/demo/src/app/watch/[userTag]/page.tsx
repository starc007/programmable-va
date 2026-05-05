"use client";

import { use, useEffect, useState, useSyncExternalStore } from "react";
import {
  type Address,
  type Hex,
  formatUnits,
  erc20Abi,
  parseUnits,
} from "viem";
import { watchSplits, deriveVirtualAddress } from "@programmable-vas/sdk";
import { publicClient } from "@/lib/provider";
import { useTempoAccount } from "@/hooks/useTempoAccount";
import { useTempoClient } from "@/hooks/useTempoClient";
import Link from "next/link";

const TOKEN = "0x20c0000000000000000000000000000000000000" as Address;

type LocalState = {
  forwarderAddress: string;
  virtualAddress: string;
  watching: boolean;
  ruleExists: boolean | null;
};
const DEFAULT_LOCAL: LocalState = {
  forwarderAddress: "",
  virtualAddress: "",
  watching: false,
  ruleExists: null,
};
let _localCache: { key: string; value: LocalState } | null = null;

function getLocalSnapshot(userTag: string): LocalState {
  const raw = (() => {
    try {
      return localStorage.getItem("programmable-vas:forwarder");
    } catch {
      return null;
    }
  })();
  const rulesRaw = (() => {
    try {
      if (!raw) return null;
      const { address } = JSON.parse(raw) as { address: string };
      return localStorage.getItem(`programmable-vas:rules:${address}`);
    } catch {
      return null;
    }
  })();
  const cacheKey = `${userTag}|${raw}|${rulesRaw}`;
  if (_localCache?.key === cacheKey) return _localCache.value;
  const value = (() => {
    try {
      if (!raw) return DEFAULT_LOCAL;
      const { address, masterId } = JSON.parse(raw) as {
        address: string;
        masterId: Hex;
      };
      const rules: { userTag: string }[] = rulesRaw ? JSON.parse(rulesRaw) : [];
      return {
        forwarderAddress: address,
        virtualAddress: deriveVirtualAddress({
          masterId,
          userTag: userTag as Hex,
        }),
        watching: true,
        ruleExists: rules.some(
          (r) => r.userTag.toLowerCase() === userTag.toLowerCase(),
        ),
      };
    } catch {
      return DEFAULT_LOCAL;
    }
  })();
  _localCache = { key: cacheKey, value };
  return value;
}

type SplitEvent = {
  userTag: Hex;
  token: Address;
  amount: bigint;
  recipientCount: bigint;
  txHash: Hex | null;
  at: Date;
};

export default function WatchPage({
  params,
}: {
  params: Promise<{ userTag: string }>;
}) {
  const { userTag } = use(params);
  const { address } = useTempoAccount();
  const walletClient = useTempoClient();

  const local = useSyncExternalStore(
    () => () => {},
    () => getLocalSnapshot(userTag),
    () => DEFAULT_LOCAL,
  );
  const { forwarderAddress, virtualAddress, ruleExists } = local;

  const [manualWatching, setManualWatching] = useState<boolean | null>(null);
  const watching = manualWatching ?? local.watching;

  const [events, setEvents] = useState<SplitEvent[]>([]);
  const [error, setError] = useState("");

  const [amount, setAmount] = useState("1");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  useEffect(() => {
    if (!watching || !forwarderAddress) return;

    let stopWatch: (() => void) | null = null;
    let active = true;

    async function start() {
      try {
        // load past Split events from last 500 blocks
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 500n ? currentBlock - 500n : 0n;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pastLogs = await (publicClient as any).getLogs({
          address: forwarderAddress as Address,
          event: {
            type: "event",
            name: "Split",
            inputs: [
              { name: "userTag", type: "bytes6", indexed: true },
              { name: "token", type: "address", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
              { name: "recipientCount", type: "uint256", indexed: false },
            ],
          },
          args: { userTag: userTag as `0x${string}` },
          fromBlock,
          toBlock: currentBlock,
        });
        if (active && pastLogs.length > 0) {
          const past = pastLogs.map(
            (log: {
              args: { token: Address; amount: bigint; recipientCount: bigint };
              transactionHash: Hex;
              blockNumber: bigint;
            }) => ({
              userTag: userTag as Hex,
              token: log.args.token,
              amount: log.args.amount ?? 0n,
              recipientCount: log.args.recipientCount ?? 0n,
              txHash: log.transactionHash,
              at: new Date(Number(log.blockNumber) * 1000),
            }),
          );
          setEvents(past.reverse());
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stopWatch = watchSplits(
          publicClient as any,
          forwarderAddress as Address,
          (event) => {
            if (event.userTag.toLowerCase() !== userTag.toLowerCase()) return;
            if (active)
              setEvents((prev) => [
                { ...event, txHash: event.txHash, at: new Date() },
                ...prev,
              ]);
          },
        );
      } catch (err) {
        if (active) setError(String(err));
      }
    }

    start();

    return () => {
      active = false;
      stopWatch?.();
    };
  }, [watching, forwarderAddress, userTag]);

  async function send() {
    if (!address || !walletClient || !virtualAddress || !amount) return;
    setSending(true);
    setSendError("");
    setLastTx(null);
    try {
      const parsed = parseUnits(amount, 6);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await (walletClient as any).writeContract({
        address: TOKEN,
        abi: erc20Abi,
        functionName: "transfer",
        args: [virtualAddress as Address, parsed],
        account: address,
      });
      setLastTx(hash as Hex);
    } catch (err) {
      setSendError(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← back
        </Link>
        <h1 className="text-xl font-bold">Live Split Watch</h1>
      </div>

      <div className="bg-zinc-900 rounded-lg p-4 text-xs font-mono space-y-1">
        <div className="text-zinc-500">userTag</div>
        <div className="text-indigo-400">{userTag}</div>
      </div>

      {ruleExists === false && (
        <div className="flex items-start justify-between gap-4 bg-yellow-950 border border-yellow-800 rounded-lg p-4">
          <div className="text-sm text-yellow-200">
            No split rule for this userTag. Payments will reach the virtual
            address but won&apos;t be forwarded.
          </div>
          <Link
            href="/"
            className="shrink-0 px-3 py-1.5 rounded bg-yellow-700 hover:bg-yellow-600 text-xs font-medium text-yellow-100 transition-colors"
          >
            create rule →
          </Link>
        </div>
      )}

      {/* Watch config */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">
            Forwarder address
          </label>
          <input
            value={forwarderAddress}
            readOnly
            placeholder="0x..."
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-400"
          />
        </div>

        <button
          onClick={() => setManualWatching(!watching)}
          disabled={!forwarderAddress}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 ${
            watching
              ? "bg-red-900 hover:bg-red-800 text-red-200"
              : "bg-green-900 hover:bg-green-800 text-green-200"
          }`}
        >
          {watching ? "■ stop watching" : "▶ start watching"}
        </button>

        {watching && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            watching for Split events…
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Send section */}
      <div className="space-y-3 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold">
          Send pathUSD to virtual address
        </h2>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">
            Virtual address
          </label>
          <input
            value={virtualAddress}
            readOnly
            placeholder="0xef098ed8…"
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm font-mono text-zinc-400"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">
            Amount (pathUSD)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            type="number"
            min="0"
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {sendError && (
          <p className="text-xs text-red-400 break-all">{sendError}</p>
        )}

        {lastTx && (
          <div className="text-xs font-mono break-all">
            <span className="text-zinc-500">tx: </span>
            <a
              href={`https://explore.testnet.tempo.xyz/tx/${lastTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              {lastTx}
            </a>
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !address || !virtualAddress || !amount}
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium transition-colors"
        >
          {sending ? "sending…" : !address ? "connect wallet" : "send"}
        </button>
      </div>

      {/* Events */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">
          Split Events {events.length > 0 && `(${events.length})`}
        </h2>

        {events.length === 0 && (
          <div className="text-sm text-zinc-600 py-6 text-center border border-dashed border-zinc-800 rounded-lg">
            No splits yet. Send pathUSD to the virtual address above.
          </div>
        )}

        {events.map((event, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{event.at.toLocaleTimeString()}</span>
              <span>{Number(event.recipientCount)} recipients</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-green-400">
                {formatUnits(event.amount, 6)}
              </span>
              <span className="text-zinc-500 ml-1">pathUSD</span>
            </div>
            <div className="font-mono text-xs text-zinc-500 break-all">
              token: {event.token}
            </div>
            {event.txHash && (
              <div className="font-mono text-xs break-all">
                <span className="text-zinc-500">tx: </span>
                <a
                  href={`https://explore.testnet.tempo.xyz/tx/${event.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {event.txHash}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
