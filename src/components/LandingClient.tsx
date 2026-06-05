"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Providers } from "./Providers";

function LandingInner() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  // Particle network background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 245, 255, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 255, ${p.opacity})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-cw-black">
      {/* Background canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.6 }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow center */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <span
            className="font-mono text-xs tracking-[0.3em] text-cw-cyan uppercase px-4 py-2 border border-cw-cyan/20"
            style={{ background: "rgba(0,245,255,0.05)" }}
          >
            Ritual Chain Testnet
          </span>
        </motion.div>

        {/* Main title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="font-display font-black text-7xl md:text-9xl tracking-tight mb-2"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #00f5ff 50%, #ffffff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 30px rgba(0,245,255,0.3))",
          }}
        >
          CHAIN
          <br />
          WATCH
        </motion.h1>

        {/* Separator line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="w-full max-w-md h-px my-6"
          style={{
            background:
              "linear-gradient(90deg, transparent, #00f5ff, transparent)",
          }}
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="font-body text-xl text-cw-muted tracking-widest uppercase mb-2"
        >
          AI-Powered Onchain Fraud Detection
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="font-mono text-sm text-cw-cyan/60 tracking-[0.2em] mb-12"
        >
          by Hemisphere
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {[
            "Advanced Determination",
            "CIPHER AI Analysis",
            "0.001 RITUAL Per Scan",
            "On-Chain Records",
          ].map((label) => (
            <span
              key={label}
              className="font-mono text-xs text-cw-muted px-3 py-1.5 border border-cw-border"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {label}
            </span>
          ))}
        </motion.div>

        {/* Connect button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          className="flex flex-col items-center gap-4"
        >
          <ConnectButton
            label="CONNECT WALLET TO BEGIN"
            showBalance={false}
          />
          <p className="font-mono text-xs text-cw-muted">
            Connect MetaMask with Ritual Chain Testnet
          </p>
        </motion.div>
      </div>

      {/* Bottom status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2 }}
        className="absolute bottom-0 left-0 right-0 border-t border-cw-border px-8 py-3 flex items-center justify-between"
        style={{ background: "rgba(10,10,15,0.8)" }}
      >
        <span className="font-mono text-xs text-cw-muted">
          CHAIN ID: 1979
        </span>
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-cw-green"
            style={{ boxShadow: "0 0 6px #00ff88" }}
          />
          <span className="font-mono text-xs text-cw-green">SYSTEM ONLINE</span>
        </div>
        <span className="font-mono text-xs text-cw-muted">
          CIPHER v1.0
        </span>
      </motion.div>
    </div>
  );
}

export default function LandingClient() {
  return (
    <Providers>
      <LandingInner />
    </Providers>
  );
}
