"use client";

import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import { useCanvasStore } from "../store/useCanvasStore";
import { CanvasNodeData, NodeCategory } from "../types";
import { cn } from "@/lib/utils";
import { 
  Users, AlertCircle, Cpu, Target, Layers, 
  Terminal, ShieldAlert, FileText, CheckSquare, Lock 
} from "lucide-react";

interface HiveNodeProps {
  id: string;
  data: CanvasNodeData;
  selected?: boolean;
  isConnectable?: boolean;
}

// Map categories to visual elements: colors and icons
const CATEGORY_MAP: Record<NodeCategory, { color: string; border: string; bg: string; text: string; icon: any }> = {
  Audience: { 
    color: "#38bdf8", 
    border: "border-[#38bdf8]/40 focus-within:border-[#38bdf8]", 
    bg: "bg-[#38bdf8]/10", 
    text: "text-[#38bdf8]",
    icon: Users 
  },
  Problem: { 
    color: "#f87171", 
    border: "border-[#f87171]/40 focus-within:border-[#f87171]", 
    bg: "bg-[#f87171]/10", 
    text: "text-[#f87171]",
    icon: AlertCircle 
  },
  Feature: { 
    color: "#c084fc", 
    border: "border-[#c084fc]/40 focus-within:border-[#c084fc]", 
    bg: "bg-[#c084fc]/10", 
    text: "text-[#c084fc]",
    icon: Cpu 
  },
  Goal: { 
    color: "#fbbf24", 
    border: "border-[#fbbf24]/40 focus-within:border-[#fbbf24]", 
    bg: "bg-[#fbbf24]/10", 
    text: "text-[#fbbf24]",
    icon: Target 
  },
  "Tech Stack": { 
    color: "#34d399", 
    border: "border-[#34d399]/40 focus-within:border-[#34d399]", 
    bg: "bg-[#34d399]/10", 
    text: "text-[#34d399]",
    icon: Terminal 
  },
  Architecture: { 
    color: "#2dd4bf", 
    border: "border-[#2dd4bf]/40 focus-within:border-[#2dd4bf]", 
    bg: "bg-[#2dd4bf]/10", 
    text: "text-[#2dd4bf]",
    icon: Layers 
  },
  Risk: { 
    color: "#fb923c", 
    border: "border-[#fb923c]/40 focus-within:border-[#fb923c]", 
    bg: "bg-[#fb923c]/10", 
    text: "text-[#fb923c]",
    icon: ShieldAlert 
  },
  Document: { 
    color: "#60a5fa", 
    border: "border-[#60a5fa]/40 focus-within:border-[#60a5fa]", 
    bg: "bg-[#60a5fa]/10", 
    text: "text-[#60a5fa]",
    icon: FileText 
  },
  Task: { 
    color: "#a78bfa", 
    border: "border-[#a78bfa]/40 focus-within:border-[#a78bfa]", 
    bg: "bg-[#a78bfa]/10", 
    text: "text-[#a78bfa]",
    icon: CheckSquare 
  },
};

export const HiveNode = memo(({ id, data, selected }: HiveNodeProps) => {
  const activeMode = useCanvasStore((state) => state.activeMode);
  
  const category = data.category || "Feature";
  const { border, bg, text, icon: Icon } = CATEGORY_MAP[category] || CATEGORY_MAP["Feature"];
  
  const isLocked = !!data.lockedBy;
  const lockedByName = data.lockedBy?.name || "Someone";

  return (
    <div
      className={cn(
        "relative w-[220px] rounded-xl bg-[#0b0e14]/90 backdrop-blur-md border text-left transition-all duration-200 select-none shadow-lg",
        isLocked 
          ? "border-amber-500/80 shadow-amber-500/5 ring-1 ring-amber-500/20" 
          : selected 
            ? "border-[#f5a623] shadow-[#f5a623]/10 ring-1 ring-[#f5a623]/25" 
            : cn("border-[#1e2533]/80 hover:border-neutral-600/80")
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Connection Handles */}
      {/* ------------------------------------------------------------------ */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="w-2.5 h-2.5 !bg-[#1e2533] hover:!bg-[#f5a623] !border-[#0b0e14] transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="w-2.5 h-2.5 !bg-[#1e2533] hover:!bg-[#f5a623] !border-[#0b0e14] transition-colors"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Lock Indicator Overlay */}
      {/* ------------------------------------------------------------------ */}
      {isLocked && (
        <div className="absolute -top-6 left-0 flex items-center gap-1 bg-amber-500/90 text-[#080a0f] text-[9px] font-bold px-2 py-0.5 rounded-md shadow-md select-none z-20">
          <Lock className="w-2.5 h-2.5" />
          <span>Locked: {lockedByName}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Header Info */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-3 border-b border-[#1e2533]/40">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase", bg, text)}>
            <Icon className="w-2.5 h-2.5" />
            <span>{category}</span>
          </div>
          {data.priority && activeMode === "Planning" && (
            <span className={cn(
              "text-[8px] font-bold px-1.5 py-0.25 rounded uppercase",
              data.priority === "High" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
              data.priority === "Medium" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
              "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            )}>
              {data.priority}
            </span>
          )}
        </div>
        <h4 className="text-[12.5px] font-bold text-[#f1f5f9] leading-snug truncate">
          {data.title || "Untitled Node"}
        </h4>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body Content by Mode */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-3 space-y-2 text-[11px]">
        {activeMode === "Brainstorm" && (
          <>
            <p className="text-[#94a3b8] line-clamp-2 leading-normal">
              {data.description || <span className="text-[#475569] italic">No description</span>}
            </p>
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {data.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="bg-[#1e2533]/50 text-[#64748b] text-[8.5px] font-semibold px-1.5 py-0.5 rounded border border-[#1e2533]/30">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {activeMode === "Planning" && (
          <div className="space-y-1.5 text-[#94a3b8]">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[#475569]">Due Date:</span>
              <span className="font-semibold text-neutral-300">
                {data.dueDate ? new Date(data.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "None"}
              </span>
            </div>
            <p className="text-[#64748b] text-[10px] line-clamp-1 italic">
              {data.description || "No planning notes"}
            </p>
          </div>
        )}

        {activeMode === "Execution" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-[#475569]">Status:</span>
              <span className={cn(
                "font-bold text-[9px] uppercase px-1.5 py-0.25 rounded",
                data.status === "Done" ? "bg-emerald-500/10 text-emerald-400" :
                data.status === "Blocked" ? "bg-red-500/10 text-red-400 animate-pulse" :
                data.status === "In Progress" ? "bg-sky-500/10 text-sky-400" :
                "bg-neutral-800 text-neutral-400"
              )}>
                {data.status || "Todo"}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[8.5px] text-[#475569]">
                <span>Progress</span>
                <span className="text-neutral-400 font-semibold">{data.progress || 0}%</span>
              </div>
              <div className="w-full bg-[#1e2533]/60 h-1.25 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    data.status === "Done" ? "bg-emerald-500" :
                    data.status === "Blocked" ? "bg-red-500" : "bg-[#f5a623]"
                  )} 
                  style={{ width: `${data.progress || 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

HiveNode.displayName = "HiveNode";
