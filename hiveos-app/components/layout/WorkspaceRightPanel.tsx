"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, UserSquare, Link as LinkIcon, DirectboxSend, DocumentText, Location, Clock, CloseSquare, Chart1, Cpu } from "iconsax-react";
import { useSocket } from "@/features/realtime/hooks/useSocket";
import { usePresenceStore } from "@/features/realtime/hooks/usePresence";
import { useKnowledgeStore } from "@/features/search/store/useKnowledgeStore";
import { cn } from "@/lib/utils";
import { Compass } from "lucide-react";
import { useRouter } from "next/navigation";

interface WorkspaceRightPanelProps {
  hiveId: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  text: string;
  timestamp: string | Date;
}

interface HiveMindMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  evidence?: string;
  citations?: {
    nodes: string[];
    documents: string[];
    workflows: string[];
  };
  suggestedActions?: Array<{
    type: "run_agent" | "create_workflow_proposal" | "create_action_plan" | "modify_structure";
    title: string;
    description: string;
    payload: any;
  }>;
  timestamp: string | Date;
}

export function WorkspaceRightPanel({ hiveId }: WorkspaceRightPanelProps) {
  const router = useRouter();
  const { socket, status } = useSocket();
  const typingUsers = usePresenceStore((state) => state.typingUsers);
  
  // Zustand Search/Inspector Store
  const { selectedEntity, setSelectedEntity, inspectEntity, clearSelection } = useKnowledgeStore();

  const [activeTab, setActiveTab] = useState<"hivemind" | "team" | "inspector" | "analytics">("hivemind");
  
  // Collaborative peer chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // HiveMind AI state
  const [hiveMindMessages, setHiveMindMessages] = useState<HiveMindMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am HiveMind, your intelligent project assistant. Ask me anything about your project's health, tasks, architecture, or documents.",
      timestamp: new Date()
    }
  ]);
  const [hiveMindInput, setHiveMindInput] = useState("");
  const [hiveMindLoading, setHiveMindLoading] = useState(false);
  const [hiveMindMode, setHiveMindMode] = useState<"analyst" | "architect" | "product" | "risk">("analyst");
  const [latestMetricId, setLatestMetricId] = useState<string | null>(null);
  const [actionStatuses, setActionStatuses] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});

  // Inspector details state
  const [inspectorData, setInspectorData] = useState<any | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadChatHistory = useCallback(async (beforeTimestamp?: string) => {
    if (!hiveId) return;
    setLoadingHistory(true);
    try {
      const url = `/api/hives/${hiveId}/chat?limit=50` + (beforeTimestamp ? `&before=${beforeTimestamp}` : "");
      const res = await fetch(url);
      const result = await res.json();
      if (result.data) {
        if (result.data.length < 50) {
          setHasMore(false);
        }
        
        const newMessages = result.data;
        setMessages((prev) => {
          const allMsgs = [...prev];
          newMessages.forEach((msg: ChatMessage) => {
            if (!allMsgs.some((m) => m.id === msg.id)) {
              allMsgs.push(msg);
            }
          });
          allMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return allMsgs;
        });
      }
    } catch (err) {
      console.error("[Chat History] Failed to load:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [hiveId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    loadChatHistory();
  }, [hiveId, loadChatHistory]);

  // Listen for incoming collaborative messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("chat:message", handleMessage);

    return () => {
      socket.off("chat:message", handleMessage);
    };
  }, [socket]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hiveMindMessages, activeTab, hiveMindLoading]);

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const loadInspectorDetails = useCallback(async () => {
    if (!selectedEntity) return;
    setInspectorLoading(true);
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/inspect?entityId=${selectedEntity.id}&entityType=${selectedEntity.type}`);
      const result = await res.json();
      if (result.data) {
        setInspectorData(result.data);
      } else {
        setInspectorData(null);
      }
    } catch (err) {
      console.error("[Inspector] Failed loading entity details:", err);
      setInspectorData(null);
    } finally {
      setInspectorLoading(false);
    }
  }, [selectedEntity, hiveId]);

  const loadAnalyticsData = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/metrics`);
      const result = await res.json();
      if (result.data) {
        setAnalyticsData(result.data);
      }
    } catch (err) {
      console.error("[Analytics] Failed loading metrics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [hiveId]);

  // Auto-switch tab and load details on selected entity updates
  useEffect(() => {
    if (selectedEntity) {
      setActiveTab("inspector");
      loadInspectorDetails();
    }
  }, [selectedEntity, loadInspectorDetails]);

  useEffect(() => {
    if (activeTab === "analytics") {
      loadAnalyticsData();
    }
  }, [activeTab, loadAnalyticsData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    if (!socket || status !== "connected") return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing:start", { workspaceId: hiveId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing:stop", { workspaceId: hiveId });
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket || status !== "connected") return;

    socket.emit("chat:message", { text: inputValue });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    socket.emit("typing:stop", { workspaceId: hiveId });

    setInputValue("");
  };

  // Send message to HiveMind AI
  const handleSendHiveMindMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hiveMindInput.trim() || hiveMindLoading) return;

    const userMsgText = hiveMindInput.trim();
    setHiveMindInput("");
    setHiveMindLoading(true);

    const userMessage: HiveMindMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMsgText,
      timestamp: new Date(),
    };

    setHiveMindMessages((prev) => [...prev, userMessage]);

    try {
      // Build messages history payload for API
      const historyPayload = [...hiveMindMessages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch(`/api/hives/${hiveId}/intelligence/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyPayload,
          mode: hiveMindMode,
        }),
      });

      const data = await res.json();

      if (res.ok && data.response) {
        const aiResponse = data.response;
        setLatestMetricId(data.metricId);

        const aiMessage: HiveMindMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: aiResponse.answer,
          reasoning: aiResponse.reasoning,
          evidence: aiResponse.evidence,
          citations: aiResponse.citations,
          suggestedActions: aiResponse.suggestedActions,
          timestamp: new Date(),
        };

        setHiveMindMessages((prev) => [...prev, aiMessage]);
      } else {
        const errorMessage = data.error || "I encountered an error trying to process your request.";
        setHiveMindMessages((prev) => [
          ...prev,
          {
            id: `ai-error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${errorMessage}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      console.error("[HiveMind Chat Error]", err);
      setHiveMindMessages((prev) => [
        ...prev,
        {
          id: `ai-error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I could not connect to the HiveMind intelligence service. Please make sure the server is online.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setHiveMindLoading(false);
    }
  };

  // Accept Suggested Action
  const handleAcceptSuggestion = async (suggestion: any, msgIndex: number, actionIndex: number) => {
    const actionKey = `${msgIndex}-${actionIndex}`;
    setActionStatuses((prev) => ({ ...prev, [actionKey]: "loading" }));

    try {
      // 1. Telemetry logging
      if (latestMetricId) {
        await fetch(`/api/hives/${hiveId}/intelligence/chat/suggestions/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metricId: latestMetricId }),
        });
      }

      // 2. Perform action based on suggestion type
      let apiEndpoint = "";
      let payload: any = {};

      if (suggestion.type === "run_agent") {
        apiEndpoint = `/api/hives/${hiveId}/intelligence/agents/${suggestion.payload?.agentId || "analyst"}/propose`;
      } else if (suggestion.type === "create_action_plan") {
        apiEndpoint = `/api/hives/${hiveId}/intelligence/action-plans`;
        payload = suggestion.payload || {};
      } else if (suggestion.type === "create_workflow_proposal") {
        apiEndpoint = `/api/hives/${hiveId}/intelligence/workflows`;
        payload = suggestion.payload || {};
      } else if (suggestion.type === "modify_structure") {
        apiEndpoint = `/api/hives/${hiveId}/canvas/modify`;
        payload = suggestion.payload || {};
      }

      if (apiEndpoint) {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setActionStatuses((prev) => ({ ...prev, [actionKey]: "success" }));
        } else {
          setActionStatuses((prev) => ({ ...prev, [actionKey]: "error" }));
        }
      } else {
        setActionStatuses((prev) => ({ ...prev, [actionKey]: "success" }));
      }
    } catch (err) {
      console.error("[Accept Suggestion Error]", err);
      setActionStatuses((prev) => ({ ...prev, [actionKey]: "error" }));
    }
  };

  // Compile typing text indicator
  const typingList = Object.values(typingUsers).map((u) => u.name);
  let typingText = "";
  if (typingList.length === 1) {
    typingText = `${typingList[0]} is typing...`;
  } else if (typingList.length > 1) {
    typingText = `${typingList.slice(0, -1).join(", ")} and ${typingList[typingList.length - 1]} are typing...`;
  }

  // Filter relationship categories
  const relationships = inspectorData?.relationships || [];
  
  const explicitDependencies = relationships.filter((r: any) => r.relationship.includes("depends_on"));
  const explicitDependents = relationships.filter((r: any) => r.relationship.includes("blocks"));
  const relatedDocuments = relationships.filter((r: any) => r.entityType === "document");
  const relatedActivities = relationships.filter((r: any) => r.entityType === "activity");
  const relatedTimeline = relationships.filter((r: any) => r.entityType === "mutation");

  return (
    <aside
      className="
        fixed right-0 top-16 w-80 h-[calc(100vh-64px)] z-40
        bg-card border-l border-border
        hidden md:flex flex-col
      "
      aria-label="HiveMind AI panel"
    >
      {/* Tab Switcher Headers */}
      <div className="flex border-b border-border bg-popover text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 select-none">
        <button
          onClick={() => setActiveTab("hivemind")}
          className={cn(
            "flex-1 py-3 text-center border-r border-border transition-colors hover:text-foreground flex items-center justify-center gap-1",
            activeTab === "hivemind" && "bg-card text-primary"
          )}
        >
          <Cpu size="14" />
          <span>HiveMind</span>
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={cn(
            "flex-1 py-3 text-center border-r border-border transition-colors hover:text-foreground flex items-center justify-center gap-1",
            activeTab === "team" && "bg-card text-primary"
          )}
        >
          <UserSquare size="14" />
          <span>Team</span>
        </button>
        <button
          onClick={() => setActiveTab("inspector")}
          className={cn(
            "flex-1 py-3 text-center border-r border-border transition-colors hover:text-foreground flex items-center justify-center gap-1",
            activeTab === "inspector" && "bg-card text-primary"
          )}
        >
          <span>Inspector</span>
          {selectedEntity && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "px-3 py-3 text-center transition-colors hover:text-foreground flex items-center justify-center",
            activeTab === "analytics" && "bg-card text-primary"
          )}
          title="Search Analytics Metrics"
        >
          <Chart1 size="16" />
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin flex flex-col min-h-0">

        {/* TAB 1: HiveMind AI Chat */}
        {activeTab === "hivemind" && (
          <div className="flex flex-col h-full space-y-4 min-h-0">
            <section className="shrink-0 select-none">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size="16" className="text-primary" />
                <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider font-mono">
                  HiveMind AI Companion
                </h3>
              </div>
              <div className="bg-secondary p-3 rounded-xl border border-border/30">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Query the project brain, evaluate risk scores, or build action plans with custom perspective modes.
                </p>
              </div>
            </section>

            {/* Mode selector dropdown */}
            <section className="shrink-0 flex items-center justify-between gap-2 p-2 bg-secondary/30 rounded-xl border border-border/50 text-[10px] select-none">
              <span className="font-bold font-mono text-muted-foreground uppercase tracking-wider">Analysis Mode:</span>
              <select
                value={hiveMindMode}
                onChange={(e) => setHiveMindMode(e.target.value as any)}
                className="bg-background border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-none focus:border-primary cursor-pointer font-mono"
              >
                <option value="analyst">Analyst Mode</option>
                <option value="architect">Architect Mode</option>
                <option value="product">Product Mode</option>
                <option value="risk">Risk Mode</option>
              </select>
            </section>

            {/* Conversational Screen */}
            <section className="flex-1 flex flex-col min-h-0 bg-secondary/10 rounded-xl border border-border/40 overflow-hidden">
              <div className="bg-secondary/50 px-3 py-2 border-b border-border/30 flex items-center justify-between text-[9px] text-muted-foreground font-bold uppercase tracking-wide select-none">
                <span>Cognitive stream</span>
                <span className="text-primary font-mono">{hiveMindMode} mode active</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 text-[11px] scrollbar-thin">
                {hiveMindMessages.map((msg, msgIdx) => (
                  <div key={msg.id} className="flex gap-2 flex-col">
                    <div className="flex gap-2">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 border select-none",
                        msg.role === "user" 
                          ? "bg-secondary border-border text-foreground" 
                          : "bg-primary/10 border-primary/30 text-primary"
                      )}>
                        {msg.role === "user" ? "ME" : "HM"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1 select-none">
                          <span className="font-bold text-foreground text-[10.5px]">
                            {msg.role === "user" ? "You" : "HiveMind AI"}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5 break-words leading-relaxed whitespace-pre-wrap select-text">
                          {msg.content}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Active Cognition / Monologue details */}
                    {msg.role === "assistant" && msg.reasoning && (
                      <div className="ml-7 select-none">
                        <details className="text-[10px] bg-popover border border-border rounded-lg p-2 font-mono text-muted-foreground">
                          <summary className="cursor-pointer text-[9px] font-extrabold uppercase text-primary tracking-wider flex items-center gap-1 select-none">
                            <span>Active Cognition (Monologue)</span>
                          </summary>
                          <div className="mt-1.5 space-y-1.5 whitespace-pre-wrap border-t border-border/50 pt-1.5">
                            <p><strong className="text-foreground">Reasoning:</strong> {msg.reasoning}</p>
                            {msg.evidence && <p><strong className="text-foreground">Evidence:</strong> {msg.evidence}</p>}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Citations */}
                    {msg.role === "assistant" && msg.citations && (msg.citations.nodes.length > 0 || msg.citations.documents.length > 0 || msg.citations.workflows.length > 0) && (
                      <div className="ml-7 mt-1 text-[8.5px] font-mono text-muted-foreground flex flex-wrap gap-2 select-none">
                        <span className="font-bold uppercase text-muted-foreground">Citations:</span>
                        {msg.citations.nodes.map(nodeId => (
                          <span key={nodeId} className="bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground border border-border">Node: {nodeId}</span>
                        ))}
                        {msg.citations.documents.map(docId => (
                          <span key={docId} className="bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground border border-border">Doc: {docId}</span>
                        ))}
                        {msg.citations.workflows.map(wfId => (
                          <span key={wfId} className="bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground border border-border">Workflow: {wfId}</span>
                        ))}
                      </div>
                    )}

                    {/* Suggested Actions */}
                    {msg.role === "assistant" && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="ml-7 mt-2 space-y-2 select-none">
                        <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider block">Suggested Actions:</span>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.suggestedActions.map((action, actionIdx) => {
                            const actionKey = `${msgIdx}-${actionIdx}`;
                            const status = actionStatuses[actionKey] || "idle";
                            return (
                              <div key={actionIdx} className="bg-popover border border-border rounded-xl p-2.5 flex flex-col justify-between gap-2">
                                <div>
                                  <h5 className="text-[10px] font-bold text-foreground">{action.title}</h5>
                                  <p className="text-[9px] text-muted-foreground leading-normal mt-0.5">{action.description}</p>
                                  {action.type === "modify_structure" && action.payload && (
                                    <div className="mt-2 border-t border-border/50 pt-2 space-y-1 text-[8.5px] font-mono text-muted-foreground">
                                      {action.payload.nodes?.map((n: any, idx: number) => (
                                        <div key={`n-${idx}`} className="flex items-center gap-1.5">
                                          <span className={cn(
                                            "px-1 py-0.5 rounded text-[7.5px] uppercase font-black",
                                            n.action === "create" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                            n.action === "update" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                            "bg-destructive/10 text-destructive border border-destructive/20"
                                          )}>{n.action}</span>
                                          <span>{n.category}: <strong>{n.title}</strong></span>
                                        </div>
                                      ))}
                                      {action.payload.edges?.map((e: any, idx: number) => (
                                        <div key={`e-${idx}`} className="flex items-center gap-1.5">
                                          <span className={cn(
                                            "px-1 py-0.5 rounded text-[7.5px] uppercase font-black",
                                            e.action === "create" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                            "bg-destructive/10 text-destructive border border-destructive/20"
                                          )}>{e.action === "create" ? "connect" : "disconnect"}</span>
                                          <span>{e.source} ➔ {e.target}</span>
                                        </div>
                                      ))}
                                      {action.payload.documents?.map((d: any, idx: number) => (
                                        <div key={`d-${idx}`} className="flex items-center gap-1.5">
                                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 py-0.5 rounded text-[7.5px] uppercase font-black">doc {d.action}</span>
                                          <span>{d.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  disabled={status !== "idle"}
                                  onClick={() => handleAcceptSuggestion(action, msgIdx, actionIdx)}
                                  className={cn(
                                    "w-full py-1.5 rounded-lg text-[9px] font-extrabold uppercase font-mono transition-all text-center cursor-pointer",
                                    status === "idle" && "bg-primary hover:bg-primary/80 text-primary-foreground",
                                    status === "loading" && "bg-secondary text-muted-foreground cursor-wait",
                                    status === "success" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                    status === "error" && "bg-destructive/10 text-destructive border border-destructive/20"
                                  )}
                                >
                                  {status === "idle" && "Accept Suggestion"}
                                  {status === "loading" && "Processing..."}
                                  {status === "success" && "✓ Completed"}
                                  {status === "error" && "✕ Failed"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {hiveMindLoading && (
                  <div className="flex gap-2 select-none">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center text-[8px] font-bold shrink-0 animate-pulse">
                      HM
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-primary italic tracking-wide animate-pulse">
                          Active Cognition (monologue) - HiveMind is thinking...
                        </span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                        </span>
                      </div>
                      <div className="h-4 bg-border/30 rounded-md w-3/4 animate-pulse" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: Collaborative Team Chat */}
        {activeTab === "team" && (
          <div className="flex flex-col h-full space-y-6 min-h-0">
            <section className="shrink-0 select-none">
              <div className="flex items-center gap-2 mb-2">
                <UserSquare size="16" className="text-primary" />
                <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider font-mono">
                  Project Workspace Chat
                </h3>
              </div>
              <div className="bg-secondary p-3 rounded-xl border border-border/30">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Discuss architecture, coordinate tasks, and receive webhook activity updates in real-time.
                </p>
              </div>
            </section>

            {/* Realtime Chat history */}
            <section className="flex-1 flex flex-col min-h-0 bg-secondary/10 rounded-xl border border-border/40 overflow-hidden">
              <div className="bg-secondary/50 p-2 border-b border-border/30 flex items-center justify-between text-[9px] text-muted-foreground font-bold uppercase tracking-wide select-none">
                <span>Realtime feed</span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-emerald-500" : "bg-muted-foreground animate-pulse"}`} />
                  <span>{status === "connected" ? "online" : "syncing"}</span>
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px] scrollbar-thin">
                {hasMore && messages.length > 0 && (
                  <button
                    type="button"
                    disabled={loadingHistory}
                    onClick={() => {
                      const oldestTimestamp = messages[0]?.timestamp;
                      if (oldestTimestamp) {
                        loadChatHistory(new Date(oldestTimestamp).toISOString());
                      }
                    }}
                    className="w-full text-center py-1.5 text-[9px] uppercase tracking-wider font-bold text-muted-foreground hover:text-primary bg-secondary/40 border border-border/50 rounded-xl transition-all select-none cursor-pointer"
                  >
                    {loadingHistory ? "Loading history..." : "Load older messages"}
                  </button>
                )}
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 select-none">
                    <p className="text-[10px] text-muted-foreground italic">
                      No communications logged. Type below to converse.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-2">
                      {msg.userImage ? (
                        <img src={msg.userImage} alt={msg.userName} className="w-5 h-5 rounded-full object-cover border border-border select-none" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-[8px] font-bold text-primary shrink-0 select-none">
                          {msg.userName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1 select-none">
                          <span className="font-bold text-foreground text-[10.5px] truncate">{msg.userName}</span>
                          <span className="text-[8px] text-muted-foreground font-mono shrink-0">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 break-all leading-relaxed select-text">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: Inspector */}
        {activeTab === "inspector" && (
          <div className="space-y-5 text-xs select-text">
            {/* Clear Selection */}
            {selectedEntity && (
              <div className="flex justify-between items-center bg-popover border border-border px-3 py-1.5 rounded-xl shrink-0 select-none">
                <span className="text-[9px] font-bold text-muted-foreground uppercase font-mono">Entity profile inspected</span>
                <button
                  onClick={() => {
                    clearSelection();
                    setInspectorData(null);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  title="Close Inspector"
                >
                  <CloseSquare size="14" />
                </button>
              </div>
            )}

            {inspectorLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 font-mono text-[10px] uppercase select-none">
                <div className="w-6 h-6 rounded-full border border-t-primary border-border animate-spin" />
                <span>Assembling Context Profile...</span>
              </div>
            ) : !selectedEntity ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2 select-none">
                <Compass size="32" className="text-border" />
                <p className="text-[10.5px] leading-relaxed">
                  No knowledge element selected.<br />Double-click any canvas node or select referenced elements to inspect linkages.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Details Card */}
                <div className="bg-secondary/50 p-3.5 border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between select-none">
                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-500/10 text-blue-400 font-extrabold uppercase font-mono border border-blue-500/20">
                      {selectedEntity.type}
                    </span>
                    {inspectorData?.status && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] bg-secondary text-muted-foreground font-bold uppercase font-mono">
                        {inspectorData.status}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[12.5px] font-extrabold text-foreground leading-snug">{inspectorData?.title || selectedEntity.title}</h4>
                  {inspectorData?.content && (
                    <p className="text-muted-foreground text-[11px] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto pr-1 font-sans">
                      {inspectorData.content}
                    </p>
                  )}
                  {inspectorData?.tags && inspectorData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/50 select-none">
                      {inspectorData.tags.map((t: string) => (
                        <span key={t} className="text-[9px] text-muted-foreground bg-background border border-border px-1.5 py-0.2 rounded font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Direct Relationship Graph Section */}
                <div className="space-y-3">
                  <h4 className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono select-none">Relationship Graph</h4>
                  
                  {/* Outgoing Direct Blocked items */}
                  {explicitDependents.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-destructive font-bold uppercase flex items-center gap-1 select-none">
                        <span>Downstream Impact (Blocks)</span>
                      </div>
                      <div className="space-y-1">
                        {explicitDependents.map((rel: any) => (
                          <div
                            key={rel.entityId}
                            onClick={() => inspectEntity(rel.entityId, rel.entityType, rel.title)}
                            className="p-2 rounded-xl bg-destructive/10 border border-destructive/15 hover:bg-destructive/20 cursor-pointer flex justify-between items-center transition-colors group select-none"
                          >
                            <span className="truncate group-hover:text-destructive transition-colors font-bold text-foreground w-[70%]">{rel.title}</span>
                            <span className="text-[8px] font-mono text-muted-foreground">CONF: {rel.confidence}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming Direct Prereqs */}
                  {explicitDependencies.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-accent font-bold uppercase flex items-center gap-1 select-none">
                        <span>Upstream Prerequisite (Depends On)</span>
                      </div>
                      <div className="space-y-1">
                        {explicitDependencies.map((rel: any) => (
                          <div
                            key={rel.entityId}
                            onClick={() => inspectEntity(rel.entityId, rel.entityType, rel.title)}
                            className="p-2 rounded-xl bg-accent/10 border border-accent/15 hover:bg-accent/20 cursor-pointer flex justify-between items-center transition-colors group select-none"
                          >
                            <span className="truncate group-hover:text-accent transition-colors font-bold text-foreground w-[70%]">{rel.title}</span>
                            <span className="text-[8px] font-mono text-muted-foreground">CONF: {rel.confidence}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {explicitDependencies.length === 0 && explicitDependents.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic select-none">No direct graph connections.</div>
                  )}
                </div>

                {/* Related Documents */}
                <div className="space-y-2">
                  <h4 className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono flex items-center gap-1 select-none">
                    <DocumentText size="14" />
                    <span>Related Documents ({relatedDocuments.length})</span>
                  </h4>
                  {relatedDocuments.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground italic select-none">No referenced document specs.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {relatedDocuments.map((rel: any) => (
                        <div
                          key={rel.entityId}
                          onClick={() => {
                            setSelectedEntity({ id: rel.entityId, type: "document", title: rel.title });
                            router.push(`/hive/${hiveId}/documents/${rel.entityId}`);
                          }}
                          className="p-2 rounded-xl bg-secondary/50 border border-border hover:bg-secondary cursor-pointer flex justify-between items-center transition-colors group select-none"
                        >
                          <span className="truncate group-hover:text-primary transition-colors text-foreground w-[75%] font-medium">{rel.title}</span>
                          <span className="text-[8px] font-mono text-muted-foreground">CONF: {rel.confidence}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Related Activities */}
                <div className="space-y-2">
                  <h4 className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono flex items-center gap-1 select-none">
                    <Location size="14" />
                    <span>Related GitHub Events ({relatedActivities.length})</span>
                  </h4>
                  {relatedActivities.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground italic select-none">No connected GitHub activity.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {relatedActivities.map((rel: any) => (
                        <div
                          key={rel.entityId}
                          onClick={() => {
                            setSelectedEntity({ id: rel.entityId, type: "activity", title: rel.title });
                            router.push(`/hive/${hiveId}/activity`);
                          }}
                          className="p-2 rounded-xl bg-secondary/50 border border-border hover:bg-secondary cursor-pointer flex justify-between items-center transition-colors group select-none"
                        >
                          <span className="truncate group-hover:text-primary transition-colors text-foreground w-[75%] font-medium">{rel.title}</span>
                          <span className="text-[8px] font-mono text-muted-foreground">CONF: {rel.confidence}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline Audits */}
                <div className="space-y-2">
                  <h4 className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono flex items-center gap-1 select-none">
                    <Clock size="14" />
                    <span>Transition History ({relatedTimeline.length})</span>
                  </h4>
                  {relatedTimeline.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground italic select-none">No mutation audits logged.</div>
                  ) : (
                    <div className="space-y-1.5 font-mono text-[9.5px]">
                      {relatedTimeline.map((rel: any) => (
                        <div key={rel.entityId} className="p-2 rounded-xl bg-secondary/50 border border-border/80 text-muted-foreground">
                          <div className="font-bold text-foreground">{rel.title}</div>
                          <div className="mt-0.5 text-muted-foreground">Confidence Match: {rel.confidence}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 4: Search Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-5 text-xs select-none">
            <div className="flex items-center gap-2 mb-2">
              <Chart1 size="16" className="text-primary" />
              <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider font-mono">
                Search Performance Index
              </h3>
            </div>

            {analyticsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 font-mono text-[9px] uppercase">
                <div className="w-5 h-5 rounded-full border border-t-primary border-border animate-spin" />
                <span>Aggregating metrics data...</span>
              </div>
            ) : !analyticsData ? (
              <div className="text-muted-foreground italic">No search metrics captured yet.</div>
            ) : (
              <div className="space-y-5">
                {/* Performance stats */}
                <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-3 border border-border rounded-xl font-mono text-[10px]">
                  <div>
                    <span className="text-[8.5px] uppercase text-muted-foreground font-extrabold tracking-wider block">Total Queries</span>
                    <span className="font-extrabold text-foreground text-sm">{analyticsData.overview.totalSearches}</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase text-muted-foreground font-extrabold tracking-wider block">Avg Latency</span>
                    <span className="font-extrabold text-emerald-400 text-sm">{analyticsData.overview.avgLatency}ms</span>
                  </div>
                </div>

                {/* Top queries */}
                <div className="space-y-2">
                  <label className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono">Most Searched Dossiers</label>
                  {analyticsData.topSearches.length === 0 ? (
                    <div className="text-muted-foreground italic">No popular searches recorded.</div>
                  ) : (
                    <div className="space-y-1 font-mono text-[10px]">
                      {analyticsData.topSearches.map((term: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-secondary/30 border border-border/30">
                          <span className="text-foreground font-bold truncate max-w-[140px]">"{term.query}"</span>
                          <span className="text-primary font-extrabold text-[9px]">{term.count} req(s) • {term.avgLatency}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent queries logs */}
                <div className="space-y-2">
                  <label className="text-[9px] uppercase text-muted-foreground font-extrabold tracking-wider font-mono">Recent Queries Log</label>
                  {analyticsData.recentQueries.length === 0 ? (
                    <div className="text-muted-foreground italic">No recent log entries.</div>
                  ) : (
                    <div className="space-y-1 font-mono text-[9px] max-h-32 overflow-y-auto pr-1">
                      {analyticsData.recentQueries.map((log: any) => (
                        <div key={log.id} className="flex justify-between text-muted-foreground border-b border-border/30 py-1 last:border-0">
                          <span className="truncate max-w-[140px]">"{log.query}"</span>
                          <span className="text-muted-foreground shrink-0 font-semibold">{log.latencyMs}ms ({log.resultsCount} hits)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Input Form for Chat */}
      {activeTab === "team" && (
        <form onSubmit={handleSendMessage} className="p-4 bg-secondary/30 border-t border-border shrink-0">
          <div className="flex items-center justify-between mb-2 h-4">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Collaborative Input</span>
              <span className={`w-1 h-1 rounded-full ${status === "connected" ? "bg-emerald-500 animate-breath" : "bg-muted-foreground"}`} />
            </div>
            {typingText && (
              <div className="flex items-center gap-1 select-none">
                <span className="text-[9px] text-primary italic tracking-wide animate-pulse">
                  {typingText}
                </span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                </span>
              </div>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={status === "connected" ? "Type messages to workspace members..." : "Realtime link offline..."}
              disabled={status !== "connected"}
              className="
                w-full bg-background border border-border rounded-xl
                pl-4 pr-10 py-2 text-[11.5px]
                text-foreground placeholder:text-muted-foreground
                focus:outline-none focus:border-primary
                transition-all disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <button
              type="submit"
              disabled={status !== "connected" || !inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover disabled:text-muted-foreground transition-colors"
            >
              <Send size="14" />
            </button>
          </div>
        </form>
      )}

      {/* Input Form for HiveMind AI */}
      {activeTab === "hivemind" && (
        <form onSubmit={handleSendHiveMindMessage} className="p-4 bg-secondary/30 border-t border-border shrink-0">
          <div className="flex items-center justify-between mb-2 h-4">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Cognitive Input</span>
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={hiveMindInput}
              onChange={(e) => setHiveMindInput(e.target.value)}
              placeholder={!hiveMindLoading ? "Ask HiveMind AI about this project..." : "Thinking..."}
              disabled={hiveMindLoading}
              className="
                w-full bg-background border border-border rounded-xl
                pl-4 pr-10 py-2 text-[11.5px]
                text-foreground placeholder:text-muted-foreground
                focus:outline-none focus:border-primary
                transition-all disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
            <button
              type="submit"
              disabled={hiveMindLoading || !hiveMindInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover disabled:text-muted-foreground transition-colors cursor-pointer"
            >
              <DirectboxSend size="14" />
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
