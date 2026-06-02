"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface RiskGaugeProps {
  score: number;
  riskLevel: string;
}

function getRiskColor(score: number): string {
  if (score <= 15) return "#00ff88";
  if (score <= 35) return "#00f5ff";
  if (score <= 60) return "#ff9500";
  if (score <= 80) return "#ff2d55";
  return "#ff2d55";
}

function getRiskGlow(score: number): string {
  if (score <= 15) return "0 0 30px rgba(0,255,136,0.6)";
  if (score <= 35) return "0 0 30px rgba(0,245,255,0.6)";
  if (score <= 60) return "0 0 30px rgba(255,149,0,0.6)";
  return "0 0 30px rgba(255,45,85,0.8)";
}

export function RiskGauge({ score, riskLevel }: RiskGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionScore = useMotionValue(0);
  const displayScore = useTransform(motionScore, (v) => Math.round(v));
  const color = getRiskColor(score);

  useEffect(() => {
    const controls = animate(motionScore, score, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        drawGauge(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const drawGauge = (currentScore: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 280;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2 + 20;
    const radius = 100;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const progress = currentScore / 100;

    ctx.clearRect(0, 0, size, size);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.stroke();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * (endAngle - startAngle);
      const inner = radius - 14;
      const outer = radius - 22;
      const x1 = cx + inner * Math.cos(angle);
      const y1 = cy + inner * Math.sin(angle);
      const x2 = cx + outer * Math.cos(angle);
      const y2 = cy + outer * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Colored progress arc with gradient
    if (progress > 0) {
      const gradient = ctx.createLinearGradient(
        cx - radius,
        cy,
        cx + radius,
        cy
      );
      gradient.addColorStop(0, "#00ff88");
      gradient.addColorStop(0.35, "#00f5ff");
      gradient.addColorStop(0.6, "#ff9500");
      gradient.addColorStop(1, "#ff2d55");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + progress * (endAngle - startAngle));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.stroke();

      // Glow effect on arc tip
      const tipAngle = startAngle + progress * (endAngle - startAngle);
      const tipX = cx + radius * Math.cos(tipAngle);
      const tipY = cy + radius * Math.sin(tipAngle);
      const tipGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 20);
      tipGlow.addColorStop(0, getRiskColor(currentScore) + "99");
      tipGlow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(tipX, tipY, 20, 0, Math.PI * 2);
      ctx.fillStyle = tipGlow;
      ctx.fill();
    }

    // Inner shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 18, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const riskLevelColors: Record<string, string> = {
    CLEAN: "#00ff88",
    LOW: "#00f5ff",
    MEDIUM: "#ff9500",
    HIGH: "#ff2d55",
    CRITICAL: "#ff2d55",
  };

  const levelColor = riskLevelColors[riskLevel] || "#e0e0f0";

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          className="block"
        />
        {/* Center score display */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingTop: "40px" }}
        >
          <motion.span
            className="font-display font-black text-6xl tabular-nums"
            style={{ color, textShadow: `0 0 20px ${color}60` }}
          >
            <motion.span>{displayScore}</motion.span>
          </motion.span>
          <span className="font-mono text-xs text-cw-muted mt-1">
            RISK SCORE
          </span>
        </div>
      </div>

      {/* Risk level badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5, duration: 0.4 }}
        className="mt-2 px-6 py-2 font-display font-bold text-lg tracking-widest border"
        style={{
          color: levelColor,
          borderColor: levelColor + "60",
          background: levelColor + "10",
          boxShadow: getRiskGlow(score),
        }}
      >
        {riskLevel}
      </motion.div>
    </div>
  );
}
