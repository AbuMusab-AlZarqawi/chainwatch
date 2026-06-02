"use client";

import { motion } from "framer-motion";

interface FlagCardProps {
  name: string;
  flagged: boolean;
  severity: string;
  cipherNote: string;
  index: number;
}

const severityColors: Record<string, string> = {
  low: "#ff9500",
  medium: "#ff9500",
  high: "#ff2d55",
};

export function FlagCard({ name, flagged, severity, cipherNote, index }: FlagCardProps) {
  const flagColor = flagged ? (severityColors[severity] || "#ff2d55") : "#00ff88";
  const flagBg = flagged ? `${flagColor}08` : "#00ff8808";
  const flagBorder = flagged ? `${flagColor}30` : "#00ff8830";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="p-4 rounded-none border"
      style={{
        background: flagBg,
        borderColor: flagBorder,
        borderLeft: `3px solid ${flagColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div
            className="w-5 h-5 flex-shrink-0 flex items-center justify-center"
            style={{ color: flagColor }}
          >
            {flagged ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <span className="font-mono text-xs font-semibold text-cw-text tracking-wide">
            {name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {flagged && (
            <span
              className="font-mono text-xs px-2 py-0.5 border"
              style={{
                color: flagColor,
                borderColor: `${flagColor}40`,
                background: `${flagColor}10`,
              }}
            >
              {severity.toUpperCase()}
            </span>
          )}
          <span
            className="font-mono text-xs font-bold"
            style={{ color: flagColor }}
          >
            {flagged ? "FLAGGED" : "CLEAN"}
          </span>
        </div>
      </div>

      {/* CIPHER's note */}
      <p className="font-body text-sm text-cw-muted leading-relaxed">
        {cipherNote}
      </p>
    </motion.div>
  );
}
