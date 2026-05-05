"use client";

import { useState } from "react";
import { type Address, type Hex } from "viem";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ForwarderSetup } from "@/components/ForwarderSetup";
import { RulesEditor } from "@/components/RulesEditor";
import { useTempoAccount } from "@/hooks/useTempoAccount";

const STORAGE_KEY = "programmable-vas:forwarder";

function loadForwarder() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { address: Address; masterId: Hex }) : null;
  } catch {
    return null;
  }
}

function saveForwarder(f: { address: Address; masterId: Hex }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

export default function Home() {
  const { isConnected } = useTempoAccount();
  const [forwarder, setForwarder] = useState<{
    address: Address;
    masterId: Hex;
  } | null>(() => loadForwarder());

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          Programmable Virtual Addresses
        </h1>
        <p className="text-sm text-zinc-400">
          TIP-1022 split-routing forwarder on Tempo. Deploy a forwarder, set
          split rules, and watch deposits fan out automatically.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">Tempo</span>
          <a href="/store" className="text-xs text-indigo-400 hover:text-indigo-300">MPP Store →</a>
        </div>
        <ConnectWallet />
      </div>

      {!isConnected && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Connect your wallet to get started.
        </div>
      )}

      {isConnected && !forwarder && (
        <ForwarderSetup
          onForwarderReady={(address, masterId) => {
            const f = { address, masterId };
            saveForwarder(f);
            setForwarder(f);
          }}
        />
      )}

      {isConnected && forwarder && (
        <>
          <div className="bg-zinc-900 rounded-lg p-4 text-xs font-mono space-y-1">
            <div className="text-zinc-500">Forwarder</div>
            <div className="text-zinc-200">{forwarder.address}</div>
            <div className="text-zinc-500 mt-1">masterId</div>
            <div className="text-indigo-400">{forwarder.masterId}</div>
          </div>

          <RulesEditor
            forwarder={forwarder.address}
            masterId={forwarder.masterId}
          />
        </>
      )}
    </main>
  );
}
