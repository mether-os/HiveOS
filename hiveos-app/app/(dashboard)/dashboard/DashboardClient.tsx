"use client";

/**
 * app/(dashboard)/dashboard/DashboardClient.tsx — Dashboard Client Component
 *
 * Purpose: Client-side dashboard content. Fetches live AI cognition metrics,
 *          renders the workspaces card grid, and displays a dynamic Active Cognition feed.
 */

import { CreateHiveModal } from "@/features/hives/components/CreateHiveModal";
import { HiveGrid } from "@/features/hives/components/HiveGrid";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Brain, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  hiveId: string;
  hiveName: string;
  createdAt: string;
}

interface CognitionData {
  averageHealth: number;
  totalRisks: number;
  totalGaps: number;
  latestRecommendations: Recommendation[];
  totalHives: number;
}

export function DashboardClient() {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cognition, setCognition] = useState<CognitionData | null>(null);
  const [loadingCognition, setLoadingCognition] = useState(true);

  async function fetchCognition() {
    try {
      const res = await fetch("/api/dashboard/cognition");
      if (res.ok) {
        const result = await res.json();
        if (result.data) {
          setCognition(result.data);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard cognition:", err);
    } finally {
      setLoadingCognition(false);
    }
  }

  useEffect(() => {
    fetchCognition();
  }, []);

  async function handleLoadDemo() {
    if (seeding) return;
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch("/api/hives/demo", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed demo workspace");
      const data = await res.json();
      if (data.hiveId) {
        await fetchCognition();
        router.push(`/hive/${data.hiveId}/intelligence`);
      } else {
        throw new Error("Invalid response from seeder");
      }
    } catch (err: any) {
      console.error("[Demo Loader] Error:", err);
      setError("Failed to load demo workspace. Please check your network and try again.");
      setSeeding(false);
    }
  }

  const risksCount = cognition?.totalRisks || 0;
  const gapsCount = cognition?.totalGaps || 0;
  const loadPercentage = cognition?.totalHives
    ? Math.min(100, Math.max(5, risksCount * 12 + gapsCount * 6))
    : 0;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10 space-y-10 animate-fade-up">
      {/* Section Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 border-b border-[#131d30] pb-7">
        <div className="space-y-1">
          <h1 className="text-[#f0f4f8] font-bold text-3xl tracking-tight font-display">
            Your Hives
          </h1>
          <p className="text-[#94a3b8] text-sm">
            Orchestrate and monitor your active collaborative workspace nodes.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Load Demo Workspace */}
          <button
            onClick={handleLoadDemo}
            disabled={seeding}
            className="flex items-center gap-2 bg-transparent hover:bg-[#f5a623]/5 text-[#f5a623] border border-[#f5a623]/25 hover:border-[#f5a623] font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seeding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Seeding Demo...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Load Demo Workspace
              </>
            )}
          </button>

          {/* New Hive */}
          <button
            id="create-hive-btn"
            onClick={() => setCreateModalOpen(true)}
            disabled={seeding}
            className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e09415] text-[#020408] font-bold px-4 py-2 rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#f5a623]/10"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            New Hive
          </button>
        </div>
      </header>

      {error && (
        <div
          className="p-4 bg-[#f43f5e]/5 border border-[#f43f5e]/20 text-[#f43f5e] rounded-xl text-xs"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Hive Cards Grid */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">
          Workspaces Lobby
        </h2>
        <HiveGrid onCreateClick={() => setCreateModalOpen(true)} />
      </section>

      {/* Active Cognition Bento */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="System status">
        {/* Active Cognition panel */}
        <div className="md:col-span-2 bg-[#060b13] border border-[#131d30] p-6 rounded-2xl flex flex-col justify-between min-h-[240px]">
          <div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse-accent" />
                <h4 className="text-[11px] font-semibold text-[#f5a623] uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-[#6366f1]" />
                  HiveMind Active Cognition
                </h4>
              </div>

              {!loadingCognition && cognition && (
                <div className="text-[10px] text-[#94a3b8] flex gap-3">
                  <span>
                    Risks: <strong className="text-[#f43f5e]">{cognition.totalRisks}</strong>
                  </span>
                  <span>
                    Gaps: <strong className="text-[#f59e0b]">{cognition.totalGaps}</strong>
                  </span>
                </div>
              )}
            </div>

            {loadingCognition ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((idx) => (
                  <div key={idx} className="h-14 bg-[#101522]/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !cognition || cognition.latestRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#475569] gap-2 border border-dashed border-[#131d30] rounded-xl bg-[#020408]/50">
                <CheckCircle2 className="w-8 h-8 text-[#334155]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider">
                  No active issues detected
                </p>
                <p className="text-[11px] text-[#475569] text-center max-w-[80%] leading-normal">
                  HiveMind AI has analyzed your graph. Workspace systems are
                  running at nominal baseline levels.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cognition.latestRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-[#131d30] bg-[#020408]/40 flex items-center justify-between group hover:border-[#6366f1]/30 transition-all"
                  >
                    <div className="space-y-0.5 max-w-[75%]">
                      <div className="text-[13px] font-semibold text-[#f0f4f8] group-hover:text-[#6366f1] transition-colors truncate">
                        {rec.title}
                      </div>
                      <p className="text-[12px] text-[#94a3b8] line-clamp-1 leading-normal">
                        {rec.description}
                      </p>
                    </div>

                    <Link
                      href={`/hive/${rec.hiveId}/intelligence`}
                      className="px-2.5 py-1.5 rounded-lg bg-[#101522] border border-[#1e293b] hover:border-[#6366f1]/40 text-[10px] font-semibold text-[#94a3b8] hover:text-[#6366f1] flex items-center gap-1 transition-all"
                    >
                      <span className="max-w-[70px] truncate">{rec.hiveName}</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hive Load panel */}
        <div className="bg-[#060b13] border border-[#131d30] p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-5">
            <h4 className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
              Aggregate Workspace Load
            </h4>
            <div className="space-y-2">
              <div className="text-[#f5a623] font-bold text-5xl font-display flex items-baseline gap-1">
                {loadingCognition ? "--" : loadPercentage}
                <span className="text-lg font-normal text-[#64748b]">%</span>
              </div>
              <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                Aggregated system health and unresolved warnings overhead
                computed across all environments.
              </p>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <div className="h-1.5 bg-[#101522] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f5a623] transition-all duration-500 shadow-md shadow-[#f5a623]/15"
                style={{ width: `${loadingCognition ? 0 : loadPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#475569] font-semibold uppercase">
              <span>Optimized</span>
              <span>Maximum capacity</span>
            </div>
          </div>
        </div>
      </section>

      <CreateHiveModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  );
}
