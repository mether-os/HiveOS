import Link from "next/link";
import { ArrowRight, Brain, Cpu, Database, FileText, GitBranch, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "HiveOS — The Agentic Workspace for Teams That Build",
  description: "Unified canvas graph, document specifications, and GitHub streams under automated LLM agent audit loops.",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#080a0f] text-[#f1f5f9] overflow-hidden flex flex-col items-center font-sans">
      {/* Background Decorative Layers */}
      <div className="hex-grid absolute inset-0 pointer-events-none z-[1] opacity-20" aria-hidden="true" />
      <div className="glow-amber-tr z-[2]" aria-hidden="true" />
      <div className="glow-blue-bl z-[2]" aria-hidden="true" />

      {/* Margins Frame Lines */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute left-10 top-0 bottom-0 w-px bg-[#1e2533]/10" />
        <div className="absolute right-10 top-0 bottom-0 w-px bg-[#1e2533]/10" />
        <div className="absolute top-10 left-0 right-0 h-px bg-[#1e2533]/10" />
        <div className="absolute bottom-10 left-0 right-0 h-px bg-[#1e2533]/10" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f5a623] animate-breath" aria-hidden="true" />
          <span className="text-xl font-bold tracking-tight text-[#f1f5f9] font-display">HiveOS</span>
        </div>
        <Link
          href="/login"
          className="bg-[#141920] border border-[#1e2533] hover:border-[#f5a623]/40 text-[#f1f5f9] text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all duration-200 active:scale-95"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 max-w-[1000px] w-full mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center justify-center">
        <div className="mb-4 inline-flex items-center gap-2 border border-[#f5a623]/20 bg-[#f5a623]/5 px-3 py-1 rounded-full text-xs text-[#f5a623] font-mono">
          <Brain className="w-3.5 h-3.5" />
          <span>PORTFOLIO SHOWCASE: PHASE 15</span>
        </div>

        <h1
          className="text-4xl md:text-6xl font-bold tracking-tight text-[#f1f5f9] leading-tight max-w-[800px] font-display"
          style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
        >
          The Agentic Workspace for <span className="text-[#f5a623]">Teams That Build</span>
        </h1>

        <p className="mt-6 text-[#94a3b8] text-lg max-w-[700px] leading-relaxed">
          HiveOS unifies collaborative canvas graphs, markdown documents, and live GitHub activity streams into a single in-memory project Knowledge Graph—actively monitored by autonomous auditing agents.
        </p>

        {/* Call to Action */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e09415] text-[#1a0e00] font-bold text-sm px-8 py-4 rounded-lg shadow-lg shadow-[#f5a623]/10 transition-all duration-200 active:scale-95"
          >
            <span>Launch Showcase Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#141920] border border-[#1e2533] hover:border-[#94a3b8]/40 text-[#94a3b8] hover:text-[#f1f5f9] font-medium text-sm px-8 py-4 rounded-lg transition-all duration-200 active:scale-95"
          >
            <span>GitHub Repository</span>
          </a>
        </div>

        {/* 10-Second Explainer Bento / Grid */}
        <section className="mt-24 w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* PROBLEM CARD */}
          <div className="bg-[#0e1117]/80 border border-[#1e2533] p-8 rounded-xl flex flex-col gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-950/20 border border-red-500/20 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-[#f1f5f9] font-display">The Fragmented Specs Problem</h3>
            <p className="text-[#94a3b8] text-sm leading-relaxed">
              Jira tickets, PRD specs, system topology docs, and code repositories live in silos. Over time, architectures drift, circular dependencies lock pipelines, and unowned critical deliverables fail silently.
            </p>
          </div>

          {/* SOLUTION CARD */}
          <div className="bg-[#0e1117]/80 border border-[#f5a623]/10 border-l-[#f5a623]/30 border-l-2 p-8 rounded-xl flex flex-col gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/20 flex items-center justify-center text-[#f5a623]">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-[#f1f5f9] font-display">Unified Knowledge Resolution</h3>
            <p className="text-[#94a3b8] text-sm leading-relaxed">
              HiveOS compiles these streams into a single in-memory graph. Autonomous agents (Architect, Product, Risk) run background audits, proposing human-in-the-loop workflows rather than direct database mutations.
            </p>
          </div>
        </section>

        {/* Core Features Bento Grid */}
        <section className="mt-16 w-full text-left">
          <h2 className="text-3xl font-bold mb-8 text-[#f1f5f9] text-center font-display">Platform Core Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* CANVAS */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <Database className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">Interactive Canvas Graphs</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                Render and edit system modules (Features, Stack, Goals) in real time. Features coordinate-drag bypasses to protect databases from write storms.
              </p>
            </div>

            {/* UNIFIED CONTEXT */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <FileText className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">Document Intelligence</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                Collaborative Markdown editor with smart offset placements, auto-saves, version rollbacks, and fuzzy text indexing using weighted matching.
              </p>
            </div>

            {/* GITHUB ACTIVITY */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <GitBranch className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">GitHub Webhook Sync</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                HMAC-validated webhook pipeline broadcasting commits, PR merges, and issues to the dashboard timeline with double-execution guards.
              </p>
            </div>

            {/* HIVEMIND INTEL */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <Brain className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">Automated Auditing Loops</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                Determine workspace health scores, generate daily mission checklists, and propose actions dynamically when cycles or gaps are detected.
              </p>
            </div>

            {/* WORKFLOWS */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <Cpu className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">Human-in-the-Loop Workflows</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                Multi-stage orchestration workflows executing through the controlled write-limit engine. Blocks autonomous mutations without human validation.
              </p>
            </div>

            {/* CONVERSATIONAL CHAT */}
            <div className="bg-[#0e1117]/60 border border-[#1e2533] hover:border-[#1e2533]/80 p-6 rounded-xl transition-all duration-200">
              <Brain className="w-6 h-6 text-[#f5a623] mb-4" />
              <h4 className="font-bold text-base text-[#f1f5f9]">Conversational View Panel</h4>
              <p className="text-[#94a3b8] text-xs mt-2 leading-relaxed">
                Read-only conversation engine querying project states. Strict citation verification blocks hallucination by reverting to empty citations.
              </p>
            </div>

          </div>
        </section>

        {/* Architecture Section */}
        <section className="mt-24 w-full text-left bg-[#0e1117]/60 border border-[#1e2533] p-8 rounded-xl">
          <h3 className="text-2xl font-bold mb-4 text-[#f1f5f9] font-display">System Routing Flow</h3>
          <p className="text-[#94a3b8] text-sm leading-relaxed mb-6">
            HiveOS is built as a stateless viewer over structural data facts. User interactions route through low-latency sockets while background audits leverage the central prompt gateway.
          </p>
          
          <div className="p-4 bg-[#080a0f] border border-[#1e2533] rounded-lg font-mono text-[10px] sm:text-xs text-[#94a3b8] overflow-x-auto">
            <div className="flex flex-col gap-2 min-w-[500px]">
              <div className="flex justify-between items-center border-b border-[#1e2533] pb-2">
                <span>[CLIENT VIEWPORT]</span>
                <span>-- WebSocket Event (throttled drag / locks) --&gt;</span>
                <span>[REALTIME SOCKET.IO (Render)]</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1e2533] py-2">
                <span>[CLIENT VIEWPORT]</span>
                <span>-- REST Action Plan Approval (Zod validation) --&gt;</span>
                <span>[NEXT.JS API ROUTE (Vercel)]</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1e2533] py-2">
                <span>[NEXT.JS ROUTE]</span>
                <span>-- Query Context (Shortest Path BFS / In-Memory DFS) --&gt;</span>
                <span>[MONGODB ATLAS]</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span>[NEXT.JS CHAT]</span>
                <span>-- Stateless Completion Prompt (Nemotron Gateway) --&gt;</span>
                <span>[NVIDIA NIM LLM]</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1e2533]/20 py-8 text-center text-[#475569] text-xs font-mono">
        <p>&copy; 2026 HiveOS Portfolio Showcase. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
