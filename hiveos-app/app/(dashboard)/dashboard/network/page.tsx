"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Node,
  Edge,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { useHives } from "@/features/hives/hooks/useHives";
import { Diagram, Magicpen, Refresh2 } from "iconsax-react";
import { useSession } from "@/features/auth/hooks/useSession";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Custom Nodes
// ---------------------------------------------------------------------------

interface WorkspaceNodeData {
  id: string;
  name: string;
  description?: string;
  health: number;
  status: "healthy" | "warning" | "error";
  onNavigate: () => void;
}

function WorkspaceNode({ data }: { data: WorkspaceNodeData }) {
  const statusColorMap = {
    healthy: "border-emerald-500/35 bg-emerald-500/5 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.05)]",
    warning: "border-amber-500/35 bg-amber-500/5 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.05)]",
    error: "border-destructive/35 bg-destructive/5 text-destructive shadow-[0_0_12px_rgba(244,63,94,0.05)]",
  };

  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      onDoubleClick={data.onNavigate}
      className={cn(
        "px-4 py-3 rounded-xl border glass-panel w-[220px] cursor-pointer transition-all duration-300 hover:scale-[1.03] select-none",
        statusColorMap[data.status]
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono tracking-wider font-extrabold uppercase opacity-60">Workspace</span>
          <span className="text-[10px] font-mono font-bold flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full bg-current", data.status === "warning" ? "animate-pulse" : "")} />
            {data.health}%
          </span>
        </div>
        
        <h4 className="text-xs font-black text-foreground truncate">{data.name}</h4>
        {data.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 leading-normal">{data.description}</p>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-border/40 flex justify-between items-center text-[8.5px] font-mono text-muted-foreground">
        <span>Double-click to open</span>
        <span className="text-primary font-bold">Canvas →</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </motion.div>
  );
}

function CentralNode() {
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      className="px-5 py-4 rounded-2xl border border-accent/30 bg-accent/5 text-foreground w-[180px] shadow-[0_0_30px_rgba(95,90,246,0.15)] text-center relative select-none animate-pulse-accent"
    >
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
          <Magicpen size="20" variant="Bold" className="animate-pulse" />
        </div>
        <div>
          <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-accent">HiveMind AI</h3>
          <p className="text-[9px] text-muted-foreground mt-0.5">Central Coordinator Node</p>
        </div>
      </div>
      <Handle type="target" position={Position.Bottom} className="opacity-0" />
    </motion.div>
  );
}

const nodeTypes = {
  workspace: WorkspaceNode,
  central: CentralNode,
};

// ---------------------------------------------------------------------------
// Network Page Component
// ---------------------------------------------------------------------------

export default function NetworkPage() {
  const router = useRouter();
  const { user } = useSession();
  const { data: hives = [], isLoading, error, refetch } = useHives();

  // Create Nodes and Edges based on user's hives
  const { nodes, edges } = useMemo(() => {
    if (isLoading || hives.length === 0) {
      return { nodes: [], edges: [] };
    }

    const calculatedNodes: Node[] = [];
    const calculatedEdges: Edge[] = [];

    // Central Coordinator Node position
    const centerX = 400;
    const centerY = 300;

    calculatedNodes.push({
      id: "central-ai-coordinator",
      type: "central",
      data: {},
      position: { x: centerX - 90, y: centerY - 40 }, // Offset by half width/height
    });

    const radius = 240;
    const totalHives = hives.length;

    hives.forEach((hive, index) => {
      const angle = (index * 2 * Math.PI) / totalHives;
      const x = centerX + radius * Math.cos(angle) - 110;
      const y = centerY + radius * Math.sin(angle) - 35;

      // Mock varying health scores & status based on character codes
      const charSum = hive.name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const health = 85 + (charSum % 16); // 85% to 100%
      const status = health > 95 ? "healthy" : health > 90 ? "warning" : "error";

      calculatedNodes.push({
        id: hive.id,
        type: "workspace",
        data: {
          id: hive.id,
          name: hive.name,
          description: hive.description,
          health,
          status,
          onNavigate: () => router.push(`/hive/${hive.id}/canvas`),
        },
        position: { x, y },
      });

      // Edge connecting this workspace node to the central coordinator
      calculatedEdges.push({
        id: `edge-${hive.id}-to-central`,
        source: "central-ai-coordinator",
        target: hive.id,
        animated: true,
        style: { stroke: status === "healthy" ? "#10b981" : status === "warning" ? "#f59e0b" : "#f43f5e", strokeWidth: 1.5, opacity: 0.65 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: status === "healthy" ? "#10b981" : status === "warning" ? "#f59e0b" : "#f43f5e",
        },
      });
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [hives, isLoading, router]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background text-neutral-300 select-none">
      {/* Page header */}
      <div className="h-16 border-b border-border px-8 flex items-center justify-between bg-card/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <Diagram size="20" variant="Bold" className="text-accent" />
          <h1 className="text-sm font-extrabold uppercase tracking-wider text-foreground">Global Network Map</h1>
        </div>

        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-[10px] font-extrabold uppercase transition-all duration-150 active:scale-95 font-mono text-muted-foreground hover:text-foreground"
        >
          <Refresh2 size="14" />
          <span>Refresh Map</span>
        </button>
      </div>

      {/* Main Flow Canvas */}
      <div className="flex-1 w-full relative bg-background">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Refresh2 className="w-8 h-8 rounded-full border-2 border-t-accent border-border animate-spin" />
            <span className="text-[10px] font-semibold tracking-wider uppercase font-mono">
              Loading topology coordinates...
            </span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive gap-2 font-mono text-xs">
            <p>Failed to retrieve network workspaces topology.</p>
            <button
              onClick={() => void refetch()}
              className="text-primary underline uppercase tracking-wider text-[10px] hover:text-primary-hover"
            >
              Retry Connection
            </button>
          </div>
        ) : hives.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-muted-foreground text-center gap-3">
            <Diagram size="48" className="text-border animate-pulse" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono">Empty Topology Map</h3>
            <p className="text-xs text-muted-foreground max-w-[340px] leading-relaxed">
              Create a new Hive from your dashboard lobby to generate nodes on the network map.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.5}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#5f5af6" gap={32} size={1} style={{ opacity: 0.08 }} />
              <Controls className="react-flow__controls" showInteractive={false} />
            </ReactFlow>
          </motion.div>
        )}
      </div>
    </div>
  );
}
