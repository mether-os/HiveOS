"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import { useSocket } from "@/features/realtime/hooks/useSocket";
import { HiveNode } from "@/features/canvas/components/HiveNode";
import { 
  Brain, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Milestone, 
  ArrowRight,
  Terminal,
  Grid,
  Search,
  Zap,
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

const CategoryOptionNode = ({ data }: any) => {
  return (
    <div
      onClick={data.onToggle}
      className={cn(
        "px-4 py-2.5 rounded-xl border text-xs font-mono font-bold uppercase cursor-pointer select-none transition-all flex items-center justify-between min-w-[170px] shadow-lg",
        data.selected
          ? "bg-purple-600/20 border-purple-500 text-purple-300"
          : "bg-[#0b0e14]/80 border-[#1e2533] text-neutral-400 hover:border-neutral-700"
      )}
    >
      <span>{data.label}</span>
      {data.selected ? (
        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
      )}
    </div>
  );
};

const nodeTypes = {
  customNode: HiveNode,
  optionNode: CategoryOptionNode
};

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

interface ProjectIdea {
  title: string;
  tagline: string;
  description: string;
  features: string[];
}

export default function OnboardingPage({ params }: PageProps) {
  const { hiveId } = use(params);
  const router = useRouter();
  const { socket, status: socketStatus } = useSocket();

  // React Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Onboarding Stepper / Conversational states
  const [step, setStep] = useState<"chat-interactive" | "generating" | "complete">("chat-interactive");
  
  const [description, setDescription] = useState("");
  const [messages, setMessages] = useState<any[]>([
    {
      id: "initial-msg",
      role: "assistant",
      content: "Hello! I am **HiveMind**, the central intelligence of this workspace. Let's design your project brain.\n\nDo you have a project idea in mind?"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [thinkingLog, setThinkingLog] = useState<string>("");
  const [completeFlag, setCompleteFlag] = useState(false);

  // Category Selections (Path B)
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isSelectingCategories, setIsSelectingCategories] = useState(false);
  const [currentIdeas, setCurrentIdeas] = useState<ProjectIdea[]>([]);

  // Typewriter thinking effect
  const [displayedThinking, setDisplayedThinking] = useState("");
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll chat
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Join workspace socket room
  useEffect(() => {
    if (!socket || socketStatus !== "connected") return;
    
    console.log(`[Onboarding] Socket joining workspace room workspace:${hiveId}`);
    socket.emit("workspace:join", { workspaceId: hiveId });

    // Listen to node creations from API route
    socket.on("canvas:node-create", ({ node }: { node: any }) => {
      setNodes((nds) => {
        if (nds.some((n) => n.id === node.id)) return nds;
        return nds.concat({
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
        });
      });
    });

    // Listen to edge creations
    socket.on("canvas:edge-create", ({ edge }: { edge: any }) => {
      setEdges((eds) => {
        if (eds.some((e) => e.id === edge.id)) return eds;
        return eds.concat({
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
          style: { stroke: "#f5a623", strokeWidth: 1.5, opacity: 0.8 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#f5a623", width: 12, height: 12 },
          data: { relationType: edge.relationType || "relates_to" }
        });
      });
    });

    return () => {
      socket.off("canvas:node-create");
      socket.off("canvas:edge-create");
      socket.emit("workspace:leave");
    };
  }, [socket, socketStatus, hiveId, setNodes, setEdges]);

  // Handle Typewriter thinking effect
  useEffect(() => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setDisplayedThinking("");
    if (!thinkingLog) return;

    let index = 0;
    typingTimerRef.current = setInterval(() => {
      setDisplayedThinking((prev) => prev + thinkingLog.charAt(index));
      index++;
      if (index >= thinkingLog.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      }
    }, 15);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [thinkingLog]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedThinking]);

  // Category Selection Toggle handler
  const toggleOption = (id: string, category: "audience" | "tech" | "skill", val: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          const newSelected = !n.data.selected;
          
          if (category === "audience") {
            setSelectedAudiences((prev) =>
              newSelected ? [...prev, val] : prev.filter((v) => v !== val)
            );
          } else if (category === "tech") {
            setSelectedTech((prev) =>
              newSelected ? [...prev, val] : prev.filter((v) => v !== val)
            );
          } else if (category === "skill") {
            setSelectedSkills((prev) =>
              newSelected ? [...prev, val] : prev.filter((v) => v !== val)
            );
          }

          return {
            ...n,
            data: {
              ...n.data,
              selected: newSelected,
            },
          };
        }
        return n;
      })
    );
  };

  const loadOptionNodes = () => {
    const AUDIENCES = [
      "Developers", "Students", "Teachers", "Hospitals", "Recruiters", 
      "Startups", "Gamers", "Content Creators", "Designers", "E-commerce Shops", 
      "Remote Workers", "Product Managers", "Finance Analysts", "Non-profits", "Musicians"
    ];
    const TECHS = [
      "React", "Python", "NodeJS", "Machine Learning", "Flutter", 
      "PostgreSQL", "Go Lang", "Rust", "NextJS", "Docker", 
      "Kubernetes", "AWS Cloud", "Firebase", "Redis Cache", "MongoDB"
    ];
    const SKILLS = [
      "AI Integration", "Realtime Sync", "Analytics", "Automation", "SaaS Billing", 
      "OAuth Auth", "Chatbots API", "Data Scraping", "WebSockets", "Video Streaming", 
      "Cloud Hosting", "Vector Search", "CI/CD Pipelines", "Push Notifications", "Geo-tracking"
    ];

    const optionNodes: any[] = [];

    AUDIENCES.forEach((aud, i) => {
      const id = `opt-audience-${i}`;
      optionNodes.push({
        id,
        type: "optionNode",
        position: { x: -220, y: i * 65 - 120 },
        data: {
          label: aud,
          selected: false,
          onToggle: () => toggleOption(id, "audience", aud)
        }
      });
    });

    TECHS.forEach((tech, i) => {
      const id = `opt-tech-${i}`;
      optionNodes.push({
        id,
        type: "optionNode",
        position: { x: 0, y: i * 65 - 120 },
        data: {
          label: tech,
          selected: false,
          onToggle: () => toggleOption(id, "tech", tech)
        }
      });
    });

    SKILLS.forEach((skill, i) => {
      const id = `opt-skill-${i}`;
      optionNodes.push({
        id,
        type: "optionNode",
        position: { x: 220, y: i * 65 - 120 },
        data: {
          label: skill,
          selected: false,
          onToggle: () => toggleOption(id, "skill", skill)
        }
      });
    });

    setNodes(optionNodes);
  };

  const handleYesPath = () => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Yes, I have an idea." },
      { role: "assistant", content: "Excellent! Tell me what you're building. Be as detailed as you like, and I'll start mapping the project brain!" }
    ]);
  };

  const handleNoPath = () => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "No, I need suggestions." },
      { role: "assistant", content: "No problem. Let's find a concept. Check the canvas on the right—I've populated a set of interests, target audiences, and technologies.\n\nSelect what appeals to you directly on the canvas, and once you have selected some, click the 'Generate Ideas' button below!" }
    ]);
    setIsSelectingCategories(true);
    loadOptionNodes();
  };

  const handleGetIdeasFromCanvas = async () => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/hives/${hiveId}/onboarding/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_ideas",
          chosenCategories: {
            audiences: selectedAudiences,
            tech: selectedTech,
            skills: selectedSkills
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: `My selected interests: ${[...selectedAudiences, ...selectedTech, ...selectedSkills].join(", ")}` },
          { role: "assistant", content: "I've analyzed your selections. Here are 3 potential project directions you could take. Choose one below to start designing the brain!" }
        ]);
        setCurrentIdeas(data.ideas || []);
        setIsSelectingCategories(false);
        setNodes([]); // Clear category options from canvas
      } else {
        alert(data.error || "Failed to generate ideas.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSelectIdeaFromList = async (idea: ProjectIdea) => {
    setCurrentIdeas([]);
    setStep("chat-interactive");
    setChatLoading(true);

    const initialUserMessage = {
      role: "user",
      content: `I selected the project: "${idea.title}". Tagline: ${idea.tagline}. Description: ${idea.description}. Features: ${idea.features.join(", ")}.`
    };

    setMessages((prev) => [...prev, initialUserMessage]);

    try {
      const res = await fetch(`/api/hives/${hiveId}/onboarding/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          messages: [...messages, { role: "user", content: `I selected: ${idea.title}` }, initialUserMessage]
        })
      });
      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: data.message
        }]);
        setThinkingLog(data.thinking || "");
        setCompleteFlag(data.complete || false);
      } else {
        alert(data.error || "Failed to initialize HiveMind chat.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  // Conversational message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch(`/api/hives/${hiveId}/onboarding/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          messages: newMessages
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message
        }]);
        setThinkingLog(data.thinking || "");
        setCompleteFlag(data.complete || false);
      } else {
        alert(data.error || "Failed to chat with HiveMind.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  // Finalize seeder
  const handleFinalizeProject = async () => {
    setStep("generating");
    
    // Aggregate full description from history
    let fullContext = "";
    messages.forEach((m) => {
      fullContext += `${m.role.toUpperCase()}: ${m.content}\n`;
    });

    try {
      const res = await fetch(`/api/hives/${hiveId}/onboarding/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          projectDescription: fullContext
        })
      });
      if (res.ok) {
        setStep("complete");
      } else {
        alert("Failed to seed and finalize project. Try again.");
        setStep("chat-interactive");
      }
    } catch (err) {
      console.error(err);
      setStep("chat-interactive");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#05070a] text-neutral-100 overflow-hidden font-sans">
      {/* Header bar */}
      <header className="h-14 border-b border-[#1e2533] px-6 flex items-center justify-between bg-[#080a0f] z-20 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-sm font-black uppercase tracking-widest font-mono">
            HiveMind // Brain Discovery
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full",
              socketStatus === "connected" ? "bg-green-500 animate-pulse" : "bg-neutral-600"
            )} />
            <span className="text-neutral-500">Cognition: {socketStatus.toUpperCase()}</span>
          </div>

          {(step === "chat-interactive" || completeFlag) && (
            <button
              onClick={handleFinalizeProject}
              className="bg-[#f5a623] hover:bg-[#e09415] text-[#1a0e00] px-4 py-1.5 rounded-lg font-bold tracking-wider transition-all uppercase text-[10px]"
            >
              Finalize Brain
            </button>
          )}
        </div>
      </header>

      {/* Main split-pane content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane (React Flow Canvas) */}
        <div className="w-[58%] h-full bg-[#080a0f] border-r border-[#1e2533] relative">
          <div className="absolute top-4 left-4 z-10 bg-black/40 border border-[#1e2533] rounded-lg px-3 py-1.5 font-mono text-[10px] text-neutral-400 select-none">
            {isSelectingCategories ? "INTERACTIVE INTEREST MATRIX" : `DISCOVERED TOPOLOGY VIEW (${nodes.length} nodes)`}
          </div>
          {nodes.length === 0 && !isSelectingCategories ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none bg-[#080a0f]">
              <div className="w-16 h-16 rounded-full bg-[#1e2533]/40 flex items-center justify-center text-neutral-600 border border-[#1e2533] mb-4">
                <Grid className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-neutral-300 font-mono">Canvas Standby</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1.5 leading-relaxed">
                As HiveMind understands your specifications, discovered features, goals, tech stacks, and risks will materialize here in real time.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.1 }}
              className="onboarding-canvas-view"
            >
              <Background color="#141920" gap={16} size={1.5} />
              <Controls className="react-flow-controls-custom" />
            </ReactFlow>
          )}
        </div>

        {/* Right Pane (HiveMind Interactive Console) */}
        <div className="w-[42%] h-full flex flex-col bg-[#0c0f16] overflow-hidden">
          {step === "chat-interactive" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Monologue display (Cognitive display) */}
              {displayedThinking && (
                <div className="shrink-0 p-4 bg-black/25 border-b border-[#1e2533] text-[10.5px] font-mono text-neutral-400 flex gap-2">
                  <Cpu className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                    <span className="text-purple-400 font-black uppercase text-[9px] block">Cognitive Process:</span>
                    <p className="leading-relaxed whitespace-pre-wrap">{displayedThinking}</p>
                  </div>
                </div>
              )}

              {/* Chat messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id || idx} className="space-y-2 flex flex-col">
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl p-3 text-xs leading-relaxed font-sans",
                          isUser
                            ? "bg-purple-600/10 border border-purple-500/15 text-neutral-100 self-end ml-auto"
                            : "bg-[#111420] border border-[#1e2533] text-neutral-300 self-start mr-auto"
                        )}
                      >
                        <div className="text-[8.5px] font-mono uppercase text-neutral-500 border-b border-[#1e2533]/40 pb-1 mb-1.5 select-none">
                          {isUser ? "User Input" : "HiveMind"}
                        </div>
                        <p className="whitespace-pre-wrap font-sans text-neutral-200">{m.content}</p>
                      </div>

                      {/* Initial Greeting buttons */}
                      {m.id === "initial-msg" && messages.length === 1 && (
                        <div className="flex gap-2 mt-1 select-none">
                          <button
                            type="button"
                            onClick={handleYesPath}
                            className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white font-mono text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
                          >
                            Yes, I have an idea
                          </button>
                          <button
                            type="button"
                            onClick={handleNoPath}
                            className="bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white font-mono text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
                          >
                            No, I need suggestions
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Project suggestions list */}
                {currentIdeas.length > 0 && (
                  <div className="space-y-2.5 my-3 select-none">
                    <span className="text-[10px] font-mono text-purple-400 font-extrabold uppercase tracking-wider block">Recommended Directions:</span>
                    <div className="space-y-2">
                      {currentIdeas.map((idea, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectIdeaFromList(idea)}
                          className="bg-[#111622] hover:bg-[#161d2b] border border-[#1e2533] hover:border-purple-500 p-4 rounded-xl cursor-pointer transition-all space-y-1.5 group"
                        >
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black uppercase text-[#f5a623] group-hover:text-purple-400 transition-colors font-mono">{idea.title}</h4>
                            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-purple-400 transition-colors" />
                          </div>
                          <p className="text-[10px] text-neutral-400 font-mono font-bold leading-normal">{idea.tagline}</p>
                          <p className="text-[11px] text-neutral-500 leading-normal">{idea.description}</p>
                          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-[#1e2533]/30">
                            {idea.features.map((f, fIdx) => (
                              <span key={fIdx} className="text-[8.5px] text-neutral-500 bg-[#080a0f] border border-[#1e2533] px-1.5 py-0.5 rounded font-mono">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {chatLoading && (
                  <div className="flex items-center gap-2 text-neutral-500 font-mono text-[10px] py-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f5a623]" />
                    <span>HiveMind is reasoning...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input form / Action button */}
              <div className="p-4 border-t border-[#1e2533] bg-black/15 shrink-0">
                {isSelectingCategories ? (
                  <button
                    type="button"
                    onClick={handleGetIdeasFromCanvas}
                    disabled={selectedAudiences.length === 0 && selectedTech.length === 0 && selectedSkills.length === 0}
                    className="w-full bg-[#f5a623] hover:bg-[#e09415] disabled:opacity-50 text-[#1a0e00] font-mono text-[10.5px] font-black uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-between px-6 shadow-lg"
                  >
                    <span>Generate Ideas from selections ({selectedAudiences.length + selectedTech.length + selectedSkills.length})</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatLoading || messages.length === 1}
                      placeholder={completeFlag ? "Brain discovery complete. Click 'Finalize Brain' to seed workspace." : messages.length === 1 ? "Choose Yes or No option above..." : "Describe requirements, ask, or challenge assumptions..."}
                      className="flex-1 bg-[#080a0f] border border-[#1e2533] rounded-xl px-4 py-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-[#f5a623] disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim() || completeFlag || messages.length === 1}
                      className="bg-[#f5a623] hover:bg-[#e09415] disabled:bg-neutral-800 disabled:text-neutral-500 text-[#1a0e00] font-mono text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* STEP: generating */}
          {step === "generating" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-[#f5a623]" />
              <div className="space-y-1.5 font-mono">
                <h3 className="text-sm font-bold text-neutral-300">DISCOVERING PROJECT SCHEMA...</h3>
                <p className="text-[10px] text-neutral-500 animate-pulse">Structuring canvas topology, generating specs, and allocating tasks...</p>
              </div>
            </div>
          )}

          {/* STEP: complete */}
          {step === "complete" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-md font-bold font-mono tracking-wide text-green-400">UNIFIED BRAIN INITIALIZED</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Discovery complete. All goals, features, tech stacks, tasks, and specification documents have been synchronized in the Knowledge Graph.
                </p>
              </div>
              <button
                onClick={() => router.push(`/hive/${hiveId}/canvas`)}
                className="w-full bg-[#f5a623] hover:bg-[#e09415] text-[#1a0e00] text-xs py-2.5 rounded-xl font-bold font-mono transition-all uppercase tracking-wider flex items-center justify-center gap-1"
              >
                <span>Enter Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
