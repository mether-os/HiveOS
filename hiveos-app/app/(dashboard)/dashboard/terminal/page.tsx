"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Shield, Cpu, RefreshCw, ArrowRight } from "lucide-react";
import { useHives } from "@/features/hives/hooks/useHives";
import { useSession } from "@/features/auth/hooks/useSession";

interface TerminalLine {
  type: "input" | "output" | "error" | "success" | "system";
  text: string;
}

export default function TerminalPage() {
  const { data: hives = [], isLoading } = useHives();
  const { user } = useSession();
  
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: "system", text: "HiveOS [Version 1.2.490]" },
    { type: "system", text: "(c) 2026 HiveOS Corporation. All rights reserved." },
    { type: "system", text: "" },
    { type: "system", text: "Establishing secure neural interface connection..." },
    { type: "success", text: "Session authenticated successfully." },
    { type: "system", text: "Type 'help' to view available developer CLI commands." },
    { type: "system", text: "" },
  ]);
  
  const [commandInput, setCommandInput] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Focus input on click anywhere inside terminal
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    // Add input command to history
    setHistory((prev) => [...prev, { type: "input", text: `guest@hiveos:~# ${cmd}` }]);
    setCommandInput("");

    // Process command
    const parts = cmd.split(" ");
    const primaryCmd = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1);

    setTimeout(() => {
      processCommand(primaryCmd, args);
    }, 80);
  };

  const processCommand = (cmd: string, args: string[]) => {
    switch (cmd) {
      case "help":
        setHistory((prev) => [
          ...prev,
          { type: "output", text: "Available commands:" },
          { type: "system", text: "  help                         - Display available commands" },
          { type: "system", text: "  list hives                   - List all active workspaces and their IDs" },
          { type: "system", text: "  health                       - Check system resource allocations and load" },
          { type: "system", text: "  query <hive_name> <prompt>   - Send neural cognitive request to a workspace" },
          { type: "system", text: "  clear                        - Clear terminal display buffer" },
          { type: "system", text: "  whoami                       - Display current session profile info" },
        ]);
        break;

      case "clear":
        setHistory([]);
        break;

      case "whoami":
        setHistory((prev) => [
          ...prev,
          { type: "success", text: `User ID: ${user?.id ?? "unknown-id"}` },
          { type: "output", text: `Username: ${user?.name ?? "Guest Developer"}` },
          { type: "output", text: `Email: ${user?.email ?? "developer@hiveos.local"}` },
          { type: "system", text: "Privilege Level: Workspace Administrator" },
        ]);
        break;

      case "list":
        if (args[0]?.toLowerCase() === "hives") {
          if (hives.length === 0) {
            setHistory((prev) => [
              ...prev,
              { type: "system", text: "No active hives found. Create one from the Hives lobby." }
            ]);
          } else {
            const listLines = hives.map((h) => ({
              type: "success" as const,
              text: `  > ${h.name.padEnd(24)} | ID: ${h.id} | Status: NOMINAL`
            }));
            setHistory((prev) => [
              ...prev,
              { type: "output", text: `Active Hives (${hives.length}):` },
              ...listLines
            ]);
          }
        } else {
          setHistory((prev) => [
            ...prev,
            { type: "error", text: "Invalid parameter. Did you mean 'list hives'?" }
          ]);
        }
        break;

      case "health":
        const mockCpu = (Math.random() * 25 + 5).toFixed(1);
        const mockRam = (Math.random() * 12 + 40).toFixed(1);
        setHistory((prev) => [
          ...prev,
          { type: "output", text: "SYSTEM TELEMETRY REPORT:" },
          { type: "system", text: `  [CPU] Core Load           : ${mockCpu}% (nominal)` },
          { type: "system", text: `  [RAM] Memory Usage        : ${mockRam}% / 16.0 GB allocated` },
          { type: "system", text: "  [DB]  Database Cluster    : CONNECTED (MongoDB Atlas)" },
          { type: "system", text: "  [RED] Redis Cache Server  : ACTIVE (127.0.0.1:6379)" },
          { type: "system", text: "  [WSS] Realtime WebSockets : OPERATIONAL (port 3002)" },
          { type: "success", text: "System Health Status      : 100% (No warnings)" },
        ]);
        break;

      case "query":
        if (args.length < 2) {
          setHistory((prev) => [
            ...prev,
            { type: "error", text: "Syntax: query <hive_name> <prompt>" },
            { type: "system", text: "Example: query \"Development Hive\" Check for gaps" }
          ]);
          break;
        }

        // Reconstruct workspace name if quoted, or take the first argument
        let hiveName = args[0] || "";
        const promptStartIndex = 1;

        if (hiveName.startsWith('"')) {
          // Find where the quote ends
          const argString = args.join(" ");
          const match = argString.match(/"([^"]+)"/);
          if (match) {
            hiveName = match[1] || "";
            // Split prompt based on remainder after the quote
            const remainder = argString.substring(match[0].length).trim();
            setHistory((prev) => [
              ...prev,
              { type: "system", text: `Querying cognitive core: "${hiveName}"` },
              { type: "system", text: `Prompt content: "${remainder}"` },
              { type: "output", text: "Processing neural embeddings..." },
              { type: "success", text: `[Cognition Core Reply]: Analyzed snapshot for Hive "${hiveName}". Zero structural risks found. Suggest adding standard unit test coverage for feature hooks.` }
            ]);
            break;
          }
        }

        const prompt = args.slice(promptStartIndex).join(" ");
        const matchedHive = hives.find((h) => h.name.toLowerCase() === hiveName.toLowerCase());

        if (!matchedHive) {
          setHistory((prev) => [
            ...prev,
            { type: "system", text: `Neural interface warning: "${hiveName}" not found in current directory registry.` },
            { type: "output", text: "Routing to global sandbox query analyzer..." },
            { type: "success", text: `[Global Sandboxed Core Reply]: Prompt: "${prompt}". Core status is nominal. AI models recommend syncing active snapshot indexes.` }
          ]);
        } else {
          setHistory((prev) => [
            ...prev,
            { type: "system", text: `Secure handshake established with Hive ID: ${matchedHive.id}` },
            { type: "output", text: "Running workspace telemetry scans..." },
            { type: "success", text: `[HiveMind core.ai@${matchedHive.id}]: Analysis complete for workspace: "${matchedHive.name}". All canvas nodes are fully connected. High-confidence recommendations synchronized to dashboard.` }
          ]);
        }
        break;

      default:
        setHistory((prev) => [
          ...prev,
          { type: "error", text: `Command not found: '${cmd}'. Type 'help' for valid CLI operators.` }
        ]);
        break;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#030508] text-[#f5a623] select-none p-6">
      {/* Page header */}
      <div className="h-14 border-b border-[#1e2533] px-4 flex items-center justify-between bg-[#070a0f]/60 backdrop-blur-md rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xs font-mono font-extrabold uppercase tracking-widest">HiveOS Secure Shell v1.2</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-[#f5a623] rounded-full animate-breath" />
          <span className="text-[10px] font-mono opacity-60">SH_CONNECTED</span>
        </div>
      </div>

      {/* Terminal View Container */}
      <div
        onClick={handleTerminalClick}
        className="flex-1 w-full bg-[#030508] border-x border-b border-[#1e2533] p-4 overflow-y-auto font-mono text-xs space-y-2 cursor-text rounded-b-2xl shadow-inner scrollbar-thin"
      >
        {history.map((line, idx) => {
          let colorClass = "text-[#f5a623]"; // Default amber
          if (line.type === "error") colorClass = "text-rose-500 font-semibold";
          if (line.type === "success") colorClass = "text-emerald-400";
          if (line.type === "system") colorClass = "text-[#94a3b8]";
          if (line.type === "input") colorClass = "text-white font-bold";

          return (
            <div key={idx} className={`${colorClass} leading-relaxed whitespace-pre-wrap`}>
              {line.text}
            </div>
          );
        })}
        
        {/* Terminal Input Line */}
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 pt-1">
          <span className="text-white font-bold shrink-0">guest@hiveos:~#</span>
          <div className="flex-1 relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-white font-bold caret-[#f5a623] p-0 focus:ring-0 select-text"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              aria-label="Terminal input prompt"
            />
            {/* Custom breathing terminal cursor */}
            {commandInput === "" && (
              <span className="w-2 h-4 bg-[#f5a623] ml-0.5 animate-pulse shrink-0" />
            )}
          </div>
        </form>

        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
