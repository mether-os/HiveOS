"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";

import { useSocket } from "@/features/realtime/hooks/useSocket";
import { useCanvasStore } from "../store/useCanvasStore";
import { useKnowledgeStore } from "@/features/search/store/useKnowledgeStore";
import { HiveNode } from "./HiveNode";
import { CanvasMode, NodeCategory } from "../types";
import { Plus, Settings2, Trash2, X, Play, Milestone, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const nodeTypes = {
  customNode: HiveNode,
};

interface CanvasBoardProps {
  hiveId: string;
}

const CATEGORIES: NodeCategory[] = [
  "Audience",
  "Problem",
  "Feature",
  "Goal",
  "Tech Stack",
  "Architecture",
  "Risk",
  "Document",
  "Task"
];
// UI-4: Replace `any` with typed interfaces
interface RawNode {
  id: string;
  position: { x: number; y: number };
  title: string;
  description?: string;
  category: string;
  tags: string[];
  createdBy?: string;
  data?: Record<string, unknown>;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  relationType?: string;
}
// DUP-1/2/3/4: Single source of truth for edge appearance.
// Previously copy-pasted 4× — change once, applies everywhere.
const BASE_EDGE_STYLE = {
  type: "smoothstep" as const,
  animated: true,
  labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' },
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#0b0e14', fillOpacity: 0.85, stroke: '#1e2533', strokeWidth: 1 },
  style: { stroke: "#334155", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 15, height: 15 },
} as const;

// DUP-1: Single node-shape mapper — previously copy-pasted 3× inside CanvasBoard
function mapRawNode(n: RawNode) {
  return {
    id: n.id,
    type: "customNode" as const,
    position: n.position,
    data: {
      title: n.title,
      description: n.description,
      category: n.category,
      tags: n.tags,
      createdBy: n.createdBy,
      ...n.data,
    },
  };
}

// DUP-2: Single edge-shape mapper — previously copy-pasted 3× inside CanvasBoard
function mapRawEdge(e: RawEdge) {
  return {
    ...BASE_EDGE_STYLE,
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.relationType || "relates_to",
    data: { relationType: e.relationType || "relates_to" },
  };
}

export function CanvasBoard({ hiveId }: CanvasBoardProps) {
  const { socket, status } = useSocket();
  const { activeMode, setActiveMode } = useCanvasStore();
  const inspectEntity = useKnowledgeStore((state) => state.inspectEntity);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Creator States
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);

  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setEdgeContextMenu(null);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NodeCategory>("Feature");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [dueDate, setDueDate] = useState("");
  const [nodeStatus, setNodeStatus] = useState<"Todo" | "In Progress" | "Blocked" | "Done">("Todo");
  const [progress, setProgress] = useState(0);

  const lastDragEmitRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // Fetch Canvas on Load
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadCanvas() {
      try {
        setLoading(true);
        const res = await fetch(`/api/hives/${hiveId}/canvas`);
        const result = await res.json();
        if (result.data && Array.isArray(result.data.nodes) && Array.isArray(result.data.edges)) {
          const fetchedNodes = result.data.nodes.map((n: RawNode) => ({
            id: n.id,
            type: "customNode",
            position: n.position,
            data: {
              title: n.title,
              description: n.description,
              category: n.category,
              tags: n.tags,
              createdBy: n.createdBy,
              ...n.data
            }
          }));

          const fetchedEdges = result.data.edges.map((e: RawEdge) => mapRawEdge(e));


          setNodes(fetchedNodes);
          setEdges(fetchedEdges);
        }
      } catch (err) {
        console.error("Failed to load canvas:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCanvas();
  }, [hiveId, status, setNodes, setEdges]);

  // -------------------------------------------------------------------------
  // Socket listeners for Realtime Synchronization
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || status !== "connected") return;

    // RT-3: Re-sync canvas state after socket reconnect.
    // RealtimeWorkspaceController dispatches this event on every (re)connect.
    const handleResync = (e: CustomEvent) => {
      const { nodes: rawNodes, edges: rawEdges } = e.detail;
      const remappedNodes = (rawNodes || []).map((n: RawNode) => mapRawNode(n));
      const remappedEdges = (rawEdges || []).map((e: RawEdge) => mapRawEdge(e));

      setNodes(remappedNodes);
      setEdges(remappedEdges);
    };

    window.addEventListener("canvas:resync", handleResync as EventListener);

    socket.on("canvas:node-create", ({ node }: { node: any }) => {
      const formattedNode = {
        id: node.id,
        type: "customNode",
        position: node.position,
        data: {
          title: node.title,
          description: node.description,
          category: node.category,
          tags: node.tags,
          createdBy: node.createdBy,
          ...node.data
        }
      };
      setNodes((nds) => nds.concat(formattedNode));
    });

    socket.on("canvas:node-drag", ({ id, position }: { id: string; position: { x: number; y: number } }) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, position } : n))
      );
    });

    socket.on("canvas:node-drag-stop", ({ id, position }: { id: string; position: { x: number; y: number } }) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, position } : n))
      );
    });

    socket.on("canvas:node-lock", ({ id, lockedBy }: { id: string; lockedBy: any }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, lockedBy }, draggable: false }
            : n
        )
      );
    });

    socket.on("canvas:node-unlock", ({ id }: { id: string }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, lockedBy: undefined }, draggable: true }
            : n
        )
      );
    });

    socket.on("canvas:node-update", ({ id, updates }: { id: string; updates: any }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                position: updates.position || n.position,
                data: { ...n.data, ...updates }
              }
            : n
        )
      );
    });

    socket.on("canvas:node-delete", ({ id }: { id: string }) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    });

    socket.on("canvas:edge-create", ({ edge }: { edge: any }) => {
      const formattedEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: true,
        label: edge.relationType || "relates_to",
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#0b0e14', fillOpacity: 0.85, stroke: '#1e2533', strokeWidth: 1 },
        style: { stroke: "#334155", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 15, height: 15 },
        data: { relationType: edge.relationType || "relates_to" }
      };
      setEdges((eds) => addEdge(formattedEdge, eds));
    });

    socket.on("canvas:edge-delete", ({ id }: { id: string }) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
    });

    socket.on("canvas:edge-update-relation", ({ id, relationType }: { id: string; relationType: string }) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                label: relationType,
                data: { ...e.data, relationType }
              }
            : e
        )
      );
    });

    return () => {
      window.removeEventListener("canvas:resync", handleResync as EventListener);
      socket.off("canvas:node-create");
      socket.off("canvas:node-drag");
      socket.off("canvas:node-drag-stop");
      socket.off("canvas:node-lock");
      socket.off("canvas:node-unlock");
      socket.off("canvas:node-update");
      socket.off("canvas:node-delete");
      socket.off("canvas:edge-create");
      socket.off("canvas:edge-delete");
      socket.off("canvas:edge-update-relation");
    };
  }, [socket, status, setNodes, setEdges]);

  // -------------------------------------------------------------------------
  // Node Drag Handlers (with throttling and locks)
  // -------------------------------------------------------------------------
  const onNodeDragStart = useCallback((event: React.MouseEvent, node: any) => {
    if (!socket || status !== "connected") return;
    socket.emit("canvas:node-lock", { workspaceId: hiveId, id: node.id });
  }, [socket, status, hiveId]);

  const onNodeDrag = useCallback((event: React.MouseEvent, node: any) => {
    if (!socket || status !== "connected") return;
    const now = Date.now();
    if (now - lastDragEmitRef.current > 30) {
      socket.emit("canvas:node-drag", {
        workspaceId: hiveId,
        id: node.id,
        position: node.position
      });
      lastDragEmitRef.current = now;
    }
  }, [socket, status, hiveId]);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: any) => {
    if (!socket || status !== "connected") return;
    socket.emit("canvas:node-unlock", { workspaceId: hiveId, id: node.id });
    socket.emit("canvas:node-drag-stop", {
      workspaceId: hiveId,
      id: node.id,
      position: node.position
    });
  }, [socket, status, hiveId]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    inspectEntity(node.id, "node", node.data.title);
  }, [inspectEntity]);

  const triggerReconfigure = useCallback(async (mutationType: string, entityId: string, entityType: string, details: any) => {
    try {
      const res = await fetch(`/api/hives/${hiveId}/canvas/reconfigure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutationType, entityId, entityType, details })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || res.statusText || "Unknown error";
        console.error("Failed to trigger AI reconfiguration:", errMsg);
        alert(`Failed to sync with AI companion: ${errMsg}`);
      }
    } catch (err: any) {
      console.error("Failed to trigger AI reconfiguration:", err);
      alert(`Failed to sync with AI companion: ${err.message || "Network error"}`);
    }
  }, [hiveId]);


  // -------------------------------------------------------------------------
  // Connect Handlers
  // -------------------------------------------------------------------------
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target || !socket || status !== "connected") return;

    const edgeId = `edge-${params.source}-${params.target}-${Date.now().toString(36)}`;
    const newEdge = {
      id: edgeId,
      source: params.source,
      target: params.target,
      type: "smoothstep",
      animated: true,
      label: "relates_to",
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#0b0e14', fillOpacity: 0.85, stroke: '#1e2533', strokeWidth: 1 },
      style: { stroke: "#334155", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 15, height: 15 },
      data: { relationType: "relates_to" }
    };

    setEdges((eds) => addEdge(newEdge, eds));

    socket.emit("canvas:edge-create", {
      workspaceId: hiveId,
      edge: {
        id: edgeId,
        hiveId: hiveId,
        source: params.source,
        target: params.target,
        type: "smoothstep",
        relationType: "relates_to"
      }
    });

    triggerReconfigure("edge_created", edgeId, "edge", { source: params.source, target: params.target });
  }, [socket, status, hiveId, setEdges, triggerReconfigure]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    const container = document.getElementById("flow-container");
    if (container) {
      const rect = container.getBoundingClientRect();
      setEdgeContextMenu({
        id: edge.id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    } else {
      setEdgeContextMenu({
        id: edge.id,
        x: event.clientX,
        y: event.clientY
      });
    }
  }, []);

  const onNodesDelete = useCallback((nodesToDelete: any[]) => {
    if (!socket || status !== "connected") return;
    nodesToDelete.forEach((node) => {
      socket.emit("canvas:node-delete", { workspaceId: hiveId, id: node.id });
      triggerReconfigure("node_deleted", node.id, "node", { title: node.data?.title });
    });
  }, [socket, status, hiveId, triggerReconfigure]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    if (!socket || status !== "connected") return;
    edgesToDelete.forEach((edge) => {
      socket.emit("canvas:edge-delete", { workspaceId: hiveId, id: edge.id });
      triggerReconfigure("edge_deleted", edge.id, "edge", { source: edge.source, target: edge.target });
    });
  }, [socket, status, hiveId, triggerReconfigure]);

  // -------------------------------------------------------------------------
  // Double-Click to Edit (Triggers Visual Lock)
  // -------------------------------------------------------------------------
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: any) => {
    if (!socket || status !== "connected" || node.data.lockedBy) return;

    socket.emit("canvas:node-lock", { workspaceId: hiveId, id: node.id });

    setEditingNode(node);
    setTitle(node.data.title || "");
    setDescription(node.data.description || "");
    setCategory(node.data.category || "Feature");
    setTagsInput(node.data.tags?.join(", ") || "");
    setPriority(node.data.priority || "Medium");
    setDueDate(node.data.dueDate || "");
    setNodeStatus(node.data.status || "Todo");
    setProgress(node.data.progress || 0);
  }, [socket, status, hiveId]);

  const closeEditor = () => {
    if (editingNode && socket && status === "connected") {
      socket.emit("canvas:node-unlock", { workspaceId: hiveId, id: editingNode.id });
    }
    setEditingNode(null);
  };

  // -------------------------------------------------------------------------
  // Create / Update Actions
  // -------------------------------------------------------------------------
  const handleCreateNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !socket || status !== "connected") return;

    const nodeId = `node-${Date.now().toString(36)}`;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const position = {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };

    const nodePayload = {
      id: nodeId,
      hiveId,
      type: "customNode",
      category,
      title: title.trim(),
      description: description.trim(),
      tags,
      position,
      data: {
        priority,
        dueDate: dueDate || undefined,
        status: nodeStatus,
        progress
      }
    };

    socket.emit("canvas:node-create", {
      workspaceId: hiveId,
      node: nodePayload
    });

    triggerReconfigure("node_created", nodeId, "node", { category, title: title.trim(), description: description.trim() });

    setTitle("");
    setDescription("");
    setTagsInput("");
    setIsCreatorOpen(false);
  };

  const handleUpdateNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !title.trim() || !socket || status !== "connected") return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const updatePayload = {
      title: title.trim(),
      description: description.trim(),
      category,
      tags,
      data: {
        priority,
        dueDate: dueDate || undefined,
        status: nodeStatus,
        progress
      }
    };

    socket.emit("canvas:node-update", {
      workspaceId: hiveId,
      id: editingNode.id,
      updates: updatePayload
    });

    triggerReconfigure("node_updated", editingNode.id, "node", updatePayload);

    closeEditor();
  };

  const handleDeleteNode = () => {
    if (!editingNode || !socket || status !== "connected") return;
    socket.emit("canvas:node-delete", { workspaceId: hiveId, id: editingNode.id });
    triggerReconfigure("node_deleted", editingNode.id, "node", { title: editingNode.data?.title });
    setEditingNode(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#94a3b8] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
        <span className="text-sm font-semibold tracking-wide uppercase" style={{ fontFamily: "JetBrains Mono" }}>
          Initializing Canvas Graph...
        </span>
      </div>
    );
  }

  return (
    <div id="flow-container" className="relative h-full w-full">
      {/* ------------------------------------------------------------------ */}
      {/* Floating Mode Switcher & Actions Toolbar */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 bg-[#0b0e14]/90 border border-[#1e2533] p-1.5 rounded-xl shadow-2xl backdrop-blur-md">
        <div className="flex items-center p-0.5 bg-[#080a0f] rounded-lg border border-[#1e2533]/45 select-none">
          {(["Brainstorm", "Planning", "Execution"] as CanvasMode[]).map((mode) => {
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all",
                  isActive
                    ? "bg-[#1a1f2c] text-[#f5a623] shadow-md border border-[#1e2533]"
                    : "text-[#64748b] hover:text-[#94a3b8]"
                )}
                style={{ fontFamily: "JetBrains Mono" }}
              >
                {mode === "Brainstorm" && <Compass className="w-3.5 h-3.5" />}
                {mode === "Planning" && <Milestone className="w-3.5 h-3.5" />}
                {mode === "Execution" && <Play className="w-3.5 h-3.5" />}
                <span>{mode}</span>
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-[#1e2533]" />

        <button
          onClick={() => {
            setIsCreatorOpen(true);
            setTitle("");
            setDescription("");
            setTagsInput("");
          }}
          disabled={status !== "connected"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] text-[11px] font-extrabold uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: "JetBrains Mono" }}
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Node</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* React Flow Board */}
      {/* ------------------------------------------------------------------ */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#080a0f]"
      >
        <Background color="#1e2533" gap={20} size={1} />
        <Controls className="!bg-[#0e1117] !border-[#1e2533] !rounded-lg !shadow-2xl [&_button]:!border-b [&_button]:!border-[#1e2533] [&_button]:!text-neutral-400 [&_button:hover]:!bg-[#1a1f2c]" />
      </ReactFlow>

      {/* Edge Context Menu Overlay */}
      {edgeContextMenu && (
        <div
          className="absolute z-50 bg-[#0e1117]/95 border border-[#1e2533] rounded-xl shadow-2xl p-2 min-w-[150px] backdrop-blur-md"
          style={{ top: edgeContextMenu.y, left: edgeContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#475569] font-bold uppercase px-2 py-1 select-none border-b border-[#1e2533] mb-1">
            Relation Type
          </div>
          <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
            {["depends_on", "implements", "relates_to", "blocks", "documents", "owns", "uses", "generates"].map((rel) => (
              <button
                key={rel}
                onClick={() => {
                  if (socket && status === "connected") {
                    socket.emit("canvas:edge-update-relation", {
                      workspaceId: hiveId,
                      id: edgeContextMenu.id,
                      relationType: rel
                    });
                  }
                  setEdgeContextMenu(null);
                }}
                className="text-left px-2 py-1 text-[11px] text-[#94a3b8] hover:text-[#f5a623] hover:bg-[#1e2533]/50 rounded font-semibold transition-colors"
                style={{ fontFamily: "JetBrains Mono" }}
              >
                {rel}
              </button>
            ))}
          </div>
          <div className="border-t border-[#1e2533] mt-1 pt-1">
            <button
              onClick={() => {
                if (socket && status === "connected") {
                  socket.emit("canvas:edge-delete", {
                    workspaceId: hiveId,
                    id: edgeContextMenu.id
                  });
                }
                setEdgeContextMenu(null);
              }}
              className="w-full text-left px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 rounded font-semibold transition-colors"
              style={{ fontFamily: "JetBrains Mono" }}
            >
              Delete Edge
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Creator Overlay */}
      {/* ------------------------------------------------------------------ */}
      {isCreatorOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[350px] bg-[#0e1117]/95 border border-[#1e2533] p-5 rounded-2xl shadow-2xl backdrop-blur-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono" }}>
              <Plus className="w-4 h-4 text-[#f5a623]" />
              <span>Create Canvas Node</span>
            </h3>
            <button onClick={() => setIsCreatorOpen(false)} className="p-1 text-[#475569] hover:text-[#94a3b8] rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateNodeSubmit} className="space-y-4 text-[12px]">
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter node title..."
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NodeCategory)}
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter details..."
                rows={2}
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="frontend, api, refactor..."
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wider"
              style={{ fontFamily: "JetBrains Mono" }}
            >
              Add to Graph
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Editor Overlay */}
      {/* ------------------------------------------------------------------ */}
      {editingNode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[350px] bg-[#0e1117]/95 border border-amber-500/80 p-5 rounded-2xl shadow-2xl backdrop-blur-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono" }}>
              <Settings2 className="w-4 h-4 text-[#f5a623]" />
              <span>Modify Canvas Node</span>
            </h3>
            <button onClick={closeEditor} className="p-1 text-[#475569] hover:text-[#94a3b8] rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleUpdateNodeSubmit} className="space-y-4 text-[12px]">
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter node title..."
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NodeCategory)}
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter details..."
                rows={2}
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Tags</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="frontend, api, refactor..."
                className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              />
            </div>

            {activeMode === "Planning" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "Low" | "Medium" | "High")}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-1.5 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Due Date</label>
                  <input
                    type="date"
                    value={dueDate ? dueDate.substring(0, 10) : ""}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2 py-1.5 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  />
                </div>
              </div>
            )}

            {activeMode === "Execution" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Status</label>
                  <select
                    value={nodeStatus}
                    onChange={(e) => setNodeStatus(e.target.value as any)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-1.5 text-[#f1f5f9] focus:outline-none"
                  >
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#475569] font-semibold">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full accent-[#f5a623] bg-[#080a0f]"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                type="submit"
                className="col-span-2 py-2.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wider"
                style={{ fontFamily: "JetBrains Mono" }}
              >
                Apply Changes
              </button>
              <button
                type="button"
                onClick={handleDeleteNode}
                className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 flex items-center justify-center transition-colors"
                aria-label="Delete node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}