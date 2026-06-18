"use client";

import React, { useState } from "react";
import { HelpCircle, Send, Check, MessageSquareCode, ShieldCheck } from "lucide-react";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setSubject("");
    setMessage("");
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-[700px] mx-auto px-6 py-12 space-y-10 animate-fade-up text-neutral-300">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <HelpCircle className="w-8 h-8 text-[#f5a623]" />
            <span>Developer Support</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Open neural pipeline tickets or query developers regarding workspace integration questions.
          </p>
        </div>
      </header>

      {submitted ? (
        <div className="bg-emerald-500/5 border border-emerald-500/35 rounded-2xl p-8 text-center space-y-3 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider font-mono">Ticket Transmitted</h3>
          <p className="text-xs text-[#94a3b8] max-w-[320px] mx-auto leading-relaxed">
            Your support payload has been successfully piped to the developer operations hub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Form */}
          <div className="md:col-span-2 bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9.5px] font-mono uppercase font-bold text-[#475569]">Subject Header</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Query summary..."
                  className="w-full bg-[#030508] border border-[#1e2533] rounded-xl px-3.5 py-2.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9.5px] font-mono uppercase font-bold text-[#475569]">Payload Details</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide logs or stack trace description..."
                  className="w-full bg-[#030508] border border-[#1e2533] rounded-xl px-3.5 py-2.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#f5a623] resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#f5a623] hover:bg-[#e09415] text-[#030508] font-bold text-xs uppercase tracking-wider font-mono transition-all duration-150 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Submit Ticket</span>
              </button>
            </form>
          </div>

          {/* Quick FAQ info */}
          <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-5 space-y-4">
            <h4 className="text-[10px] font-mono uppercase font-bold text-[#f5a623] tracking-wider flex items-center gap-1.5">
              <MessageSquareCode className="w-4 h-4 text-accent" />
              <span>Dev Channels</span>
            </h4>
            <div className="space-y-3 text-[11px] leading-relaxed text-[#94a3b8]">
              <div>
                <strong className="text-white block">Documentation Docs</strong>
                <span>Refer to workspace.md inside Hives for prompt schemas.</span>
              </div>
              <div className="border-t border-[#141b29] pt-2">
                <strong className="text-white block">Slack Channels</strong>
                <span>Join #hiveos-operators for realtime socket questions.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
