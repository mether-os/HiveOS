"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  ListChecks,
  TrendingUp,
  Sparkles,
  Lock,
  Workflow,
  User,
  Users,
  History,
  AlertCircle,
  RefreshCw,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUpDown,
  Shield,
  GitMerge,
  PlayCircle,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedEntity {
  entityId: string;
  entityType: string;
  title: string;
}

interface Mission {
  id: string;
  _id?: string;
  title: string;
  description: string;
  status: "pending" | "assigned" | "completed" | "reviewed";
  type: string;
  relatedEntities: RelatedEntity[];
  assignedTo?: string;
  assigneeName?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  generatedBy: "system" | "llm";
  sourceRisk?: string;
  sourceRecommendation?: string;
  sourceGap?: string;
}

interface Recommendation {
  id: string;
  _id?: string;
  type: string;
  title: string;
  reason: string;
  confidence: number;
  relatedEntities: RelatedEntity[];
  status: "active" | "accepted" | "dismissed" | "completed";
  suggestedActions: string[];
}

interface Risk {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  reason: string;
  relatedEntities: RelatedEntity[];
  suggestedActions: string[];
}

interface Gap {
  id: string;
  title: string;
  type: string;
  description: string;
  relatedEntities: RelatedEntity[];
}

interface Summary {
  executiveSummary: string;
  technicalSummary: string;
  sprintSummary: string;
  recentChanges: string[];
  keyRisks: string[];
  keyOpportunities: string[];
}

interface AnalysisData {
  healthScore: number;
  grade: string;
  risks: Risk[];
  gaps: Gap[];
  recommendations: Recommendation[];
  missions: Mission[];
  summary: Summary;
  nodes: any[];
  dependencyTraversals: {
    cycles: string[][];
    bottlenecks: any[];
    spofs: any[];
    criticalPath: any[];
    blockedChains: any[];
  };
  momentumScore: number;
}

interface Notification {
  id: string;
  _id: string;
  type: "new_risk" | "stale_work" | "missing_ownership" | "dependency_issue";
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  read: boolean;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
}

interface Contributor {
  actorName: string;
  avatar?: string;
  activityCount: number;
  assignedTasksCount: number;
}

interface TeamIntel {
  contributors: Contributor[];
  ownershipMap: Record<string, string[]>;
  workloads: Record<string, { todo: number; inProgress: number; blocked: number; done: number }>;
  activityPatterns: {
    hourly: Record<number, number>;
    daily: Record<number, number>;
  };
  busFactor: {
    score: number;
    warnings: string[];
    singleOwnerCriticalPathNodes: string[];
    knowledgeConcentrators: string[];
  };
}

interface ComparisonData {
  comparisonAvailable: boolean;
  message?: string;
  currentSnapshot?: {
    id: string;
    healthScore: number;
    risksCount: number;
    gapsCount: number;
    recommendationsCount: number;
    missionsCompletionRate: number;
    momentumScore: number;
    timestamp: string;
  };
  previousSnapshot?: {
    id: string;
    healthScore: number;
    risksCount: number;
    gapsCount: number;
    recommendationsCount: number;
    missionsCompletionRate: number;
    momentumScore: number;
    timestamp: string;
  } | null;
  diffs?: {
    healthScore: number;
    risksCount: number;
    gapsCount: number;
    recommendationsCount: number;
  };
  attributions?: {
    improvements: string[];
    regressions: string[];
    newRisks: Risk[];
    resolvedRisks: Risk[];
    newGaps: Gap[];
    resolvedGaps: Gap[];
  };
}

// Legacy single-action interface (Phase 9)
interface AgentAction {
  id: string;
  _id: string;
  recommendationId?: string;
  actionType: "create_node" | "delete_node" | "update_node" | "create_edge" | "delete_edge" | "assign_owner" | "create_document";
  params: Record<string, any>;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending_approval" | "approved" | "rejected" | "executed" | "failed";
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  error?: string;
  auditLogs: string[];
  createdAt: string;
}

// Phase 10 — Multi-step action plan
interface ActionStep {
  stepNumber: number;
  actionType: string;
  params: Record<string, any>;
  reversibility: "reversible" | "irreversible";
  affectedEntities: Array<{ entityId: string; entityType: string; title: string }>;
  expectedImpact: string;
}

interface AuditLogEntry {
  actorId?: string;
  actorName: string;
  action: "submit" | "approve" | "reject" | "expire";
  notes?: string;
  timestamp: string;
}

interface AgentActionPlan {
  id: string;
  _id: string;
  hiveId: string;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  actionQualityScore: number;
  status: "proposed" | "approved" | "rejected" | "expired" | "executed" | "failed";
  expiresAt: string;
  sourceRiskIds: string[];
  sourceRecommendationIds: string[];
  sourceMissionIds: string[];
  sourceGapIds: string[];
  steps: ActionStep[];
  structuredAuditLogs: AuditLogEntry[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  decisionNotes?: string;
  executedBy?: string;
  executedAt?: string;
  executionLatencyMs?: number;
  executionResult?: "success" | "failed" | "partial";
  rollbackMetadata?: {
    beforeState: Record<string, any>;
    afterState: Record<string, any>;
  };
  executionDetails?: {
    entitiesCreated: Array<{ entityId: string; entityType: string; title: string }>;
    entitiesUpdated: Array<{ entityId: string; entityType: string; title: string }>;
    entitiesFailed: Array<{ stepNumber: number; error: string }>;
    executionOperations: Array<{ operation: string; entityId: string; timestamp: string; details?: any }>;
  };
  createdAt: string;
  updatedAt: string;
}

interface ActionSimulation {
  planId: string;
  nodesAdded: number;
  nodesModified: number;
  nodesDeleted: number;
  risksResolved: number;
  risksCreated: number;
  gapsResolved: number;
  gapsCreated: number;
  ownershipChanges: number;
  dependencyChanges: number;
  estimatedHealthImpact: number;
  estimatedMomentumImpact: number;
  affectedEntityCount: number;
  affectedEntities: Array<{ entityId: string; entityType: string; title: string; changeType: string }>;
  reversibleSteps: number;
  irreversibleSteps: number;
  overallRiskLevel: "low" | "medium" | "high" | "critical";
}

interface ActionPlansMeta {
  total: number;
  statusCounts: Record<string, number>;
  expiredThisRun: number;
}

interface TrendPoint {
  id: string;
  healthScore: number;
  risksCount: number;
  gapsCount: number;
  recommendationsCount: number;
  acceptedRecommendationsCount: number;
  completedRecommendationsCount: number;
  dismissedRecommendationsCount: number;
  missionsCompletionRate: number;
  momentumScore: number;
  timestamp: string;
}

interface TrendsResponse {
  snapshots: TrendPoint[];
  teamActivityTrends: Array<{ date: string; count: number }>;
}

export default function IntelligencePage() {
  const params = useParams();
  const hiveId = params?.hiveId as string;
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "missions" | "team" | "history" | "actions" | "action-center" | "execution-center" | "workflow-center" | "agent-center" | "chat-center">("overview");
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core data states
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [teamIntel, setTeamIntel] = useState<TeamIntel | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);

  // Phase 10 — Action Plans state
  const [actionPlans, setActionPlans] = useState<AgentActionPlan[]>([]);
  const [actionPlansMeta, setActionPlansMeta] = useState<ActionPlansMeta | null>(null);
  const [planStatusFilter, setPlanStatusFilter] = useState<string>("proposed");
  const [planSortField, setPlanSortField] = useState<string>("date");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planSimulations, setPlanSimulations] = useState<Record<string, ActionSimulation>>({});
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(null);
  const [planDecisionNotes, setPlanDecisionNotes] = useState<Record<string, string>>({});
  const [decidingPlanId, setDecidingPlanId] = useState<string | null>(null);
  const [generatingPlans, setGeneratingPlans] = useState(false);

  // Phase 11 — Controlled Execution Engine state
  const [executionMetrics, setExecutionMetrics] = useState<any | null>(null);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [executionTimelineStep, setExecutionTimelineStep] = useState<number>(0);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [maxRiskLevelFilter, setMaxRiskLevelFilter] = useState<"low" | "medium" | "high" | "critical">("critical");
  const [executionOverrides, setExecutionOverrides] = useState<Record<string, Record<number, any>>>({});

  // Phase 12 — Workflow Engine state
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<any[]>([]);
  const [workflowMetrics, setWorkflowMetrics] = useState<any>(null);
  const [expandedWorkflowRunId, setExpandedWorkflowRunId] = useState<string | null>(null);
  const [workflowRunStatusFilter, setWorkflowRunStatusFilter] = useState<string>("all");
  const [workflowActionLoading, setWorkflowActionLoading] = useState<string | null>(null);
  const [manuallyStartingWorkflowId, setManuallyStartingWorkflowId] = useState<string | null>(null);
  const [showWorkflowSimulator, setShowWorkflowSimulator] = useState<string | null>(null);

  // Phase 13 — Agent Framework state
  const [agents, setAgents] = useState<any[]>([]);
  const [triggeringAgentId, setTriggeringAgentId] = useState<string | null>(null);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [acknowledgeCritical, setAcknowledgeCritical] = useState<Record<string, boolean>>({});
  // Phase 14 — Conversational HiveMind state
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am HiveMind, your intelligence assistant. Ask me questions about system health, architectural bottlenecks, spec coverage gaps, or agent proposals.",
      response: {
        answer: "Hello! I am HiveMind, your intelligence assistant. Ask me questions about system health, architectural bottlenecks, spec coverage gaps, or agent proposals.",
        explainability: { reasoning: "Initial greeting", sourceEntities: [], sourceDocuments: [], sourceWorkflows: [], sourceRecommendations: [] },
        citations: { nodes: [], documents: [], workflows: [] },
        suggestedActions: [
          { type: "run_agent", title: "Run Architect Agent", description: "Audit graph architecture bottlenecks.", payload: { agentId: "architect" } },
          { type: "run_agent", title: "Run Risk Analyst Agent", description: "Audit system security risks.", payload: { agentId: "risk" } }
        ]
      }
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatMode, setChatMode] = useState<"analyst" | "architect" | "product" | "risk">("analyst");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMetrics, setChatMetrics] = useState<any>(null);
  const [activeMessageId, setActiveMessageId] = useState<string>("welcome");

  // Phase 14 — Conversational HiveMind Chat Handlers
  const fetchChatMetrics = useCallback(async () => {
    if (!hiveId) return;
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/chat/metrics`).then(r => r.json());
      if (res) {
        setChatMetrics(res);
      }
    } catch (err) {
      console.error("Failed to fetch chat metrics:", err);
    }
  }, [hiveId]);

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading || !hiveId) return;

    const userMessageContent = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const newUserMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessageContent
    };

    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);

    try {
      const cleanHistory = updatedMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`/api/hives/${hiveId}/intelligence/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: cleanHistory,
          mode: chatMode
        })
      });

      const data = await res.json();
      if (res.ok && data.response) {
        const assistantMsgId = `assistant-${Date.now()}`;
        const newAssistantMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: data.response.answer,
          metricId: data.metricId,
          response: data.response
        };
        setChatMessages(prev => [...prev, newAssistantMessage]);
        setActiveMessageId(assistantMsgId);
        fetchChatMetrics();
      } else {
        alert(data.error || "Failed to get response from HiveMind chat.");
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptChatSuggestion = async (metricId: string, action: any) => {
    if (!hiveId || !metricId) return;

    try {
      await fetch(`/api/hives/${hiveId}/intelligence/chat/suggestions/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricId })
      });
      fetchChatMetrics();

      if (action.type === "run_agent") {
        await handleTriggerAgentPropose(action.payload.agentId);
        setChatMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          role: "assistant",
          content: `⚡ **Action Triggered**: Specialized agent analysis successfully proposed for agent: \`${action.payload.agentId}\`. You can check the details inside the **Agent Center** or **Workflow Center** tabs.`,
          response: {
            answer: `⚡ **Action Triggered**: Specialized agent analysis successfully proposed for agent: \`${action.payload.agentId}\`. You can check the details inside the **Agent Center** or **Workflow Center** tabs.`,
            explainability: { reasoning: "Suggestion click action", sourceEntities: [], sourceDocuments: [], sourceWorkflows: [], sourceRecommendations: [] },
            citations: { nodes: [], documents: [], workflows: [] },
            suggestedActions: []
          }
        }]);
      } else if (action.type === "create_workflow_proposal") {
        await handleStartWorkflowManual(action.payload.workflowId);
        setChatMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          role: "assistant",
          content: `⚡ **Action Triggered**: Workflow proposal run successfully initialized for ID \`${action.payload.workflowId}\`. Check progress inside the **Workflow Center** tab.`,
          response: {
            answer: `⚡ **Action Triggered**: Workflow proposal run successfully initialized for ID \`${action.payload.workflowId}\`. Check progress inside the **Workflow Center** tab.`,
            explainability: { reasoning: "Suggestion click action", sourceEntities: [], sourceDocuments: [], sourceWorkflows: [], sourceRecommendations: [] },
            citations: { nodes: [], documents: [], workflows: [] },
            suggestedActions: []
          }
        }]);
      } else if (action.type === "create_action_plan") {
        await handleGeneratePlans();
        setChatMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          role: "assistant",
          content: `⚡ **Action Triggered**: Rule-based action plan generation executed. Proposed steps are now visible inside the **Action Center** tab.`,
          response: {
            answer: `⚡ **Action Triggered**: Rule-based action plan generation executed. Proposed steps are now visible inside the **Action Center** tab.`,
            explainability: { reasoning: "Suggestion click action", sourceEntities: [], sourceDocuments: [], sourceWorkflows: [], sourceRecommendations: [] },
            citations: { nodes: [], documents: [], workflows: [] },
            suggestedActions: []
          }
        }]);
      }
    } catch (err) {
      console.error("Failed to execute suggested action:", err);
    }
  };

  // Interactive action states
  const [updatingRecId, setUpdatingRecId] = useState<string | null>(null);
  const [assigningMissionId, setAssigningMissionId] = useState<string | null>(null);
  const [assigneeNameInput, setAssigneeNameInput] = useState("");
  const [reviewingMissionId, setReviewingMissionId] = useState<string | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState("");
  const [actionNotesInput, setActionNotesInput] = useState<Record<string, string>>();

  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (!hiveId) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const endpoints = [
        `/api/hives/${hiveId}/intelligence/hivemind`,
        `/api/hives/${hiveId}/intelligence/notifications`,
        `/api/hives/${hiveId}/intelligence/team`,
        `/api/hives/${hiveId}/intelligence/history`,
        `/api/hives/${hiveId}/intelligence/actions`,
        `/api/hives/${hiveId}/intelligence/trends`,
        `/api/hives/${hiveId}/intelligence/action-plans?status=${planStatusFilter}&sort=${planSortField}`,
        `/api/hives/${hiveId}/intelligence/action-plans?metrics=true`
      ];

      const [resAnalysis, resNotif, resTeam, resHistory, resActions, resTrends, resPlans, resMetrics] = await Promise.all(
        endpoints.map(url => fetch(url).then(r => r.json()))
      );

      if (resAnalysis.data) setAnalysis(resAnalysis.data);
      if (resNotif.data) setNotifications(resNotif.data);
      if (resTeam.data) setTeamIntel(resTeam.data);
      if (resHistory.data) setComparison(resHistory.data);
      if (resActions.data) setActions(resActions.data);
      if (resTrends.data) setTrends(resTrends.data);
      if (resPlans.data) {
        setActionPlans(resPlans.data);
        if (resPlans.meta) setActionPlansMeta(resPlans.meta);
      }
      if (resMetrics && resMetrics.metrics) {
        setExecutionMetrics(resMetrics.metrics);
      }

      // Fetch Phase 12 Workflow data
      const [resWorkflows, resRuns] = await Promise.all([
        fetch(`/api/hives/${hiveId}/intelligence/workflows`).then(r => r.json()),
        fetch(`/api/hives/${hiveId}/intelligence/workflows/runs?metrics=true`).then(r => r.json())
      ]);

      if (resWorkflows.workflows) setWorkflows(resWorkflows.workflows);
      if (resRuns.runs) setWorkflowRuns(resRuns.runs);
      if (resRuns.metrics) setWorkflowMetrics(resRuns.metrics);

      // Fetch Phase 13 Agent data
      const resAgents = await fetch(`/api/hives/${hiveId}/intelligence/agents`).then(r => r.json());
      if (resAgents.agents) setAgents(resAgents.agents);

      // Fetch Phase 14 Chat Metrics
      const resChatMetrics = await fetch(`/api/hives/${hiveId}/intelligence/chat/metrics`).then(r => r.json());
      if (resChatMetrics) setChatMetrics(resChatMetrics);

    } catch (err: any) {
      console.error("Error loading intelligence data:", err);
      setError("Failed to fetch intelligence reports. Ensure MongoDB and API routes are online.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hiveId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handle Mark Notifications as Read
  const handleMarkNotificationsRead = async (ids?: string[]) => {
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        // Refresh notifications list
        const updated = await fetch(`/api/hives/${hiveId}/intelligence/notifications`).then(r => r.json());
        if (updated.data) setNotifications(updated.data);
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  // Handle Recommendation Update (Accept / Dismiss)
  const handleUpdateRecStatus = async (recId: string, status: "accepted" | "dismissed" | "completed") => {
    try {
      setUpdatingRecId(recId);
      const res = await fetch(`/api/hives/${hiveId}/intelligence/recommendations/${recId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, userId: session?.user?.id }),
      });
      if (res.ok) {
        // Refresh local analytics
        fetchAllData(true);
      }
    } catch (err) {
      console.error("Failed to update recommendation:", err);
    } finally {
      setUpdatingRecId(null);
    }
  };

  // Handle Mission Assignment
  const handleAssignMission = async (missionId: string) => {
    if (!assigneeNameInput.trim()) return;
    try {
      const userId = session?.user?.id || "mock-user-id";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "assigned",
          assignedTo: userId,
          assigneeName: assigneeNameInput.trim()
        })
      });
      if (res.ok) {
        setAssigningMissionId(null);
        setAssigneeNameInput("");
        fetchAllData(true);
      }
    } catch (err) {
      console.error("Failed to assign mission:", err);
    }
  };

  // Handle Complete Mission
  const handleCompleteMission = async (missionId: string) => {
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (res.ok) {
        fetchAllData(true);
      }
    } catch (err) {
      console.error("Failed to complete mission:", err);
    }
  };

  // Handle Review Mission
  const handleReviewMission = async (missionId: string) => {
    try {
      const userId = session?.user?.id || "mock-user-id";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "reviewed",
          reviewedBy: userId,
          reviewNotes: reviewNotesInput.trim() || "Approved by workspace lead."
        })
      });
      if (res.ok) {
        setReviewingMissionId(null);
        setReviewNotesInput("");
        fetchAllData(true);
      }
    } catch (err) {
      console.error("Failed to review mission:", err);
    }
  };

  // Handle Agent Action Approval / Rejection (Phase 9 legacy)
  const handleAgentActionResponse = async (actionId: string, status: "approved" | "rejected") => {
    try {
      const userId = session?.user?.id || "mock-user-id";
      const notes = (actionNotesInput ?? {})[actionId] || "";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          status,
          userId,
          notes: notes.trim()
        })
      });
      if (res.ok) {
        setActionNotesInput(prev => ({ ...(prev ?? {}), [actionId]: "" }));
        fetchAllData(true);
      }
    } catch (err) {
      console.error(`Failed to update agent action ${actionId}:`, err);
    }
  };

  // Phase 10 — Fetch simulation for a plan
  const handleLoadSimulation = async (planId: string) => {
    if (planSimulations[planId]) return; // Already loaded
    try {
      setLoadingSimulation(planId);
      const res = await fetch(`/api/hives/${hiveId}/intelligence/action-plans/${planId}`);
      const data = await res.json();
      if (data.simulation) {
        setPlanSimulations(prev => ({ ...prev, [planId]: data.simulation }));
      }
    } catch (err) {
      console.error("Failed to load simulation:", err);
    } finally {
      setLoadingSimulation(null);
    }
  };

  // Phase 10 — Toggle plan expansion + load simulation
  const handleExpandPlan = (planId: string) => {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(planId);
      handleLoadSimulation(planId);
    }
  };

  // Phase 10 — Decide on a plan (approve/reject)
  const handlePlanDecision = async (planId: string, decision: "approved" | "rejected") => {
    try {
      setDecidingPlanId(planId);
      const userId = session?.user?.id || "system";
      const actorName = session?.user?.name || "Workspace Admin";
      const notes = planDecisionNotes[planId] || "";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/action-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, actorId: userId, actorName, notes: notes.trim() })
      });
      if (res.ok) {
        setPlanDecisionNotes(prev => ({ ...prev, [planId]: "" }));
        setExpandedPlanId(null);
        // Refresh plans
        const refreshed = await fetch(
          `/api/hives/${hiveId}/intelligence/action-plans?status=${planStatusFilter}&sort=${planSortField}`
        ).then(r => r.json());
        if (refreshed.data) setActionPlans(refreshed.data);
        if (refreshed.meta) setActionPlansMeta(refreshed.meta);
      }
    } catch (err) {
      console.error("Failed to decide on plan:", err);
    } finally {
      setDecidingPlanId(null);
    }
  };

  // Phase 10 — Generate plans from diagnostics
  const handleGeneratePlans = async () => {
    try {
      setGeneratingPlans(true);
      await fetch(`/api/hives/${hiveId}/intelligence/action-plans`, { method: "POST" });
      // Re-fetch
      const refreshed = await fetch(
        `/api/hives/${hiveId}/intelligence/action-plans?status=${planStatusFilter}&sort=${planSortField}`
      ).then(r => r.json());
      if (refreshed.data) setActionPlans(refreshed.data);
      if (refreshed.meta) setActionPlansMeta(refreshed.meta);
    } catch (err) {
      console.error("Failed to generate plans:", err);
    } finally {
      setGeneratingPlans(false);
    }
  };

  // Phase 11 — Execute approved action plan
  const handleExecutePlan = async (planId: string) => {
    try {
      setExecutingPlanId(planId);
      setExecutionTimelineStep(1); // Step 1: Validation Pass
      setExecutionError(null);

      // Simulate step progression delay for visual timeline feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      setExecutionTimelineStep(2); // Step 2: Execution Initiated

      await new Promise(resolve => setTimeout(resolve, 500));
      setExecutionTimelineStep(3); // Step 3: Processing Step progression

      const userId = session?.user?.id || "system";
      const userName = session?.user?.name || "Workspace Admin";
      const overrides = executionOverrides[planId] || {};

      const res = await fetch(`/api/hives/${hiveId}/intelligence/action-plans/${planId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: userId,
          actorName: userName,
          stepOverrides: overrides,
          maxRiskLevel: maxRiskLevelFilter
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Execution aborted by safety layer.");
      }

      setExecutionTimelineStep(4); // Step 4: Completion Success
      
      // Brief delay so checkmark is visible
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Clear overrides for this plan
      setExecutionOverrides(prev => {
        const copy = { ...prev };
        delete copy[planId];
        return copy;
      });
      setExpandedPlanId(null);
      
      // Reload all workspace data to update graph, metrics, and lists
      await fetchAllData(true);
    } catch (err: any) {
      console.error("[UI Execution] Plan run failed:", err);
      setExecutionError(err.message || "An unexpected error occurred during execution.");
      setExecutionTimelineStep(5); // Failure state marker
    }
  };

  // Helper to handle owner override selections
  const handleOwnerOverrideChange = (planId: string, stepNumber: number, ownerId: string, assigneeName: string) => {
    setExecutionOverrides(prev => {
      const planOverrides = prev[planId] || {};
      return {
        ...prev,
        [planId]: {
          ...planOverrides,
          [stepNumber]: {
            ...planOverrides[stepNumber],
            owner: ownerId,
            assigneeName
          }
        }
      };
    });
  };

  // Phase 10 — Change filter/sort and re-fetch plans
  const handlePlansFilterChange = async (newStatus: string, newSort: string) => {
    setPlanStatusFilter(newStatus);
    setPlanSortField(newSort);
    try {
      const refreshed = await fetch(
        `/api/hives/${hiveId}/intelligence/action-plans?status=${newStatus}&sort=${newSort}`
      ).then(r => r.json());
      if (refreshed.data) setActionPlans(refreshed.data);
      if (refreshed.meta) setActionPlansMeta(refreshed.meta);
    } catch (err) {
      console.error("Failed to filter plans:", err);
    }
  };

  // Phase 12 — Workflow Engine Action Handlers
  const handleStartWorkflowManual = async (workflowId: string) => {
    try {
      setManuallyStartingWorkflowId(workflowId);
      const userId = session?.user?.id || "admin";
      const userName = session?.user?.name || "Workspace Admin";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/workflows/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          actorId: userId,
          actorName: userName
        })
      });
      if (res.ok) {
        // Refresh runs
        const runsData = await fetch(`/api/hives/${hiveId}/intelligence/workflows/runs?metrics=true`).then(r => r.json());
        if (runsData.runs) setWorkflowRuns(runsData.runs);
        if (runsData.metrics) setWorkflowMetrics(runsData.metrics);
      } else {
        const errData = await res.json();
        alert(`Failed to trigger workflow: ${errData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to trigger workflow run:", err);
    } finally {
      setManuallyStartingWorkflowId(null);
    }
  };

  const handleWorkflowRunAction = async (runId: string, action: string, stepNumber?: number) => {
    try {
      setWorkflowActionLoading(runId);
      const userId = session?.user?.id || "admin";
      const userName = session?.user?.name || "Workspace Admin";
      const res = await fetch(`/api/hives/${hiveId}/intelligence/workflows/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actorId: userId,
          actorName: userName,
          stepNumber,
          acknowledgeCritical: !!acknowledgeCritical[runId]
        })
      });
      if (res.ok) {
        // Refresh everything
        await fetchAllData(true);
      } else {
        const errorData = await res.json();
        alert(`Action failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to execute workflow action:", err);
    } finally {
      setWorkflowActionLoading(null);
    }
  };

  // Phase 13 — Agent Action Handlers
  const handleToggleAgent = async (agentId: string, currentStatus: string) => {
    if (!hiveId) return;
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setUpdatingAgentId(agentId);
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actorId: session?.user?.id || "operator"
        })
      });
      if (res.ok) {
        const updated = await fetch(`/api/hives/${hiveId}/intelligence/agents`).then(r => r.json());
        if (updated.agents) setAgents(updated.agents);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update agent status");
      }
    } catch (err) {
      console.error("Failed to toggle agent status:", err);
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleChangeAgentRisk = async (agentId: string, newRisk: string) => {
    if (!hiveId) return;
    setUpdatingAgentId(agentId);
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskLevel: newRisk,
          actorId: session?.user?.id || "operator"
        })
      });
      if (res.ok) {
        const updated = await fetch(`/api/hives/${hiveId}/intelligence/agents`).then(r => r.json());
        if (updated.agents) setAgents(updated.agents);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update agent risk level");
      }
    } catch (err) {
      console.error("Failed to update agent risk level:", err);
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleTriggerAgentPropose = async (agentId: string) => {
    if (!hiveId) return;
    setTriggeringAgentId(agentId);
    try {
      const res = await fetch(`/api/hives/${hiveId}/intelligence/agents/${agentId}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh runs
        const resRuns = await fetch(`/api/hives/${hiveId}/intelligence/workflows/runs?metrics=true`).then(r => r.json());
        if (resRuns.runs) setWorkflowRuns(resRuns.runs);
        if (resRuns.metrics) setWorkflowMetrics(resRuns.metrics);
        // Refresh agents metrics
        const updated = await fetch(`/api/hives/${hiveId}/intelligence/agents`).then(r => r.json());
        if (updated.agents) setAgents(updated.agents);
        
        alert(`Agent proposal generated successfully: ${data.proposal.name}`);
      } else {
        alert(data.error || "Failed to trigger agent analysis");
      }
    } catch (err) {
      console.error("Failed to trigger agent analysis:", err);
    } finally {
      setTriggeringAgentId(null);
    }
  };

  // Helper to draw SVG Charts
  const drawLineChart = (
    points: TrendPoint[],
    dataKey: keyof Omit<TrendPoint, "id" | "timestamp" | "llmMetrics">,
    color: string,
    maxVal = 100
  ) => {
    if (!points || points.length <= 1) {
      return (
        <div className="flex items-center justify-center h-32 text-neutral-500 font-mono text-[10px] uppercase border border-dashed border-[#1e2533] rounded-xl select-none bg-black/20">
          Awaiting snapshot logs...
        </div>
      );
    }

    const width = 500;
    const height = 120;
    const padding = 15;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const coords = points.map((p, idx) => {
      const val = Number(p[dataKey]) || 0;
      const x = padding + (idx * chartWidth) / (points.length - 1);
      const y = padding + chartHeight - (val * chartHeight) / maxVal;
      return { x, y };
    });

    const pathData = coords
      .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x} ${c.y}`)
      .join(" ");

    const areaPathData = `
      ${pathData}
      L ${coords[coords.length - 1]!.x} ${height - padding}
      L ${coords[0]!.x} ${height - padding}
      Z
    `;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible select-none">
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e2533" strokeDasharray="3,3" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="#1e2533" strokeDasharray="3,3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e2533" />
        <path d={areaPathData} fill={`url(#gradient-${String(dataKey)})`} opacity="0.12" />
        <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, idx) => (
          <circle
            key={idx}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="#080a0f"
            stroke={color}
            strokeWidth="1.5"
            className="cursor-pointer transition-transform hover:scale-150"
          />
        ))}
        <defs>
          <linearGradient id={`gradient-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-400 gap-4">
        <div className="w-9 h-9 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
        <span className="text-[10px] font-semibold uppercase tracking-widest font-mono">
          Assembling Workspace Command Center...
        </span>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#080a0f] text-neutral-500 gap-3">
        <Brain className="w-12 h-12 text-[#f43f5e] opacity-80" />
        <span className="text-xs font-semibold uppercase tracking-wider font-mono text-rose-400">
          {error || "Intelligence Diagnostics Offline"}
        </span>
        <button
          onClick={() => fetchAllData()}
          className="mt-2 px-3 py-1.5 border border-[#1e2533] hover:border-[#f5a623] bg-[#0c101b] text-neutral-400 hover:text-[#f5a623] text-[10px] font-bold uppercase rounded-xl transition-all"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const {
    healthScore = 0,
    grade = "F",
    risks = [],
    gaps = [],
    recommendations = [],
    missions = [],
    summary = { executiveSummary: "No diagnostic summary available.", technicalSummary: "", sprintSummary: "", recentChanges: [], keyRisks: [], keyOpportunities: [] },
    nodes = [],
    dependencyTraversals = { cycles: [], bottlenecks: [], spofs: [], criticalPath: [], blockedChains: [] },
    momentumScore = 0
  } = analysis || {};

  const scoreColor =
    (healthScore || 0) >= 90 ? "text-emerald-500" :
    (healthScore || 0) >= 80 ? "text-cyan-400" :
    (healthScore || 0) >= 70 ? "text-amber-500" :
    "text-rose-500";

  const momentumColor =
    (momentumScore || 0) >= 80 ? "text-emerald-400" :
    (momentumScore || 0) >= 50 ? "text-cyan-400" :
    (momentumScore || 0) >= 30 ? "text-amber-500" :
    "text-rose-500";

  return (
    <div className="h-full bg-[#080a0f] text-neutral-300 flex flex-col overflow-y-auto scrollbar-thin select-text p-6">
      
      {/* Dashboard Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0 border-b border-[#1e2533] pb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-[#f5a623]" />
          <div>
            <h1 className="text-base font-extrabold text-[#f1f5f9] tracking-wider uppercase font-mono">
              V2 Project Command Center
            </h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5 font-mono">
              Phase 9 — Workspace Intelligence Command & Diagnostics
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="text-[9px] font-mono uppercase text-[#f5a623] animate-pulse">
              Syncing snapshots...
            </span>
          )}
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#1e2533] hover:border-[#f5a623] bg-[#0c101b] hover:bg-[#1a1f2c]/30 text-neutral-400 hover:text-[#f5a623] text-[9px] font-bold uppercase rounded-xl transition-all"
            style={{ fontFamily: "JetBrains Mono" }}
          >
            <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
            <span>Recalculate Diagnostics</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation Menu */}
      <nav className="flex flex-wrap border-b border-[#1e2533] mb-6 text-xs font-bold uppercase tracking-wider font-mono gap-1 select-none">
        {[
          { key: "overview", label: "Overview Center", icon: Brain },
          { key: "trends", label: "Analytics Trends", icon: TrendingUp },
          { key: "missions", label: "Daily Missions", icon: ListChecks },
          { key: "team", label: "Team Intel", icon: Users },
          { key: "history", label: "Snapshot History", icon: History },
          { key: "action-center", label: "Action Center", icon: Zap },
          { key: "execution-center", label: "Execution Center", icon: PlayCircle },
          { key: "workflow-center", label: "Workflow Center", icon: Workflow },
          { key: "agent-center", label: "Agent Center", icon: Sparkles },
          { key: "chat-center", label: "Chat Center", icon: MessageSquare },
          { key: "actions", label: "Legacy Actions", icon: Lock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex items-center gap-1.5 pb-3 px-4 border-b-2 border-transparent transition-all hover:text-neutral-200",
                isActive ? "border-[#f5a623] text-[#f5a623]" : "text-neutral-500"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* RENDER TAB CONTENTS */}
      <div className="flex-1 min-h-0">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Radial Index Gauges */}
            <div className="space-y-6">
              
              {/* Double Gauges Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-6">
                
                {/* Gauge 1: Workspace Health */}
                <div className="flex flex-col items-center justify-center relative border-b border-[#1e2533] pb-6">
                  <span className="absolute top-0 left-0 text-[8px] font-bold uppercase text-neutral-500 font-mono">
                    Workspace Quality Index
                  </span>
                  
                  <div className="relative flex items-center justify-center mt-3">
                    <svg className="w-32 h-32" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#161b26" strokeWidth="8" strokeDasharray="125 250" strokeLinecap="round" transform="rotate(135 50 50)" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke={healthScore >= 70 ? (healthScore >= 90 ? "#10b981" : "#f5a623") : "#f43f5e"} strokeWidth="8" strokeDasharray={`${(healthScore / 100) * 125} 250`} strokeLinecap="round" transform="rotate(135 50 50)" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className={cn("text-2xl font-extrabold font-mono", scoreColor)}>{healthScore}</span>
                      <span className="text-[9px] uppercase text-neutral-500 font-extrabold tracking-widest mt-0.5 font-mono">Grade {grade}</span>
                    </div>
                  </div>
                </div>

                {/* Gauge 2: Project Momentum */}
                <div className="flex flex-col items-center justify-center relative pt-2">
                  <span className="absolute top-0 left-0 text-[8px] font-bold uppercase text-neutral-500 font-mono">
                    Project Momentum Index
                  </span>
                  
                  <div className="relative flex items-center justify-center mt-3">
                    <svg className="w-32 h-32" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#161b26" strokeWidth="8" strokeDasharray="125 250" strokeLinecap="round" transform="rotate(135 50 50)" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke={momentumScore >= 70 ? (momentumScore >= 90 ? "#10b981" : "#06b6d4") : "#f5a623"} strokeWidth="8" strokeDasharray={`${(momentumScore / 100) * 125} 250`} strokeLinecap="round" transform="rotate(135 50 50)" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className={cn("text-2xl font-extrabold font-mono", momentumColor)}>{momentumScore}%</span>
                      <span className="text-[8px] uppercase text-neutral-500 font-extrabold tracking-widest mt-0.5 font-mono">Velocity</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* High-Priority Warnings Summary */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-rose-500 font-mono flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Immediate Risk Metrics</span>
                </span>
                
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between border-b border-[#1e2533]/50 pb-1.5">
                    <span className="text-neutral-500">DEPENDENCY CYCLES</span>
                    <span className={cn("font-bold", (dependencyTraversals?.cycles || []).length > 0 ? "text-rose-400" : "text-neutral-400")}>
                      {(dependencyTraversals?.cycles || []).length} Found
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#1e2533]/50 pb-1.5">
                    <span className="text-neutral-500">BLOCKED TASKS</span>
                    <span className={cn("font-bold", (dependencyTraversals?.blockedChains || []).length > 0 ? "text-rose-400" : "text-neutral-400")}>
                      {(dependencyTraversals?.blockedChains || []).length} Active
                    </span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-neutral-500">UNRESOLVED RISKS</span>
                    <span className="text-neutral-400 font-bold">{(risks || []).length} Items</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Middle and Right: Feed and Missions */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Executive Summary Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-2">
                <span className="text-[9px] font-bold text-neutral-500 uppercase font-mono">Diagnostic Summary</span>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">{summary.executiveSummary}</p>
              </div>

              {/* Quick Notifications Alert Feed */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e2533] pb-2.5">
                  <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Workspace Alert Feed</span>
                  </span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => handleMarkNotificationsRead()}
                      className="text-[8.5px] text-neutral-500 hover:text-neutral-300 font-bold uppercase font-mono transition-all"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-xl select-none">
                    No active notifications alerts.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {notifications.map(notif => (
                      <div
                        key={notif._id}
                        className={cn(
                          "p-3 rounded-xl border flex justify-between items-start gap-3 text-xs bg-[#111420] border-[#1e2533] hover:border-neutral-700 transition-all font-mono",
                          notif.severity === "critical" && "border-rose-900/30 bg-rose-950/5"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase border",
                              notif.severity === "critical" && "text-rose-400 border-rose-500/30 bg-rose-500/10",
                              notif.severity === "high" && "text-amber-500 border-amber-500/30 bg-amber-500/10",
                              notif.severity === "medium" && "text-sky-400 border-sky-500/30 bg-sky-500/10",
                              notif.severity === "low" && "text-neutral-400 border-neutral-500/30 bg-neutral-500/10"
                            )}>
                              {notif.severity}
                            </span>
                            <span className="font-bold text-neutral-200 truncate">{notif.title}</span>
                            {notif.occurrenceCount > 1 && (
                              <span className="text-[8px] text-neutral-500 font-extrabold uppercase">
                                x{notif.occurrenceCount} occurrences
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-1 leading-snug font-sans">{notif.message}</p>
                          <span className="text-[8px] text-neutral-600 uppercase block mt-1">
                            Detected: {new Date(notif.lastDetectedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <button
                          onClick={() => handleMarkNotificationsRead([notif._id])}
                          className="p-1 text-neutral-600 hover:text-rose-400 transition-all shrink-0"
                          title="Dismiss alert"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Opportunities recommendations list */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Proactive Recommendation Opportunities</span>
                </span>

                {(recommendations || []).filter(r => r?.status === "active").length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-xl select-none">
                    Perfect alignment. No recommendations proposed.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(recommendations || []).filter(r => r?.status === "active").slice(0, 4).map((rec, idx) => {
                      const recId = rec.id || rec._id || `rec-${idx}`;
                      return (
                        <div key={recId} className="p-3.5 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col justify-between gap-3 font-mono">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                              <span className="text-[10.5px] font-bold text-neutral-200 line-clamp-1">{rec.title}</span>
                              <span className="text-[8.5px] font-extrabold px-1 rounded bg-black/50 text-[#f5a623] shrink-0">
                                CONF: {(rec.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed font-sans line-clamp-2">{rec.reason}</p>
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-[#1e2533]/50">
                            <button
                              onClick={() => handleUpdateRecStatus(recId, "dismissed")}
                              className="px-2 py-0.5 text-[8.5px] font-bold text-rose-400 border border-rose-500/15 bg-rose-500/5 rounded hover:bg-rose-500/10 transition-all"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleUpdateRecStatus(recId, "accepted")}
                              className="px-2 py-0.5 text-[8.5px] font-bold text-[#080a0f] bg-[#f5a623] rounded hover:bg-[#f5a623]/90 transition-all"
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: ANALYTICS TRENDS */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            
            {/* SVG Charts Grid */}
            <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-6">
              <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                <TrendingUp className="w-4 h-4" />
                <span>Historical Snapshots trends</span>
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 border-r border-[#1e2533]/20 pr-0 md:pr-4">
                  <span className="text-[9.5px] font-bold uppercase text-neutral-500 font-mono block">Workspace Health Score Index</span>
                  {trends ? drawLineChart(trends.snapshots, "healthScore", "#10b981", 100) : null}
                </div>
                <div className="space-y-2">
                  <span className="text-[9.5px] font-bold uppercase text-neutral-500 font-mono block">Missions Completion rate (%)</span>
                  {trends ? drawLineChart(trends.snapshots, "missionsCompletionRate", "#06b6d4", 100) : null}
                </div>
                <div className="space-y-2 border-r border-[#1e2533]/20 pr-0 md:pr-4 pt-4 border-t border-[#1e2533]/10">
                  <span className="text-[9.5px] font-bold uppercase text-neutral-500 font-mono block">Active Risks Count</span>
                  {trends ? drawLineChart(trends.snapshots, "risksCount", "#f43f5e", 10) : null}
                </div>
                <div className="space-y-2 pt-4 border-t border-[#1e2533]/10">
                  <span className="text-[9.5px] font-bold uppercase text-neutral-500 font-mono block">Project Momentum Index</span>
                  {trends ? drawLineChart(trends.snapshots, "momentumScore", "#a855f7", 100) : null}
                </div>
              </div>
            </div>

            {/* Daily Contributor Activities Volume */}
            <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
              <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                <Users className="w-4 h-4" />
                <span>Daily activities volume (last 15 days)</span>
              </span>

              {trends?.teamActivityTrends && trends.teamActivityTrends.length > 0 ? (
                <div className="flex items-end justify-between h-36 pt-6 font-mono text-[9px] text-neutral-500 select-none">
                  {trends.teamActivityTrends.map((t, idx) => {
                    const maxCount = Math.max(...trends.teamActivityTrends.map(item => item.count), 1);
                    const barHeightPercent = (t.count / maxCount) * 100;
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 group">
                        <div className="text-[8px] text-[#06b6d4] font-bold opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">
                          {t.count}
                        </div>
                        <div
                          className="w-[60%] bg-[#1e2533] hover:bg-[#06b6d4] transition-all rounded-t-sm"
                          style={{ height: `${Math.max(4, barHeightPercent * 0.8)}px` }}
                        />
                        <span className="mt-2 text-[7.5px] scale-90 origin-top text-neutral-600 rotate-45 md:rotate-0 translate-y-1 md:translate-y-0">
                          {t.date.substring(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-xl select-none">
                  No activity log history.
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: DAILY MISSIONS */}
        {activeTab === "missions" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Missions List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                  <ListChecks className="w-4 h-4" />
                  <span>Daily Actionable Missions checklist</span>
                </span>

                <div className="space-y-4">
                  {(missions || []).map(m => {
                    const isDone = m.status === "completed";
                    const isAssigned = m.status === "assigned";
                    const isReviewed = m.status === "reviewed";

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "p-4 rounded-xl border flex flex-col gap-3 transition-all",
                          isReviewed ? "bg-[#0c101b] border-[#1e2533] text-neutral-500" :
                          isDone ? "bg-emerald-500/5 border-emerald-500/20" :
                          isAssigned ? "bg-cyan-500/5 border-cyan-500/20" :
                          "bg-[#111420] border-[#1e2533] hover:border-neutral-700"
                        )}
                      >
                        <div className="flex justify-between items-start gap-4 font-mono">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase border",
                                isReviewed ? "text-neutral-500 border-neutral-500/20" :
                                isDone ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                                isAssigned ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" :
                                "text-amber-500 border-amber-500/30 bg-amber-500/10"
                              )}>
                                {m.status}
                              </span>
                              <span className={cn("font-bold text-neutral-200 text-xs", (isDone || isReviewed) && "line-through text-neutral-500")}>
                                {m.title}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-neutral-400 mt-1.5 font-sans leading-relaxed">{m.description}</p>
                          </div>

                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-neutral-500 uppercase shrink-0">
                            Source: {m.generatedBy}
                          </span>
                        </div>

                        {/* Assignee / Review Notes Details */}
                        {(isAssigned || isDone || isReviewed) && (
                          <div className="p-2.5 bg-black/25 rounded-lg text-[10px] font-mono text-neutral-400 space-y-1">
                            {m.assigneeName && (
                              <div><span className="text-neutral-500">ASSIGNEE:</span> {m.assigneeName}</div>
                            )}
                            {isReviewed && (
                              <>
                                <div><span className="text-neutral-500">REVIEWED AT:</span> {m.reviewedAt ? new Date(m.reviewedAt).toLocaleDateString() : ""}</div>
                                <div><span className="text-neutral-500">REVIEW NOTES:</span> {m.reviewNotes}</div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Interactive Action Forms */}
                        <div className="flex flex-wrap justify-between items-center gap-3 pt-2.5 border-t border-[#1e2533]/50">
                          {/* Trace links */}
                          <div className="flex flex-wrap gap-1">
                            {m.sourceRisk && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono">
                                Risk origin
                              </span>
                            )}
                            {m.sourceRecommendation && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#f5a623]/10 border border-[#f5a623]/20 text-[#f5a623] font-mono">
                                Recommendation origin
                              </span>
                            )}
                            {m.sourceGap && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">
                                Gap origin
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {m.status === "pending" && (
                              <>
                                {assigningMissionId === m.id ? (
                                  <div className="flex gap-1.5 items-center font-mono">
                                    <input
                                      type="text"
                                      placeholder="Assignee Name"
                                      value={assigneeNameInput}
                                      onChange={(e) => setAssigneeNameInput(e.target.value)}
                                      className="px-2 py-0.5 border border-[#1e2533] bg-[#0c101b] text-[9.5px] rounded text-neutral-200 outline-none w-28 placeholder-neutral-600"
                                    />
                                    <button
                                      onClick={() => handleAssignMission(m.id)}
                                      className="px-2 py-0.5 text-[9px] font-bold bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] rounded"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setAssigningMissionId(null)}
                                      className="px-1.5 py-0.5 text-[9px] font-bold text-neutral-500 hover:text-neutral-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAssigningMissionId(m.id);
                                      setAssigneeNameInput("");
                                    }}
                                    className="px-2.5 py-0.5 border border-[#1e2533] text-[9.5px] font-bold hover:border-[#f5a623] hover:text-[#f5a623] rounded font-mono transition-all"
                                  >
                                    Assign
                                  </button>
                                )}

                                <button
                                  onClick={() => handleCompleteMission(m.id)}
                                  className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-[9.5px] font-bold text-[#080a0f] rounded font-mono transition-all"
                                >
                                  Complete
                                </button>
                              </>
                            )}

                            {isAssigned && (
                              <button
                                onClick={() => handleCompleteMission(m.id)}
                                className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-[9.5px] font-bold text-[#080a0f] rounded font-mono transition-all"
                              >
                                Complete Mission
                              </button>
                            )}

                            {isDone && (
                              <>
                                {reviewingMissionId === m.id ? (
                                  <div className="flex flex-col gap-2 font-mono border border-[#1e2533] p-3 rounded bg-black/30 mt-2 w-full max-w-sm">
                                    <span className="text-[8.5px] text-neutral-500 font-bold uppercase">Enter Review Notes:</span>
                                    <textarea
                                      placeholder="Notes (e.g. verified cycles resolved on canvas)"
                                      value={reviewNotesInput}
                                      onChange={(e) => setReviewNotesInput(e.target.value)}
                                      className="px-2 py-1.5 border border-[#1e2533] bg-[#0c101b] text-[10px] rounded text-neutral-200 outline-none w-full placeholder-neutral-600 min-h-12 resize-none"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => setReviewingMissionId(null)}
                                        className="px-2 py-0.5 text-[9px] font-bold text-neutral-500 hover:text-neutral-300"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleReviewMission(m.id)}
                                        className="px-2.5 py-0.5 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] rounded font-bold"
                                      >
                                        Submit Review
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setReviewingMissionId(m.id);
                                      setReviewNotesInput("");
                                    }}
                                    className="px-2.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-[9.5px] font-bold text-[#080a0f] rounded font-mono transition-all"
                                  >
                                    Approve & Review
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar: Gaps & Diagnostics checklist */}
            <div className="space-y-6">
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                  <Workflow className="w-4 h-4" />
                  <span>Unlinked Gaps ({(gaps || []).length})</span>
                </span>

                <div className="space-y-3">
                  {(gaps || []).map(g => (
                    <div key={g.id} className="p-3 bg-[#111420] border border-[#1e2533] rounded-xl font-mono text-[10px]">
                      <div className="flex justify-between items-start mb-1 gap-1">
                        <span className="font-bold text-neutral-200 line-clamp-1">{g.title}</span>
                        <span className="text-[7.5px] uppercase text-neutral-500 bg-black/40 px-1 rounded shrink-0">
                          {g.type.split("_")[0]}
                        </span>
                      </div>
                      <p className="text-neutral-400 font-sans leading-snug">{g.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: TEAM INTELLIGENCE */}
        {activeTab === "team" && teamIntel && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Contributor summaries and Bus Factor */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Contributor Cards */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                  <Users className="w-4 h-4" />
                  <span>Contributor activity summaries</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(teamIntel?.contributors || []).map(c => (
                    <div key={c.actorName} className="p-3.5 bg-[#111420] border border-[#1e2533] rounded-xl flex items-center gap-3 font-mono text-xs">
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.actorName} className="w-9 h-9 rounded-full border border-[#1e2533] shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1e2533] border border-[#1e2533] flex items-center justify-center shrink-0">
                          <User className="w-4.5 h-4.5 text-neutral-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-neutral-200 truncate">{c.actorName}</div>
                        <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono">
                          <span>COMMITS/LOGS: {c.activityCount}</span>
                          <span>TASKS: {c.assignedTasksCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workload Status Bars */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                  <ListChecks className="w-4 h-4" />
                  <span>Workload distribution per engineer</span>
                </span>

                <div className="space-y-4 font-mono text-xs">
                  {Object.entries(teamIntel?.workloads || {}).map(([owner, w]) => {
                    const total = (w?.todo || 0) + (w?.inProgress || 0) + (w?.blocked || 0) + (w?.done || 0);
                    if (total === 0) return null;
                    return (
                      <div key={owner} className="space-y-1.5">
                        <div className="flex justify-between font-bold text-neutral-300">
                          <span>{owner}</span>
                          <span className="text-neutral-500">{total} active tasks</span>
                        </div>
                        {/* Stacked bar representation */}
                        <div className="h-3 rounded-full overflow-hidden flex bg-[#161b26]">
                          {(w?.todo || 0) > 0 && <div className="bg-neutral-600 hover:opacity-90" style={{ width: `${((w?.todo || 0) / total) * 100}%` }} title={`Todo: ${w?.todo || 0}`} />}
                          {(w?.inProgress || 0) > 0 && <div className="bg-sky-500 hover:opacity-90" style={{ width: `${((w?.inProgress || 0) / total) * 100}%` }} title={`Active: ${w?.inProgress || 0}`} />}
                          {(w?.blocked || 0) > 0 && <div className="bg-rose-500 hover:opacity-90" style={{ width: `${((w?.blocked || 0) / total) * 100}%` }} title={`Blocked: ${w?.blocked || 0}`} />}
                          {(w?.done || 0) > 0 && <div className="bg-emerald-500 hover:opacity-90" style={{ width: `${((w?.done || 0) / total) * 100}%` }} title={`Done: ${w?.done || 0}`} />}
                        </div>
                        <div className="flex gap-3 text-[8.5px] text-neutral-500 font-extrabold uppercase">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-neutral-600 rounded-full" />TODO: {w?.todo || 0}</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />IN PROGRESS: {w?.inProgress || 0}</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />BLOCKED: {w?.blocked || 0}</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />DONE: {w?.done || 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Sidebar Bus Factor warnings */}
            <div className="space-y-6">
              
              {/* Bus Factor Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e2533] pb-2.5">
                  <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Bus Factor diagnostics</span>
                  </span>
                  
                  {/* Score Indicator */}
                  <span className={cn(
                    "text-xs font-extrabold px-2 py-0.5 rounded border font-mono",
                    (teamIntel?.busFactor?.score || 0) >= 4 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                    (teamIntel?.busFactor?.score || 0) >= 2 ? "text-amber-500 border-amber-500/30 bg-amber-500/10" :
                    "text-rose-400 border-rose-500/30 bg-rose-500/10"
                  )}>
                    SCORE: {teamIntel?.busFactor?.score || 0}/5
                  </span>
                </div>

                <div className="space-y-4 font-mono text-[10px] text-neutral-400">
                  {/* Bus Factor warnings */}
                  {(teamIntel?.busFactor?.warnings || []).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[8.5px] font-bold text-rose-400 uppercase">System Concentrators Alerts:</span>
                      {(teamIntel?.busFactor?.warnings || []).map((warn, i) => (
                        <div key={i} className="p-2 rounded bg-rose-500/5 border border-rose-500/10 text-rose-300 leading-normal flex gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Single-owner Critical path */}
                  {(teamIntel?.busFactor?.singleOwnerCriticalPathNodes || []).length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#1e2533]/50">
                      <span className="text-[8.5px] font-bold text-amber-500 uppercase">Critical path single owners:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(teamIntel?.busFactor?.singleOwnerCriticalPathNodes || []).map(name => (
                          <span key={name} className="px-2 py-0.5 bg-black/40 rounded border border-[#1e2533] text-neutral-300">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ownership Map */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-extrabold uppercase text-neutral-500 font-mono block border-b border-[#1e2533] pb-2">
                  Engineer Ownership Map
                </span>
                
                <div className="space-y-3 font-mono text-[10px] max-h-60 overflow-y-auto pr-1">
                  {Object.entries(teamIntel?.ownershipMap || {}).map(([owner, titles]) => (
                    <div key={owner} className="space-y-1">
                      <span className="font-bold text-[#06b6d4]">{owner} ({(titles || []).length})</span>
                      <div className="space-y-0.5 pl-2 text-neutral-400 border-l border-[#1e2533]">
                        {(titles || []).map((title, i) => (
                          <div key={i} className="truncate" title={title}>{title}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 5: SNAPSHOT HISTORY */}
        {activeTab === "history" && comparison && (
          <div className="space-y-6">
            
            {/* Comparison Overview Dashboard */}
            {comparison.comparisonAvailable ? (
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-6">
                
                <div className="flex justify-between items-center border-b border-[#1e2533] pb-3">
                  <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                    <History className="w-4 h-4" />
                    <span>Snapshot quality comparison (Health Change Attribution)</span>
                  </span>
                  
                  {comparison.currentSnapshot && (
                    <span className="text-[8.5px] text-neutral-500 font-mono">
                      LAST RUN: {new Date(comparison.currentSnapshot.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Score Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                  
                  {/* Health score diff */}
                  <div className="p-4 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase">Health Score index</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-bold text-neutral-200">{comparison.currentSnapshot?.healthScore}</span>
                      {comparison.diffs && (
                        <span className={cn(
                          "text-xs font-bold",
                          comparison.diffs.healthScore > 0 ? "text-emerald-400" :
                          comparison.diffs.healthScore < 0 ? "text-rose-400" : "text-neutral-500"
                        )}>
                          {comparison.diffs.healthScore >= 0 ? `+${comparison.diffs.healthScore}` : comparison.diffs.healthScore}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Risks count diff */}
                  <div className="p-4 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase">Active Risks Count</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-bold text-neutral-200">{comparison.currentSnapshot?.risksCount}</span>
                      {comparison.diffs && (
                        <span className={cn(
                          "text-xs font-bold",
                          comparison.diffs.risksCount < 0 ? "text-emerald-400" :
                          comparison.diffs.risksCount > 0 ? "text-rose-400" : "text-neutral-500"
                        )}>
                          {comparison.diffs.risksCount >= 0 ? `+${comparison.diffs.risksCount}` : comparison.diffs.risksCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Gaps count diff */}
                  <div className="p-4 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase">Documentation gaps</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-bold text-neutral-200">{comparison.currentSnapshot?.gapsCount}</span>
                      {comparison.diffs && (
                        <span className={cn(
                          "text-xs font-bold",
                          comparison.diffs.gapsCount < 0 ? "text-emerald-400" :
                          comparison.diffs.gapsCount > 0 ? "text-rose-400" : "text-neutral-500"
                        )}>
                          {comparison.diffs.gapsCount >= 0 ? `+${comparison.diffs.gapsCount}` : comparison.diffs.gapsCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Momentum score compare */}
                  <div className="p-4 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase">Momentum index</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-xl font-bold text-neutral-200">{comparison.currentSnapshot?.momentumScore}%</span>
                      {comparison.previousSnapshot && (
                        <span className="text-[9px] text-neutral-600">
                          PREV: {comparison.previousSnapshot.momentumScore}%
                        </span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Attributions listing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#1e2533]/50 font-mono text-xs">
                  
                  {/* Improvements panel */}
                  <div className="space-y-3">
                    <span className="text-[9.5px] font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Workspace improvements</span>
                    </span>

                    {comparison.attributions?.improvements.length === 0 ? (
                      <div className="p-4 bg-black/10 border border-dashed border-[#1e2533] text-neutral-600 italic rounded-xl text-[10px]">
                        No improvement changes since last diagnostic snapshot.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {comparison.attributions?.improvements.map((imp, idx) => (
                          <div key={idx} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl leading-normal text-emerald-300 flex items-start gap-2 text-[10.5px]">
                            <span className="mt-0.5">•</span>
                            <span>{imp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Regressions panel */}
                  <div className="space-y-3">
                    <span className="text-[9.5px] font-bold text-rose-400 uppercase flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 font-bold" />
                      <span>Diagnostics regressions</span>
                    </span>

                    {comparison.attributions?.regressions.length === 0 ? (
                      <div className="p-4 bg-black/10 border border-dashed border-[#1e2533] text-neutral-600 italic rounded-xl text-[10px]">
                        No regressions found. Perfect synchronization.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {comparison.attributions?.regressions.map((reg, idx) => (
                          <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl leading-normal text-rose-300 flex items-start gap-2 text-[10.5px]">
                            <span className="mt-0.5">•</span>
                            <span>{reg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-6 text-center text-xs text-neutral-500 italic font-mono select-none">
                {comparison.message || "Awaiting more snapshots database history to run attribution comparisons."}
              </div>
            )}

          </div>
        )}

        {/* TAB 6: PHASE 10 ACTION CENTER */}
        {activeTab === "action-center" && (() => {
          const riskColor = (level: string) =>
            level === "critical" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
            level === "high" ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
            level === "medium" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
            "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

          const statusColor = (s: string) =>
            s === "approved" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
            s === "rejected" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
            s === "expired" ? "text-neutral-500 border-neutral-700 bg-neutral-800/30" :
            "text-amber-400 border-amber-500/30 bg-amber-500/10";

          const qualityColor = (score: number) =>
            score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";

          const impactSign = (v: number) => v > 0 ? `+${v}` : `${v}`;

          return (
            <div className="space-y-5">

              {/* Action Center Header */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      <span>Phase 10 — Approval-Based Action Center</span>
                    </span>
                    <p className="text-[9.5px] text-neutral-500 font-mono mt-1">
                      HiveMind generates multi-step action plans from diagnostics. All plans remain PROPOSED until explicitly approved.
                    </p>
                  </div>

                  {/* Status count badges */}
                  {actionPlansMeta && (
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(actionPlansMeta.statusCounts).map(([s, count]) => (
                        <button
                          key={s}
                          onClick={() => handlePlansFilterChange(s, planSortField)}
                          className={cn(
                            "text-[8.5px] font-extrabold px-2 py-1 rounded-lg border uppercase transition-all",
                            planStatusFilter === s
                              ? statusColor(s)
                              : "text-neutral-500 border-[#1e2533] hover:border-neutral-600"
                          )}
                        >
                          {s}: {count}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleGeneratePlans}
                    disabled={generatingPlans}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#f5a623] text-[#080a0f] text-[9px] font-extrabold uppercase rounded-xl hover:bg-[#f5a623]/90 transition-all shrink-0 disabled:opacity-60"
                  >
                    {generatingPlans ? (
                      <><div className="w-3 h-3 rounded-full border-2 border-t-[#080a0f] border-[#080a0f]/30 animate-spin" />Generating...</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5" />Generate Plans</>  
                    )}
                  </button>
                </div>

                {/* Sort controls */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="text-[9px] text-neutral-500 font-mono uppercase font-bold self-center">Sort by:</span>
                  {[
                    { key: "date", label: "Date" },
                    { key: "confidence", label: "Confidence" },
                    { key: "quality", label: "Quality Score" },
                    { key: "risk", label: "Risk" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => handlePlansFilterChange(planStatusFilter, opt.key)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[8.5px] font-bold uppercase transition-all",
                        planSortField === opt.key
                          ? "text-[#f5a623] border-[#f5a623]/40 bg-[#f5a623]/10"
                          : "text-neutral-500 border-[#1e2533] hover:border-neutral-600"
                      )}
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plans list */}
              {actionPlans.length === 0 ? (
                <div className="py-12 text-center bg-[#0e1117] border border-dashed border-[#1e2533] rounded-2xl">
                  <Zap className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500 font-mono italic">
                    No action plans matching filter &quot;{planStatusFilter}&quot;.
                  </p>
                  <p className="text-[9.5px] text-neutral-600 font-mono mt-1">
                    Click &quot;Generate Plans&quot; to derive action plans from current diagnostics.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionPlans.map(plan => {
                    const isExpanded = expandedPlanId === plan._id;
                    const sim = planSimulations[plan._id];
                    const isLoadingSim = loadingSimulation === plan._id;
                    const isDeciding = decidingPlanId === plan._id;
                    const isProposed = plan.status === "proposed";
                    const isExpired = plan.status === "expired";

                    return (
                      <div
                        key={plan._id}
                        className={cn(
                          "bg-[#0e1117] border rounded-2xl overflow-hidden transition-all font-mono text-xs",
                          isExpanded ? "border-[#f5a623]/30" : "border-[#1e2533]"
                        )}
                      >
                        {/* Plan Header Row */}
                        <button
                          onClick={() => handleExpandPlan(plan._id)}
                          className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 hover:bg-white/[0.01] transition-all text-left"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase",
                                statusColor(plan.status)
                              )}>
                                {plan.status}
                              </span>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase",
                                riskColor(plan.riskLevel)
                              )}>
                                {plan.riskLevel} risk
                              </span>
                              {plan.sourceRiskIds.length > 0 && (
                                <span className="text-[7.5px] px-1.5 py-0.5 rounded border border-rose-500/20 text-rose-400/70 bg-rose-500/5">
                                  {plan.sourceRiskIds.length} risk{plan.sourceRiskIds.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {plan.sourceGapIds.length > 0 && (
                                <span className="text-[7.5px] px-1.5 py-0.5 rounded border border-amber-500/20 text-amber-400/70 bg-amber-500/5">
                                  {plan.sourceGapIds.length} gap{plan.sourceGapIds.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {plan.sourceRecommendationIds.length > 0 && (
                                <span className="text-[7.5px] px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-400/70 bg-cyan-500/5">
                                  {plan.sourceRecommendationIds.length} rec{plan.sourceRecommendationIds.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-200 font-bold text-[11px] leading-tight">{plan.title}</p>
                            <p className="text-neutral-500 text-[9.5px] leading-snug line-clamp-2">{plan.description}</p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {/* Quality Score */}
                            <div className="text-center">
                              <p className="text-[7.5px] text-neutral-600 uppercase">Quality</p>
                              <p className={cn("text-base font-black", qualityColor(plan.actionQualityScore))}>
                                {plan.actionQualityScore}
                              </p>
                            </div>
                            {/* Confidence */}
                            <div className="text-center">
                              <p className="text-[7.5px] text-neutral-600 uppercase">Confidence</p>
                              <p className="text-base font-black text-cyan-400">
                                {Math.round(plan.confidence * 100)}%
                              </p>
                            </div>
                            {/* Steps count */}
                            <div className="text-center">
                              <p className="text-[7.5px] text-neutral-600 uppercase">Steps</p>
                              <p className="text-base font-black text-neutral-300">{plan.steps.length}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-neutral-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <div className="border-t border-[#1e2533] p-4 space-y-5">

                            {/* Two-col: Steps + Simulation */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                              {/* Steps panel */}
                              <div className="space-y-3">
                                <p className="text-[9px] font-bold text-neutral-400 uppercase flex items-center gap-1.5">
                                  <GitMerge className="w-3.5 h-3.5 text-[#f5a623]" /> Plan Steps
                                </p>
                                {plan.steps.map(step => (
                                  <div key={step.stepNumber} className="flex gap-3 p-3 bg-black/30 rounded-xl border border-[#1e2533]">
                                    <div className="w-5 h-5 rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10 text-[#f5a623] text-[8px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                      {step.stepNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[8px] font-bold uppercase text-neutral-300 bg-[#1e2533] px-1.5 py-0.5 rounded">
                                          {step.actionType.replace(/_/g, " ")}
                                        </span>
                                        <span className={cn(
                                          "text-[7.5px] font-bold uppercase px-1 py-0.5 rounded border",
                                          step.reversibility === "reversible"
                                            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                                            : "text-rose-400 border-rose-500/20 bg-rose-500/5"
                                        )}>
                                          {step.reversibility}
                                        </span>
                                        {step.params?.owner === null && (
                                          <span className="text-[7.5px] text-amber-400/70 border border-amber-500/20 bg-amber-500/5 px-1 py-0.5 rounded">
                                            owner: manual
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9.5px] text-neutral-400 leading-snug">{step.expectedImpact}</p>
                                      {step.affectedEntities.length > 0 && (
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                          {step.affectedEntities.slice(0, 3).map((e, i) => (
                                            <span key={i} className="text-[7.5px] text-neutral-500 bg-[#1e2533] px-1.5 py-0.5 rounded">
                                              {e.title}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Simulation panel */}
                              <div className="space-y-3">
                                <p className="text-[9px] font-bold text-neutral-400 uppercase flex items-center gap-1.5">
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Impact Preview
                                </p>

                                {isLoadingSim ? (
                                  <div className="flex items-center gap-2 p-4 bg-black/20 rounded-xl border border-dashed border-[#1e2533] text-neutral-500 text-[10px]">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-t-cyan-400 border-neutral-700 animate-spin" />
                                    Computing simulation...
                                  </div>
                                ) : sim ? (
                                  <div className="space-y-3">
                                    {/* Health & Momentum */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center">
                                        <p className="text-[7.5px] text-neutral-500 uppercase mb-0.5">Health Impact</p>
                                        <p className={cn(
                                          "text-xl font-black",
                                          sim.estimatedHealthImpact >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                          {impactSign(sim.estimatedHealthImpact)}
                                        </p>
                                        <p className="text-[7px] text-neutral-600">health pts</p>
                                      </div>
                                      <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-center">
                                        <p className="text-[7.5px] text-neutral-500 uppercase mb-0.5">Momentum</p>
                                        <p className={cn(
                                          "text-xl font-black",
                                          sim.estimatedMomentumImpact >= 0 ? "text-cyan-400" : "text-rose-400"
                                        )}>
                                          {impactSign(sim.estimatedMomentumImpact)}
                                        </p>
                                        <p className="text-[7px] text-neutral-600">momentum pts</p>
                                      </div>
                                    </div>

                                    {/* Diagnostic deltas */}
                                    <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                                      <div className="p-2.5 bg-black/20 border border-[#1e2533] rounded-xl space-y-1.5">
                                        <p className="text-[8px] font-bold text-neutral-500 uppercase">Risks</p>
                                        <div className="flex justify-between">
                                          <span className="text-neutral-400">Resolved</span>
                                          <span className="text-emerald-400 font-bold">{impactSign(-sim.risksResolved)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-neutral-400">Created</span>
                                          <span className="text-rose-400 font-bold">{impactSign(sim.risksCreated)}</span>
                                        </div>
                                      </div>
                                      <div className="p-2.5 bg-black/20 border border-[#1e2533] rounded-xl space-y-1.5">
                                        <p className="text-[8px] font-bold text-neutral-500 uppercase">Gaps</p>
                                        <div className="flex justify-between">
                                          <span className="text-neutral-400">Resolved</span>
                                          <span className="text-emerald-400 font-bold">{impactSign(-sim.gapsResolved)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-neutral-400">Created</span>
                                          <span className="text-rose-400 font-bold">{impactSign(sim.gapsCreated)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Graph & ownership deltas */}
                                    <div className="p-3 bg-black/20 border border-[#1e2533] rounded-xl grid grid-cols-3 gap-2 text-center">
                                      <div>
                                        <p className="text-[7px] text-neutral-500 uppercase">Nodes Added</p>
                                        <p className="text-sm font-black text-emerald-400">{impactSign(sim.nodesAdded)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[7px] text-neutral-500 uppercase">Ownership</p>
                                        <p className="text-sm font-black text-cyan-400">{sim.ownershipChanges}</p>
                                      </div>
                                      <div>
                                        <p className="text-[7px] text-neutral-500 uppercase">Dependency</p>
                                        <p className="text-sm font-black text-amber-400">{sim.dependencyChanges}</p>
                                      </div>
                                    </div>

                                    {/* Reversibility */}
                                    <div className="flex items-center gap-2 p-2.5 bg-black/20 border border-[#1e2533] rounded-xl">
                                      <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span className="text-[9px] text-neutral-400">
                                        {sim.reversibleSteps} reversible / {sim.irreversibleSteps} irreversible steps
                                      </span>
                                    </div>

                                    {/* Affected entities */}
                                    {sim.affectedEntities.length > 0 && (
                                      <div className="p-2.5 bg-black/20 border border-[#1e2533] rounded-xl space-y-1">
                                        <p className="text-[8px] font-bold text-neutral-500 uppercase">{sim.affectedEntityCount} affected entities</p>
                                        <div className="flex flex-wrap gap-1">
                                          {sim.affectedEntities.slice(0, 6).map((e, i) => (
                                            <span
                                              key={i}
                                              className={cn(
                                                "text-[7.5px] px-1.5 py-0.5 rounded border",
                                                e.changeType === "removed" ? "text-rose-400/80 border-rose-500/20 bg-rose-500/5" :
                                                e.changeType === "modified" ? "text-amber-400/80 border-amber-500/20 bg-amber-500/5" :
                                                "text-emerald-400/80 border-emerald-500/20 bg-emerald-500/5"
                                              )}
                                            >
                                              {e.changeType === "removed" ? "−" : e.changeType === "modified" ? "~" : "+"} {e.title}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-4 bg-black/10 border border-dashed border-[#1e2533] rounded-xl text-center text-[10px] text-neutral-600 italic">
                                    Simulation data unavailable.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Traceability */}
                            <div className="p-3 bg-black/20 border border-[#1e2533] rounded-xl space-y-2">
                              <p className="text-[8.5px] font-bold uppercase text-neutral-500">Traceability — Why this plan exists:</p>
                              <p className="text-[9.5px] text-neutral-400 leading-snug">{plan.reason}</p>
                              <div className="flex gap-3 flex-wrap text-[8px] text-neutral-600">
                                {plan.sourceRiskIds.length > 0 && <span>Sources: {plan.sourceRiskIds.join(", ")}</span>}
                                {plan.sourceGapIds.length > 0 && <span>Gaps: {plan.sourceGapIds.join(", ")}</span>}
                                {plan.sourceRecommendationIds.length > 0 && <span>Recs: {plan.sourceRecommendationIds.join(", ")}</span>}
                              </div>
                            </div>

                            {/* Audit trail */}
                            <div className="p-3 bg-black/20 border border-[#1e2533] rounded-xl space-y-2">
                              <p className="text-[8.5px] font-bold uppercase text-neutral-500">Audit Trail:</p>
                              {plan.structuredAuditLogs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 text-[9px] text-neutral-500">
                                  <span className="text-[#f5a623]/60 font-mono">{new Date(log.timestamp).toLocaleDateString()}</span>
                                  <span className="font-bold text-neutral-400">{log.actorName}</span>
                                  <span className={cn(
                                    "uppercase font-bold",
                                    log.action === "approve" ? "text-emerald-400" :
                                    log.action === "reject" ? "text-rose-400" :
                                    log.action === "expire" ? "text-neutral-600" :
                                    "text-amber-400"
                                  )}>{log.action}</span>
                                  {log.notes && <span className="text-neutral-600">— {log.notes}</span>}
                                </div>
                              ))}
                            </div>

                            {/* Decision Panel */}
                            {isProposed && !isExpired && (
                              <div className="p-4 bg-[#0c101b] border border-[#f5a623]/20 rounded-xl space-y-3">
                                <p className="text-[9px] font-bold uppercase text-[#f5a623]/80">Decision Required</p>
                                <textarea
                                  rows={2}
                                  placeholder="Add decision notes (optional)..."
                                  value={planDecisionNotes[plan._id] || ""}
                                  onChange={(e) => setPlanDecisionNotes(prev => ({ ...prev, [plan._id]: e.target.value }))}
                                  className="w-full px-3 py-2 bg-black/40 border border-[#1e2533] rounded-xl text-[9.5px] text-neutral-300 outline-none placeholder-neutral-600 resize-none font-mono"
                                />
                                <p className="text-[8px] text-amber-400/70 italic">
                                  ⚠ Approving this plan does NOT execute it. Execution is reserved for Phase 11.
                                </p>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handlePlanDecision(plan._id, "rejected")}
                                    disabled={isDeciding}
                                    className="flex-1 py-2 bg-rose-900/20 border border-rose-500/30 text-rose-400 font-bold text-[9px] uppercase rounded-xl hover:bg-rose-950/30 transition-all disabled:opacity-50"
                                  >
                                    {isDeciding ? "Processing..." : "Reject Plan"}
                                  </button>
                                  <button
                                    onClick={() => handlePlanDecision(plan._id, "approved")}
                                    disabled={isDeciding}
                                    className="flex-1 py-2 bg-[#f5a623] text-[#080a0f] font-extrabold text-[9px] uppercase rounded-xl hover:bg-[#f5a623]/90 transition-all disabled:opacity-50"
                                  >
                                    {isDeciding ? "Processing..." : "✓ Approve Plan"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Decided state banner */}
                            {(plan.status === "approved" || plan.status === "rejected") && (
                              <div className={cn(
                                "p-3 rounded-xl border text-[9.5px] font-mono",
                                plan.status === "approved" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"
                              )}>
                                <span className="font-bold uppercase">{plan.status}</span>
                                {plan.decisionNotes && <span className="text-neutral-500 ml-2">— {plan.decisionNotes}</span>}
                                {plan.approvedAt && <span className="text-neutral-600 ml-2">{new Date(plan.approvedAt).toLocaleString()}</span>}
                                {plan.rejectedAt && <span className="text-neutral-600 ml-2">{new Date(plan.rejectedAt).toLocaleString()}</span>}
                              </div>
                            )}

                            {/* Expiry warning */}
                            {isProposed && (
                              <p className="text-[8.5px] text-neutral-600 font-mono">
                                Expires: {new Date(plan.expiresAt).toLocaleString()}
                              </p>
                            )}

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 6.5: PHASE 11 CONTROLLED EXECUTION CENTER */}
        {activeTab === "execution-center" && (() => {
          const riskColor = (level: string) =>
            level === "critical" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
            level === "high" ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
            level === "medium" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
            "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

          const statusColor = (s: string) =>
            s === "executed" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
            s === "failed" ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
            "text-amber-400 border-amber-500/30 bg-amber-500/10";

          const metrics = executionMetrics || {
            totalExecuted: 0,
            successCount: 0,
            failedCount: 0,
            partialCount: 0,
            executionSuccessRate: 0,
            executionFailureRate: 0,
            averageExecutionLatencyMs: 0,
            successByActionType: {},
          };

          const contributors = teamIntel?.contributors || [
            { actorName: "mayanksharma" },
            { actorName: "alice-coder" }
          ];

          return (
            <div className="space-y-5">
              
              {/* Execution Center Header */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#06b6d4] font-mono flex items-center gap-1.5">
                      <PlayCircle className="w-4 h-4 text-[#06b6d4]" />
                      <span>Phase 11 — Controlled Execution Center</span>
                    </span>
                    <p className="text-[9.5px] text-neutral-500 font-mono mt-1">
                      Execute approved action plans under strict safety authorization controls.
                    </p>
                  </div>

                  {/* Sub-tab selection */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { status: "approved", label: "Pending Executions" },
                      { status: "executed", label: "Completed Runs" },
                      { status: "failed", label: "Failed Runs" }
                    ].map(tab => (
                      <button
                        key={tab.status}
                        onClick={() => handlePlansFilterChange(tab.status, planSortField)}
                        className={cn(
                          "text-[8.5px] font-extrabold px-2.5 py-1 rounded-lg border uppercase transition-all font-mono",
                          planStatusFilter === tab.status
                            ? "text-[#06b6d4] border-[#06b6d4]/40 bg-[#06b6d4]/10"
                            : "text-neutral-500 border-[#1e2533] hover:border-neutral-600"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk configuration policy slider */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#1e2533]/50 font-mono text-[9.5px]">
                  <span className="text-neutral-500 font-bold uppercase">Max Allowed Risk Level:</span>
                  <div className="flex gap-1.5">
                    {["low", "medium", "high", "critical"].map(level => (
                      <button
                        key={level}
                        onClick={() => setMaxRiskLevelFilter(level as any)}
                        className={cn(
                          "px-2 py-0.5 rounded border uppercase text-[8px] font-black transition-all",
                          maxRiskLevelFilter === level
                            ? riskColor(level)
                            : "text-neutral-500 border-[#1e2533] hover:border-neutral-700"
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <span className="text-neutral-600 italic ml-auto">
                    ⚠ Execution is blocked if plan risk exceeds threshold.
                  </span>
                </div>
              </div>

              {/* Metrics Dashboards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-4 text-center">
                  <p className="text-[7.5px] text-neutral-500 uppercase mb-1">Success Rate</p>
                  <p className="text-2xl font-black text-emerald-400">{metrics.executionSuccessRate}%</p>
                  <p className="text-[7.5px] text-neutral-600 mt-1">{metrics.successCount} of {metrics.totalExecuted} run(s)</p>
                </div>
                <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-4 text-center">
                  <p className="text-[7.5px] text-neutral-500 uppercase mb-1">Failure Rate</p>
                  <p className="text-2xl font-black text-rose-400">{metrics.executionFailureRate}%</p>
                  <p className="text-[7.5px] text-neutral-600 mt-1">{metrics.failedCount} aborted run(s)</p>
                </div>
                <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-4 text-center">
                  <p className="text-[7.5px] text-neutral-500 uppercase mb-1">Avg Latency</p>
                  <p className="text-2xl font-black text-cyan-400">{metrics.averageExecutionLatencyMs}ms</p>
                  <p className="text-[7.5px] text-neutral-600 mt-1">total execution time</p>
                </div>
                <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-4 text-center">
                  <p className="text-[7.5px] text-neutral-500 uppercase mb-1">Total Runs</p>
                  <p className="text-2xl font-black text-neutral-300">{metrics.totalExecuted}</p>
                  <p className="text-[7.5px] text-neutral-600 mt-1">actions committed</p>
                </div>
              </div>

              {/* Action Plans list */}
              {actionPlans.length === 0 ? (
                <div className="py-12 text-center bg-[#0e1117] border border-dashed border-[#1e2533] rounded-2xl">
                  <PlayCircle className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500 font-mono italic">
                    No plans matching &quot;{planStatusFilter}&quot; executions filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionPlans.map(plan => {
                    const isExpanded = expandedPlanId === plan._id;
                    const isRunning = executingPlanId === plan._id;
                    const isPending = plan.status === "approved";
                    const isDone = plan.status === "executed";
                    const isFailed = plan.status === "failed";
                    const overrides = executionOverrides[plan._id] || {};

                    return (
                      <div
                        key={plan._id}
                        className={cn(
                          "bg-[#0e1117] border rounded-2xl overflow-hidden transition-all font-mono text-xs",
                          isExpanded ? "border-[#06b6d4]/30" : "border-[#1e2533]"
                        )}
                      >
                        {/* Plan Header Row */}
                        <button
                          onClick={() => handleExpandPlan(plan._id)}
                          className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 hover:bg-white/[0.01] transition-all text-left"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase",
                                statusColor(plan.status)
                              )}>
                                {plan.status}
                              </span>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase",
                                riskColor(plan.riskLevel)
                              )}>
                                {plan.riskLevel} risk
                              </span>
                              <span className="text-[7.5px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400">
                                {plan.steps.length} step{plan.steps.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-neutral-200 font-bold text-[11px] leading-tight">{plan.title}</p>
                            <p className="text-neutral-500 text-[9.5px] leading-snug line-clamp-1">{plan.description}</p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            {plan.executedAt && (
                              <div className="text-right text-[8.5px] text-neutral-500 hidden md:block">
                                <span>RUN: {new Date(plan.executedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-neutral-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <div className="border-t border-[#1e2533] p-4 space-y-5">
                            
                            {/* Running Timeline Loader */}
                            {isRunning && (
                              <div className="p-4 bg-[#0c101b] border border-[#06b6d4]/20 rounded-xl space-y-4 font-mono">
                                <p className="text-[9px] font-bold uppercase text-[#06b6d4] flex items-center gap-1.5 animate-pulse">
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] animate-ping" />
                                  Executing Plan...
                                </p>
                                
                                <div className="space-y-2.5 text-[9.5px]">
                                  {[
                                    { step: 1, label: "Validation Pass (Authorization, Risk, Entity Existence)" },
                                    { step: 2, label: "Database Transaction Initiated" },
                                    { step: 3, label: "Processing Step Writes & Placeholder Mapping" },
                                    { step: 4, label: "Cache Invalidation & Knowledge Indexing" }
                                  ].map(item => {
                                    const isComplete = executionTimelineStep > item.step;
                                    const isActive = executionTimelineStep === item.step;
                                    return (
                                      <div key={item.step} className="flex items-center gap-2">
                                        {isComplete ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : isActive ? (
                                          <div className="w-3.5 h-3.5 rounded-full border-2 border-t-cyan-400 border-neutral-700 animate-spin" />
                                        ) : (
                                          <Clock className="w-3.5 h-3.5 text-neutral-700" />
                                        )}
                                        <span className={cn(
                                          isComplete ? "text-neutral-300 font-bold" :
                                          isActive ? "text-cyan-400 font-bold" :
                                          "text-neutral-600"
                                        )}>
                                          [{item.step}] {item.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Execution Error Banner */}
                            {isExpanded && executionError && expandedPlanId === plan._id && (
                              <div className="p-3 bg-rose-500/5 border border-rose-500/20 text-rose-400 rounded-xl text-[9.5px]">
                                <span className="font-bold">❌ Execution Aborted:</span> {executionError}
                              </div>
                            )}

                            {/* Main steps list */}
                            <div className="space-y-3">
                              <p className="text-[9px] font-bold text-neutral-400 uppercase">Step Actions</p>
                              {plan.steps.map(step => {
                                const stepOverride = overrides[step.stepNumber] || {};
                                const isAssignOwner = step.actionType === "assign_owner";
                                const isCreateNode = step.actionType === "create_node";
                                const needsAssignment = (isAssignOwner && step.params.owner === null) || (isCreateNode && step.params.owner === null);

                                return (
                                  <div key={step.stepNumber} className="flex flex-col md:flex-row justify-between gap-3 p-3 bg-black/30 rounded-xl border border-[#1e2533]">
                                    <div className="flex gap-3">
                                      <div className="w-5 h-5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-[8px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {step.stepNumber}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[8px] font-bold uppercase text-neutral-300 bg-[#1e2533] px-1.5 py-0.5 rounded">
                                            {step.actionType.replace(/_/g, " ")}
                                          </span>
                                        </div>
                                        <p className="text-[9.5px] text-neutral-400 leading-snug">{step.expectedImpact}</p>
                                      </div>
                                    </div>

                                    {/* Parameter overrides / selections */}
                                    {needsAssignment && isPending && (
                                      <div className="flex flex-col gap-1 shrink-0 justify-center min-w-40 font-mono">
                                        <span className="text-[8px] text-neutral-500 font-bold uppercase">Assign Owner Override:</span>
                                        <select
                                          value={stepOverride.owner || ""}
                                          onChange={(e) => {
                                            const opt = e.target.selectedOptions[0];
                                            const name = opt ? opt.text : "";
                                            handleOwnerOverrideChange(plan._id, step.stepNumber, e.target.value, name);
                                          }}
                                          className="px-2 py-1 bg-[#0c101b] border border-[#1e2533] rounded text-[9px] text-neutral-300 outline-none hover:border-[#06b6d4] transition-all"
                                        >
                                          <option value="">-- Select Contributor --</option>
                                          {contributors.map(c => (
                                            <option key={c.actorName} value={c.actorName}>
                                              {c.actorName}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Completed Run Metadata */}
                            {isDone && plan.rollbackMetadata && (
                              <div className="space-y-3 p-3.5 bg-black/20 border border-[#1e2533] rounded-xl">
                                <p className="text-[8.5px] font-bold uppercase text-neutral-400">Execution Performance Logs:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[9.5px]">
                                  <div>
                                    <span className="text-neutral-500">Latency:</span> <span className="font-bold text-neutral-200">{plan.executionLatencyMs}ms</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">Result:</span> <span className="font-bold text-emerald-400 uppercase">{plan.executionResult}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">Committed By:</span> <span className="font-bold text-neutral-300">{plan.structuredAuditLogs[plan.structuredAuditLogs.length - 1]?.actorName}</span>
                                  </div>
                                </div>
                                
                                {/* Operations listing */}
                                {plan.executionDetails && plan.executionDetails.executionOperations && plan.executionDetails.executionOperations.length > 0 && (
                                  <div className="space-y-1.5 pt-2 border-t border-[#1e2533]/50">
                                    <span className="text-[8px] font-bold text-neutral-500 uppercase">Rollback operations trace:</span>
                                    <div className="space-y-1 text-[8.5px] font-mono text-neutral-500">
                                      {plan.executionDetails.executionOperations.map((op: any, i: number) => (
                                        <div key={i} className="flex gap-2">
                                          <span>[{new Date(op.timestamp).toLocaleTimeString()}]</span>
                                          <span className="text-cyan-400">{op.operation}</span>
                                          <span>→ Entity ID:</span> <span className="text-neutral-300 font-bold">{op.entityId}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Failure log detail */}
                            {isFailed && plan.executionDetails && plan.executionDetails.entitiesFailed && (
                              <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1 text-[9.5px]">
                                <span className="font-bold text-rose-400 uppercase">Failure audit logs:</span>
                                {plan.executionDetails.entitiesFailed.map((f: any, i: number) => (
                                  <p key={i} className="text-rose-400/90 font-mono">
                                    [Step {f.stepNumber}] Error: {f.error}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Execution Decision Actions */}
                            {isPending && (
                              <div className="p-4 bg-[#0c101b] border border-[#06b6d4]/20 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="text-[9px] font-black uppercase text-[#06b6d4]">Execution Guard Approved</p>
                                  <p className="text-[8.5px] text-neutral-500 font-mono mt-0.5">
                                    This plan matches all safety verification limits. Click Execute to deploy.
                                  </p>
                                </div>
                                
                                <button
                                  onClick={() => handleExecutePlan(plan._id)}
                                  disabled={isRunning}
                                  className="px-5 py-2.5 bg-[#06b6d4] text-[#080a0f] font-black uppercase text-[10px] rounded-xl hover:bg-[#06b6d4]/90 transition-all shadow-lg shrink-0 disabled:opacity-50"
                                >
                                  {isRunning ? "Executing..." : "🚀 Execute Action Plan"}
                                </button>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 8: WORKFLOW CENTER (Phase 12) */}
        {activeTab === "workflow-center" && (
          <div className="space-y-6">
            
            {/* Workflow Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Gauges Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-around gap-6">
                
                {/* Completion Rate Gauge */}
                <div className="flex flex-col items-center justify-center relative">
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono mb-2">
                    Workflow Success Rate
                  </span>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#161b26" strokeWidth="8" strokeDasharray="125 250" strokeLinecap="round" transform="rotate(135 50 50)" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${((workflowMetrics?.workflowCompletionRate ?? 0) / 100) * 125} 250`} strokeLinecap="round" transform="rotate(135 50 50)" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold font-mono text-emerald-400">{workflowMetrics?.workflowCompletionRate ?? 0}%</span>
                    </div>
                  </div>
                </div>

                {/* Failure Rate Gauge */}
                <div className="flex flex-col items-center justify-center relative">
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono mb-2">
                    Workflow Failure Rate
                  </span>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#161b26" strokeWidth="8" strokeDasharray="125 250" strokeLinecap="round" transform="rotate(135 50 50)" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f43f5e" strokeWidth="8" strokeDasharray={`${((workflowMetrics?.workflowFailureRate ?? 0) / 100) * 125} 250`} strokeLinecap="round" transform="rotate(135 50 50)" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold font-mono text-rose-400">{workflowMetrics?.workflowFailureRate ?? 0}%</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Performance Stats Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 flex flex-col justify-center">
                <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono mb-3 block">
                  Average Execution Duration
                </span>
                <div className="text-2xl font-black font-mono text-[#06b6d4]">
                  {Math.round((workflowMetrics?.averageDurationMs ?? 0) / 1000)}s
                </div>
                <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1 font-mono">
                  From generation to final state commit
                </p>
              </div>

              {/* Success By Trigger Type Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-3">
                <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-[#f5a623]" />
                  <span>Success By Trigger Type</span>
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                  {Object.entries(workflowMetrics?.successByTriggerType || {}).map(([trigger, stats]: [string, any]) => (
                    <div key={trigger} className="flex justify-between border-b border-[#1e2533]/50 pb-1">
                      <span className="text-neutral-500 uppercase">{trigger.replace(/_/g, " ")}</span>
                      <span className="text-neutral-300 font-bold">
                        {stats.success} / {stats.success + stats.failed}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Double Column Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Workflow Definitions / Templates */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e2533] pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5">
                    <Workflow className="w-4 h-4" />
                    <span>Workflow Templates</span>
                  </span>
                </div>

                <div className="space-y-3">
                  {workflows.map(wf => {
                    const isSimulating = showWorkflowSimulator === wf._id;
                    
                    // Simple programmatic estimates mapping for built-in template simulator panel
                    const estPlans = wf.steps.filter((s: any) => s.actionType === "generate_action_plan").length;
                    const estExecs = wf.steps.filter((s: any) => s.actionType === "execute_action_plan").length;
                    const estAppros = wf.steps.filter((s: any) => s.actionType === "request_approval").length;
                    const estComp = estAppros * 5 + estPlans * 10 + estExecs * 20;

                    return (
                      <div key={wf._id} className="p-4 bg-[#0e1117] border border-[#1e2533] hover:border-neutral-700 rounded-xl space-y-3 transition-all font-mono text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-neutral-200 truncate">{wf.name}</h4>
                            <span className="text-[8px] font-extrabold uppercase text-[#f5a623] bg-[#f5a623]/5 border border-[#f5a623]/20 px-1.5 py-0.2 rounded mt-1 inline-block">
                              Trigger: {wf.trigger.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleStartWorkflowManual(wf._id)}
                            disabled={manuallyStartingWorkflowId === wf._id}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 font-bold rounded-lg uppercase text-[8.5px] transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            {manuallyStartingWorkflowId === wf._id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              "🚀 Launch"
                            )}
                          </button>
                        </div>

                        <p className="text-[10px] text-neutral-400 font-sans leading-snug">{wf.description}</p>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[9px] text-neutral-500 font-bold">{wf.steps.length} Steps Orchestrated</span>
                          <button
                            onClick={() => setShowWorkflowSimulator(isSimulating ? null : wf._id)}
                            className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold uppercase transition-all"
                          >
                            {isSimulating ? "Close Simulator" : "📊 Simulate Run"}
                          </button>
                        </div>

                        {/* Simulator panel details */}
                        {isSimulating && (
                          <div className="p-3 bg-black/40 border border-[#06b6d4]/20 rounded-xl space-y-2 text-[9px] leading-relaxed">
                            <span className="font-black uppercase text-[#06b6d4] block">Workflow Simulator Estimates:</span>
                            <div className="grid grid-cols-2 gap-2 text-neutral-400">
                              <div>
                                • Spawned Action Plans: <span className="font-bold text-neutral-200">{estPlans}</span>
                              </div>
                              <div>
                                • Executions Required: <span className="font-bold text-neutral-200">{estExecs}</span>
                              </div>
                              <div>
                                • Human Approvals: <span className="font-bold text-neutral-200">{estAppros}</span>
                              </div>
                              <div>
                                • Complexity Rating: <span className="font-bold text-[#f5a623]">{estComp}</span>
                              </div>
                            </div>
                            <div className="text-neutral-500 pt-1 border-t border-[#1e2533]/50">
                              Estimated Duration: <span className="text-neutral-300 font-bold">{estAppros > 0 ? "Awaiting human (hours)" : "Automatic (~60s)"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Middle/Right Column: Workflow Runs */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#1e2533] pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-[#06b6d4] font-mono flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#06b6d4]" />
                    <span>Workflow Run Instances</span>
                  </span>

                  {/* Run status filter tabs */}
                  <div className="flex gap-1.5 flex-wrap">
                    {["all", "proposed", "active", "paused", "blocked", "completed", "failed"].map(status => (
                      <button
                        key={status}
                        onClick={() => setWorkflowRunStatusFilter(status)}
                        className={cn(
                          "text-[8px] font-extrabold px-2 py-0.5 rounded-md border uppercase transition-all font-mono",
                          workflowRunStatusFilter === status
                            ? "text-[#06b6d4] border-[#06b6d4]/40 bg-[#06b6d4]/10"
                            : "text-neutral-500 border-[#1e2533] hover:border-neutral-600"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {workflowRuns.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-xl select-none">
                    No matching workflow run instances logged.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflowRuns
                      .filter(r => workflowRunStatusFilter === "all" || r.status === workflowRunStatusFilter)
                      .map(run => {
                        const isExpanded = expandedWorkflowRunId === run._id;
                        const isRunningAction = workflowActionLoading === run._id;

                        const riskColor =
                          run.workflowRiskLevel === "critical" ? "text-rose-500 border-rose-500/20 bg-rose-500/5" :
                          run.workflowRiskLevel === "high" ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
                          run.workflowRiskLevel === "medium" ? "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" :
                          "text-emerald-400 border-emerald-400/20 bg-emerald-400/5";

                        return (
                          <div key={run._id} className="bg-[#0e1117] border border-[#1e2533] rounded-2xl overflow-hidden">
                            
                            <button
                              onClick={() => setExpandedWorkflowRunId(isExpanded ? null : run._id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/10 transition-all text-left"
                            >
                              <div className="min-w-0 space-y-1 font-mono">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn(
                                    "text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase border",
                                    run.status === "completed" && "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                                    run.status === "failed" && "text-rose-400 border-rose-500/30 bg-rose-500/10",
                                    run.status === "active" && "text-cyan-400 border-cyan-500/30 bg-cyan-500/10 animate-pulse",
                                    run.status === "proposed" && "text-[#f5a623] border-[#f5a623]/30 bg-[#f5a623]/10",
                                    run.status === "paused" && "text-amber-500 border-amber-500/30 bg-amber-500/10",
                                    run.status === "blocked" && "text-rose-500 border-rose-500/30 bg-rose-500/10"
                                  )}>
                                    {run.status}
                                  </span>
                                  <h4 className="text-xs font-bold text-neutral-200 truncate">{run.name}</h4>
                                </div>
                                
                                <div className="flex items-center gap-3 text-[8.5px] text-neutral-500 flex-wrap">
                                  <span>Risk: <span className={cn("px-1 py-0.1 border rounded text-[7.5px] font-bold uppercase", riskColor)}>{run.workflowRiskLevel}</span></span>
                                  {run.occurrenceCount > 1 && (
                                    <span className="text-[#f5a623] font-bold">⚡ Deduplicated Storm ({run.occurrenceCount}x)</span>
                                  )}
                                  <span>Fingerprint: <span className="font-bold text-neutral-600">{run.triggerFingerprint ? run.triggerFingerprint.slice(0, 10) : "n/a"}</span></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[8.5px] text-neutral-500 font-mono">
                                  {new Date(run.createdAt).toLocaleTimeString()}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-neutral-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                                )}
                              </div>
                            </button>

                            {/* Expanded Panel */}
                            {isExpanded && (
                              <div className="border-t border-[#1e2533] p-4 space-y-5 font-mono text-xs">
                                
                                {/* Blocked Validation Alert Banner */}
                                {run.status === "blocked" && (
                                  <div className="p-3 bg-rose-500/5 border border-rose-500/20 text-rose-400 rounded-xl text-[9.5px] flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold">❌ Activation Blocked by safety guard:</span>
                                      <p className="mt-1 text-neutral-400">
                                        {run.logs.find((l: any) => l.severity === "error")?.message || "Entity existence or risk check bounds violated."}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Steps listing vertical timeline */}
                                <div className="space-y-3">
                                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Orchestrated Steps Progress</p>
                                  <div className="space-y-2">
                                    {run.steps.map((step: any, idx: number) => {
                                      const isPendingStep = step.status === "pending";
                                      const isRunningStep = step.status === "running";
                                      const isCompletedStep = step.status === "completed";
                                      const isFailedStep = step.status === "failed";
                                      const isAwaitingApproval = step.actionType === "request_approval" && run.status === "paused" && run.currentStepIndex === idx;

                                      return (
                                        <div key={idx} className="flex justify-between items-start p-3 bg-black/20 border border-[#1e2533] rounded-xl gap-3">
                                          <div className="flex gap-2">
                                            <div className={cn(
                                              "w-5 h-5 rounded-full border text-[8px] font-black flex items-center justify-center shrink-0 mt-0.5",
                                              isCompletedStep ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                                              isRunningStep ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 animate-spin" :
                                              isFailedStep ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
                                              "border-neutral-700 bg-neutral-800/20 text-neutral-500"
                                            )}>
                                              {isCompletedStep ? "✓" : isRunningStep ? "⚙" : isFailedStep ? "✗" : step.stepNumber}
                                            </div>
                                            <div>
                                              <span className="text-[8.5px] font-extrabold uppercase text-neutral-400 bg-[#1e2533] px-1.5 py-0.2 rounded inline-block mb-1">
                                                {step.actionType.replace(/_/g, " ")}
                                              </span>
                                              <pre className="text-[9px] text-neutral-500 font-mono overflow-x-auto max-w-full">
                                                {JSON.stringify(step.params, null, 2)}
                                              </pre>
                                              {step.actionPlanId && (
                                                <div className="mt-1 text-[8.5px] text-neutral-400">
                                                  Linked Action Plan ID: <span className="text-cyan-400 font-bold">{step.actionPlanId}</span>
                                                </div>
                                              )}
                                              {step.error && (
                                                <div className="text-[8.5px] text-rose-400 font-bold mt-1">
                                                  Error: {step.error}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Step action buttons (e.g. approve request_approval step) */}
                                          {isAwaitingApproval && (
                                            <button
                                              onClick={() => handleWorkflowRunAction(run._id, "approve_step", step.stepNumber)}
                                              disabled={isRunningAction}
                                              className="px-2 py-1 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-bold uppercase rounded-lg text-[8.5px] transition-all"
                                            >
                                              Approve Step
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Controls Actions Panel */}
                                <div className="p-4 bg-[#0c101b] border border-[#06b6d4]/20 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-[#06b6d4]">Human Controls Operator</p>
                                    <p className="text-[8.5px] text-neutral-500">
                                      AI agents are strictly blocked. Actions below require human credentials.
                                    </p>
                                  </div>

                                  <div className="flex gap-2">
                                    {run.status === "proposed" && (
                                      <>
                                        <button
                                          onClick={() => handleWorkflowRunAction(run._id, "reject")}
                                          disabled={isRunningAction}
                                          className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 text-rose-400 font-bold uppercase rounded-xl text-[9px] transition-all disabled:opacity-50"
                                        >
                                          Reject Proposal
                                        </button>
                                        <button
                                          onClick={() => handleWorkflowRunAction(run._id, "approve")}
                                          disabled={isRunningAction}
                                          className="px-3 py-1.5 bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f] font-bold uppercase rounded-xl text-[9px] transition-all disabled:opacity-50"
                                        >
                                          Approve Proposal
                                        </button>
                                      </>
                                    )}

                                    {(run.status === "approved" || run.status === "blocked") && (
                                      <button
                                        onClick={() => handleWorkflowRunAction(run._id, "activate")}
                                        disabled={isRunningAction}
                                        className="px-4 py-1.5 bg-emerald-500 text-black font-extrabold uppercase rounded-xl text-[9px] hover:bg-emerald-400 transition-all disabled:opacity-50"
                                      >
                                        Activate/Run Workflow
                                      </button>
                                    )}

                                    {run.status === "active" && (
                                      <button
                                        onClick={() => handleWorkflowRunAction(run._id, "pause")}
                                        disabled={isRunningAction}
                                        className="px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-extrabold uppercase rounded-xl text-[9px] transition-all disabled:opacity-50"
                                      >
                                        Pause Execution
                                      </button>
                                    )}

                                    {run.status === "paused" && (
                                      <button
                                        onClick={() => handleWorkflowRunAction(run._id, "resume")}
                                        disabled={isRunningAction}
                                        className="px-4 py-1.5 bg-emerald-500 text-black font-extrabold uppercase rounded-xl text-[9px] hover:bg-emerald-400 transition-all disabled:opacity-50"
                                      >
                                        Resume Execution
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Logs Trail Scrollbox */}
                                <div className="space-y-2">
                                  <p className="text-[9px] font-bold text-neutral-400 uppercase">Workflow Execution Logs</p>
                                  <div className="p-3 bg-black/30 border border-[#1e2533] rounded-xl max-h-40 overflow-y-auto space-y-1.5 text-[8.5px] leading-relaxed">
                                    {run.logs.map((log: any, lIdx: number) => {
                                      const logColor =
                                        log.severity === "error" ? "text-rose-400" :
                                        log.severity === "warn" ? "text-amber-400" :
                                        "text-neutral-400";
                                      return (
                                        <div key={lIdx} className="flex gap-2 font-mono">
                                          <span className="text-neutral-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                          <span className={logColor}>{log.message}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 9: AGENT CENTER (Phase 13) */}
        {activeTab === "agent-center" && (
          <div className="space-y-6">
            
            {/* Header / Summary stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Leaderboard Summary Card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono block mb-1">
                    Agent Grid Telemetry
                  </span>
                  <h3 className="text-sm font-black text-neutral-200 uppercase font-mono tracking-wider">
                    Agent Health status
                  </h3>
                </div>
                <div className="flex justify-between items-center mt-4 text-xs font-mono">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Active Agents</span>
                    <span className="text-lg font-black text-emerald-400">
                      {agents.filter(a => a.status === "active").length} / {agents.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Proposals Gen</span>
                    <span className="text-lg font-black text-cyan-400">
                      {agents.reduce((acc, a) => acc + (a.metrics?.proposalsGenerated ?? 0), 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase">Avg Confidence</span>
                    <span className="text-lg font-black text-purple-400">
                      {(() => {
                        const totalGen = agents.reduce((acc, a) => acc + (a.metrics?.proposalsGenerated ?? 0), 0);
                        const totalConf = agents.reduce((acc, a) => acc + (a.metrics?.totalConfidence ?? 0), 0);
                        return totalGen > 0 ? `${Math.round((totalConf / totalGen) * 100)}%` : "0%";
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Health Index gauge */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 flex items-center justify-around">
                <div className="flex flex-col items-center justify-center relative">
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono mb-2">
                    Agent Success Rate
                  </span>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-20 h-20" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#161b26" strokeWidth="8" strokeDasharray="125 250" strokeLinecap="round" transform="rotate(135 50 50)" />
                      {(() => {
                        const totalSuccess = agents.reduce((acc, a) => acc + (a.metrics?.workflowSuccessCount ?? 0), 0);
                        const totalFailure = agents.reduce((acc, a) => acc + (a.metrics?.workflowFailureCount ?? 0), 0);
                        const rate = (totalSuccess + totalFailure) > 0 ? Math.round((totalSuccess / (totalSuccess + totalFailure)) * 100) : 100;
                        return (
                          <>
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#a855f7" strokeWidth="8" strokeDasharray={`${(rate / 100) * 125} 250`} strokeLinecap="round" transform="rotate(135 50 50)" className="transition-all duration-1000 ease-out" />
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-base font-extrabold font-mono text-purple-400">{rate}%</span>
                            </div>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col justify-center max-w-[50%]">
                  <p className="text-[9px] font-bold uppercase text-purple-400">Platform Quality</p>
                  <p className="text-[8.5px] text-neutral-500 mt-1 leading-snug">
                    Cumulative success rate of agent-generated workflow runs executing through the Phase 11 safety engine.
                  </p>
                </div>
              </div>

              {/* Active Leaderboard card */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono block mb-1">
                    Agent Standings
                  </span>
                  <h3 className="text-sm font-black text-neutral-200 uppercase font-mono tracking-wider">
                    Leaderboard
                  </h3>
                </div>
                <div className="space-y-1.5 mt-3">
                  {[...agents]
                    .sort((a, b) => (b.metrics?.proposalEffectivenessScore ?? 0) - (a.metrics?.proposalEffectivenessScore ?? 0))
                    .slice(0, 3)
                    .map((agent, index) => (
                      <div key={agent.id} className="flex justify-between items-center text-[9px] font-mono border-b border-[#1e2533]/50 pb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-neutral-500 font-extrabold">#{index+1}</span>
                          <span className="text-neutral-300 font-black truncate">{agent.name}</span>
                        </div>
                        <span className="text-purple-400 font-black shrink-0">
                          {agent.metrics?.proposalEffectivenessScore ?? 0} pts
                        </span>
                      </div>
                    ))}
                </div>
              </div>

            </div>

            {/* Agent registry grid */}
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                <Sparkles className="w-4 h-4" />
                <span>Specialized Autonomous Agent Registry</span>
              </span>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {agents.map(agent => {
                  const isUpdating = updatingAgentId === agent.id;
                  const isTriggering = triggeringAgentId === agent.id;
                  const isActive = agent.status === "active";

                  // Calculate stats
                  const appCount = agent.metrics?.proposalsApproved ?? 0;
                  const rejCount = agent.metrics?.proposalsRejected ?? 0;
                  const totalDecided = appCount + rejCount;
                  const appRate = totalDecided > 0 ? Math.round((appCount / totalDecided) * 100) : 0;

                  const successCount = agent.metrics?.workflowSuccessCount ?? 0;
                  const failCount = agent.metrics?.workflowFailureCount ?? 0;
                  const totalRuns = successCount + failCount;
                  const runSuccessRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;

                  return (
                    <div key={agent.id} className={cn(
                      "bg-[#0e1117] border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300",
                      isActive ? "border-[#1e2533] hover:border-purple-500/20" : "border-neutral-800/60 opacity-60"
                    )}>
                      {/* Name / Switch */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-extrabold text-[#f1f5f9] tracking-wider uppercase font-mono">
                              {agent.name}
                            </h4>
                            <span className={cn(
                              "text-[7.5px] font-black uppercase px-1 py-0.2 rounded border",
                              isActive ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-rose-400 border-rose-500/20 bg-rose-500/5"
                            )}>
                              {agent.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                            {agent.description}
                          </p>
                        </div>

                        {/* Toggle switch */}
                        <button
                          onClick={() => handleToggleAgent(agent.id, agent.status)}
                          disabled={isUpdating}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                            isActive ? "bg-purple-500" : "bg-neutral-800"
                          )}
                        >
                          <span className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            isActive ? "translate-x-4" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      {/* Capabilities */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase text-neutral-500 font-mono">Capabilities:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.capabilities.map((cap: string, i: number) => (
                            <span key={i} className="text-[8.5px] font-mono bg-[#161b26] border border-[#1e2533] text-neutral-400 px-2 py-0.5 rounded-lg">
                              {cap.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Overrides / Risk Override Dropdown */}
                      <div className="flex items-center gap-4 justify-between pt-3 border-t border-[#1e2533]/50">
                        <div className="flex items-center gap-2 font-mono text-[9px]">
                          <span className="text-neutral-500 uppercase">Risk Level:</span>
                          <select
                            value={agent.riskLevel}
                            disabled={!isActive || isUpdating}
                            onChange={(e) => handleChangeAgentRisk(agent.id, e.target.value)}
                            className="bg-[#0c101b] border border-[#1e2533] text-neutral-300 font-black uppercase rounded-lg px-2 py-1 outline-none focus:border-purple-500/30 text-[9px] outline-none disabled:opacity-40"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <span className="text-neutral-600 text-[8px]">Min: {agent.minimumRiskLevel.toUpperCase()}</span>
                        </div>

                        {/* Run analysis propose button */}
                        <button
                          onClick={() => handleTriggerAgentPropose(agent.id)}
                          disabled={!isActive || isTriggering}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold uppercase rounded-xl text-[9px] shadow-lg hover:shadow-purple-500/10 transition-all disabled:opacity-30 disabled:hover:shadow-none"
                        >
                          {isTriggering ? "Triggering Analysis..." : "⚡ Run Analysis"}
                        </button>
                      </div>

                      {/* Stats Block */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/10 border border-[#1e2533]/50 rounded-xl p-3 text-[9px] font-mono leading-none">
                        <div>
                          <span className="text-neutral-500 block text-[8px] uppercase mb-1">Generated</span>
                          <span className="font-bold text-neutral-300">{agent.metrics?.proposalsGenerated ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[8px] uppercase mb-1">Approval Rate</span>
                          <span className="font-bold text-neutral-300">{appRate}%</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[8px] uppercase mb-1">Run Success</span>
                          <span className="font-bold text-neutral-300">{runSuccessRate}%</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[8px] uppercase mb-1">Effectiveness</span>
                          <span className="font-bold text-purple-400">{agent.metrics?.proposalEffectivenessScore ?? 0} pts</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Proposed workflow runs list with explainability */}
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                <Workflow className="w-4 h-4" />
                <span>Proposed Agent Workflows & Decision Portal</span>
              </span>

              {(() => {
                const agentProposals = workflowRuns.filter(r => r.status === "proposed" && r.proposedByAgentId);
                if (agentProposals.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-2xl select-none">
                      No active workflow proposals generated by agents are awaiting review.
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {agentProposals.map(run => {
                      const isRunningAction = workflowActionLoading === run._id;
                      const hasCriticalRisk = run.workflowRiskLevel === "critical";

                      return (
                        <div key={run._id} className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4 font-mono text-xs">
                          {/* Top Header */}
                          <div className="flex justify-between items-start gap-4 flex-wrap pb-3 border-b border-[#1e2533]/50">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-purple-500/20 bg-purple-500/10 text-purple-400">
                                  {run.proposedByAgentId} agent
                                </span>
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded border",
                                  hasCriticalRisk ? "border-rose-500/30 bg-rose-500/10 text-rose-400 animate-pulse" :
                                  run.workflowRiskLevel === "high" ? "border-amber-500/20 bg-amber-500/5 text-amber-400" :
                                  "border-neutral-700 bg-neutral-800/10 text-neutral-400"
                                )}>
                                  {run.workflowRiskLevel} risk
                                </span>
                                <span className="font-extrabold text-neutral-200 uppercase text-xs">
                                  {run.name}
                                </span>
                              </div>
                              <p className="text-[9px] text-neutral-500 uppercase mt-1">
                                Generated: {new Date(run.firstTriggeredAt).toLocaleString()}
                              </p>
                            </div>

                            {/* Confidence rating badge */}
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-black uppercase text-neutral-500">Confidence</span>
                              <span className="text-sm font-black text-purple-400 mt-0.5">
                                {Math.round((run.agentExplainability?.confidence ?? 0.5) * 100)}%
                              </span>
                            </div>
                          </div>

                          {/* Explainability Block */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                            
                            {/* Reasoning */}
                            <div className="md:col-span-2 space-y-1.5">
                              <span className="text-[8.5px] font-black uppercase text-neutral-500">Agent Reasoning:</span>
                              <div className="p-3.5 bg-black/30 border border-[#1e2533] rounded-xl text-[10px] text-neutral-300 leading-relaxed italic">
                                "{run.agentExplainability?.reasoning || "No detailed reasoning supplied."}"
                              </div>
                            </div>

                            {/* Confidence breakdown details */}
                            <div className="space-y-1.5">
                              <span className="text-[8.5px] font-black uppercase text-neutral-500">Confidence Breakdown:</span>
                              <div className="p-3 bg-black/10 border border-[#1e2533]/50 rounded-xl space-y-2 text-[9px]">
                                <div className="flex justify-between items-center">
                                  <span className="text-neutral-500">Evidence Count:</span>
                                  <span className="font-bold text-neutral-300">
                                    {run.agentExplainability?.confidenceBreakdown?.sourceCount ?? 0}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-neutral-500">Graph Evidence:</span>
                                  <span className={cn(
                                    "font-bold",
                                    run.agentExplainability?.confidenceBreakdown?.graphEvidence ? "text-emerald-400" : "text-neutral-500"
                                  )}>
                                    {run.agentExplainability?.confidenceBreakdown?.graphEvidence ? "Verified" : "None"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-neutral-500">Rule Agreement:</span>
                                  <span className={cn(
                                    "font-bold",
                                    run.agentExplainability?.confidenceBreakdown?.ruleAgreement ? "text-emerald-400" : "text-neutral-500"
                                  )}>
                                    {run.agentExplainability?.confidenceBreakdown?.ruleAgreement ? "Agreed" : "None"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-neutral-500">Agent Effectiveness:</span>
                                  <span className="font-bold text-neutral-300">
                                    {run.agentExplainability?.confidenceBreakdown?.historicalEffectiveness ?? 0} pts
                                  </span>
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Source Context tags */}
                          <div className="flex flex-wrap gap-4 pt-1">
                            {run.agentExplainability?.sourceEntities && run.agentExplainability.sourceEntities.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-neutral-500 block">Source Entities:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {run.agentExplainability.sourceEntities.map((ent: string, i: number) => (
                                    <span key={i} className="text-[8px] bg-neutral-900 border border-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-sans">
                                      node: {ent}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {run.agentExplainability?.sourceRisks && run.agentExplainability.sourceRisks.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-neutral-500 block">Source Risks:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {run.agentExplainability.sourceRisks.map((risk: string, i: number) => (
                                    <span key={i} className="text-[8px] bg-rose-950/20 border border-rose-500/20 text-rose-400 px-1.5 py-0.2 rounded font-sans">
                                      {risk}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Steps overview */}
                          <div className="space-y-2">
                            <span className="text-[8.5px] font-black uppercase text-neutral-500">Planned Sequence Steps:</span>
                            <div className="space-y-2">
                              {run.steps.map((step: any) => (
                                <div key={step.stepNumber} className="flex gap-3 items-start p-3 bg-black/10 border border-[#1e2533]/50 rounded-xl">
                                  <div className="w-5 h-5 rounded-full border border-neutral-700 bg-neutral-800/20 text-neutral-500 text-[8.5px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                    {step.stepNumber}
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-extrabold uppercase text-neutral-400 bg-[#1e2533] px-1.5 py-0.2 rounded inline-block mb-1">
                                      {step.actionType.replace(/_/g, " ")}
                                    </span>
                                    <pre className="text-[9px] text-neutral-500 font-mono overflow-x-auto max-w-full">
                                      {JSON.stringify(step.params, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Critical Acknowledgment Checkbox */}
                          {hasCriticalRisk && (
                            <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2.5">
                              <p className="text-[9px] font-bold text-rose-400 uppercase leading-snug flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 animate-pulse" />
                                <span>Critical Action Risk Alert</span>
                              </p>
                              <p className="text-[8.5px] text-neutral-400 leading-relaxed font-sans">
                                This agent proposal involves critical system modifications or exceeds risk limits. Human operators are required to explicitly acknowledge the proposal's risk scope before approving.
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`ack-${run._id}`}
                                  checked={!!acknowledgeCritical[run._id]}
                                  onChange={(e) => setAcknowledgeCritical(prev => ({ ...prev, [run._id]: e.target.checked }))}
                                  className="rounded border-[#1e2533] bg-[#0c101b] text-purple-500 focus:ring-0 w-3.5 h-3.5"
                                />
                                <label htmlFor={`ack-${run._id}`} className="text-[8.5px] text-[#f1f5f9] font-bold uppercase select-none cursor-pointer">
                                  I acknowledge the critical risk of this agent-proposed workflow.
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Approval / Rejection Controls Panel */}
                          <div className="p-4 bg-[#0c101b] border border-[#1e2533] rounded-xl flex items-center justify-between gap-4 flex-wrap">
                            <div>
                              <p className="text-[9px] font-black uppercase text-[#06b6d4]">Human Decision Portal</p>
                              <p className="text-[8.5px] text-neutral-500">
                                Prohibited for autonomous agents. Decisive actions require human credentials.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleWorkflowRunAction(run._id, "reject")}
                                disabled={isRunningAction}
                                className="px-4 py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 text-rose-400 font-bold uppercase rounded-xl text-[9px] transition-all disabled:opacity-50"
                              >
                                Reject Proposal
                              </button>
                              <button
                                onClick={() => handleWorkflowRunAction(run._id, "approve")}
                                disabled={isRunningAction || (hasCriticalRisk && !acknowledgeCritical[run._id])}
                                className={cn(
                                  "px-5 py-2.5 font-black uppercase rounded-xl text-[9px] transition-all shadow-lg shrink-0 disabled:opacity-30",
                                  hasCriticalRisk && acknowledgeCritical[run._id] ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/30" : "bg-[#f5a623] hover:bg-[#f5a623]/90 text-[#080a0f]"
                                )}
                              >
                                Approve Proposal
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* TAB 8: HIVEMIND CONVERSATIONAL CHAT CENTER (Phase 14) */}
        {activeTab === "chat-center" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Chat log and input */}
            <div className="lg:col-span-2 bg-[#0e1117] border border-[#1e2533] rounded-2xl flex flex-col justify-between h-[650px]">
              {/* Header with Mode Selector */}
              <div className="p-4 border-b border-[#1e2533] flex justify-between items-center bg-black/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-black text-neutral-200 uppercase font-mono tracking-wider">
                    HiveMind Chat Center
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="text-neutral-500">Perspective:</span>
                  <select
                    value={chatMode}
                    onChange={(e: any) => setChatMode(e.target.value)}
                    className="bg-black border border-[#1e2533] text-purple-400 font-extrabold rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                  >
                    <option value="analyst">Project Analyst</option>
                    <option value="architect">Architect</option>
                    <option value="product">Product Strategist</option>
                    <option value="risk">Risk Analyst</option>
                  </select>
                </div>
              </div>

              {/* Chat Message Box */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
                {chatMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      onClick={() => !isUser && msg.id !== "welcome" && setActiveMessageId(msg.id)}
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-2xl p-4 cursor-pointer transition-all duration-200",
                        isUser 
                          ? "bg-purple-600/15 border border-purple-500/20 text-neutral-100 self-end rounded-tr-none ml-auto" 
                          : "bg-[#161b26] border border-[#1e2533] text-neutral-300 self-start rounded-tl-none mr-auto",
                        activeMessageId === msg.id && !isUser && "border-purple-500 ring-1 ring-purple-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-[#1e2533]/40 pb-1.5 mb-2 text-[9px] font-mono uppercase text-neutral-500 select-none">
                        <span>{isUser ? "User" : "HiveMind"}</span>
                        {!isUser && msg.response?.explainability?.reasoning && (
                          <span className="text-purple-400 font-extrabold">Inspect Details</span>
                        )}
                      </div>
                      <div className="prose prose-invert prose-xs leading-relaxed whitespace-pre-wrap select-text font-sans text-neutral-200">
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-neutral-500 font-mono text-[10px] self-start py-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                    <span>HiveMind is compiling analysis...</span>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-[#1e2533] bg-black/10 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  placeholder="Ask a question about health index, architecture cycles, or unassigned tasks..."
                  className="flex-1 bg-black border border-[#1e2533] rounded-xl px-4 py-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-mono text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-xl transition-all duration-200"
                >
                  Ask
                </button>
              </form>
            </div>

            {/* Right 1 Column: Citations, Suggestions & Telemetry */}
            <div className="space-y-6">
              {/* Citations & Related Entities box for active message */}
              {(() => {
                const activeMsg = chatMessages.find(m => m.id === activeMessageId);
                const resp = activeMsg?.response;
                const citNodes = resp?.citations?.nodes || [];
                const citDocs = resp?.citations?.documents || [];
                const citWfs = resp?.citations?.workflows || [];
                const reasoning = resp?.reasoning || resp?.explainability?.reasoning || "";
                const evidence = resp?.evidence || "";
                const totalCits = citNodes.length + citDocs.length + citWfs.length;

                return (
                  <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                    <div>
                      <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono block mb-1">
                        Active Response Details
                      </span>
                      <h4 className="text-xs font-extrabold text-neutral-200 uppercase font-mono tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        <span>Citations & Evidence</span>
                      </h4>
                    </div>

                    {reasoning && (
                      <div className="text-[10px] font-mono bg-black/20 border border-[#1e2533] rounded-xl p-3 space-y-1">
                        <span className="text-purple-400 font-black uppercase text-[8px] block">Reasoning:</span>
                        <p className="text-neutral-400 leading-normal">{reasoning}</p>
                      </div>
                    )}

                    {evidence && (
                      <div className="text-[10px] font-mono bg-black/20 border border-[#1e2533] rounded-xl p-3 space-y-1">
                        <span className="text-emerald-400 font-black uppercase text-[8px] block">Evidence Summary:</span>
                        <p className="text-neutral-400 leading-normal">{evidence}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <span className="text-[9px] font-extrabold uppercase text-neutral-500 font-mono block border-b border-[#1e2533]/50 pb-1.5">
                        References Sources ({totalCits})
                      </span>

                      {totalCits === 0 ? (
                        <p className="text-[9.5px] font-mono text-neutral-500 italic">
                          No citations resolved for this response.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {citNodes.map((nId: string) => (
                            <div key={nId} className="flex justify-between items-center bg-[#161b26]/50 border border-[#1e2533]/40 rounded-lg p-2 text-[9.5px] font-mono">
                              <span className="text-purple-400 font-bold">@Node:</span>
                              <span className="text-neutral-300 font-extrabold truncate max-w-[140px]">{nId}</span>
                            </div>
                          ))}
                          {citDocs.map((dId: string) => (
                            <div key={dId} className="flex justify-between items-center bg-[#161b26]/50 border border-[#1e2533]/40 rounded-lg p-2 text-[9.5px] font-mono">
                              <span className="text-emerald-400 font-bold">#Doc:</span>
                              <span className="text-neutral-300 font-extrabold truncate max-w-[140px]">{dId}</span>
                            </div>
                          ))}
                          {citWfs.map((wId: string) => (
                            <div key={wId} className="flex justify-between items-center bg-[#161b26]/50 border border-[#1e2533]/40 rounded-lg p-2 text-[9.5px] font-mono">
                              <span className="text-amber-400 font-bold">⚙ Workflow:</span>
                              <span className="text-neutral-300 font-extrabold truncate max-w-[140px]">{wId}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Suggested Actions box for active message */}
              {(() => {
                const activeMsg = chatMessages.find(m => m.id === activeMessageId);
                const suggestions = activeMsg?.response?.suggestedActions || [];

                return (
                  <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                    <div>
                      <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono block mb-1">
                        Workspace Actions
                      </span>
                      <h4 className="text-xs font-extrabold text-neutral-200 uppercase font-mono tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        <span>Suggested Actions</span>
                      </h4>
                    </div>

                    {suggestions.length === 0 ? (
                      <p className="text-[9.5px] font-mono text-neutral-500 italic">
                        No suggested actions compiled.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {suggestions.map((action: any, idx: number) => (
                          <div key={idx} className="bg-black/35 border border-[#1e2533] rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                            <div>
                              <span className="text-[8px] font-black uppercase text-purple-400 font-mono">
                                {action.type.replace(/_/g, " ")}
                              </span>
                              <h5 className="text-[10px] font-black text-neutral-200 mt-0.5 leading-snug">
                                {action.title}
                              </h5>
                              <p className="text-[9px] text-neutral-500 mt-1 leading-relaxed">
                                {action.description}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAcceptChatSuggestion(activeMsg?.metricId, action)}
                              disabled={chatLoading}
                              className="w-full bg-[#161b26] hover:bg-[#1e2533] border border-[#1e2533] text-purple-400 hover:text-purple-300 text-[9px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all duration-200"
                            >
                              Trigger Action
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Chat Telemetry Metrics panel */}
              <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
                <div>
                  <span className="text-[8px] font-bold uppercase text-neutral-500 font-mono block mb-1">
                    System Telemetry
                  </span>
                  <h4 className="text-xs font-extrabold text-neutral-200 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span>Chat Intelligence Telemetry</span>
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3.5 text-center font-mono text-[9px] border-b border-[#1e2533]/40 pb-3">
                  <div className="bg-black/25 border border-[#1e2533]/50 rounded-xl p-2.5">
                    <span className="text-neutral-500 block mb-0.5">Latency</span>
                    <span className="text-base font-black text-purple-400 font-sans">
                      {chatMetrics?.averageLatencyMs ? (chatMetrics.averageLatencyMs / 1000).toFixed(1) : "0.0"}s
                    </span>
                  </div>
                  <div className="bg-black/25 border border-[#1e2533]/50 rounded-xl p-2.5">
                    <span className="text-neutral-500 block mb-0.5">Questions</span>
                    <span className="text-base font-black text-neutral-200 font-sans">
                      {chatMetrics?.questionsAsked ?? 0}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-[9.5px] font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Suggestion Acceptance Rate</span>
                    <span className="text-purple-400 font-black">
                      {chatMetrics?.suggestionAcceptanceRate ?? "0.0"}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Zod Schema Match Rate</span>
                    <span className="text-emerald-400 font-black">
                      {chatMetrics?.validationSuccessRate ?? "100.0"}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: LEGACY AGENT ACTIONS (Phase 9) */}
        {activeTab === "actions" && (
          <div className="space-y-6">
            
            <div className="bg-[#0e1117] border border-[#1e2533] rounded-2xl p-5 space-y-4">
              <span className="text-[10px] font-extrabold uppercase text-[#f5a623] font-mono flex items-center gap-1.5 border-b border-[#1e2533] pb-2.5">
                <Lock className="w-4 h-4" />
                <span>Agent actions approval portal (Phase 9 Legacy)</span>
              </span>

              {actions.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 italic font-mono bg-black/10 border border-dashed border-[#1e2533] rounded-xl select-none">
                  No proposed agent action proposals logged in system.
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map(action => {
                    const isPending = action.status === "pending_approval";
                    return (
                      <div key={action._id} className="p-4 bg-[#111420] border border-[#1e2533] rounded-xl flex flex-col md:flex-row justify-between gap-4 font-mono text-xs">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase border",
                              action.status === "approved" && "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                              action.status === "rejected" && "text-rose-400 border-rose-500/30 bg-rose-500/10",
                              isPending && "text-amber-500 border-amber-500/30 bg-amber-500/10",
                              action.status === "executed" && "text-purple-400 border-purple-500/30 bg-purple-500/10"
                            )}>
                              {action.status}
                            </span>
                            <span className="font-bold text-neutral-200">
                              {action.actionType.replace("_", " ").toUpperCase()}
                            </span>
                            <span className="text-[8.5px] text-neutral-500">
                              SUBMITTED: {new Date(action.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="p-2.5 bg-black/40 rounded-lg text-[9.5px] text-neutral-400 overflow-x-auto">
                            <pre className="font-mono">{JSON.stringify(action.params, null, 2)}</pre>
                          </div>
                          <div className="text-[8.5px] text-neutral-500 leading-snug">
                            <span className="font-bold text-neutral-600 block uppercase">Audit Trace:</span>
                            {action.auditLogs.map((log, i) => (
                              <div key={i}>• {log}</div>
                            ))}
                          </div>
                        </div>
                        {isPending && (
                          <div className="flex flex-col gap-2 shrink-0 justify-end md:w-56 font-mono text-[10px]">
                            <span className="text-neutral-500 font-bold uppercase text-[8.5px]">Enter Decision Notes:</span>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={(actionNotesInput ?? {})[action._id] || ""}
                              onChange={(e) => setActionNotesInput(prev => ({ ...(prev ?? {}), [action._id]: e.target.value }))}
                              className="px-2 py-1 border border-[#1e2533] bg-[#0c101b] rounded text-neutral-300 outline-none placeholder-neutral-600 w-full"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAgentActionResponse(action._id, "rejected")}
                                className="flex-1 py-1 bg-rose-900/30 border border-rose-500/30 text-rose-400 font-bold rounded hover:bg-rose-950/20"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleAgentActionResponse(action._id, "approved")}
                                className="flex-1 py-1 bg-[#f5a623] text-[#080a0f] font-bold rounded hover:bg-[#f5a623]/90"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
