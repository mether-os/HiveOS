"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useSocket } from "@/features/realtime/hooks/useSocket";
import { useKnowledgeStore } from "@/features/search/store/useKnowledgeStore";
import { cn } from "@/lib/utils";
import {
  FileText,
  Eye,
  EyeOff,
  Link as LinkIcon,
  History,
  Users,
  Check,
  AlertCircle,
  Trash2,
  ArrowLeft,
  Minimize2,
  X
} from "lucide-react";

type DocumentType = "prd" | "trd" | "architecture" | "research" | "meeting" | "spec" | "markdown";

interface DocumentData {
  id: string;
  hiveId: string;
  nodeId?: string;
  title: string;
  type: DocumentType;
  content: string;
  tags: string[];
  status: "draft" | "review" | "approved";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface VersionData {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  changelog?: string;
  timestamp: string;
}

interface CanvasNodeData {
  id: string;
  hiveId: string;
  category: string;
  title: string;
  description?: string;
  tags?: string[];
  position: { x: number; y: number };
  data?: {
    status?: string;
    priority?: string;
  };
}

interface CanvasEdgeData {
  id: string;
  hiveId: string;
  source: string;
  target: string;
  type?: string;
  relationType?: string;
}

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { socket, status: socketStatus } = useSocket();
  const inspectEntity = useKnowledgeStore((state) => state.inspectEntity);

  const hiveId = params?.hiveId as string;
  const docId = params?.docId as string;

  // Document Core State
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docStatus, setDocStatus] = useState<"draft" | "review" | "approved">("draft");
  const [tagsInput, setTagsInput] = useState("");
  
  // Loading & Action State
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [changelogMessage, setChangelogMessage] = useState("");
  
  // Autocomplete state for @Node and #Document
  const [showAutocomplete, setShowAutocomplete] = useState<"node" | "document" | null>(null);
  const [autocompleteSearch, setAutocompleteSearch] = useState("");
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteTriggerIndex, setAutocompleteTriggerIndex] = useState(-1);
  
  // Workspace Lists
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [edges, setEdges] = useState<CanvasEdgeData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  
  // Versions
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<VersionData | null>(null);
  
  // Collaborative Presence State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  
  // UI Panels
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"presence" | "links" | "history" | "inspect" | null>("links");
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  
  // Linking modal/inline form state
  const [linkTargetNodeId, setLinkTargetNodeId] = useState("");
  const [linkRelationType, setLinkRelationType] = useState("relates_to");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------------------------------------------------------
  // 1. Data Fetchers
  // -------------------------------------------------------------------------
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hives/${hiveId}/documents/${docId}`);
      const result = await res.json();
      if (result.data) {
        const d = result.data as DocumentData;
        setDoc(d);
        setTitle(d.title);
        setContent(d.content);
        setDocStatus(d.status);
        setTagsInput(d.tags?.join(", ") || "");
      } else {
        router.push(`/hive/${hiveId}/documents`);
      }
    } catch (err) {
      console.error("Failed to fetch document details:", err);
    } finally {
      setLoading(false);
    }
  }, [hiveId, docId, router]);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/hives/${hiveId}/documents/${docId}/versions`);
      const result = await res.json();
      if (result.data) {
        setVersions(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    }
  }, [hiveId, docId]);

  const fetchWorkspaceElements = useCallback(async () => {
    try {
      // Fetch canvas nodes & edges
      const canvasRes = await fetch(`/api/hives/${hiveId}/canvas`);
      const canvasResult = await canvasRes.json();
      if (canvasResult.data) {
        setNodes(canvasResult.data.nodes || []);
        setEdges(canvasResult.data.edges || []);
      }

      // Fetch all docs
      const docRes = await fetch(`/api/hives/${hiveId}/documents`);
      const docResult = await docRes.json();
      if (docResult.data) {
        setDocuments(docResult.data);
      }
    } catch (err) {
      console.error("Failed to fetch workspace elements:", err);
    }
  }, [hiveId]);

  useEffect(() => {
    if (hiveId && docId) {
      fetchDocument();
      fetchVersions();
      fetchWorkspaceElements();
    }
  }, [hiveId, docId, fetchDocument, fetchVersions, fetchWorkspaceElements]);

  // -------------------------------------------------------------------------
  // 2. Real-time Sockets & Presence
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !hiveId || !docId) return;

    // Join Document Room
    socket.emit("document:join", { workspaceId: hiveId, docId });

    // Handle Active Room Members list
    socket.on("document:presence", (data: { docId: string; members: any[] }) => {
      if (data.docId === docId) {
        setCollaborators(data.members || []);
      }
    });

    // Handle typing status updates
    socket.on("document:typing-update", (data: { docId: string; userId: string; name: string; isTyping: boolean }) => {
      if (data.docId === docId) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (data.isTyping) {
            next[data.userId] = data.name;
          } else {
            delete next[data.userId];
          }
          return next;
        });
      }
    });

    // Handle live saving / reload broadcasts
    socket.on("document:reload", (data: { docId: string; document: DocumentData }) => {
      if (data.docId === docId) {
        // Update states only if we are not actively typing ourselves to prevent collision cursor jumps
        if (textareaRef.current !== document.activeElement) {
          setDoc(data.document);
          setTitle(data.document.title);
          setContent(data.document.content);
          setDocStatus(data.document.status);
          setTagsInput(data.document.tags?.join(", ") || "");
          setSavingState("saved");
        }
      }
    });

    return () => {
      socket.emit("document:leave");
      socket.off("document:presence");
      socket.off("document:typing-update");
      socket.off("document:reload");
    };
  }, [socket, hiveId, docId]);

  // -------------------------------------------------------------------------
  // 3. Debounced Auto-Save & Manual Saves
  // -------------------------------------------------------------------------
  const performSave = useCallback(
    async (updatedContent: string, updatedTitle: string, updatedStatus: string, updatedTags: string[], changelog: string = "") => {
      try {
        setSavingState("saving");
        const res = await fetch(`/api/hives/${hiveId}/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updatedTitle.trim(),
            content: updatedContent,
            status: updatedStatus,
            tags: updatedTags,
            changelog: changelog || undefined,
          }),
        });
        
        const result = await res.json();
        if (result.data) {
          setSavingState("saved");
          setDoc(result.data);
          
          // Emit socket reload notification to collaborators
          if (socket) {
            socket.emit("document:save-notification", {
              workspaceId: hiveId,
              docId,
              document: result.data,
            });
          }

          // If version was created (triggered versioning), reload history list
          if (result.data.versionCreated || changelog) {
            fetchVersions();
            setChangelogMessage("");
          }
        } else {
          setSavingState("error");
        }
      } catch (err) {
        console.error("Save error:", err);
        setSavingState("error");
      }
    },
    [hiveId, docId, socket, fetchVersions]
  );

  const triggerTypingAndSave = (
    newContent: string,
    newTitle: string,
    newStatus: "draft" | "review" | "approved",
    newTagsString: string
  ) => {
    setSavingState("unsaved");
    
    // Broadcast typing start
    if (socket) {
      socket.emit("document:typing-start", { workspaceId: hiveId, docId });
    }

    // Debounce typing stop
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    typingStopTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit("document:typing-stop", { workspaceId: hiveId, docId });
      }
    }, 1500);

    // Debounce Save API (1.5 seconds)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const parsedTags = newTagsString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      performSave(newContent, newTitle, newStatus, parsedTags);
    }, 1500);
  };

  // Explicit Save version
  const handleManualSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changelogMessage.trim()) return;

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    
    await performSave(content, title, docStatus, parsedTags, changelogMessage.trim());
  };

  // -------------------------------------------------------------------------
  // 4. Autocomplete Selection & Replacements
  // -------------------------------------------------------------------------
  const filteredAutocompleteItems = showAutocomplete === "node"
    ? nodes.filter((n) => n.title?.toLowerCase().includes(autocompleteSearch.toLowerCase()))
    : documents.filter((d) => d.title?.toLowerCase().includes(autocompleteSearch.toLowerCase()) && d.id !== docId);

  const insertSelectedAutocomplete = () => {
    if (!showAutocomplete || filteredAutocompleteItems.length === 0) return;
    const selectedItem = filteredAutocompleteItems[autocompleteIndex];
    if (!selectedItem) return;

    const valueBefore = content.substring(0, autocompleteTriggerIndex);
    const selStart = textareaRef.current?.selectionStart || content.length;
    const valueAfter = content.substring(selStart);

    const linkText = showAutocomplete === "node"
      ? `[@${selectedItem.title}](node:${selectedItem.id})`
      : `[#${selectedItem.title}](doc:${selectedItem.id})`;

    const newContent = valueBefore + linkText + valueAfter;
    setContent(newContent);
    triggerTypingAndSave(newContent, title, docStatus, tagsInput);

    setShowAutocomplete(null);

    // Refocus textarea and place cursor after inserted text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = autocompleteTriggerIndex + linkText.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const selStart = e.target.selectionStart;
    setContent(val);
    triggerTypingAndSave(val, title, docStatus, tagsInput);

    // Parse for @ or # trigger
    const textBeforeCursor = val.substring(0, selStart);
    const lastChar = textBeforeCursor[textBeforeCursor.length - 1];

    if (lastChar === "@") {
      setShowAutocomplete("node");
      setAutocompleteTriggerIndex(selStart - 1);
      setAutocompleteIndex(0);
      setAutocompleteSearch("");
    } else if (lastChar === "#") {
      setShowAutocomplete("document");
      setAutocompleteTriggerIndex(selStart - 1);
      setAutocompleteIndex(0);
      setAutocompleteSearch("");
    } else if (showAutocomplete) {
      const idx = autocompleteTriggerIndex;
      if (selStart <= idx) {
        setShowAutocomplete(null);
      } else {
        const query = val.substring(idx + 1, selStart);
        if (/\s/.test(query)) {
          // Closed by space
          setShowAutocomplete(null);
        } else {
          setAutocompleteSearch(query);
          setAutocompleteIndex(0);
        }
      }
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete && filteredAutocompleteItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % filteredAutocompleteItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + filteredAutocompleteItems.length) % filteredAutocompleteItems.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertSelectedAutocomplete();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAutocomplete(null);
        return;
      }
    }
  };

  // -------------------------------------------------------------------------
  // 5. Toolbar Actions
  // -------------------------------------------------------------------------
  const insertToolbarText = (before: string, after: string = "") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = content.substring(start, end);
    const textToInsert = before + (selected || "text") + after;

    const valueBefore = content.substring(0, start);
    const valueAfter = content.substring(end);
    const newContent = valueBefore + textToInsert + valueAfter;

    setContent(newContent);
    triggerTypingAndSave(newContent, title, docStatus, tagsInput);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + before.length, start + before.length + (selected || "text").length);
      }
    }, 10);
  };

  // -------------------------------------------------------------------------
  // 6. Linked Nodes Actions (Socket-based edge mutations)
  // -------------------------------------------------------------------------
  const handleLinkNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc?.nodeId || !linkTargetNodeId || !socket) return;

    const edgeId = `edge-doc-${doc.nodeId}-${linkTargetNodeId}-${Date.now().toString(36)}`;
    
    // Emit edge-create event to sync graph, DB, and invalidations
    socket.emit("canvas:edge-create", {
      workspaceId: hiveId,
      edge: {
        id: edgeId,
        source: doc.nodeId,
        target: linkTargetNodeId,
        type: "smoothstep",
        relationType: linkRelationType,
        data: {},
      },
    });

    // Optimistically update local element edges list, then reload
    setEdges((prev) => [
      ...prev,
      {
        id: edgeId,
        hiveId,
        source: doc.nodeId!,
        target: linkTargetNodeId,
        type: "smoothstep",
        relationType: linkRelationType,
      },
    ]);

    setLinkTargetNodeId("");
    // Reload database representations to confirm
    setTimeout(() => fetchWorkspaceElements(), 500);
  };

  const handleUnlinkNode = (edgeId: string) => {
    if (!socket) return;
    socket.emit("canvas:edge-delete", { workspaceId: hiveId, id: edgeId });
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setTimeout(() => fetchWorkspaceElements(), 500);
  };

  // Filter out edges connecting doc node to other nodes
  const linkedCanvasEdges = doc?.nodeId
    ? edges.filter((e) => e.source === doc.nodeId || e.target === doc.nodeId)
    : [];

  const getLinkedNodeInfo = (edge: CanvasEdgeData) => {
    const otherNodeId = edge.source === doc?.nodeId ? edge.target : edge.source;
    const node = nodes.find((n) => n.id === otherNodeId);
    return {
      node,
      relationType: edge.relationType || "relates_to",
      edgeId: edge.id,
    };
  };

  // -------------------------------------------------------------------------
  // 7. Version Restore Operations
  // -------------------------------------------------------------------------
  const handleRestoreVersion = async (versionNumber: number) => {
    if (!confirm(`Are you sure you want to restore Version ${versionNumber}? The current unsaved state will be backed up as a version first.`)) {
      return;
    }

    try {
      setSavingState("saving");
      const res = await fetch(`/api/hives/${hiveId}/documents/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionNumber }),
      });
      const result = await res.json();
      if (result.data) {
        setSavingState("saved");
        const restoredDoc = result.data as DocumentData;
        setDoc(restoredDoc);
        setTitle(restoredDoc.title);
        setContent(restoredDoc.content);
        setDocStatus(restoredDoc.status);
        setTagsInput(restoredDoc.tags?.join(", ") || "");
        setSelectedVersionForDiff(null);
        setSidebarTab("links");
        
        // Broadcast reload
        if (socket) {
          socket.emit("document:save-notification", {
            workspaceId: hiveId,
            docId,
            document: restoredDoc,
          });
        }
        
        fetchVersions();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
      setSavingState("error");
    }
  };

  // Delete document cascade
  const handleDeleteDocument = async () => {
    if (!confirm("Are you sure you want to permanently delete this document? This will remove its canvas representation and version logs.")) {
      return;
    }

    try {
      const res = await fetch(`/api/hives/${hiveId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/hive/${hiveId}/documents`);
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  // -------------------------------------------------------------------------
  // 8. Markdown Custom Parser & Click Navigation
  // -------------------------------------------------------------------------
  const renderMarkdown = (md: string) => {
    if (!md) return '<p class="text-neutral-500 italic">No content yet. Start typing to write specifications...</p>';

    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre class="bg-black/40 border border-[#1e2533] p-3 rounded-xl font-mono text-xs overflow-x-auto text-[#f5a623] my-3 leading-relaxed"><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-[#0c101b] border border-[#1e2533] px-1.5 py-0.5 rounded font-mono text-xs text-orange-400">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-extrabold text-[#f1f5f9] tracking-wider uppercase mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-base font-extrabold text-[#f1f5f9] border-b border-[#1e2533]/60 pb-1.5 mt-5 mb-3">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-extrabold text-[#f1f5f9] border-b border-[#1e2533] pb-2 mt-6 mb-4">$1</h1>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-[#f1f5f9]">$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

    // Checklists
    html = html.replace(/^- \[(x| )\] (.*$)/gim, (_, checked, label) => {
      const isChecked = checked.toLowerCase() === "x";
      return `<li class="flex items-start gap-2 my-1">
        <input type="checkbox" disabled ${isChecked ? "checked" : ""} class="mt-1 w-3.5 h-3.5 rounded border-neutral-700 accent-[#f5a623]" />
        <span class="${isChecked ? "line-through text-neutral-500" : ""}">${label}</span>
      </li>`;
    });

    // Unordered lists
    html = html.replace(/^- (.*$)/gim, '<li class="list-disc ml-5 my-1 text-neutral-300">$1</li>');

    // Custom inline links
    // [@NodeName](node:nodeId)
    html = html.replace(/\[@([^\]]+)\]\(node:([a-zA-Z0-9_-]+)\)/g, (_, name, id) => {
      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/25 cursor-pointer font-bold border border-blue-500/20 transition-all select-none" data-node-link="${id}">@${name}</span>`;
    });

    // [#DocName](doc:docId)
    html = html.replace(/\[#([^\]]+)\]\(doc:([a-zA-Z0-9_-]+)\)/g, (_, name, id) => {
      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/25 cursor-pointer font-bold border border-purple-500/20 transition-all select-none" data-doc-link="${id}">#${name}</span>`;
    });

    // General hyperlinks
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#f5a623] hover:underline">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, "<br />");

    return html;
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const nodeLinkId = target.getAttribute("data-node-link");
    const docLinkId = target.getAttribute("data-doc-link");

    if (nodeLinkId) {
      const targetNode = nodes.find((n) => n.id === nodeLinkId);
      const nodeTitle = targetNode ? targetNode.title : "Node";
      inspectEntity(nodeLinkId, "node", nodeTitle);
    } else if (docLinkId) {
      router.push(`/hive/${hiveId}/documents/${docLinkId}`);
    }
  };

  // Inspected node
  const inspectedNode = inspectedNodeId ? nodes.find((n) => n.id === inspectedNodeId) : null;

  // -------------------------------------------------------------------------
  // 9. LCS Line Diff Algorithm
  // -------------------------------------------------------------------------
  const computeLineDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    const dp: number[][] = Array(oldLines.length + 1)
      .fill(0)
      .map(() => Array(newLines.length + 1).fill(0));

    for (let i = 1; i <= oldLines.length; i++) {
      for (let j = 1; j <= newLines.length; j++) {
        const oldLine = oldLines[i - 1] ?? "";
        const newLine = newLines[j - 1] ?? "";
        const dpRow = dp[i]!;
        if (oldLine === newLine) {
          const prevRow = dp[i - 1]!;
          dpRow[j] = (prevRow[j - 1] ?? 0) + 1;
        } else {
          const prevRow = dp[i - 1]!;
          dpRow[j] = Math.max(prevRow[j] ?? 0, dpRow[j - 1] ?? 0);
        }
      }
    }

    let i = oldLines.length;
    let j = newLines.length;
    const diff: { type: "added" | "removed" | "unchanged"; text: string }[] = [];

    while (i > 0 || j > 0) {
      const oldLine = oldLines[i - 1] ?? "";
      const newLine = newLines[j - 1] ?? "";
      
      if (i > 0 && j > 0 && oldLine === newLine) {
        diff.unshift({ type: "unchanged", text: oldLine });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || (dp[i]?.[j - 1] ?? 0) >= (dp[i - 1]?.[j] ?? 0))) {
        diff.unshift({ type: "added", text: newLine });
        j--;
      } else if (i > 0 && (j === 0 || (dp[i]?.[j - 1] ?? 0) < (dp[i - 1]?.[j] ?? 0))) {
        diff.unshift({ type: "removed", text: oldLine });
        i--;
      }
    }

    return diff;
  };

  const diffLines = selectedVersionForDiff
    ? computeLineDiff(selectedVersionForDiff.content, content)
    : [];

  // -------------------------------------------------------------------------
  // 10. Helper render states
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-400 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono" }}>
          Decrypting Intelligence Dossier...
        </span>
      </div>
    );
  }

  // Active typers string
  const docTypingList = Object.values(typingUsers).filter(Boolean);
  let docTypingText = "";
  if (docTypingList.length === 1) {
    docTypingText = `${docTypingList[0]} is writing...`;
  } else if (docTypingList.length > 1) {
    docTypingText = `${docTypingList.slice(0, -1).join(", ")} & ${docTypingList[docTypingList.length - 1]} writing...`;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-300 select-none overflow-hidden">
      
      {/* 1. Header Toolbar */}
      <header className="h-16 border-b border-[#1e2533] px-6 flex items-center justify-between bg-[#0b0e14]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            onClick={() => router.push(`/hive/${hiveId}/documents`)}
            className="p-1.5 rounded-xl border border-[#1e2533] bg-[#0c101b] hover:bg-[#1e2533] text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border",
              doc?.type === "prd" ? "bg-blue-500/10 text-blue-400 border-blue-500/25" :
              doc?.type === "trd" ? "bg-purple-500/10 text-purple-400 border-purple-500/25" :
              doc?.type === "architecture" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" :
              "bg-neutral-500/10 text-neutral-400 border-neutral-500/25"
            )} style={{ fontFamily: "JetBrains Mono" }}>
              {doc?.type}
            </span>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              triggerTypingAndSave(content, e.target.value, docStatus, tagsInput);
            }}
            placeholder="Untitled Document"
            className="bg-transparent border-0 text-sm font-extrabold text-[#f1f5f9] focus:outline-none focus:ring-0 w-64 truncate py-1 placeholder:text-neutral-600"
          />

          {/* Saving state indicators */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ fontFamily: "JetBrains Mono" }}>
            {savingState === "saving" && (
              <span className="text-amber-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Saving...</span>
              </span>
            )}
            {savingState === "saved" && (
              <span className="text-emerald-500 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Dossier Synchronized</span>
              </span>
            )}
            {savingState === "unsaved" && (
              <span className="text-neutral-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
                <span>Auto-saving...</span>
              </span>
            )}
            {savingState === "error" && (
              <span className="text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Save Failed</span>
              </span>
            )}
          </div>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-3">
          {/* Status picker */}
          <select
            value={docStatus}
            onChange={(e) => {
              const nextStatus = e.target.value as "draft" | "review" | "approved";
              setDocStatus(nextStatus);
              triggerTypingAndSave(content, title, nextStatus, tagsInput);
            }}
            className="bg-[#080a0f] border border-[#1e2533] rounded-xl px-2 py-1.5 text-[10px] font-bold text-neutral-300 uppercase focus:outline-none"
            style={{ fontFamily: "JetBrains Mono" }}
          >
            <option value="draft">DRAFT</option>
            <option value="review">UNDER REVIEW</option>
            <option value="approved">APPROVED</option>
          </select>

          {/* Sidebar togglers */}
          <div className="flex items-center rounded-xl border border-[#1e2533] bg-[#0c101b] p-0.5">
            <button
              onClick={() => setSidebarTab(sidebarTab === "links" ? null : "links")}
              className={cn(
                "p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1",
                sidebarTab === "links" && "bg-[#1e2533] text-[#f5a623]"
              )}
              title="Knowledge Graph Links"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSidebarTab(sidebarTab === "history" ? null : "history")}
              className={cn(
                "p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1",
                sidebarTab === "history" && "bg-[#1e2533] text-[#f5a623]"
              )}
              title="Version Snapshots"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSidebarTab(sidebarTab === "presence" ? null : "presence")}
              className={cn(
                "p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1",
                sidebarTab === "presence" && "bg-[#1e2533] text-[#f5a623]"
              )}
              title="Presence Details"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Delete Dossier */}
          <button
            onClick={handleDeleteDocument}
            className="p-1.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-colors"
            title="Delete Document Dossier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Content Split Panels */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* A. Left Editor Column */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#1e2533] bg-[#080a0f]">
          
          {/* Editor Header Toolbar */}
          <div className="h-10 bg-[#0c101b] border-b border-[#1e2533] px-4 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => insertToolbarText("# ")}
                className="p-1 text-neutral-500 hover:text-neutral-300 font-bold hover:bg-[#1a1f2c] rounded"
                title="Heading 1"
              >
                H1
              </button>
              <button
                onClick={() => insertToolbarText("## ")}
                className="p-1 text-neutral-500 hover:text-neutral-300 font-bold hover:bg-[#1a1f2c] rounded"
                title="Heading 2"
              >
                H2
              </button>
              <button
                onClick={() => insertToolbarText("**", "**")}
                className="p-1 text-neutral-500 hover:text-neutral-300 font-bold hover:bg-[#1a1f2c] rounded"
                title="Bold"
              >
                B
              </button>
              <button
                onClick={() => insertToolbarText("*", "*")}
                className="p-1 text-neutral-500 hover:text-neutral-300 italic hover:bg-[#1a1f2c] rounded"
                title="Italic"
              >
                I
              </button>
              <span className="w-px h-4 bg-[#1e2533] mx-1" />
              <button
                onClick={() => insertToolbarText("```\n", "\n```")}
                className="p-1 text-neutral-500 hover:text-[#f5a623] font-mono hover:bg-[#1a1f2c] rounded text-[10px]"
                title="Code Block"
              >
                Code
              </button>
              <button
                onClick={() => insertToolbarText("- [ ] ")}
                className="p-1 text-neutral-500 hover:text-[#f5a623] hover:bg-[#1a1f2c] rounded text-[10px]"
                title="Checklist Item"
              >
                Todo
              </button>
              <button
                onClick={() => insertToolbarText("| Column 1 | Column 2 |\n| -------- | -------- |\n| Item 1   | Item 2   |")}
                className="p-1 text-neutral-500 hover:text-[#f5a623] hover:bg-[#1a1f2c] rounded text-[10px]"
                title="Insert Table Structure"
              >
                Table
              </button>
            </div>
            
            <div className="flex items-center gap-3 font-semibold text-[#475569] text-[10px] uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono" }}>
              <span>Type @ for Nodes • # for Documents</span>
            </div>
          </div>

          {/* Textarea Area & Autocomplete Overlay */}
          <div className="flex-1 relative overflow-hidden">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Begin writing document contents using Markdown... Use @NodeName and #DocumentName to reference knowledge elements inline."
              className="w-full h-full p-6 bg-[#080a0f] text-neutral-200 border-0 focus:ring-0 focus:outline-none resize-none font-mono text-[13px] leading-relaxed scrollbar-thin overflow-y-auto placeholder:text-neutral-700 select-text"
              style={{ caretColor: "#f5a623" }}
            />

            {/* Autocomplete Menu Popover */}
            {showAutocomplete && filteredAutocompleteItems.length > 0 && (
              <div
                className="absolute z-50 bg-[#0e1117]/95 border border-[#1e2533] w-64 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
                style={{
                  top: "2.5rem",
                  left: "1.5rem",
                  maxHeight: "220px",
                }}
              >
                <div className="bg-[#1a1f2c] border-b border-[#1e2533] px-3 py-1.5 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                  <span>Autocomplete {showAutocomplete}</span>
                  <span>{filteredAutocompleteItems.length} found</span>
                </div>
                <div className="overflow-y-auto max-h-[180px] scrollbar-thin text-xs">
                  {filteredAutocompleteItems.map((item, idx) => {
                    const isSelected = idx === autocompleteIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setAutocompleteIndex(idx);
                          // Defer call to allow state to settle
                          setTimeout(() => insertSelectedAutocomplete(), 20);
                        }}
                        className={cn(
                          "px-3 py-2 cursor-pointer transition-colors flex items-center justify-between",
                          isSelected ? "bg-[#f5a623]/15 text-[#f5a623] font-bold" : "hover:bg-[#1a1f2c]/50 text-neutral-300"
                        )}
                      >
                        <span className="truncate flex-1">{item.title}</span>
                        {showAutocomplete === "node" && (
                          <span className="text-[8px] font-extrabold uppercase px-1 rounded bg-black/40 text-neutral-500 scale-90">
                            {(item as any).category}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Typing indicator ticker */}
          {docTypingText && (
            <div className="h-6 px-4 bg-[#0c101b] border-t border-[#1e2533] flex items-center justify-between text-[9px] italic text-[#f5a623] shrink-0 select-none animate-pulse">
              <span>{docTypingText}</span>
            </div>
          )}
        </div>

        {/* B. Right Live Preview / Diff Column */}
        {!previewCollapsed && (
          <div className="flex-1 min-w-0 flex flex-col bg-[#0c101b]/50">
            {/* Header control */}
            <div className="h-10 bg-[#0c101b] border-b border-[#1e2533] px-4 flex items-center justify-between shrink-0 text-xs select-none">
              <span className="font-extrabold text-[#94a3b8] uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono" }}>
                {selectedVersionForDiff ? `Comparing Active vs. Version ${selectedVersionForDiff.version}` : "Live Compiled Preview"}
              </span>

              <div className="flex items-center gap-2">
                {selectedVersionForDiff && (
                  <button
                    onClick={() => setSelectedVersionForDiff(null)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold scale-90"
                  >
                    <X className="w-3 h-3" />
                    <span>Close Diff</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewCollapsed(true)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1f2c]"
                  title="Collapse Preview Panel"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Render Output */}
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin select-text">
              {selectedVersionForDiff ? (
                /* LCS Line Diff rendering */
                <div className="font-mono text-[12px] space-y-0.5 bg-[#080a0f] border border-[#1e2533] p-4 rounded-xl select-text overflow-x-auto leading-relaxed">
                  {diffLines.length === 0 ? (
                    <div className="text-neutral-500 text-center py-8">No content discrepancies found.</div>
                  ) : (
                    diffLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-2 py-0.5 rounded flex gap-2 whitespace-pre",
                          line.type === "added" ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" :
                          line.type === "removed" ? "bg-red-500/10 text-red-400 border-l-2 border-red-500 line-through" :
                          "text-neutral-400"
                        )}
                      >
                        <span className="w-6 shrink-0 text-right select-none opacity-40 font-bold">
                          {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                        </span>
                        <span>{line.text || " "}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Live parsed markdown container */
                <article
                  onClick={handlePreviewClick}
                  className="prose prose-invert max-w-none text-xs leading-relaxed text-neutral-300 font-sans space-y-3"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              )}
            </div>
          </div>
        )}

        {/* Preview collapsed stripe */}
        {previewCollapsed && (
          <button
            onClick={() => setPreviewCollapsed(false)}
            className="w-10 bg-[#0c101b] border-l border-[#1e2533] flex flex-col items-center justify-start py-6 text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1f2c]/50 transition-colors shrink-0"
            title="Expand Preview Panel"
          >
            <Eye className="w-4 h-4 mb-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest origin-center rotate-90 whitespace-nowrap mt-8" style={{ fontFamily: "JetBrains Mono" }}>
              Show Preview
            </span>
          </button>
        )}

        {/* C. Pinned Internal Side Drawer (Version History / Node Inspections / Graph Links) */}
        {sidebarTab && (
          <aside
            className="w-72 bg-[#0e1117]/95 border-l border-[#1e2533] flex flex-col overflow-hidden shrink-0"
            aria-label="Document metadata details panel"
          >
            {/* Header */}
            <div className="h-10 bg-[#1a1f2c]/30 border-b border-[#1e2533] px-4 flex items-center justify-between shrink-0 select-none text-xs">
              <span className="font-extrabold uppercase text-[#f5a623] tracking-wide" style={{ fontFamily: "JetBrains Mono" }}>
                {sidebarTab === "links" && "Knowledge Graph Links"}
                {sidebarTab === "history" && "Version History"}
                {sidebarTab === "presence" && "Dossier Access Log"}
                {sidebarTab === "inspect" && "Node Inspector"}
              </span>
              <button
                onClick={() => setSidebarTab(null)}
                className="p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-[#1e2533]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inner drawer content */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin text-xs space-y-6">

              {/* TAB 1: Presence */}
              {sidebarTab === "presence" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase text-[#475569] font-extrabold tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    <span>Active Presence ({collaborators.length})</span>
                  </div>
                  
                  {collaborators.length === 0 ? (
                    <div className="text-neutral-500 italic">No other users online.</div>
                  ) : (
                    <div className="space-y-2">
                      {collaborators.map((c) => (
                        <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-[#161a24]/50 border border-[#1e2533]/30">
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-5 h-5 rounded-full object-cover border border-[#1e2533]" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[#1e2533] border border-[#334155] flex items-center justify-center text-[9px] font-bold text-[#f5a623]">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="truncate flex-1">
                            <div className="font-bold text-[#f1f5f9] truncate">{c.name}</div>
                            <div className="text-[9px] text-[#64748b] truncate">{c.email}</div>
                          </div>
                          {typingUsers[c.id] && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Links */}
              {sidebarTab === "links" && (
                <div className="space-y-5">
                  {/* Current linkages list */}
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider">Active Graph Edges</label>
                    {linkedCanvasEdges.length === 0 ? (
                      <div className="p-3 border border-dashed border-[#1e2533] rounded-xl text-neutral-500 italic text-center">
                        This document has no semantic canvas edges. Use the form below to attach it to feature nodes.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {linkedCanvasEdges.map((edge) => {
                          const info = getLinkedNodeInfo(edge);
                          return (
                            <div key={edge.id} className="p-2.5 rounded-xl bg-[#111420] border border-[#1e2533] flex flex-col gap-1.5">
                              <div className="flex justify-between items-start">
                                <div className="truncate font-bold text-neutral-200">
                                  {info.node ? info.node.title : "Unknown Target Node"}
                                </div>
                                <button
                                  onClick={() => handleUnlinkNode(info.edgeId)}
                                  className="text-red-500 hover:text-red-400 p-0.5 rounded transition-colors scale-90"
                                  title="Sever Edge Link"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-extrabold bg-[#1a1f2c] border border-[#1e2533] px-1.5 py-0.2 rounded text-[#f5a623] uppercase" style={{ fontFamily: "JetBrains Mono" }}>
                                  {info.relationType}
                                </span>
                                {info.node && (
                                  <span className="text-[8px] font-extrabold text-neutral-500 uppercase">
                                    {info.node.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Edge Form */}
                  <div className="border-t border-[#1e2533]/80 pt-4 space-y-3">
                    <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider">Link Canvas Node</label>
                    <form onSubmit={handleLinkNode} className="space-y-3">
                      <div>
                        <select
                          required
                          value={linkTargetNodeId}
                          onChange={(e) => setLinkTargetNodeId(e.target.value)}
                          className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-2 text-neutral-300 focus:outline-none focus:border-[#f5a623]"
                        >
                          <option value="">-- Select Target Node --</option>
                          {nodes
                            .filter((n) => n.id !== doc?.nodeId)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                [{n.category.toUpperCase()}] {n.title}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <select
                          value={linkRelationType}
                          onChange={(e) => setLinkRelationType(e.target.value)}
                          className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-2 text-neutral-300 focus:outline-none focus:border-[#f5a623] uppercase font-bold"
                          style={{ fontFamily: "JetBrains Mono" }}
                        >
                          <option value="depends_on">depends_on</option>
                          <option value="implements">implements</option>
                          <option value="relates_to">relates_to</option>
                          <option value="blocks">blocks</option>
                          <option value="documents">documents</option>
                          <option value="owns">owns</option>
                          <option value="uses">uses</option>
                          <option value="generates">generates</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={!linkTargetNodeId}
                        className="w-full py-2 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[10px]"
                        style={{ fontFamily: "JetBrains Mono" }}
                      >
                        Add Link Connection
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 3: History */}
              {sidebarTab === "history" && (
                <div className="space-y-4">
                  {/* Committing Snapshots form */}
                  <form onSubmit={handleManualSaveVersion} className="bg-[#111420] p-3 rounded-xl border border-[#1e2533] space-y-3">
                    <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider block">Commit Version Snapshot</label>
                    <input
                      type="text"
                      required
                      value={changelogMessage}
                      onChange={(e) => setChangelogMessage(e.target.value)}
                      placeholder="Changelog: e.g. Finalized Spec draft..."
                      className="w-full bg-[#080a0f] border border-[#1e2533] rounded-xl px-2.5 py-2 text-neutral-300 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!changelogMessage.trim()}
                      className="w-full py-1.5 rounded-xl bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-extrabold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[9px]"
                      style={{ fontFamily: "JetBrains Mono" }}
                    >
                      Commit Snapshot
                    </button>
                  </form>

                  <div className="space-y-3">
                    <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider">Snapshot Logs</label>
                    
                    {versions.length === 0 ? (
                      <div className="text-neutral-500 italic text-center">No version logs found. Auto-saves commit every 10 mins on updates.</div>
                    ) : (
                      <div className="space-y-2.5">
                        {versions.map((ver) => {
                          const isComparing = selectedVersionForDiff?.id === ver.id;
                          return (
                            <div
                              key={ver.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all select-none cursor-pointer flex flex-col gap-1.5",
                                isComparing
                                  ? "bg-[#f5a623]/5 border-[#f5a623]"
                                  : "bg-[#111420] border-[#1e2533] hover:bg-[#161a27]"
                              )}
                              onClick={() => {
                                if (isComparing) {
                                  setSelectedVersionForDiff(null);
                                } else {
                                  setSelectedVersionForDiff(ver);
                                }
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-[#f1f5f9] text-[10px]" style={{ fontFamily: "JetBrains Mono" }}>
                                  VERSION {ver.version}
                                </span>
                                <span className="text-[9px] text-[#475569] font-semibold">
                                  {new Date(ver.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-neutral-400 text-[11px] leading-snug">{ver.changelog}</p>
                              <div className="flex justify-between items-center mt-1 border-t border-[#1e2533]/50 pt-1.5">
                                <span className="text-[9px] text-neutral-500">
                                  By {ver.authorName}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreVersion(ver.version);
                                  }}
                                  className="text-[9px] font-extrabold text-[#f5a623] hover:underline hover:text-[#f5a623]/80 uppercase"
                                >
                                  Restore
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Inspector */}
              {sidebarTab === "inspect" && (
                <div className="space-y-4">
                  {inspectedNode ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/25">
                          {inspectedNode.category}
                        </span>
                        <h4 className="text-sm font-extrabold text-[#f1f5f9] mt-2 leading-snug">{inspectedNode.title}</h4>
                      </div>

                      {inspectedNode.description && (
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider">Description</label>
                          <p className="text-neutral-400 leading-relaxed bg-[#111420] p-2.5 rounded-xl border border-[#1e2533]">
                            {inspectedNode.description}
                          </p>
                        </div>
                      )}

                      {inspectedNode.tags && inspectedNode.tags.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider">Tags</label>
                          <div className="flex flex-wrap gap-1">
                            {inspectedNode.tags.map((t) => (
                              <span key={t} className="text-[9px] text-[#64748b] bg-[#1a1f2c] px-1.5 py-0.2 rounded border border-[#1e2533]" style={{ fontFamily: "JetBrains Mono" }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {inspectedNode.data && (
                        <div className="grid grid-cols-2 gap-2 bg-[#111420] p-2.5 rounded-xl border border-[#1e2533]">
                          <div>
                            <span className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider block">Status</span>
                            <span className="font-bold text-neutral-300 uppercase">{inspectedNode.data.status || "Todo"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-[#475569] font-extrabold tracking-wider block">Priority</span>
                            <span className="font-bold text-neutral-300 uppercase">{inspectedNode.data.priority || "Low"}</span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setInspectedNodeId(null);
                          setSidebarTab("links");
                        }}
                        className="w-full py-1.5 border border-[#1e2533] hover:bg-[#1a1f2c] rounded-xl text-neutral-400 hover:text-neutral-200 transition-colors uppercase font-bold text-[9px] tracking-wider"
                        style={{ fontFamily: "JetBrains Mono" }}
                      >
                        Back to Links
                      </button>
                    </div>
                  ) : (
                    <div className="text-neutral-500 italic text-center">Select any @Node reference link in the preview panel to inspect its graph attributes here.</div>
                  )}
                </div>
              )}

            </div>
          </aside>
        )}

      </div>

    </div>
  );
}
