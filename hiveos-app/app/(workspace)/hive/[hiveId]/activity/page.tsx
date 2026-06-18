"use client";

import React, { use, useEffect, useState } from "react";
import { useSocket } from "@/features/realtime/hooks/useSocket";
import { ConnectRepoModal } from "@/features/github/components/ConnectRepoModal";
import { Button } from "@/components/ui/button";
import { 
  GitBranch, 
  GitPullRequest, 
  GitMerge, 
  AlertCircle, 
  MessageSquare, 
  Terminal, 
  Link, 
  Unlink, 
  Loader2,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

interface SerializedHive {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  githubRepo?: {
    owner: string;
    repo: string;
    webhookSecret?: string;
    connectedAt: string;
    status: "connected" | "disconnected";
  };
}

interface ActivityEvent {
  id: string;
  hiveId: string;
  type: string;
  title: string;
  description?: string;
  actorName: string;
  actorAvatar?: string;
  timestamp: string;
}

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

export default function ActivityPage({ params }: PageProps) {
  const { hiveId } = use(params);
  const { socket, status: socketStatus } = useSocket();

  const [hive, setHive] = useState<SerializedHive | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [hiveRes, activityRes] = await Promise.all([
        fetch(`/api/hives/${hiveId}`),
        fetch(`/api/hives/${hiveId}/activity?limit=50`),
      ]);
      
      if (hiveRes.ok) {
        const hiveJson = await hiveRes.json();
        setHive(hiveJson.data);
      }
      
      if (activityRes.ok) {
        const activityJson = await activityRes.json();
        const data = activityJson.data || [];
        setActivities(data);
        setHasMore(data.length === 50);
      }
    } catch (err) {
      console.error("[Activity Feed] Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load more paginated activities
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || activities.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestActivity = activities[activities.length - 1];
      if (!oldestActivity) return;
      const oldestTimestamp = oldestActivity.timestamp;
      const res = await fetch(`/api/hives/${hiveId}/activity?limit=50&before=${encodeURIComponent(oldestTimestamp)}`);
      
      if (res.ok) {
        const json = await res.json();
        const newActivities = json.data || [];
        if (newActivities.length < 50) {
          setHasMore(false);
        }
        setActivities((prev) => {
          // Avoid duplicates
          const filtered = newActivities.filter(
            (na: ActivityEvent) => !prev.some((p) => p.id === na.id)
          );
          return [...prev, ...filtered];
        });
      }
    } catch (err) {
      console.error("[Activity Feed] Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hiveId]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleNewActivity = (activity: ActivityEvent) => {
      console.log("[Activity Feed] Received real-time activity:", activity);
      setActivities((prev) => [activity, ...prev]);
    };

    socket.on("activity:event", handleNewActivity);

    return () => {
      socket.off("activity:event", handleNewActivity);
    };
  }, [socket]);

  // Disconnect GitHub link
  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this repository? You will no longer receive live updates.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/hives/${hiveId}/github/link`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("[Activity Feed] Failed to disconnect repository:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  // Map event types to styling/badges
  const getEventMeta = (type: string) => {
    switch (type) {
      case "github_commit":
        return {
          label: "COMMIT",
          color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          icon: <GitBranch className="w-3.5 h-3.5" />,
        };
      case "github_pr_open":
        return {
          label: "PR_OPEN",
          color: "text-green-400 bg-green-500/10 border-green-500/20",
          icon: <GitPullRequest className="w-3.5 h-3.5" />,
        };
      case "github_pr_merge":
        return {
          label: "PR_MERGE",
          color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
          icon: <GitMerge className="w-3.5 h-3.5" />,
        };
      case "github_pr_close":
        return {
          label: "PR_CLOSED",
          color: "text-red-400 bg-red-500/10 border-red-500/20",
          icon: <GitPullRequest className="w-3.5 h-3.5" />,
        };
      case "github_issue_open":
        return {
          label: "ISSUE_OPEN",
          color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
          icon: <AlertCircle className="w-3.5 h-3.5" />,
        };
      case "github_issue_close":
        return {
          label: "ISSUE_CLOSED",
          color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
          icon: <AlertCircle className="w-3.5 h-3.5" />,
        };
      case "github_comment_create":
        return {
          label: "COMMENT",
          color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
          icon: <MessageSquare className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: "SYSTEM",
          color: "text-[#f5a623] bg-[#f5a623]/10 border-[#f5a623]/20",
          icon: <Terminal className="w-3.5 h-3.5" />,
        };
    }
  };

  const isConnected = hive?.githubRepo && hive.githubRepo.status === "connected";

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center bg-[#080a0f] text-[#94a3b8]">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#f5a623]" />
          <p className="text-sm">Loading activity feed console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-y-auto bg-[#080a0f] p-6 space-y-6 text-[#f1f5f9]">
      {/* 1. Header & GitHub Link Dashboard card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1e2533] pb-6">
        <div>
          <h1 
            className="text-2xl font-bold text-[#f1f5f9] flex items-center gap-2"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            <Terminal className="w-6 h-6 text-[#f5a623]" />
            Activity Log
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            Realtime event pipeline monitoring GitHub push, pull request, and issue streams.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchData} 
          className="border-[#1e2533] bg-[#141920]/40 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533] text-xs h-9 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {!isConnected ? (
        <div className="bg-[#111622]/40 backdrop-blur-md border border-[#1e2533] p-6 rounded-lg max-w-2xl flex flex-col md:flex-row gap-5 items-start md:items-center">
          <div className="p-4 bg-slate-500/5 border border-slate-500/10 rounded-lg shrink-0">
            <Link className="w-10 h-10 text-[#94a3b8]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#f1f5f9]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Connect GitHub Repository
            </h2>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              Link this Hive workspace to a GitHub repository to stream commits, pull requests, and comments. 
              Changes are broadcasted globally to your team using Redis Pub/Sub.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => setModalOpen(true)}
                className="bg-[#f5a623] text-[#1a0e00] hover:bg-[#e09415] font-bold h-9 px-4 text-xs"
              >
                <Link className="w-3.5 h-3.5 mr-1.5" />
                Link GitHub Repository
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#111622]/40 backdrop-blur-md border border-[#1e2533] p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/10">
                  Connected
                </span>
                <span className="text-sm font-bold text-[#f1f5f9]">
                  {hive?.githubRepo?.owner}/{hive?.githubRepo?.repo}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1 font-mono">
                Webhook Secret: •••••••••••••••• | Connected: {hive?.githubRepo?.connectedAt ? format(new Date(hive.githubRepo.connectedAt), "yyyy-MM-dd HH:mm") : "-"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/10 px-3 h-9 text-xs"
          >
            {disconnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Disconnecting...
              </>
            ) : (
              <>
                <Unlink className="w-3.5 h-3.5 mr-1.5" />
                Disconnect Repo
              </>
            )}
          </Button>
        </div>
      )}

      {/* 2. Monospace Terminal Activity Console */}
      <div 
        className="w-full bg-[#090d14] border border-[#1e2533] rounded-lg shadow-2xl flex flex-col overflow-hidden font-mono text-xs text-slate-300"
        style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}
      >
        {/* Terminal Header */}
        <div className="bg-[#101520] border-b border-[#1e2533] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-600/40 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-500/80 border border-green-600/40 inline-block" />
            </div>
            <span className="text-[11px] text-[#475569] ml-2 font-medium tracking-wide">
              HIVEOS // ACTIVITY_STREAM // hive-{hiveId.slice(-6)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[#475569]">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${socketStatus === "connected" ? "bg-green-400" : "bg-red-400"}`} />
              Socket: {socketStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
          {/* Welcome Prompt */}
          <div className="text-[#475569] space-y-1 select-none">
            <p className="text-[#f5a623]/80 font-bold">HIVEOS WEBHOOK ACTIVITY MONITOR v1.0.0</p>
            <p>SYSTEM RESOLVED: {activities.length} EVENTS IN CONSOLE</p>
            <p>REALTIME PIPELINE: STANDBY / LISTENING FOR WEBHOCK STREAMS...</p>
            <p>----------------------------------------------------------------------</p>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-[#475569] space-y-1 select-none animate-pulse">
              <p>[CONSOLE] NO WEBHOOK EVENTS LOGGED YET.</p>
              <p>WAITING FOR COMMITS, ISSUES, OR PR EVENTS FROM CONNECTED REPOS...</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activities.map((act) => {
                const meta = getEventMeta(act.type);
                const formattedTime = format(new Date(act.timestamp), "HH:mm:ss");
                
                return (
                  <div 
                    key={act.id} 
                    className="group flex items-start gap-3 py-1.5 px-2.5 rounded hover:bg-[#111622]/40 transition-colors animate-fade-in border border-transparent hover:border-[#1e2533]/50"
                  >
                    {/* Time */}
                    <span className="text-[#475569] font-medium shrink-0 mt-0.5">
                      [{formattedTime}]
                    </span>

                    {/* Badge */}
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border shrink-0 flex items-center gap-1 select-none leading-none ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </span>

                    {/* Content */}
                    <div className="flex-1 space-y-1">
                      <div className="text-slate-200">
                        <span className="font-semibold text-slate-100">{act.title}</span>
                        {act.description && (
                          <span className="text-[#94a3b8] ml-2">— {act.description}</span>
                        )}
                      </div>
                      
                      {/* Actor */}
                      <div className="flex items-center gap-1.5 text-[10px] text-[#475569] group-hover:text-[#94a3b8] transition-colors">
                        {act.actorAvatar ? (
                          <img 
                            src={act.actorAvatar} 
                            alt={act.actorName} 
                            className="w-3.5 h-3.5 rounded-full border border-[#1e2533]" 
                          />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-[#1e2533] flex items-center justify-center text-[8px]">
                            {act.actorName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span>@{act.actorName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <div className="pt-4 pb-2 text-center select-none">
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="border border-[#1e2533] bg-[#141920]/40 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533] text-[10px] font-mono font-bold tracking-wider h-8 px-4"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        STREAMING OLDER ENTRIES...
                      </>
                    ) : (
                      "LOAD MORE ENTRIES //"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connect Repo Modal */}
      <ConnectRepoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        hiveId={hiveId}
        onSuccess={fetchData}
      />
    </div>
  );
}
