"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Search,
  Plus,
  FolderOpen,
  Calendar,
  User,
  Tag,
  Clock,
  ArrowRight,
  Filter,
  X,
  Compass,
  Milestone,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type DocumentType = "prd" | "trd" | "architecture" | "research" | "meeting" | "spec" | "markdown";

interface DocumentItem {
  id: string;
  title: string;
  type: DocumentType;
  tags: string[];
  status: "draft" | "review" | "approved";
  nodeId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const DOCUMENT_TYPES: { type: DocumentType; label: string; desc: string; color: string }[] = [
  { type: "prd", label: "PRD", desc: "Product Requirement Documents", color: "border-blue-500/30 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10" },
  { type: "trd", label: "TRD", desc: "Technical Requirement Documents", color: "border-purple-500/30 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10" },
  { type: "architecture", label: "Architecture", desc: "System Design & Layouts", color: "border-cyan-500/30 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10" },
  { type: "research", label: "Research", desc: "Discovery & Market Notes", color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10" },
  { type: "meeting", label: "Meetings", desc: "Meeting Notes & Outcomes", color: "border-orange-500/30 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10" },
  { type: "spec", label: "Specs", desc: "Product & Feature Specifications", color: "border-yellow-500/30 text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10" },
  { type: "markdown", label: "Markdown", desc: "General Markdown Notes", color: "border-neutral-500/30 text-neutral-400 bg-neutral-500/5 hover:bg-neutral-500/10" },
];

export default function DocumentExplorerPage() {
  const params = useParams();
  const router = useRouter();
  const hiveId = params?.hiveId as string;

  // State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [nodes, setNodes] = useState<any[]>([]); // for creation-linking
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFolderType, setActiveFolderType] = useState<DocumentType | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<DocumentType>("prd");
  const [newTagsInput, setNewTagsInput] = useState("");
  const [newLinkedNodeId, setNewLinkedNodeId] = useState("");
  const [creating, setCreating] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch Documents & Workspace Nodes
  // -------------------------------------------------------------------------
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hives/${hiveId}/documents`);
      const result = await res.json();
      if (result.data) {
        setDocuments(result.data);
      }

      // Load Canvas Nodes for document creation picker
      const canvasRes = await fetch(`/api/hives/${hiveId}/canvas`);
      const canvasResult = await canvasRes.json();
      if (canvasResult.data) {
        // Filter out existing document nodes
        setNodes(canvasResult.data.nodes?.filter((n: any) => n.category !== "Document") || []);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [hiveId]);

  useEffect(() => {
    if (hiveId) {
      loadDocuments();
    }
  }, [hiveId, loadDocuments]);

  // -------------------------------------------------------------------------
  // Unified Fuzzy/Weighted Search trigger
  // -------------------------------------------------------------------------
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await fetch(`/api/hives/${hiveId}/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const result = await res.json();
        if (result.data) {
          setSearchResults(result.data.documents || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, hiveId]);

  // -------------------------------------------------------------------------
  // Create Document Submit
  // -------------------------------------------------------------------------
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    try {
      const tags = newTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/hives/${hiveId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          tags,
          linkedNodeId: newLinkedNodeId || undefined,
        }),
      });

      const result = await res.json();
      if (result.data) {
        setIsModalOpen(false);
        // Clear forms
        setNewTitle("");
        setNewType("prd");
        setNewTagsInput("");
        setNewLinkedNodeId("");
        // Redirect to editor
        router.push(`/hive/${hiveId}/documents/${result.data.id}`);
      }
    } catch (err) {
      console.error("Error creating document:", err);
    } finally {
      setCreating(false);
    }
  };

  // Compile unique tags for tag filter list
  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags || [])));

  // Filter list
  const filteredDocs = (searchResults !== null ? searchResults : documents).filter((doc) => {
    if (activeFolderType && doc.type !== activeFolderType) return false;
    if (selectedStatus && doc.status !== selectedStatus) return false;
    if (selectedTag && !doc.tags.includes(selectedTag)) return false;
    return true;
  });

  // Recent docs (first 4 sorted by update time)
  const recentDocs = [...documents].slice(0, 4);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-300 select-none">
      {/* Top Header */}
      <div className="h-16 border-b border-[#1e2533] px-8 flex items-center justify-between bg-[#0b0e14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <FolderOpen className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-sm font-extrabold uppercase tracking-wider text-[#f1f5f9]">Document Explorer</h1>
        </div>

        {/* Global Search and Create Button */}
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fuzzy search title, tag, content..."
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

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] text-[11px] font-extrabold uppercase transition-all active:scale-95"
            style={{ fontFamily: "JetBrains Mono" }}
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Doc</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawer Filters */}
        <aside className="w-64 border-r border-[#1e2533] bg-[#0c101b] p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Active Folder Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider">Document Type</label>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveFolderType(null)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors",
                  activeFolderType === null
                    ? "bg-[#1a1f2c] text-[#f5a623]"
                    : "text-neutral-400 hover:bg-[#1e2533]/30 hover:text-neutral-200"
                )}
              >
                <span>All Documents</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#080a0f] text-neutral-500 font-bold">{documents.length}</span>
              </button>
              {DOCUMENT_TYPES.map(({ type, label }) => {
                const count = documents.filter((d) => d.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveFolderType(type)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors",
                      activeFolderType === type
                        ? "bg-[#1a1f2c] text-[#f5a623]"
                        : "text-neutral-400 hover:bg-[#1e2533]/30 hover:text-neutral-200"
                    )}
                  >
                    <span className="uppercase">{label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#080a0f] text-neutral-500 font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {/* Tags Filters */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>Tags Filter</span>
              </label>
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => {
                  const isSel = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isSel ? "" : tag)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all",
                        isSel
                          ? "bg-[#f5a623]/15 border-[#f5a623] text-[#f5a623]"
                          : "bg-[#080a0f] border-[#1e2533] text-neutral-400 hover:text-neutral-200"
                      )}
                      style={{ fontFamily: "JetBrains Mono" }}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset Filters button */}
          {(activeFolderType || selectedStatus || selectedTag || searchResults) && (
            <button
              onClick={() => {
                setActiveFolderType(null);
                setSelectedStatus("");
                setSelectedTag("");
                setSearchQuery("");
                setSearchResults(null);
              }}
              className="mt-auto py-2 rounded-xl border border-red-500/25 hover:bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
              style={{ fontFamily: "JetBrains Mono" }}
            >
              <X className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </aside>

        {/* Documents Dashboard Main Grid */}
        <section className="flex-1 p-8 overflow-y-auto space-y-8" aria-label="Documents Dashboard">
          {loading || searchLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ fontFamily: "JetBrains Mono" }}>
                Scanning Workspace Documents...
              </span>
            </div>
          ) : (
            <>
              {/* Folder Directories Cards */}
              {activeFolderType === null && searchResults === null && (
                <div className="space-y-3">
                  <h2 className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider">Knowledge Folders</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {DOCUMENT_TYPES.map(({ type, label, desc, color }) => {
                      const count = documents.filter((d) => d.type === type).length;
                      return (
                        <div
                          key={type}
                          onClick={() => setActiveFolderType(type)}
                          className={cn(
                            "p-4 rounded-2xl border border-[#1e2533] bg-[#0c101b]/50 select-none cursor-pointer transition-all duration-300 hover:-translate-y-0.5",
                            color
                          )}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-[#080a0f] text-neutral-400">
                              {count}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 leading-snug">{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Documents Section */}
              {activeFolderType === null && searchResults === null && recentDocs.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Recent Updates</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recentDocs.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/hive/${hiveId}/documents/${doc.id}`}
                        className="p-4 rounded-2xl border border-[#1e2533] bg-[#0c101b]/60 hover:bg-[#111624] flex items-center justify-between group transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3 w-[80%]">
                          <div className="p-2.5 rounded-lg bg-[#080a0f] border border-[#1e2533] text-[#f5a623]">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate space-y-1">
                            <div className="text-xs font-bold text-[#f1f5f9] truncate group-hover:text-[#f5a623] transition-colors">
                              {doc.title}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-neutral-500 font-semibold uppercase">
                              <span className="text-[#3b82f6]">{doc.type}</span>
                              <span>•</span>
                              <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#475569] group-hover:text-[#f5a623] group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Lists Table */}
              <div className="space-y-3">
                <h2 className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider flex items-center justify-between">
                  <span>
                    {searchResults !== null ? "Search Matches" : activeFolderType ? `${activeFolderType.toUpperCase()} Documents` : "All Documents"}
                  </span>
                  <span style={{ fontFamily: "JetBrains Mono" }}>{filteredDocs.length} DOC(S)</span>
                </h2>

                {filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-[#1e2533] rounded-2xl text-neutral-500 gap-1.5">
                    <FileText className="w-7 h-7 text-[#1e2533]" />
                    <span className="text-[11px] font-semibold tracking-wide uppercase select-none">No documents matched filters.</span>
                  </div>
                ) : (
                  <div className="border border-[#1e2533] rounded-2xl bg-[#0c101b]/40 overflow-hidden shadow-2xl">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1e2533] bg-[#0c101b]/90 text-[#475569] uppercase font-extrabold text-[9px] tracking-wider select-none">
                          <th className="px-6 py-3">Document Title</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Tags</th>
                          <th className="px-6 py-3 text-right">Last Modified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocs.map((doc) => (
                          <tr
                            key={doc.id}
                            onClick={() => router.push(`/hive/${hiveId}/documents/${doc.id}`)}
                            className="border-b border-[#1e2533]/55 last:border-0 hover:bg-[#1a1f2c]/15 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4 font-bold text-[#f1f5f9] group-hover:text-[#f5a623] transition-colors flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-neutral-500 group-hover:text-[#f5a623] transition-colors" />
                              <span className="truncate max-w-[280px]">{doc.title}</span>
                            </td>
                            <td className="px-4 py-4 uppercase font-bold text-[10px] text-neutral-400">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded",
                                doc.type === "prd" ? "bg-blue-500/10 text-blue-400" :
                                doc.type === "trd" ? "bg-purple-500/10 text-purple-400" :
                                doc.type === "architecture" ? "bg-cyan-500/10 text-cyan-400" :
                                doc.type === "meeting" ? "bg-orange-500/10 text-orange-400" : "bg-neutral-500/10 text-neutral-400"
                              )}>
                                {doc.type}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn(
                                "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md",
                                doc.status === "approved" ? "bg-green-500/10 text-green-400 border border-green-500/25" :
                                doc.status === "review" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                                "bg-neutral-500/10 text-neutral-400 border border-neutral-500/25"
                              )} style={{ fontFamily: "JetBrains Mono" }}>
                                {doc.status}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {doc.tags?.slice(0, 2).map((tag: string) => (
                                  <span key={tag} className="text-[9px] text-neutral-500 font-semibold" style={{ fontFamily: "JetBrains Mono" }}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-[#475569] font-medium" style={{ fontFamily: "JetBrains Mono" }}>
                              {new Date(doc.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[420px] bg-[#0e1117]/95 border border-[#1e2533] p-6 rounded-2xl shadow-2xl backdrop-blur-lg select-none">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase flex items-center gap-1.5" style={{ fontFamily: "JetBrains Mono" }}>
                <Plus className="w-4 h-4 text-[#f5a623]" />
                <span>Create Knowledge Document</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-[#475569] hover:text-[#94a3b8] rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDocument} className="space-y-4 text-[12px]">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Authentication Specification PRD..."
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Document Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as DocumentType)}
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] uppercase font-bold"
                  style={{ fontFamily: "JetBrains Mono" }}
                >
                  {DOCUMENT_TYPES.map(({ type, label }) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newTagsInput}
                  onChange={(e) => setNewTagsInput(e.target.value)}
                  placeholder="e.g. auth, spec, auth-v1..."
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3.5 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                />
              </div>

              {/* Link target Node on canvas (Smart Placement target) */}
              <div className="space-y-1">
                <label className="text-[#475569] font-bold uppercase tracking-wider text-[10px]">
                  Link Canvas Node (Smart Placement Placement)
                </label>
                <select
                  value={newLinkedNodeId}
                  onChange={(e) => setNewLinkedNodeId(e.target.value)}
                  className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                >
                  <option value="">-- Choose Node to Link Near --</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.category}] {n.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 leading-snug">
                  If selected, the Document Node will be automatically placed near the linked node. If left blank, it will be placed in the Documents Cluster.
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: "JetBrains Mono" }}
              >
                {creating ? "Creating Document..." : "Create & Open"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
