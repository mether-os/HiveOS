"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/features/realtime/hooks/useSocket";
import { useSession } from "@/lib/auth-client";
import {
  Kanban,
  Plus,
  Search,
  Trash2,
  X,
  Calendar,
  User,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";

interface TaskNode {
  id: string;
  title: string;
  description: string;
  position?: { x: number; y: number };
  data: {
    status: "Todo" | "In Progress" | "Blocked" | "Done";
    priority: "Low" | "Medium" | "High";
    assigneeName?: string;
    assigneeId?: string;
    dueDate?: string;
    progress?: number;
  };
}

const COLUMNS = [
  { status: "Todo" as const, label: "Todo", colorClass: "text-slate-400 border-slate-500/20 bg-slate-500/5" },
  { status: "In Progress" as const, label: "In Progress", colorClass: "text-sky-400 border-sky-500/20 bg-sky-500/5" },
  { status: "Blocked" as const, label: "Blocked", colorClass: "text-rose-500 border-rose-500/20 bg-rose-500/5 pulsing-indicator" },
  { status: "Done" as const, label: "Done", colorClass: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" }
];

export default function TasksPage() {
  const params = useParams();
  const hiveId = params?.hiveId as string;
  const { data: session } = useSession();
  const { socket, status: socketStatus } = useSocket();

  // Tasks State
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "Low" | "Medium" | "High">("All");

  // Modal / Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskNode | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [assigneeName, setAssigneeName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState<"Todo" | "In Progress" | "Blocked" | "Done">("Todo");
  const [progress, setProgress] = useState(0);

  // -------------------------------------------------------------------------
  // Fetch Initial Tasks (nodes of category === "Task")
  // -------------------------------------------------------------------------
  const loadTasks = useCallback(async () => {
    if (!hiveId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/hives/${hiveId}/canvas`);
      const result = await res.json();
      if (result.data) {
        const fetchedTasks = (result.data.nodes || [])
          .filter((n: any) => n.category === "Task")
          .map((n: any) => ({
            id: n.id,
            title: n.title,
            description: n.description || "",
            position: n.position,
            data: {
              status: n.data?.status || "Todo",
              priority: n.data?.priority || "Medium",
              assigneeName: n.data?.assigneeName || "",
              assigneeId: n.data?.assigneeId || "",
              dueDate: n.data?.dueDate || "",
              progress: n.data?.progress || 0
            }
          }));
        setTasks(fetchedTasks);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [hiveId]);

  useEffect(() => {
    loadTasks();
  }, [hiveId, loadTasks]);

  // -------------------------------------------------------------------------
  // Realtime Socket Event Synchronizer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || socketStatus !== "connected") return;

    // Task Creation
    socket.on("canvas:node-create", ({ node }: { node: any }) => {
      if (node.category !== "Task") return;

      const newTask: TaskNode = {
        id: node.id,
        title: node.title,
        description: node.description || "",
        position: node.position,
        data: {
          status: node.data?.status || "Todo",
          priority: node.data?.priority || "Medium",
          assigneeName: node.data?.assigneeName || "",
          assigneeId: node.data?.assigneeId || "",
          dueDate: node.data?.dueDate || "",
          progress: node.data?.progress || 0
        }
      };

      setTasks((prev) => {
        // Prevent duplicate append
        if (prev.some((t) => t.id === node.id)) return prev;
        return [...prev, newTask];
      });
    });

    // Task Update
    socket.on("canvas:node-update", ({ id, updates }: { id: string; updates: any }) => {
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === id);

        // Case 1: Existing task is updated
        if (exists) {
          // If updated category changed to non-task, remove it
          if (updates.category !== undefined && updates.category !== "Task") {
            return prev.filter((t) => t.id !== id);
          }

          return prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  title: updates.title !== undefined ? updates.title : t.title,
                  description: updates.description !== undefined ? updates.description : t.description,
                  position: updates.position !== undefined ? updates.position : t.position,
                  data: {
                    ...t.data,
                    ...updates.data
                  }
                }
              : t
          );
        }

        // Case 2: Node not currently tracked in tasks list but category updated to "Task"
        if (updates.category === "Task") {
          // Re-fetch node state or add placeholder (safest is to trigger a merge of known fields)
          const newTask: TaskNode = {
            id,
            title: updates.title || "Untitled Node",
            description: updates.description || "",
            position: updates.position,
            data: {
              status: updates.data?.status || "Todo",
              priority: updates.data?.priority || "Medium",
              assigneeName: updates.data?.assigneeName || "",
              assigneeId: updates.data?.assigneeId || "",
              dueDate: updates.data?.dueDate || "",
              progress: updates.data?.progress || 0
            }
          };
          return [...prev, newTask];
        }

        return prev;
      });
    });

    // Task Deletion
    socket.on("canvas:node-delete", ({ id }: { id: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      socket.off("canvas:node-create");
      socket.off("canvas:node-update");
      socket.off("canvas:node-delete");
    };
  }, [socket, socketStatus]);

  const triggerReconfigure = useCallback(async (mutationType: string, entityId: string, details: any) => {
    try {
      await fetch(`/api/hives/${hiveId}/canvas/reconfigure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutationType, entityId, entityType: "node", details })
      });
    } catch (err) {
      console.error("Failed to trigger AI reconfiguration from Tasks:", err);
    }
  }, [hiveId]);

  // -------------------------------------------------------------------------
  // Drag and Drop (HTML5 Native Drag-and-Drop)
  // -------------------------------------------------------------------------
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: "Todo" | "In Progress" | "Blocked" | "Done") => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Skip if status is unchanged
    if (task.data.status === targetStatus) return;

    // Optimistic UI state update
    const autoProgress = targetStatus === "Done" ? 100 : targetStatus === "Todo" ? 0 : task.data.progress || 0;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              data: {
                ...t.data,
                status: targetStatus,
                progress: autoProgress
              }
            }
          : t
      )
    );

    // Emit Canvas update over sockets
    if (socket && socketStatus === "connected") {
      socket.emit("canvas:node-update", {
        workspaceId: hiveId,
        id: taskId,
        updates: {
          data: {
            ...task.data,
            status: targetStatus,
            progress: autoProgress
          }
        }
      });
    } else {
      try {
        await fetch(`/api/hives/${hiveId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_node",
            id: taskId,
            updates: {
              data: {
                ...task.data,
                status: targetStatus,
                progress: autoProgress
              }
            }
          })
        });
      } catch (err) {
        console.error("Failed to update task position via REST fallback:", err);
      }
    }

    triggerReconfigure("node_updated", taskId, { data: { status: targetStatus, progress: autoProgress } });
  };

  // -------------------------------------------------------------------------
  // Create / Edit Action Handlers
  // -------------------------------------------------------------------------
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTaskId = `node-task-${Date.now().toString(36)}`;
    const nodePayload = {
      id: newTaskId,
      hiveId,
      type: "customNode",
      category: "Task",
      title: title.trim(),
      description: description.trim(),
      position: {
        x: 200 + Math.random() * 300,
        y: 200 + Math.random() * 300
      },
      data: {
        status: "Todo" as const,
        priority,
        assigneeName: assigneeName.trim() || undefined,
        assigneeId: assigneeId.trim() || undefined,
        dueDate: dueDate || undefined,
        progress: 0
      }
    };

    if (socket && socketStatus === "connected") {
      socket.emit("canvas:node-create", {
        workspaceId: hiveId,
        node: nodePayload
      });
    } else {
      try {
        const res = await fetch(`/api/hives/${hiveId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_node", node: nodePayload })
        });
        if (res.ok) {
          const newTask: TaskNode = {
            id: newTaskId,
            title: nodePayload.title,
            description: nodePayload.description,
            position: nodePayload.position,
            data: {
              status: nodePayload.data.status,
              priority: nodePayload.data.priority,
              assigneeName: nodePayload.data.assigneeName,
              assigneeId: nodePayload.data.assigneeId,
              dueDate: nodePayload.data.dueDate,
              progress: nodePayload.data.progress
            }
          };
          setTasks((prev) => [...prev, newTask]);
          toast.success("Task created successfully");
        } else {
          toast.error("Failed to create task");
        }
      } catch (err) {
        console.error("Error creating task via REST API fallback:", err);
      }
    }

    triggerReconfigure("node_created", newTaskId, { category: "Task", title: title.trim(), description: description.trim(), data: nodePayload.data });

    // Clean states & close
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setAssigneeName("");
    setAssigneeId("");
    setDueDate("");
    setIsCreateOpen(false);
  };

  const handleEditOpen = (task: TaskNode) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.data.priority);
    setAssigneeName(task.data.assigneeName || "");
    setAssigneeId(task.data.assigneeId || "");
    setDueDate(task.data.dueDate || "");
    setTaskStatus(task.data.status);
    setProgress(task.data.progress || 0);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !title.trim()) return;

    const autoProgress = taskStatus === "Done" ? 100 : taskStatus === "Todo" && progress === 100 ? 0 : progress;
    const updatesPayload = {
      title: title.trim(),
      description: description.trim(),
      data: {
        ...editingTask.data,
        status: taskStatus,
        priority,
        assigneeName: assigneeName.trim() || undefined,
        assigneeId: assigneeId.trim() || undefined,
        dueDate: dueDate || undefined,
        progress: autoProgress
      }
    };

    if (socket && socketStatus === "connected") {
      socket.emit("canvas:node-update", {
        workspaceId: hiveId,
        id: editingTask.id,
        updates: updatesPayload
      });
    } else {
      try {
        const res = await fetch(`/api/hives/${hiveId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_node", id: editingTask.id, updates: updatesPayload })
        });
        if (res.ok) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === editingTask.id
                ? {
                    ...t,
                    title: updatesPayload.title,
                    description: updatesPayload.description,
                    data: {
                      ...t.data,
                      ...updatesPayload.data
                    }
                  }
                : t
            )
          );
        } else {
          alert("Failed to update task");
        }
      } catch (err) {
        console.error("Error updating task via REST fallback:", err);
      }
    }

    triggerReconfigure("node_updated", editingTask.id, updatesPayload);

    setEditingTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    const deletedTaskTitle = tasks.find((t) => t.id === taskId)?.title;
    if (socket && socketStatus === "connected") {
      socket.emit("canvas:node-delete", {
        workspaceId: hiveId,
        id: taskId
      });
    } else {
      try {
        const res = await fetch(`/api/hives/${hiveId}/canvas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_node", id: taskId })
        });
        if (res.ok) {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        } else {
          alert("Failed to delete task");
        }
      } catch (err) {
        console.error("Error deleting task via REST fallback:", err);
      }
    }

    triggerReconfigure("node_deleted", taskId, { title: deletedTaskTitle });

    setEditingTask(null);
  };

  // -------------------------------------------------------------------------
  // Filtering & Metrics Calculations
  // -------------------------------------------------------------------------
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority =
      priorityFilter === "All" ||
      task.data?.priority?.toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesPriority;
  });

  const todoCount = tasks.filter((t) => (t.data.status || "Todo") === "Todo").length;
  const inProgressCount = tasks.filter((t) => t.data.status === "In Progress").length;
  const blockedCount = tasks.filter((t) => t.data.status === "Blocked").length;
  const doneCount = tasks.filter((t) => t.data.status === "Done").length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-300 select-none">
      {/* Top Header toolbar */}
      <div className="h-16 border-b border-[#1e2533] px-8 flex items-center justify-between bg-[#0b0e14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Kanban className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-sm font-extrabold uppercase tracking-wider text-[#f1f5f9]">Tasks Board</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Fuzzy Search */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl pl-9 pr-8 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#f5a623] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-[#f5a623]"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>

          {/* Add Task Button */}
          <button
            onClick={() => {
              setTitle("");
              setDescription("");
              setPriority("Medium");
              setAssigneeName(session?.user?.name || "");
              setAssigneeId(session?.user?.id || "");
              setDueDate("");
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] text-[11px] font-extrabold uppercase transition-all active:scale-95"
            style={{ fontFamily: "JetBrains Mono" }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Empty state — shown when workspace has no tasks yet */}
      {!loading && tasks.length === 0 && (
        <EmptyState
          icon={<Kanban size={32} />}
          title="No tasks yet"
          description="Break your project into tasks. Drag them across columns as you make progress."
          action={{
            label: "Create First Task",
            icon: <Plus className="w-4 h-4" />,
            onClick: () => {
              setTitle(""); setDescription(""); setPriority("Medium");
              setAssigneeName(session?.user?.name || "");
              setAssigneeId(session?.user?.id || "");
              setDueDate(""); setIsCreateOpen(true);
            },
          }}
        />
      )}

      {/* Main content — only shown when tasks exist */}
      {!loading && tasks.length > 0 && (
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#0c101b]/50 border border-[#1e2533] rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-[#475569] uppercase tracking-wider font-mono">Total Tasks</span>
            <span className="text-2xl font-black text-[#f1f5f9] mt-1">{tasks.length}</span>
          </div>
          <div className="bg-[#0c101b]/50 border border-slate-500/10 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Todo</span>
            <span className="text-2xl font-black text-slate-300 mt-1">{todoCount}</span>
          </div>
          <div className="bg-[#0c101b]/50 border border-sky-500/15 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-sky-400 uppercase tracking-wider font-mono">In Progress</span>
            <span className="text-2xl font-black text-sky-300 mt-1">{inProgressCount}</span>
          </div>
          <div className="bg-[#0c101b]/50 border border-rose-500/15 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-rose-500 uppercase tracking-wider font-mono">Blocked</span>
            <span className="text-2xl font-black text-rose-400 mt-1">{blockedCount}</span>
          </div>
          <div className="bg-[#0c101b]/50 border border-emerald-500/15 rounded-2xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider font-mono font-bold">Done</span>
            <span className="text-2xl font-black text-emerald-300 mt-1">{doneCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
            <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ fontFamily: "JetBrains Mono" }}>
              Syncing Workspace Tasks...
            </span>
          </div>
        ) : (
          /* Kanban Board Lanes */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {COLUMNS.map(({ status: colStatus, label, colorClass }) => {
              const columnTasks = filteredTasks.filter((t) => (t.data.status || "Todo") === colStatus);

              return (
                <div
                  key={colStatus}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, colStatus)}
                  className="bg-[#0c101b]/30 border border-[#1e2533]/80 rounded-2xl p-4 flex flex-col min-h-[550px] transition-colors duration-150 hover:bg-[#0c101b]/50"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1e2533]/50">
                    <span className={cn("text-xs font-extrabold uppercase tracking-widest font-mono", colorClass.split(" ")[0])}>
                      {label}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#080a0f] border border-[#1e2533] text-neutral-400">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
                    {columnTasks.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center min-h-[120px] border border-dashed border-[#1e2533]/50 rounded-xl text-neutral-600 select-none">
                        <span className="text-[9px] font-semibold uppercase tracking-wider font-mono">Empty Lane</span>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => handleEditOpen(task)}
                          className="
                            bg-[#0e1117]/90 hover:bg-[#151a24]/80
                            border border-[#1e2533] hover:border-[#f5a623]/35
                            rounded-xl p-4 space-y-3 cursor-grab active:cursor-grabbing
                            transition-all duration-200 shadow-sm
                          "
                        >
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-xs font-bold text-[#f1f5f9] leading-snug break-words max-w-[80%]">
                              {task.title}
                            </h4>
                            {/* Priority Badge */}
                            <span
                              className={cn(
                                "text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider",
                                task.data.priority === "High" ? "bg-red-500/10 border-red-500/25 text-red-400" :
                                task.data.priority === "Medium" ? "bg-amber-500/10 border-amber-500/25 text-amber-400" :
                                "bg-sky-500/10 border-sky-500/25 text-sky-400"
                              )}
                            >
                              {task.data.priority}
                            </span>
                          </div>

                          {task.description && (
                            <p className="text-[10px] text-neutral-500 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Mini Progress Bar */}
                          {task.data.progress !== undefined && task.data.progress > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[8px] text-neutral-600 font-mono">
                                <span>Progress</span>
                                <span>{task.data.progress}%</span>
                              </div>
                              <div className="w-full bg-[#080a0f] h-1 rounded-full overflow-hidden border border-[#1e2533]/50">
                                <div
                                  className="bg-[#f5a623] h-full transition-all duration-300"
                                  style={{ width: `${task.data.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Footer details: assignee, date */}
                          <div className="flex justify-between items-center pt-2 border-t border-[#1e2533]/30 text-[9px] text-neutral-500 font-semibold font-mono">
                            {/* Assignee */}
                            <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                              <User className="w-3 h-3 text-neutral-600 shrink-0" />
                              <span className="truncate">{task.data.assigneeName || "Unassigned"}</span>
                            </div>

                            {/* Due Date */}
                            {task.data.dueDate && (
                              <div className="flex items-center gap-1 text-[8.5px] shrink-0 text-[#94a3b8]">
                                <Calendar className="w-3 h-3 text-neutral-600" />
                                <span>{new Date(task.data.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )} {/* end tasks.length > 0 conditional */}

      {/* ------------------------------------------------------------------ */}
      {/* Creation Modal Overlay */}
      {/* ------------------------------------------------------------------ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[420px] bg-[#0e1117]/95 border border-[#1e2533] p-6 rounded-2xl shadow-2xl backdrop-blur-lg select-none space-y-4">
            <div className="flex justify-between items-center border-b border-[#1e2533] pb-3">
              <h3 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono" }}>
                <Plus className="w-4 h-4 text-[#f5a623]" />
                <span>Create Workspace Task</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 text-[#475569] hover:text-[#94a3b8] rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-[12px]">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details and context..."
                  rows={3}
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] resize-none"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Assignee Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Assignee Name</label>
                  <input
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    placeholder="User's Name"
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  />
                </div>
                {/* Due Date */}
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-1.5 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  />
                </div>
              </div>

              {/* Hidden Assignee ID field - defaults to session user id */}
              <input type="hidden" value={assigneeId} />

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wider transition-all"
                style={{ fontFamily: "JetBrains Mono" }}
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Editor Modal Overlay */}
      {/* ------------------------------------------------------------------ */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[420px] bg-[#0e1117]/95 border border-[#1e2533] p-6 rounded-2xl shadow-2xl backdrop-blur-lg select-none space-y-4">
            <div className="flex justify-between items-center border-b border-[#1e2533] pb-3">
              <h3 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono" }}>
                <Settings className="w-4 h-4 text-[#f5a623]" />
                <span>Modify Task Node</span>
              </h3>
              <button onClick={() => setEditingTask(null)} className="p-1 text-[#475569] hover:text-[#94a3b8] rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-[12px]">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details..."
                  rows={2}
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] resize-none"
                />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Status</label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as any)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              {/* Progress slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-500 font-semibold font-mono">
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

              {/* Assignee & Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Assignee Name</label>
                  <input
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    placeholder="User's Name"
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px] font-mono">Due Date</label>
                  <input
                    type="date"
                    value={dueDate ? dueDate.substring(0, 10) : ""}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-1.5 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <button
                  type="submit"
                  className="col-span-2 py-2.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wider transition-all"
                  style={{ fontFamily: "JetBrains Mono" }}
                >
                  Apply Changes
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTask(editingTask.id)}
                  className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 flex items-center justify-center transition-colors"
                  aria-label="Delete node"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
