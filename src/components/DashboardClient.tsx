"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, keccak256, toBytes } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { Providers } from "./Providers";
import { RiskGauge } from "./RiskGauge";
import { FlagCard } from "./FlagCard";
import { ScanHistory } from "./ScanHistory";
import { analyzeWallet } from "@/lib/fraudChecks";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

const STATUS_MESSAGES = [
  "Establishing connection to Ritual Chain...",
  "Fetching transaction history...",
  "Mapping counterparty network...",
  "Running pattern analysis...",
  "Checking burst activity...",
  "Analyzing transfer flows...",
  "Computing behavioral signatures...",
  "Consulting CIPHER...",
  "Generating risk assessment...",
  "Finalizing report...",
];

interface CipherResult {
  riskScore: number;
  riskLevel: string;
  flagAnalysis: {
    name: string;
    flagged: boolean;
    severity: string;
    cipherNote: string;
  }[];
  verdict: string;
  summary: string;
}

function DashboardInner() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [inputAddress, setInputAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CipherResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedAddress, setScannedAddress] = useState("");
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [txRecording, setTxRecording] = useState(false);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  const fillMyWallet = () => {
    if (address) setInputAddress(address);
  };

  const startStatusCycle = () => {
    let idx = 0;
    setStatusIdx(0);
    setProgress(0);
    statusIntervalRef.current = setInterval(() => {
      idx++;
      setStatusIdx(Math.min(idx, STATUS_MESSAGES.length - 1));
      setProgress(Math.min((idx / STATUS_MESSAGES.length) * 100, 95));
    }, 900);
  };

  const stopStatusCycle = () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    setProgress(100);
  };

  // Record scan on-chain AFTER results are shown -- non-blocking
  const recordOnChain = async (cipherResult: CipherResult, target: string) => {
    if (!isConnected || !address) return;
    setTxRecording(true);
    try {
      const reportHash = keccak256(toBytes(JSON.stringify(cipherResult))) as `0x${string}`;
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "recordScan",
        args: [target as `0x${string}`, cipherResult.riskLevel, reportHash],
        value: parseEther("0.001"),
      });
      setPendingTxHash(txHash);
    } catch (err) {
      console.warn("Contract recording failed or rejected:", err);
    } finally {
      setTxRecording(false);
    }
  };

  const runScan = async () => {
    const trimmed = inputAddress.trim();
    if (!trimmed || !trimmed.startsWith("0x") || trimmed.length !== 42) {
      setError("Please enter a valid wallet address (starts with 0x, 42 characters).");
      return;
    }

    setError(null);
    setResult(null);
    setPendingTxHash(undefined);
    setScanning(true);
    setScannedAddress(trimmed);
    startStatusCycle();

    try {
      // Step 1: Rule-based on-chain checks
      let walletData: Awaited<ReturnType<typeof analyzeWallet>>["walletData"];
      let flags: Awaited<ReturnType<typeof analyzeWallet>>["flags"];

      try {
        const analysis = await analyzeWallet(trimmed);
        walletData = analysis.walletData;
        flags = analysis.flags;
      } catch (rpcErr) {
        console.warn("RPC analysis partial failure -- using fallback data:", rpcErr);
        // Fallback: send minimal data so CIPHER can still run
        walletData = {
          transactionCount: 0,
          walletAgeInDays: 0,
          uniqueCounterparties: 0,
          largestInflow: "0.0000",
          largestOutflow: "0.0000",
          mostActiveDay: "N/A",
          avgDailyTransactions: 0,
        };
        flags = [
          { name: "Wallet Age", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Burst Activity", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Fan-Out Pattern", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Rapid Drain", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Round Number Transactions", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Single Counterparty Dominance", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Bot-Like Timing Pattern", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
          { name: "Zero Value Transactions", flagged: false, severity: "low", detail: "RPC data unavailable for this check." },
        ];
      }

      // Step 2: Call Groq / CIPHER
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: trimmed, walletData, flags }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`CIPHER API error (${res.status}): ${errBody}`);
      }

      const cipherResult: CipherResult = await res.json();

      if (!cipherResult.riskScore === undefined || !cipherResult.riskLevel || !cipherResult.flagAnalysis) {
        throw new Error("CIPHER returned an incomplete response. Please try again.");
      }

      stopStatusCycle();

      setResult(cipherResult);
      setScanning(false);

    } catch (err: unknown) {
      stopStatusCycle();
      const msg = err instanceof Error ? err.message : "Unknown error occurred.";
      setError(msg);
      setScanning(false);
    }
  };

  const handleSelectScan = (addr: string) => {
    setInputAddress(addr);
    setResult(null);
    setError(null);
  };

  const resetScan = () => {
    setResult(null);
    setError(null);
    setInputAddress("");
    setPendingTxHash(undefined);
  };

  function getRiskColor(score: number): string {
    if (score <= 15) return "#00ff88";
    if (score <= 35) return "#00f5ff";
    if (score <= 60) return "#ff9500";
    return "#ff2d55";
  }
  const riskScoreColor = result ? getRiskColor(result.riskScore) : "#00f5ff";

  return (
    <div className="min-h-screen bg-cw-black flex flex-col">
      {/* Top nav */}
      <nav
        className="border-b border-cw-border px-6 py-3 flex items-center justify-between"
        style={{ background: "rgba(10,10,15,0.95)" }}
      >
        <div className="flex items-center gap-4">
          <span className="font-display font-black text-xl text-cw-text tracking-wider">
            CHAIN<span className="text-cw-cyan">WATCH</span>
          </span>
          <span className="hidden md:block font-mono text-xs text-cw-muted border border-cw-border px-2 py-1">
            by Hemisphere
          </span>
        </div>
        <ConnectButton showBalance={false} />
      </nav>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto mb-8"
          >
            <h2 className="font-display text-sm tracking-[0.3em] text-cw-muted uppercase mb-4 text-center">
              Wallet Intelligence Terminal
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="Enter any wallet address (0x...)"
                className="flex-1 bg-cw-panel border border-cw-border px-4 py-3 font-mono text-sm text-cw-text placeholder-cw-muted/40 outline-none focus:border-cw-cyan/50 transition-colors"
                disabled={scanning}
                onKeyDown={(e) => e.key === "Enter" && !scanning && runScan()}
              />
            </div>

            <div className="flex gap-2">
              {isConnected && (
                <button
                  onClick={fillMyWallet}
                  disabled={scanning}
                  className="flex-1 px-4 py-3 font-mono text-xs border border-cw-border text-cw-muted hover:border-cw-cyan/40 hover:text-cw-cyan transition-colors disabled:opacity-40"
                >
                  o SCAN MY WALLET
                </button>
              )}
              <button
                onClick={runScan}
                disabled={scanning || !inputAddress}
                className="flex-1 px-6 py-3 font-mono text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background: scanning ? "#1a1a2e" : "linear-gradient(135deg, #00f5ff, #00b8c4)",
                  color: scanning ? "#6b7280" : "#050508",
                }}
              >
                {scanning ? "ANALYZING..." : "> RUN SCAN"}
              </button>
            </div>

            <p className="font-mono text-xs text-cw-muted mt-2 text-center">
              On-chain recording optional -- 0.001 RITUAL per scan
            </p>
          </motion.div>

          {/* Error display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto mb-6 px-4 py-3 border border-cw-red/30 bg-cw-red/5"
              >
                <p className="font-mono text-sm text-cw-red">! {error}</p>
                <p className="font-mono text-xs text-cw-muted mt-1">
                  Check the browser console (F12) for details if this persists.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanning animation */}
          <AnimatePresence>
            {scanning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto mb-8"
              >
                <div className="panel p-6">
                  <div className="h-px bg-cw-border mb-6 overflow-hidden">
                    <div
                      className="h-full transition-all duration-700"
                      style={{
                        background: "linear-gradient(90deg, #00f5ff, #00b8c4)",
                        width: `${progress}%`,
                        boxShadow: "0 0 10px #00f5ff",
                      }}
                    />
                  </div>

                  <div className="mb-4 text-center">
                    <span className="font-mono text-xs text-cw-muted">ANALYZING</span>
                    <br />
                    <span className="font-mono text-sm text-cw-cyan break-all">{scannedAddress}</span>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-cw-cyan"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={statusIdx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="font-mono text-sm text-cw-muted"
                      >
                        {STATUS_MESSAGES[Math.min(statusIdx, STATUS_MESSAGES.length - 1)]}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {/* Binary rain decoration */}
                  <div className="mt-6 relative overflow-hidden" style={{ height: "60px" }}>
                    <div className="absolute inset-0 font-mono text-cw-cyan/15 leading-5 overflow-hidden select-none" style={{ fontSize: "10px" }}>
                      {Array.from({ length: 4 }, (_, i) => (
                        <div key={i}>{Array.from({ length: 80 }, () => Math.random() > 0.5 ? "1" : "0").join("")}</div>
                      ))}
                    </div>
                    <motion.div
                      className="absolute left-0 right-0 h-6 pointer-events-none"
                      style={{ background: "linear-gradient(180deg, transparent, rgba(0,245,255,0.08), transparent)" }}
                      animate={{ top: ["-20%", "120%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results panel */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">

                {/* Scan target header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 panel p-4 flex items-center justify-between flex-wrap gap-3"
                >
                  <div>
                    <span className="font-mono text-xs text-cw-muted tracking-widest">SCAN TARGET</span>
                    <br />
                    <span className="font-mono text-sm text-cw-cyan break-all">{scannedAddress}</span>
                  </div>
                  <button
                    onClick={resetScan}
                    className="font-mono text-xs border border-cw-border px-3 py-2 text-cw-muted hover:border-cw-cyan/40 hover:text-cw-cyan transition-colors"
                  >
                    NEW SCAN
                  </button>
                </motion.div>

                {/* Risk gauge + summary */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="panel p-8 mb-6 flex flex-col md:flex-row items-center gap-8"
                >
                  <RiskGauge score={result.riskScore} riskLevel={result.riskLevel} />
                  <div className="flex-1">
                    <div className="font-mono text-xs tracking-widest text-cw-muted uppercase mb-3">
                      Executive Summary
                    </div>
                    <p className="font-body text-lg leading-relaxed" style={{ color: riskScoreColor }}>
                      {result.summary}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        ["Risk Score", `${result.riskScore}/100`],
                        ["Flags Triggered", `${result.flagAnalysis.filter((f) => f.flagged).length} of ${result.flagAnalysis.length}`],
                      ].map(([label, value]) => (
                        <div key={label} className="px-3 py-2 border border-cw-border" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="font-mono text-xs text-cw-muted">{label}</div>
                          <div className="font-mono text-sm font-bold mt-0.5" style={{ color: riskScoreColor }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Flag breakdown */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
                  <div className="font-mono text-xs tracking-widest text-cw-muted uppercase mb-3 px-1">
                    Signal Breakdown
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {result.flagAnalysis.map((flag, i) => (
                      <FlagCard
                        key={flag.name}
                        name={flag.name}
                        flagged={flag.flagged}
                        severity={flag.severity}
                        cipherNote={flag.cipherNote}
                        index={i}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* CIPHER Verdict */}
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-6 panel">
                  <div className="px-5 py-3 border-b border-cw-border flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: riskScoreColor, boxShadow: `0 0 8px ${riskScoreColor}` }} />
                    <span className="font-mono text-xs tracking-widest text-cw-cyan uppercase">CIPHER Verdict</span>
                    <span className="font-mono text-xs text-cw-muted ml-auto">AI Analysis</span>
                  </div>
                  <div className="p-5">
                    <p className="font-mono text-sm text-cw-text leading-relaxed">
                      <span className="font-bold" style={{ color: riskScoreColor }}>CIPHER: </span>
                      {result.verdict}
                    </p>
                  </div>
                  <div className="px-5 pb-4 flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${riskScoreColor}40, transparent)` }} />
                    <span className="font-mono text-xs text-cw-muted/40">END OF REPORT</span>
                  </div>
                </motion.div>

                {/* On-chain recording -- explicit button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mb-8 panel p-5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="font-mono text-xs text-cw-cyan tracking-widest uppercase mb-1">
                        Record On-Chain
                      </p>
                      <p className="font-body text-sm text-cw-muted">
                        Permanently store this scan result on Ritual Chain. Costs 0.001 RITUAL.
                      </p>
                    </div>
                    {!txConfirmed ? (
                      <button
                        onClick={() => result && recordOnChain(result, scannedAddress)}
                        disabled={txRecording}
                        className="px-6 py-3 font-mono text-sm font-bold border border-cw-cyan/40 text-cw-cyan hover:bg-cw-cyan/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                      >
                        {txRecording ? (
                          <>
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="inline-block"
                            >
                              ~
                            </motion.span>
                            WAITING FOR METAMASK...
                          </>
                        ) : (
                          "RECORD ON-CHAIN"
                        )}
                      </button>
                    ) : (
                      <div className="px-4 py-2 border border-cw-green/30 bg-cw-green/5 font-mono text-xs text-cw-green flex-shrink-0">
                        v RECORDED -- {pendingTxHash?.slice(0, 14)}...
                      </div>
                    )}
                  </div>
                </motion.div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right sidebar -- Scan History */}
        <div className="hidden lg:block w-72 border-l border-cw-border flex-shrink-0" style={{ minHeight: "calc(100vh - 57px)" }}>
          <ScanHistory onSelectScan={handleSelectScan} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  return (
    <Providers>
      <DashboardInner />
    </Providers>
  );
}
