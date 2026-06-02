"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

interface ScanRecord {
  scanner: string;
  target: string;
  timestamp: bigint;
  riskLevel: string;
  reportHash: string;
}

interface ScanHistoryProps {
  onSelectScan: (address: string, riskLevel: string) => void;
}

const riskColors: Record<string, string> = {
  CLEAN: "#00ff88",
  LOW: "#00f5ff",
  MEDIUM: "#ff9500",
  HIGH: "#ff2d55",
  CRITICAL: "#ff2d55",
};

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatTime(ts: bigint) {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScanHistory({ onSelectScan }: ScanHistoryProps) {
  const { address, isConnected } = useAccount();

  const { data: scans, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getScans",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  const { data: totalScans } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getScanCount",
  });

  const scanList = (scans as ScanRecord[] | undefined) || [];

  return (
    <div className="panel rounded-none h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cw-border flex items-center justify-between">
        <span className="font-mono text-xs text-cw-cyan tracking-widest uppercase">
          Scan History
        </span>
        {totalScans !== undefined && (
          <span className="font-mono text-xs text-cw-muted">
            {String(totalScans)} total
          </span>
        )}
      </div>

      {/* My scans count */}
      {isConnected && (
        <div className="px-4 py-2 border-b border-cw-border/50">
          <span className="font-mono text-xs text-cw-muted">
            Your scans:{" "}
            <span className="text-cw-cyan">{scanList.length}</span>
          </span>
        </div>
      )}

      {/* Scan list */}
      <div className="flex-1 overflow-y-auto">
        {!isConnected ? (
          <div className="px-4 py-6 text-center">
            <p className="font-mono text-xs text-cw-muted">
              Connect wallet to view scan history
            </p>
          </div>
        ) : isLoading ? (
          <div className="px-4 py-6 flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-cw-border/30 animate-pulse rounded"
              />
            ))}
          </div>
        ) : scanList.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="font-mono text-xs text-cw-muted">No scans yet</p>
            <p className="font-mono text-xs text-cw-muted/50 mt-1">
              Run your first scan below
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {[...scanList].reverse().map((scan, i) => {
              const color = riskColors[scan.riskLevel] || "#e0e0f0";
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectScan(scan.target, scan.riskLevel)}
                  className="px-4 py-3 border-b border-cw-border/50 text-left hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-cw-text">
                      {shortAddr(scan.target)}
                    </span>
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color }}
                    >
                      {scan.riskLevel}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-cw-muted">
                    {formatTime(scan.timestamp)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
