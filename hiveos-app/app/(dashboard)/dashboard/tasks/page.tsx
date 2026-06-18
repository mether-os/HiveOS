"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Kanban, ClipboardList, Loader2, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { useHives } from "@/features/hives/hooks/useHives";

interface TaskSummary {
  hiveId: string;
  hiveName: string;
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
  total: number;
}

export default function GlobalTasksPage() {
  const router = useRouter();
  const { data: hives = [], isLoading } = useHives();
  const [summaries, setSummaries] = useState<TaskSummary[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Load task summaries for each hive by querying their canvas nodes
  useEffect(() => {
    if (hives.length === 0) return;

    const fetchTaskMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const promises = hives.map(async (hive) => {
          const res = await fetch(`/api/hives/${hive.id}/canvas`);
          if (!res.ok) {
            return {
              hiveId: hive.id,
              hiveName: hive.name,
              todo: 0,
              inProgress: 0,
              blocked: 0,
              done: 0,
              total: 0,
            };
          }
          const result = await res.json();
          const nodes = result.data?.nodes || [];
          const taskNodes = nodes.filter((n: any) => n.category === "Task");

          let todo = 0;
          let inProgress = 0;
          let blocked = 0;
          let done = 0;

          taskNodes.forEach((node: any) => {
            const status = node.data?.status || "Todo";
            if (status === "Todo") todo++;
            else if (status === "In Progress") inProgress++;
            else if (status === "Blocked") blocked++;
            else if (status === "Done") done++;
          });

          return {
            hiveId: hive.id,
            hiveName: hive.name,
            todo,
            inProgress,
            blocked,
            done,
            total: taskNodes.length,
          };
        });

        const results = await Promise.all(promises);
        setSummaries(results);
      } catch (err) {
        console.error("Failed to load global task metrics:", err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchTaskMetrics();
  }, [hives]);

  // Aggregate metrics
  const aggregate = summaries.reduce(
    (acc, curr) => {
      acc.todo += curr.todo;
      acc.inProgress += curr.inProgress;
      acc.blocked += curr.blocked;
      acc.done += curr.done;
      acc.total += curr.total;
      return acc;
    },
    { todo: 0, inProgress: 0, blocked: 0, done: 0, total: 0 }
  );

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12 space-y-10 animate-fade-up">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <ClipboardList className="w-8 h-8 text-[#f5a623]" />
            <span>Tasks Center</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Monitor, assign, and track consolidated task pipelines across all neural environments.
          </p>
        </div>
      </header>

      {isLoading || (hives.length > 0 && loadingMetrics && summaries.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
          <Loader2 className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
          <span className="text-[10px] font-semibold tracking-wider uppercase font-mono">
            Aggregating workflow queues...
          </span>
        </div>
      ) : hives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#141b29] rounded-2xl bg-[#070a0f]/40 gap-4 text-center">
          <Kanban className="w-12 h-12 text-[#1c2331] animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider font-mono">No tasks active</h3>
            <p className="text-xs text-[#475569] max-w-[320px] leading-relaxed">
              Create a new Hive workspace to allocate developer nodes and manage Kanban issues.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e09415] text-[#030508] font-bold px-4 py-2 rounded-xl text-[10px] tracking-wider uppercase font-mono transition-all duration-150 active:scale-95"
          >
            Go to Lobby
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Aggregate Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-5 flex flex-col justify-center shadow-sm">
              <span className="text-[9px] font-extrabold text-[#475569] uppercase tracking-widest font-mono">Total Issues</span>
              <span className="text-2xl font-black text-[#f1f5f9] mt-1.5">{aggregate.total}</span>
            </div>
            <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-5 flex flex-col justify-center shadow-sm">
              <span className="text-[9px] font-extrabold text-[#94a3b8] uppercase tracking-widest font-mono">Todo</span>
              <span className="text-2xl font-black text-[#e2e8f0] mt-1.5">{aggregate.todo}</span>
            </div>
            <div className="bg-[#070a0f] border border-sky-500/10 rounded-2xl p-5 flex flex-col justify-center shadow-sm">
              <span className="text-[9px] font-extrabold text-sky-400 uppercase tracking-widest font-mono">In Progress</span>
              <span className="text-2xl font-black text-sky-300 mt-1.5">{aggregate.inProgress}</span>
            </div>
            <div className="bg-[#070a0f] border border-rose-500/10 rounded-2xl p-5 flex flex-col justify-center shadow-sm">
              <span className="text-[9px] font-extrabold text-rose-500 uppercase tracking-widest font-mono">Blocked</span>
              <span className="text-2xl font-black text-rose-400 mt-1.5">{aggregate.blocked}</span>
            </div>
            <div className="bg-[#070a0f] border border-emerald-500/10 rounded-2xl p-5 flex flex-col justify-center shadow-sm">
              <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest font-mono">Completed</span>
              <span className="text-2xl font-black text-emerald-300 mt-1.5">{aggregate.done}</span>
            </div>
          </div>

          {/* Lane breakdown list */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider font-mono">Workspaces Breakdown</h2>
            <div className="space-y-3">
              {summaries.map((summary) => (
                <div
                  key={summary.hiveId}
                  onClick={() => router.push(`/hive/${summary.hiveId}/tasks`)}
                  className="p-5 rounded-xl border border-[#141b29] bg-[#070a0f] hover:border-[#f5a623]/20 transition-all duration-150 group cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-[#f1f5f9] group-hover:text-[#f5a623] transition-colors">
                      {summary.hiveName}
                    </h3>
                    <p className="text-[10px] text-[#475569] font-mono">
                      ID: {summary.hiveId}
                    </p>
                  </div>

                  <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
                    {/* Metrics list */}
                    <div className="flex gap-4 text-[10px] font-mono">
                      <div className="flex items-center gap-1 text-slate-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Todo: <strong className="text-neutral-300">{summary.todo}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-sky-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
                        <span>Active: <strong className="text-sky-300">{summary.inProgress}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-500">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Blocked: <strong className="text-rose-400">{summary.blocked}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Done: <strong className="text-emerald-300">{summary.done}</strong></span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-[#f5a623] font-bold flex items-center gap-1 shrink-0">
                      <span>Open Board</span>
                      <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
