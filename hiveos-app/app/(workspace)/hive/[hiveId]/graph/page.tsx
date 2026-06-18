"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { useSocket } from "@/features/realtime/hooks/useSocket";
import { cn } from "@/lib/utils";
import {
  Network,
  Search,
  Filter,
  ArrowRight,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Activity,
  Info,
  RefreshCw,
  Eye,
  AlertCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import { useParams } from "next/navigation";

// -------------------------------------------------------------------------
// Custom Explorer Node Component
// -------------------------------------------------------------------------
function ExplorerNode({ data }: any) {
  const { title, category, tags, status, priority, isDimmed, isHighlighted, componentColor, isSearchMatch } = data;

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border bg-[#0e1117]/95 transition-all duration-300 w-[220px] shadow-lg",
        isSearchMatch ? "ring-2 ring-amber-500 border-amber-500 shadow-[0_0_10px_rgba(245,166,35,0.2)]" : "",
        isHighlighted
          ? "border-amber-500 shadow-[0_0_15px_rgba(245,166,35,0.25)] text-[#f1f5f9]"
          : componentColor
            ? `${componentColor} text-[#f1f5f9]`
            : "border-[#1e2533] text-neutral-300",
        isDimmed ? "opacity-25" : "opacity-100"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#3b82f6] !border-none !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between mb-1.5 select-none">
        <span
          className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#1e2533] text-[#f5a623] tracking-wide"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {category}
        </span>
        {priority && (
          <span
            className={cn(
              "text-[8px] font-bold px-1 py-0.2 rounded uppercase",
              priority === "High" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
              priority === "Medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
              "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            )}
          >
            {priority}
          </span>
        )}
      </div>
      <div className="text-xs font-bold truncate text-[#f1f5f9]">{title}</div>

      {status && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-[#94a3b8]">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "Done" ? "bg-green-500" :
            status === "Blocked" ? "bg-red-500" :
            status === "In Progress" ? "bg-blue-500" : "bg-neutral-500"
          )} />
          <span style={{ fontFamily: "JetBrains Mono" }}>{status}</span>
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-[#1e2533]/50">
          {tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="text-[8px] text-neutral-400 bg-[#141920] px-1 py-0.2 rounded border border-[#1e2533]/50 font-medium"
              style={{ fontFamily: "JetBrains Mono" }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#10b981] !border-none !w-2.5 !h-2.5" />
    </div>
  );
}

const nodeTypes = {
  explorerNode: ExplorerNode,
};

const COMPONENT_COLORS = [
  "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/5 ring-1 ring-[#3b82f6]/20",
  "border-[#10b981] text-[#10b981] bg-[#10b981]/5 ring-1 ring-[#10b981]/20",
  "border-[#f5a623] text-[#f5a623] bg-[#f5a623]/5 ring-1 ring-[#f5a623]/20",
  "border-[#ec4899] text-[#ec4899] bg-[#ec4899]/5 ring-1 ring-[#ec4899]/20",
  "border-[#8b5cf6] text-[#8b5cf6] bg-[#8b5cf6]/5 ring-1 ring-[#8b5cf6]/20",
  "border-[#f43f5e] text-[#f43f5e] bg-[#f43f5e]/5 ring-1 ring-[#f43f5e]/20",
  "border-[#06b6d4] text-[#06b6d4] bg-[#06b6d4]/5 ring-1 ring-[#06b6d4]/20",
  "border-[#eab308] text-[#eab308] bg-[#eab308]/5 ring-1 ring-[#eab308]/20",
];

export default function GraphExplorerPage() {
  const params = useParams();
  const hiveId = params?.hiveId as string;
  const { socket, status: socketStatus } = useSocket();

  // Graph Data States
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [originalNodes, setOriginalNodes] = useState<any[]>([]);
  const [originalEdges, setOriginalEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([]);

  // View States
  const [activeView, setActiveView] = useState<"standard" | "dependency" | "impact" | "orphans" | "components">("standard");
  const [selectedStartNode, setSelectedStartNode] = useState("");
  const [selectedEndNode, setSelectedEndNode] = useState("");
  const [selectedImpactNode, setSelectedImpactNode] = useState("");

  // Highlights / Traversal output
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [componentsMapping, setComponentsMapping] = useState<Record<string, string>>({});
  const [traversalError, setTraversalError] = useState<string | null>(null);

  // Selected Detail Element
  const [selectedElement, setSelectedElement] = useState<{ type: "node" | "edge"; data: any } | null>(null);

  // Timeline Time-Travel States
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(-1);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isTimelineActive = timelineIndex >= 0 && timelineIndex < timelineEvents.length;

  // -------------------------------------------------------------------------
  // Fetch Initial Data
  // -------------------------------------------------------------------------
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setTraversalError(null);
      const res = await fetch(`/api/hives/${hiveId}/canvas`);
      const result = await res.json();

      if (result.data) {
        setOriginalNodes(result.data.nodes || []);
        setOriginalEdges(result.data.edges || []);
      }

      const timelineRes = await fetch(`/api/hives/${hiveId}/graph/timeline`);
      const timelineResult = await timelineRes.json();
      if (timelineResult.data) {
        setTimelineEvents(timelineResult.data || []);
      }
    } catch (err) {
      console.error("Error loading graph:", err);
    } finally {
      setLoading(false);
    }
  }, [hiveId]);

  useEffect(() => {
    if (hiveId) {
      fetchGraphData();
    }
  }, [hiveId, fetchGraphData]);

  // -------------------------------------------------------------------------
  // Realtime Socket Sync
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || socketStatus !== "connected" || isTimelineActive) return;

    const handleNodeCreate = ({ node }: any) => {
      setOriginalNodes((prev) => [...prev, node]);
    };

    const handleNodeUpdate = ({ id, updates }: any) => {
      setOriginalNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n))
      );
    };

    const handleNodeDelete = ({ id }: any) => {
      setOriginalNodes((prev) => prev.filter((n) => n.id !== id));
      setOriginalEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      if (selectedElement?.type === "node" && selectedElement.data.id === id) {
        setSelectedElement(null);
      }
    };

    const handleEdgeCreate = ({ edge }: any) => {
      setOriginalEdges((prev) => [...prev, edge]);
    };

    const handleEdgeDelete = ({ id }: any) => {
      setOriginalEdges((prev) => prev.filter((e) => e.id !== id));
      if (selectedElement?.type === "edge" && selectedElement.data.id === id) {
        setSelectedElement(null);
      }
    };

    const handleEdgeUpdateRelation = ({ id, relationType }: any) => {
      setOriginalEdges((prev) =>
        prev.map((e) => (e.id === id ? { ...e, relationType } : e))
      );
      if (selectedElement?.type === "edge" && selectedElement.data.id === id) {
        setSelectedElement((prev) => prev ? { ...prev, data: { ...prev.data, relationType } } : null);
      }
    };

    socket.on("canvas:node-create", handleNodeCreate);
    socket.on("canvas:node-update", handleNodeUpdate);
    socket.on("canvas:node-delete", handleNodeDelete);
    socket.on("canvas:edge-create", handleEdgeCreate);
    socket.on("canvas:edge-delete", handleEdgeDelete);
    socket.on("canvas:edge-update-relation", handleEdgeUpdateRelation);

    return () => {
      socket.off("canvas:node-create", handleNodeCreate);
      socket.off("canvas:node-update", handleNodeUpdate);
      socket.off("canvas:node-delete", handleNodeDelete);
      socket.off("canvas:edge-create", handleEdgeCreate);
      socket.off("canvas:edge-delete", handleEdgeDelete);
      socket.off("canvas:edge-update-relation", handleEdgeUpdateRelation);
    };
  }, [socket, socketStatus, isTimelineActive, selectedElement]);

  // -------------------------------------------------------------------------
  // Fetch Historical Timeline Replay State
  // -------------------------------------------------------------------------
  const loadHistoricalState = useCallback(async (index: number) => {
    if (index < 0 || index >= timelineEvents.length) return;
    try {
      setLoading(true);
      const targetEvent = timelineEvents[index];
      const res = await fetch(
        `/api/hives/${hiveId}/graph/timeline?timestamp=${encodeURIComponent(targetEvent.timestamp)}`
      );
      const result = await res.json();
      if (result.data) {
        setActiveView("standard");
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
        setComponentsMapping({});
        setOriginalNodes(result.data.nodes || []);
        setOriginalEdges(result.data.edges || []);
      }
    } catch (err) {
      console.error("Error fetching historical state:", err);
    } finally {
      setLoading(false);
    }
  }, [hiveId, timelineEvents]);

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setTimelineIndex(idx);
    setIsTimelinePlaying(false);
    if (idx === -1) {
      fetchGraphData();
    } else {
      loadHistoricalState(idx);
    }
  };

  useEffect(() => {
    if (isTimelinePlaying) {
      playTimerRef.current = setInterval(() => {
        setTimelineIndex((prev) => {
          const next = prev + 1;
          if (next >= timelineEvents.length) {
            setIsTimelinePlaying(false);
            return prev;
          }
          loadHistoricalState(next);
          return next;
        });
      }, 1800);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isTimelinePlaying, timelineEvents.length, loadHistoricalState]);

  // -------------------------------------------------------------------------
  // Compute Renderable Nodes/Edges (Applies views, search & filters)
  // BUG-5: Convert Set objects to stable string keys for dependency comparison.
  // Set references change on every setState call, causing infinite re-runs.
  // -------------------------------------------------------------------------
  const highlightedNodesKey = [...highlightedNodes].sort().join(",");
  const highlightedEdgesKey = [...highlightedEdges].sort().join(",");
  const componentsMappingKey = JSON.stringify(componentsMapping);

  useEffect(() => {
    const filteredNodes = originalNodes.map((n) => {
      const isCategoryMatch = selectedCategories.length === 0 || selectedCategories.includes(n.category);
      const isSearchMatch =
        searchQuery === "" ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const isDimmedByView =
        (activeView === "dependency" || activeView === "impact" || activeView === "orphans") &&
        !highlightedNodes.has(n.id);

      const componentColor = componentsMapping[n.id] || null;

      return {
        id: n.id,
        type: "explorerNode",
        position: n.position || { x: Math.random() * 200, y: Math.random() * 200 },
        draggable: false,
        data: {
          title: n.title,
          category: n.category,
          tags: n.tags,
          priority: n.data?.priority || n.priority,
          status: n.data?.status || n.status,
          isSearchMatch: isSearchMatch && searchQuery !== "",
          isHighlighted: highlightedNodes.has(n.id),
          isDimmed: !isCategoryMatch || isDimmedByView,
          componentColor,
        },
      };
    });

    const filteredEdges = originalEdges.map((e) => {
      const isRelationMatch = selectedRelationTypes.length === 0 || selectedRelationTypes.includes(e.relationType || "relates_to");
      const isEdgeHighlighted = highlightedEdges.has(e.id);
      const isDimmedByView =
        (activeView === "dependency" || activeView === "impact" || activeView === "orphans") &&
        !isEdgeHighlighted;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        label: e.relationType || "relates_to",
        labelStyle: { fill: "#94a3b8", fontSize: 9, fontWeight: 700, fontFamily: "JetBrains Mono" },
        labelBgPadding: [3, 1.5] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: "#0b0e14", fillOpacity: 0.9, stroke: "#1e2533", strokeWidth: 0.5 },
        animated: isEdgeHighlighted || (!isDimmedByView && activeView !== "standard"),
        style: {
          stroke: isEdgeHighlighted ? "#f5a623" : isDimmedByView ? "#1e2533" : "#334155",
          strokeWidth: isEdgeHighlighted ? 2.5 : 1.25,
          opacity: !isRelationMatch ? 0.05 : isDimmedByView ? 0.15 : 1.0,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEdgeHighlighted ? "#f5a623" : "#334155",
          width: 14,
          height: 14,
        },
        data: { relationType: e.relationType || "relates_to" },
      };
    });

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [
    originalNodes,
    originalEdges,
    searchQuery,
    selectedCategories,
    selectedRelationTypes,
    activeView,
    highlightedNodesKey,
    highlightedEdgesKey,
    componentsMappingKey,
    setNodes,
    setEdges,
  ]);

  // -------------------------------------------------------------------------
  // Graph Traversal View Actions
  // BUG-6: Wrapped in useCallback with stable deps to prevent stale closures
  // -------------------------------------------------------------------------

  const handleResetView = useCallback(() => {
    setActiveView("standard");
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setComponentsMapping({});
    setTraversalError(null);
    setSelectedStartNode("");
    setSelectedEndNode("");
    setSelectedImpactNode("");
  }, []);

  const handleAnalyzeOrphans = useCallback(async () => {
    setTraversalError(null);
    try {
      const res = await fetch(`/api/hives/${hiveId}/graph/traversal?type=orphans`);
      const result = await res.json();
      if (result.error) {
        setTraversalError(result.error);
        return;
      }
      const orphans = result.data || [];
      if (orphans.length === 0) {
        setTraversalError("No orphan nodes detected in this workspace.");
        setHighlightedNodes(new Set());
        return;
      }
      setHighlightedNodes(new Set(orphans.map((n: any) => n.id)));
      setHighlightedEdges(new Set());
    } catch (err) {
      setTraversalError("Failed to fetch orphans.");
    }
  }, [hiveId]);

  const handleAnalyzeComponents = useCallback(async () => {
    setTraversalError(null);
    try {
      const res = await fetch(`/api/hives/${hiveId}/graph/traversal?type=components`);
      const result = await res.json();
      if (result.error) {
        setTraversalError(result.error);
        return;
      }
      const components: any[][] = result.data || [];
      const mapping: Record<string, string> = {};
      components.forEach((componentList, idx) => {
        const colorClass = (COMPONENT_COLORS[idx % COMPONENT_COLORS.length] || COMPONENT_COLORS[0]) as string;
        componentList.forEach((n) => {
          if (n.id) mapping[n.id] = colorClass;
        });
      });
      setComponentsMapping(mapping);
    } catch (err) {
      setTraversalError("Failed to run component analysis.");
    }
  }, [hiveId]);

  const handleAnalyzePath = async () => {
    if (!selectedStartNode || !selectedEndNode) {
      setTraversalError("Please select both start and end nodes.");
      return;
    }
    setTraversalError(null);
    try {
      const res = await fetch(
        `/api/hives/${hiveId}/graph/traversal?type=shortestPath&startId=${selectedStartNode}&endId=${selectedEndNode}`
      );
      const result = await res.json();
      if (result.error) {
        setTraversalError(result.error);
        return;
      }
      const pathSteps = result.data;
      if (!pathSteps || pathSteps.length === 0) {
        setTraversalError("No path found between the selected nodes.");
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
        return;
      }
      const pathNodeIds = new Set<string>([selectedStartNode]);
      const pathEdgeIds = new Set<string>();
      pathSteps.forEach((step: any) => {
        pathNodeIds.add(step.node.id);
        pathEdgeIds.add(step.edge.id);
      });
      setHighlightedNodes(pathNodeIds);
      setHighlightedEdges(pathEdgeIds);
    } catch (err) {
      setTraversalError("Failed to trace path. Server error.");
    }
  };

  const handleAnalyzeImpact = async () => {
    if (!selectedImpactNode) {
      setTraversalError("Please select an impact source node.");
      return;
    }
    setTraversalError(null);
    try {
      const res = await fetch(
        `/api/hives/${hiveId}/graph/traversal?type=impact&nodeId=${selectedImpactNode}`
      );
      const result = await res.json();
      if (result.error) {
        setTraversalError(result.error);
        return;
      }
      const impactList = result.data || [];
      const nodeIds = new Set<string>([selectedImpactNode, ...impactList.map((n: any) => n.id)]);
      const edgeIds = new Set<string>();
      originalEdges.forEach((e) => {
        if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
          edgeIds.add(e.id);
        }
      });
      setHighlightedNodes(nodeIds);
      setHighlightedEdges(edgeIds);
    } catch (err) {
      setTraversalError("Failed to trace impact. Server error.");
    }
  };

  // BUG-6: handlers are stable useCallback refs so this effect never captures stale closures
  useEffect(() => {
    handleResetView();
    if (activeView === "orphans") {
      handleAnalyzeOrphans();
    } else if (activeView === "components") {
      handleAnalyzeComponents();
    }
  }, [activeView, handleResetView, handleAnalyzeOrphans, handleAnalyzeComponents]);

  // -------------------------------------------------------------------------
  // Element Click Handlers
  // -------------------------------------------------------------------------
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    const original = originalNodes.find((n) => n.id === node.id);
    if (original) setSelectedElement({ type: "node", data: original });
  };

  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    const original = originalEdges.find((e) => e.id === edge.id);
    if (original) setSelectedElement({ type: "edge", data: original });
  };

  const handleRelationChange = (newRelation: string) => {
    if (selectedElement?.type !== "edge" || !socket || socketStatus !== "connected") return;
    socket.emit("canvas:edge-update-relation", {
      workspaceId: hiveId,
      id: selectedElement.data.id,
      relationType: newRelation,
    });
  };

  const getCategoryColor = (category: string) => {
    const mappings: Record<string, string> = {
      Audience: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      Problem: "bg-red-500/10 text-red-400 border border-red-500/20",
      Feature: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      Goal: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      "Tech Stack": "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
      Architecture: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
      Risk: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
      Document: "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20",
      Task: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    };
    return mappings[category] || "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20";
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-[#080a0f] text-neutral-300 relative overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT SIDEBAR */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-80 border-r border-[#1e2533] bg-[#0c101b] flex flex-col z-10 select-none">
        <div className="p-4 border-b border-[#1e2533] flex items-center gap-2">
          <Network className="w-5 h-5 text-[#f5a623]" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f1f5f9]">Graph Explorer</h2>
        </div>

        <div className="p-4 border-b border-[#1e2533] space-y-1">
          <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider">Analysis View</label>
          <div className="grid grid-cols-5 bg-[#080a0f] p-1 rounded-xl border border-[#1e2533]/60">
            {(["standard", "dependency", "impact", "orphans", "components"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={cn(
                  "py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all tracking-wider text-center",
                  activeView === view
                    ? "bg-[#1a1f2c] text-[#f5a623] shadow-md"
                    : "text-[#64748b] hover:text-neutral-300"
                )}
                title={`${view.charAt(0).toUpperCase() + view.slice(1)} view`}
                style={{ fontFamily: "JetBrains Mono" }}
              >
                {view === "standard" && "STD"}
                {view === "dependency" && "PATH"}
                {view === "impact" && "IMP"}
                {view === "orphans" && "ORP"}
                {view === "components" && "COMP"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {activeView === "standard" && (
            <div className="space-y-2 p-3.5 bg-[#080a0f] border border-[#1e2533]/50 rounded-2xl">
              <h3 className="font-bold text-[#f1f5f9] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#f5a623]" />
                <span>Standard Graph</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Explore the collaborative canvas structure as a semantic knowledge network. Apply filters below to filter node types and edges.
              </p>
            </div>
          )}

          {activeView === "dependency" && (
            <div className="space-y-4 p-3.5 bg-[#080a0f] border border-[#1e2533]/50 rounded-2xl">
              <h3 className="font-bold text-[#f1f5f9] flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-[#f5a623]" />
                <span>Dependency Path View</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Finds the shortest semantic chain connecting two canvas entities using BFS.
              </p>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569]">Start Node</label>
                  <select
                    value={selectedStartNode}
                    onChange={(e) => setSelectedStartNode(e.target.value)}
                    className="w-full bg-[#0c101b] border border-[#1e2533] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="">-- Choose Node --</option>
                    {originalNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569]">End Node</label>
                  <select
                    value={selectedEndNode}
                    onChange={(e) => setSelectedEndNode(e.target.value)}
                    className="w-full bg-[#0c101b] border border-[#1e2533] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="">-- Choose Node --</option>
                    {originalNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAnalyzePath}
                  className="w-full py-2 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-bold uppercase rounded-lg transition-all"
                  style={{ fontFamily: "JetBrains Mono" }}
                >
                  Analyze Path
                </button>
              </div>
            </div>
          )}

          {activeView === "impact" && (
            <div className="space-y-4 p-3.5 bg-[#080a0f] border border-[#1e2533]/50 rounded-2xl">
              <h3 className="font-bold text-[#f1f5f9] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#f5a623]" />
                <span>Impact Analysis View</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Highlight all downstream nodes recursively reachable from the selected source node to trace impact.
              </p>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569]">Impact Source Node</label>
                  <select
                    value={selectedImpactNode}
                    onChange={(e) => setSelectedImpactNode(e.target.value)}
                    className="w-full bg-[#0c101b] border border-[#1e2533] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="">-- Choose Node --</option>
                    {originalNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAnalyzeImpact}
                  className="w-full py-2 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-bold uppercase rounded-lg transition-all"
                  style={{ fontFamily: "JetBrains Mono" }}
                >
                  Analyze Impact
                </button>
              </div>
            </div>
          )}

          {activeView === "orphans" && (
            <div className="space-y-2 p-3.5 bg-[#080a0f] border border-[#1e2533]/50 rounded-2xl">
              <h3 className="font-bold text-[#f1f5f9] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span>Orphan Nodes View</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Highlights nodes that have no connected edges. Use this to audit stray items, missing links, or unassigned tasks.
              </p>
            </div>
          )}

          {activeView === "components" && (
            <div className="space-y-2 p-3.5 bg-[#080a0f] border border-[#1e2533]/50 rounded-2xl">
              <h3 className="font-bold text-[#f1f5f9] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Weakly Connected Components</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Uses Union-Find with path compression to color-code disconnected subgraphs (separate workspace groups).
              </p>
            </div>
          )}

          {traversalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[11px]">
              {traversalError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Entity Filters</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-neutral-500">Categories</label>
              <div className="flex flex-wrap gap-1">
                {["Audience", "Problem", "Feature", "Goal", "Tech Stack", "Architecture", "Risk", "Document", "Task"].map((cat) => {
                  const isSel = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() =>
                        setSelectedCategories((prev) =>
                          isSel ? prev.filter((c) => c !== cat) : [...prev, cat]
                        )
                      }
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-medium border transition-colors",
                        isSel
                          ? "bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]"
                          : "bg-[#080a0f] border-[#1e2533] text-neutral-400 hover:text-neutral-200"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-[9px] font-extrabold uppercase text-neutral-500">Relationships</label>
              <div className="flex flex-wrap gap-1">
                {["depends_on", "implements", "relates_to", "blocks", "documents", "owns", "uses", "generates"].map((rel) => {
                  const isSel = selectedRelationTypes.includes(rel);
                  return (
                    <button
                      key={rel}
                      onClick={() =>
                        setSelectedRelationTypes((prev) =>
                          isSel ? prev.filter((r) => r !== rel) : [...prev, rel]
                        )
                      }
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-medium border transition-colors",
                        isSel
                          ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]"
                          : "bg-[#080a0f] border-[#1e2533] text-neutral-400 hover:text-neutral-200"
                      )}
                      style={{ fontFamily: "JetBrains Mono" }}
                    >
                      {rel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#1e2533] bg-[#080a0f] flex gap-2">
          <button
            onClick={handleResetView}
            className="flex-1 py-2 rounded-xl border border-[#1e2533] hover:bg-[#1a1f2c]/50 text-neutral-400 hover:text-neutral-200 uppercase font-semibold text-[10px] tracking-wider text-center"
            style={{ fontFamily: "JetBrains Mono" }}
          >
            Clear Analysis
          </button>
          <button
            onClick={fetchGraphData}
            className="px-3 rounded-xl border border-[#1e2533] hover:bg-[#1a1f2c]/50 text-neutral-400 hover:text-neutral-200 flex items-center justify-center transition-colors"
            title="Refresh graph from DB"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* CENTER: Main Explorer Graph Canvas */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 h-full relative flex flex-col">
        <div className="h-14 border-b border-[#1e2533] bg-[#0b0e14]/90 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="text-xs text-neutral-400 select-none">
              Nodes: <span className="font-extrabold text-[#f5a623]">{nodes.length}</span> | Edges:{" "}
              <span className="font-extrabold text-[#3b82f6]">{edges.length}</span>
            </div>
            {isTimelineActive && (
              <span
                className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-[#f5a623] rounded-lg animate-pulse"
                style={{ fontFamily: "JetBrains Mono" }}
              >
                Time-Travel Mode
              </span>
            )}
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, tag..."
              className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl pl-9 pr-4 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#f5a623] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 w-full bg-[#080a0f] relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-3 bg-[#080a0f] z-20">
              <div className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ fontFamily: "JetBrains Mono" }}>
                Calculating Graph Snapshot...
              </span>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 gap-2 bg-[#080a0f] z-20">
              <HelpCircle className="w-8 h-8 text-[#1e2533]" />
              <span className="text-[11px] font-semibold tracking-wide uppercase select-none" style={{ fontFamily: "JetBrains Mono" }}>
                Workspace has no nodes.
              </span>
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#080a0f]"
          >
            <Background color="#1e2533" gap={22} size={1} />
            <Controls className="!bg-[#0e1117] !border-[#1e2533] !rounded-lg [&_button]:!border-[#1e2533] [&_button]:!text-neutral-400 [&_button:hover]:!bg-[#1a1f2c]" />
          </ReactFlow>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* BOTTOM: Timeline Time-Travel Replay Slider */}
        {/* ------------------------------------------------------------------ */}
        <div className="border-t border-[#1e2533] bg-[#0c101b] px-6 py-4 flex flex-col gap-2 z-10 select-none">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase text-[#475569]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Event Timeline Replay</span>
            </span>
            <span style={{ fontFamily: "JetBrains Mono" }}>
              {timelineIndex === -1 ? "LIVE SNAPSHOT" : `STEP ${timelineIndex + 1} OF ${timelineEvents.length}`}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-[#080a0f] p-1 rounded-lg border border-[#1e2533]">
              <button
                disabled={timelineEvents.length === 0}
                onClick={() => {
                  setIsTimelinePlaying(false);
                  setTimelineIndex(-1);
                  fetchGraphData();
                }}
                className="p-1.5 text-neutral-400 hover:text-[#f5a623] transition-colors disabled:opacity-40"
                title="Go to Live Graph"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>

              <button
                disabled={timelineIndex <= 0}
                onClick={() => {
                  setIsTimelinePlaying(false);
                  const nextIdx = timelineIndex - 1;
                  setTimelineIndex(nextIdx);
                  loadHistoricalState(nextIdx);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-40"
                title="Step Back"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                disabled={timelineEvents.length === 0}
                onClick={() => setIsTimelinePlaying(!isTimelinePlaying)}
                className="p-1.5 text-neutral-200 hover:text-[#f5a623] transition-colors disabled:opacity-40"
                title={isTimelinePlaying ? "Pause Replay" : "Play Replay"}
              >
                {isTimelinePlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                disabled={timelineIndex === -1 || timelineIndex >= timelineEvents.length - 1}
                onClick={() => {
                  setIsTimelinePlaying(false);
                  const nextIdx = timelineIndex + 1;
                  setTimelineIndex(nextIdx);
                  loadHistoricalState(nextIdx);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-40"
                title="Step Forward"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* BUG-4: Use Math.max(0, ...) so max is never -1 when timelineEvents is empty */}
            <div className="flex-1 flex items-center gap-2.5">
              <input
                type="range"
                min={-1}
                max={Math.max(0, timelineEvents.length - 1)}
                value={timelineIndex}
                onChange={handleTimelineChange}
                disabled={timelineEvents.length === 0}
                className="w-full bg-[#080a0f] accent-[#f5a623] h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>

          {isTimelineActive && (
            <div
              className="mt-1 px-3 py-2 bg-[#080a0f] border border-[#1e2533]/55 rounded-xl flex items-center justify-between text-xs transition-opacity duration-300"
              style={{ fontFamily: "JetBrains Mono" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-extrabold uppercase border border-blue-500/15">
                  {timelineEvents[timelineIndex].eventType.replace("_", " ")}
                </span>
                <span className="text-[#f1f5f9] font-bold">
                  {timelineEvents[timelineIndex].entityType} ID: "{timelineEvents[timelineIndex].entityId}"
                </span>
              </div>
              <div className="text-neutral-500 text-[10px] flex items-center gap-2">
                <span>By: {timelineEvents[timelineIndex].actorName}</span>
                <span>•</span>
                <span>{new Date(timelineEvents[timelineIndex].timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT DRAWER: Inspection Panel */}
      {/* ------------------------------------------------------------------ */}
      {selectedElement && (
        <aside className="w-80 border-l border-[#1e2533] bg-[#0c101b] p-5 flex flex-col gap-6 z-10 shadow-2xl relative select-none">
          <div className="flex justify-between items-center border-b border-[#1e2533] pb-3">
            <h3 className="text-xs font-bold text-[#f1f5f9] uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#f5a623]" />
              <span>Inspection Panel</span>
            </h3>
            <button
              onClick={() => setSelectedElement(null)}
              className="text-neutral-500 hover:text-neutral-300 text-xs font-semibold px-2 py-1 rounded bg-[#080a0f] border border-[#1e2533]/50 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto text-xs">
            {selectedElement.type === "node" ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569] tracking-wider">Node Title</label>
                  <div className="text-sm font-bold text-[#f1f5f9] bg-[#080a0f] p-3 border border-[#1e2533] rounded-xl leading-snug">
                    {selectedElement.data.title}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase text-[#475569]">Category</label>
                    <div className={cn("text-[10px] font-bold px-2 py-1.5 rounded-lg text-center uppercase tracking-wider", getCategoryColor(selectedElement.data.category))}>
                      {selectedElement.data.category}
                    </div>
                  </div>
                  {selectedElement.data.data?.priority && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-[#475569]">Priority</label>
                      <div className="text-[10px] font-bold bg-[#080a0f] border border-[#1e2533] text-[#f5a623] py-1.5 rounded-lg text-center uppercase">
                        {selectedElement.data.data.priority}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569] tracking-wider">Description</label>
                  <div className="bg-[#080a0f] border border-[#1e2533] rounded-xl p-3 text-[#94a3b8] leading-relaxed max-h-[140px] overflow-y-auto">
                    {selectedElement.data.description || "No description provided."}
                  </div>
                </div>

                {selectedElement.data.tags && selectedElement.data.tags.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase text-[#475569]">Tags</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedElement.data.tags.map((tag: string) => (
                        <span key={tag} className="text-[9px] bg-[#080a0f] border border-[#1e2533] text-neutral-400 px-2 py-0.5 rounded font-semibold" style={{ fontFamily: "JetBrains Mono" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-[#1e2533]/50 text-[10px] text-neutral-500">
                  <div className="flex justify-between">
                    <span>Creator ID:</span>
                    <span className="font-bold text-neutral-400" style={{ fontFamily: "JetBrains Mono" }}>{selectedElement.data.createdBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Node ID:</span>
                    <span className="font-bold text-neutral-400" style={{ fontFamily: "JetBrains Mono" }}>{selectedElement.data.id}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569] tracking-wider">Edge ID</label>
                  <div className="text-[10px] font-bold text-neutral-400 bg-[#080a0f] p-2.5 border border-[#1e2533] rounded-xl truncate" style={{ fontFamily: "JetBrains Mono" }}>
                    {selectedElement.data.id}
                  </div>
                </div>

                <div className="bg-[#080a0f] p-3 border border-[#1e2533] rounded-xl space-y-2 select-none text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-neutral-500">Source:</span>
                    <span className="font-bold text-neutral-300 truncate w-32 text-right">{selectedElement.data.source}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5 text-[#f5a623]" />
                  </div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-neutral-500">Target:</span>
                    <span className="font-bold text-neutral-300 truncate w-32 text-right">{selectedElement.data.target}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase text-[#475569] tracking-wider">Relationship Type</label>
                  <select
                    disabled={socketStatus !== "connected" || isTimelineActive}
                    value={selectedElement.data.relationType || "relates_to"}
                    onChange={(e) => handleRelationChange(e.target.value)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    style={{ fontFamily: "JetBrains Mono" }}
                  >
                    {["depends_on", "implements", "relates_to", "blocks", "documents", "owns", "uses", "generates"].map((rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                  {isTimelineActive && (
                    <span className="text-[9.5px] text-amber-500 font-bold block mt-1">
                      Editing disabled in historical replay view.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}