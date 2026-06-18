"use client";

import React from "react";
import { useSession } from "@/features/auth/hooks/useSession";
import { User as UserIcon, Mail, ShieldAlert, Cpu, Key, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { user, isAuthenticated } = useSession();

  // User initials for fallback avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12 space-y-10 animate-fade-up text-neutral-300">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#141b29] pb-6">
        <div className="space-y-1">
          <h1 className="text-[#f8fafc] font-black text-3xl tracking-tight font-display flex items-center gap-2.5">
            <UserIcon className="w-8 h-8 text-[#f5a623]" />
            <span>Developer Profile</span>
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Manage your local developer session credentials, access tokens, and workspace authorization roles.
          </p>
        </div>
      </header>

      {/* Profile Info Card */}
      <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full border-2 border-[#f5a623]/20 overflow-hidden shrink-0 flex items-center justify-center bg-[#0e1117] text-3xl font-black text-[#f5a623] select-none">
          {user?.image ? (
            <img src={user.image} alt={user.name ?? "Avatar"} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        {/* Details */}
        <div className="space-y-4 w-full">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl font-black text-[#f8fafc] font-display">{user?.name ?? "Guest Developer"}</h2>
            <p className="text-xs text-[#94a3b8] font-mono flex items-center justify-center md:justify-start gap-1">
              <Mail className="w-3.5 h-3.5" />
              <span>{user?.email ?? "developer@hiveos.local"}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#141b29]">
            <div className="bg-[#030508]/40 border border-[#141b29] rounded-xl p-4 space-y-1">
              <span className="text-[8.5px] font-mono uppercase font-bold text-[#475569]">System Role</span>
              <p className="text-xs font-bold text-[#f5a623]">Workspace Administrator</p>
            </div>
            
            <div className="bg-[#030508]/40 border border-[#141b29] rounded-xl p-4 space-y-1">
              <span className="text-[8.5px] font-mono uppercase font-bold text-[#475569]">Session Status</span>
              <p className="text-xs font-bold text-emerald-400">Authenticated (OAuth)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Telemetry Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
          <Key className="w-4 h-4" />
          <span>Security & Scopes</span>
        </h3>
        <div className="bg-[#070a0f] border border-[#141b29] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#94a3b8] font-mono">Workspace Write Privilege</span>
            <span className="text-emerald-400 font-bold font-mono">GRANTED</span>
          </div>
          <div className="border-t border-[#141b29] pt-4 flex justify-between items-center text-xs">
            <span className="text-[#94a3b8] font-mono">OAuth Token Scope</span>
            <span className="text-emerald-400 font-bold font-mono">read:user, repo, workflow</span>
          </div>
          <div className="border-t border-[#141b29] pt-4 flex justify-between items-center text-xs">
            <span className="text-[#94a3b8] font-mono">Account Created At</span>
            <span className="text-text-secondary font-mono">2026-06-11T14:47:00Z</span>
          </div>
        </div>
      </section>
    </div>
  );
}
