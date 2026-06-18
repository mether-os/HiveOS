"use client";

import React, { useState, useEffect, useRef } from "react";
import { useKnowledgeStore } from "@/features/search/store/useKnowledgeStore";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search,
  FileText,
  Compass,
  Milestone,
  Play,
  Plus,
  GitBranch,
  Settings,
  X,
  Keyboard,
  HelpCircle
} from "lucide-react";

interface CommandPaletteProps {
  hiveId: string;
}

interface CommandAction {
  id: string;
  title: string;
  category: "Actions" | "Navigation";
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ hiveId }: CommandPaletteProps) {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, inspectEntity } = useKnowledgeStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Keyboard listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // 2. Quick Command Actions
  const commandActions: CommandAction[] = [
    {
      id: "action-create-doc",
      title: "Create Document Specs",
      category: "Actions",
      icon: <Plus className="w-3.5 h-3.5 text-emerald-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/documents`);
      }
    },
    {
      id: "action-create-node",
      title: "Create Canvas Node Element",
      category: "Actions",
      icon: <Plus className="w-3.5 h-3.5 text-blue-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/canvas`);
      }
    },
    {
      id: "action-create-hive",
      title: "Create New Workspace Hive",
      category: "Actions",
      icon: <Plus className="w-3.5 h-3.5 text-amber-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push("/");
      }
    },
    {
      id: "nav-canvas",
      title: "Open Canvas Board View",
      category: "Navigation",
      icon: <Compass className="w-3.5 h-3.5 text-purple-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/canvas`);
      }
    },
    {
      id: "nav-docs",
      title: "Open Document Explorer",
      category: "Navigation",
      icon: <FileText className="w-3.5 h-3.5 text-sky-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/documents`);
      }
    },
    {
      id: "nav-graph",
      title: "Open Graph Relationship Explorer",
      category: "Navigation",
      icon: <Milestone className="w-3.5 h-3.5 text-cyan-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/graph`);
      }
    },
    {
      id: "nav-activity",
      title: "Open GitHub Activity Feed",
      category: "Navigation",
      icon: <GitBranch className="w-3.5 h-3.5 text-orange-400" />,
      action: () => {
        setCommandPaletteOpen(false);
        router.push(`/hive/${hiveId}/activity`);
      }
    }
  ];

  // 3. Search Fetching (Debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hives/${hiveId}/search?q=${encodeURIComponent(query.trim())}`);
        const result = await res.json();
        if (result.data?.results) {
          setResults(result.data.results);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Command palette search failed:", err);
      } finally {
        setLoading(false);
        setSelectedIndex(0);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, hiveId]);

  // Combine items to list
  const activeItems: any[] = query.trim()
    ? results
    : commandActions;

  // 4. Keyboard Navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % activeItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(activeItems[selectedIndex]);
    }
  };

  // 5. Select Action
  const handleSelect = (item: any) => {
    if (!item) return;

    if (item.action) {
      // It is a command action
      item.action();
    } else {
      // It is a search result
      setCommandPaletteOpen(false);
      const { entityId, entityType, title } = item;

      if (entityType === "document") {
        router.push(`/hive/${hiveId}/documents/${entityId}`);
      } else if (entityType === "node") {
        inspectEntity(entityId, "node", title);
        router.push(`/hive/${hiveId}/canvas`);
      } else if (entityType === "activity") {
        inspectEntity(entityId, "activity", title);
        router.push(`/hive/${hiveId}/activity`);
      } else if (entityType === "mutation") {
        inspectEntity(entityId, "mutation", title);
        router.push(`/hive/${hiveId}/graph`);
      }
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-md pt-24 select-none">
      
      {/* Modal Container */}
      <div
        className="w-[540px] bg-[#0e1117]/95 border border-[#1e2533] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[440px]"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="h-14 border-b border-[#1e2533] px-4 flex items-center gap-3 bg-[#111420] shrink-0">
          <Search className="w-5 h-5 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, canvas elements, activity logs or run commands..."
            className="flex-1 bg-transparent border-0 focus:outline-none text-sm text-[#f1f5f9] placeholder:text-[#475569] h-full"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded bg-[#080a0f] border border-[#1e2533] text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2.5 scrollbar-thin text-xs space-y-0.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-500 gap-2 font-mono text-[10px] uppercase tracking-wider">
              <div className="w-5 h-5 rounded-full border border-t-[#f5a623] border-[#1e2533] animate-spin" />
              <span>Searching Project Index...</span>
            </div>
          ) : activeItems.length === 0 ? (
            <div className="text-center py-8 text-[#475569] italic">
              No matching specifications, canvas elements, or commands found.
            </div>
          ) : (
            <>
              {/* Category Grouping */}
              {!query.trim() && (
                <div className="px-3 py-1.5 text-[9px] uppercase text-[#475569] font-extrabold tracking-wider select-none">
                  Available Commands
                </div>
              )}
              {query.trim() && (
                <div className="px-3 py-1.5 text-[9px] uppercase text-[#475569] font-extrabold tracking-wider select-none">
                  Unified Search Hits ({activeItems.length})
                </div>
              )}

              {activeItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isAction = !!item.action;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all select-none",
                      isSelected ? "bg-[#f5a623]/10 text-[#f5a623] font-bold border-l-2 border-[#f5a623]" : "hover:bg-[#1a1f2c]/30 text-neutral-300"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="shrink-0">
                        {isAction ? (
                          item.icon
                        ) : item.entityType === "document" ? (
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                        ) : item.entityType === "node" ? (
                          <Compass className="w-3.5 h-3.5 text-purple-400" />
                        ) : item.entityType === "activity" ? (
                          <GitBranch className="w-3.5 h-3.5 text-orange-400" />
                        ) : (
                          <Milestone className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </span>
                      
                      <div className="truncate flex-1">
                        <div className="truncate font-bold">{item.title}</div>
                        <div className="text-[9.5px] text-[#475569] truncate mt-0.5 leading-snug">
                          {isAction ? item.category : item.content || item.entityType}
                        </div>
                      </div>
                    </div>

                    {!isAction && (
                      <span className="text-[8px] font-extrabold bg-[#161a24] border border-[#1e2533] px-1.5 py-0.5 rounded text-neutral-500 uppercase tracking-wider font-mono">
                        {item.entityType}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="h-9 border-t border-[#1e2533] px-4 flex items-center justify-between bg-[#111420]/80 shrink-0 text-[10px] text-neutral-500 font-medium font-mono select-none">
          <div className="flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Navigation:</span>
            <span className="bg-[#080a0f] border border-[#1e2533] px-1 rounded">↑↓</span>
            <span>Select:</span>
            <span className="bg-[#080a0f] border border-[#1e2533] px-1 rounded">Enter</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Close:</span>
            <span className="bg-[#080a0f] border border-[#1e2533] px-1 rounded">Esc</span>
          </div>
        </div>

      </div>

    </div>
  );
}
