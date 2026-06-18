"use client";

import React, { useState } from "react";
import { Settings, Shield, Database, Bell, Save, Check } from "lucide-react";

function Github(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [telemetry, setTelemetry] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12 space-y-10 animate-fade-up text-neutral-300">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <Settings className="w-8 h-8 text-[#f5a623]" />
            <span>Settings</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Configure global dashboard behaviors, third-party authentication scopes, and node diagnostics.
          </p>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Visual Preferences Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Visual Preferences</span>
          </h3>
          <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#f1f5f9]">Color Theme</h4>
                <p className="text-[11px] text-[#94a3b8]">Select UI canvas color palette mode.</p>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="bg-[#030508] border border-[#1e2533] rounded-xl px-3 py-1.5 text-xs text-[#f1f5f9] focus:outline-none focus:border-[#f5a623]"
              >
                <option value="dark">Royal Slate-Indigo (Dark)</option>
                <option value="obsidian">Pure Obsidian (Black)</option>
                <option value="cyberpunk">Cyberpunk Amber (Legacy)</option>
              </select>
            </div>

            <div className="border-t border-[#141b29] pt-4 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#f1f5f9]">Animate Layouts</h4>
                <p className="text-[11px] text-[#94a3b8]">Enable smooth Spring-based keyframe animations.</p>
              </div>
              <input
                type="checkbox"
                checked={telemetry}
                onChange={(e) => setTelemetry(e.target.checked)}
                className="w-4 h-4 rounded border-[#1e2533] text-[#f5a623] bg-[#030508] focus:ring-[#f5a623]"
              />
            </div>
          </div>
        </section>

        {/* Integration Credentials Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
            <Github className="w-4 h-4" />
            <span>Integrations & Sync</span>
          </h3>
          <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[#f1f5f9] flex items-center gap-1.5">
                  <Github className="w-4 h-4" />
                  <span>GitHub Authentication</span>
                </h4>
                <p className="text-[11px] text-[#94a3b8]">Connected callback port: 3000</p>
              </div>
              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8.5px] font-mono uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg">
                CONNECTED
              </span>
            </div>

            <div className="border-t border-[#141b29] pt-4 flex justify-between items-center">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[#f1f5f9] flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  <span>Redis Cache Host</span>
                </h4>
                <p className="text-[11px] text-[#94a3b8]">Local host cache connection loop: 6379</p>
              </div>
              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8.5px] font-mono uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg">
                ACTIVE
              </span>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span>System Notifications</span>
          </h3>
          <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-[#f1f5f9]">Cognitive Alerts</h4>
                <p className="text-[11px] text-[#94a3b8]">Get notified instantly when AI detects risks or gaps.</p>
              </div>
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="w-4 h-4 rounded border-[#1e2533] text-[#f5a623] bg-[#030508] focus:ring-[#f5a623]"
              />
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-[#f5a623] hover:bg-[#e09415] text-[#030508] font-bold text-xs uppercase tracking-wider font-mono transition-all duration-150 active:scale-95"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Preferences Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
