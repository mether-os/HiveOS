"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, BookOpen, Loader2, ArrowRight, FolderOpen } from "lucide-react";
import { useHives } from "@/features/hives/hooks/useHives";

interface DocsSummary {
  hiveId: string;
  hiveName: string;
  docsCount: number;
}

export default function GlobalDocsPage() {
  const router = useRouter();
  const { data: hives = [], isLoading } = useHives();
  const [summaries, setSummaries] = useState<DocsSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (hives.length === 0) return;

    const fetchDocsMetrics = async () => {
      setLoadingDocs(true);
      try {
        const promises = hives.map(async (hive) => {
          const res = await fetch(`/api/hives/${hive.id}/documents`);
          if (!res.ok) {
            return {
              hiveId: hive.id,
              hiveName: hive.name,
              docsCount: 0,
            };
          }
          const result = await res.json();
          const docs = result.data || [];
          return {
            hiveId: hive.id,
            hiveName: hive.name,
            docsCount: docs.length,
          };
        });

        const results = await Promise.all(promises);
        setSummaries(results);
      } catch (err) {
        console.error("Failed to load global documents metrics:", err);
      } finally {
        setLoadingDocs(false);
      }
    };

    fetchDocsMetrics();
  }, [hives]);

  const totalDocs = summaries.reduce((sum, curr) => sum + curr.docsCount, 0);

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12 space-y-10 animate-fade-up">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <BookOpen className="w-8 h-8 text-[#f5a623]" />
            <span>Document Library</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Manage documentation, developer manuals, code specifications, and system logs.
          </p>
        </div>
      </header>

      {isLoading || (hives.length > 0 && loadingDocs && summaries.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
          <Loader2 className="w-8 h-8 rounded-full border-2 border-t-[#f5a623] border-[#1e2533] animate-spin" />
          <span className="text-[10px] font-semibold tracking-wider uppercase font-mono">
            Scanning document repositories...
          </span>
        </div>
      ) : hives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[#141b29] rounded-2xl bg-[#070a0f]/40 gap-4 text-center">
          <FileText className="w-12 h-12 text-[#1c2331] animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider font-mono">No documents active</h3>
            <p className="text-xs text-[#475569] max-w-[320px] leading-relaxed">
              Create a new Hive workspace to attach code documents, notes, or knowledge bases.
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
          {/* Summary Banner */}
          <div className="bg-[#070a0f] border border-[#141b29] p-6 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] font-mono uppercase font-bold text-[#475569] tracking-wider">Document Library Status</span>
              <p className="text-[#f1f5f9] text-xs">
                Your neural workspaces contain <strong className="text-[#f5a623]">{totalDocs}</strong> active document files.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#f5a623]/10 border border-[#f5a623]/25 flex items-center justify-center text-[#f5a623]">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Folder grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {summaries.map((summary) => (
              <div
                key={summary.hiveId}
                onClick={() => router.push(`/hive/${summary.hiveId}/documents`)}
                className="p-6 rounded-2xl border border-[#141b29] bg-[#070a0f] hover:border-[#5f5af6]/30 group cursor-pointer transition-all duration-200 hover:shadow-[0_8px_30px_rgb(95,90,246,0.03)] flex flex-col justify-between min-h-[140px]"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-lg bg-[#5f5af6]/10 border border-[#5f5af6]/20 flex items-center justify-center text-[#5f5af6]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono text-text-secondary">
                      {summary.docsCount} {summary.docsCount === 1 ? "File" : "Files"}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#f1f5f9] group-hover:text-[#f5a623] transition-colors">
                    {summary.hiveName}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-[#141b29] flex justify-between items-center text-[10px] font-mono text-[#475569] group-hover:text-[#94a3b8]">
                  <span>Browse Folder</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform text-[#f5a623]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
