"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Grid3X3, Plus, ArrowRight, Loader2 } from "lucide-react";
import { useHives } from "@/features/hives/hooks/useHives";

export default function CanvasManagerPage() {
  const router = useRouter();
  const { data: hives = [], isLoading } = useHives();

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12 space-y-8 animate-fade-up">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <LayoutDashboard className="w-8 h-8 text-[#f5a623]" />
            <span>Canvas Manager</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Open visual graphs to orchestrate workspace nodes, state triggers, and neural bindings.
          </p>
        </div>
      </header>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
          <Loader2 className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
          <span className="text-[10px] font-semibold tracking-wider uppercase font-mono">
            Retrieving canvas models...
          </span>
        </div>
      ) : hives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#141b29] rounded-2xl bg-[#070a0f]/40 gap-4 text-center">
          <Grid3X3 className="w-12 h-12 text-[#1c2331] animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider font-mono">No canvases active</h3>
            <p className="text-xs text-[#475569] max-w-[320px] leading-relaxed">
              Create a new Hive workspace in the dashboard lobby to initialize a collaborative node canvas.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e09415] text-[#030508] font-bold px-4 py-2 rounded-xl text-[10px] tracking-wider uppercase font-mono transition-all duration-150 active:scale-95"
          >
            Go to Lobby
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hives.map((hive) => (
            <div
              key={hive.id}
              onClick={() => router.push(`/hive/${hive.id}/canvas`)}
              className="p-6 rounded-2xl border border-[#141b29] bg-[#070a0f] hover:border-[#5f5af6]/30 group cursor-pointer transition-all duration-200 hover:shadow-[0_8px_30px_rgb(95,90,246,0.03)] flex flex-col justify-between min-h-[160px]"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="w-8 h-8 rounded-lg bg-[#5f5af6]/10 border border-[#5f5af6]/20 flex items-center justify-center text-[#5f5af6]">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="text-[8.5px] font-mono bg-[#141b29] border border-[#1e2533] px-2 py-0.5 rounded text-[#94a3b8] uppercase font-semibold">
                    Interactive
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#f1f5f9] group-hover:text-[#f5a623] transition-colors">
                  {hive.name}
                </h3>
                {hive.description && (
                  <p className="text-[11px] text-[#94a3b8] line-clamp-2 leading-relaxed">
                    {hive.description}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#141b29] flex justify-between items-center text-[10px] font-mono text-[#475569] group-hover:text-[#94a3b8]">
                <span>Launch Graph Environment</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform text-[#f5a623]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
