"use client";

/**
 * components/layout/WorkspaceLeftSidebar.tsx — Workspace Left Sidebar (64px)
 *
 * Purpose: Icon-only 64px left sidebar for workspace pages.
 * Faithfully implements the workspace.html left sidebar.
 *
 * Icons (top): Canvas (active), Tasks, Docs, Activity, Intelligence
 * Icons (bottom): Settings
 *
 * Active state: amber icon tint + amber left border
 * Hover: subtle background fill
 *
 * Interactions:
 * - Used by: app/(workspace)/hive/[hiveId]/layout.tsx
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";

import {
  Activity,
  DocumentText,
  Category,
  Kanban,
  Setting2,
  Warning2,
  Keyboard,
} from "iconsax-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WorkspaceLeftSidebarProps {
  hiveId: string;
}

const SIDEBAR_ITEMS = [
  { icon: Category, label: "Canvas", path: "canvas" },
  { icon: Kanban, label: "Tasks", path: "tasks" },
  { icon: DocumentText, label: "Docs", path: "documents" },
  { icon: Activity, label: "Activity", path: "activity" },
  { icon: Brain, label: "Intelligence", path: "intelligence" },
] as const;

export function WorkspaceLeftSidebar({ hiveId }: WorkspaceLeftSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Settings & delete states
  const [isOpen, setIsOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keyboard shortcuts state
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);

  // Global keydown handler for hotkeys (FEAT-003)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in input/textarea/contenteditable
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsShortcutOpen(false);
        setIsOpen(false);
      } else if (key === "t") {
        e.preventDefault();
        router.push(`/hive/${hiveId}/tasks`);
      } else if (key === "c") {
        e.preventDefault();
        router.push(`/hive/${hiveId}/canvas`);
      } else if (key === "d") {
        e.preventDefault();
        router.push(`/hive/${hiveId}/documents`);
      } else if (key === "a") {
        e.preventDefault();
        router.push(`/hive/${hiveId}/activity`);
      } else if (key === "i") {
        e.preventDefault();
        router.push(`/hive/${hiveId}/intelligence`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hiveId, router]);

  // Fetch workspace name when dialog is opened
  useEffect(() => {
    if (!isOpen || !hiveId || workspaceName) return;

    const fetchWorkspaceDetails = async () => {
      try {
        const res = await fetch(`/api/hives/${hiveId}`);
        const result = await res.json();
        if (result.data) {
          setWorkspaceName(result.data.name);
        }
      } catch (err) {
        console.error("Failed to fetch hive details:", err);
      }
    };

    fetchWorkspaceDetails();
  }, [isOpen, hiveId]);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName !== workspaceName || isDeleting) return;

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/hives/${hiveId}`, {
        method: "DELETE",
      });

      if (res.status === 204 || res.ok) {
        setIsOpen(false);
        // Redirect back to dashboard after successful deletion
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to delete workspace.");
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred.");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" as const } }
} satisfies import("framer-motion").Variants;


  return (
    <>
      <aside
        className="
          fixed left-0 top-16 w-16 h-[calc(100vh-64px)] z-40
          bg-card border-r border-border
          flex flex-col items-center py-4 gap-2
        "
        aria-label="Workspace section navigation"
      >
        {/* Main navigation icons */}
        <motion.nav 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-1 w-full"
        >
          {SIDEBAR_ITEMS.map(({ icon: Icon, label, path }) => {
            const href = `/hive/${hiveId}/${path}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");

            return (
              <motion.div key={path} variants={itemVariants}>
                <Link
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative w-12 h-12 flex items-center justify-center rounded-lg",
                    "transition-all duration-200 active:scale-[0.95]",
                    "group",
                    isActive
                      ? "bg-accent/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  {/* Active left border indicator */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r"
                      aria-hidden="true"
                    />
                  )}
                  <Icon size="20" variant={isActive ? "Bold" : "Linear"} />

                  {/* Tooltip on hover */}
                  <span
                    className="
                      absolute left-full ml-2 px-2 py-1
                      bg-secondary border border-border rounded text-xs text-foreground
                      whitespace-nowrap pointer-events-none
                      opacity-0 group-hover:opacity-100
                      transition-opacity duration-150
                      z-50
                    "
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                    role="tooltip"
                  >
                    {label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>

        {/* Bottom: Shortcuts & Settings */}
        <div className="mt-auto flex flex-col gap-1">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <button
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
              onClick={() => {
                setIsShortcutOpen(true);
              }}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200 active:scale-[0.95]"
            >
              <Keyboard size="20" variant="Linear" />
            </button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <button
              title="Settings"
              aria-label="Settings"
              onClick={() => {
                setConfirmName("");
                setErrorMsg(null);
                setIsOpen(true);
              }}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-200 active:scale-[0.95]"
            >
              <Setting2 size="20" variant="Linear" />
            </button>
          </motion.div>
        </div>
      </aside>

      {/* Settings Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-popover border border-border text-foreground max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-foreground uppercase tracking-wider font-mono">
              Workspace Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Configure and manage your project workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* Workspace Info */}
            <div className="bg-secondary p-4 rounded-xl border border-border/50 space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono block">Workspace Name</span>
              <span className="text-sm font-bold text-foreground">{workspaceName || "Loading..."}</span>
            </div>

            {/* Danger Zone */}
            <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-4 space-y-4">
              <span className="text-[10px] font-extrabold uppercase text-destructive font-mono flex items-center gap-1.5 select-none">
                <Warning2 size="16" variant="Bold" className="text-destructive" />
                <span>Danger Zone</span>
              </span>

              <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                Deleting this workspace is permanent and will delete all associated nodes, edges, documents, version histories, activities, chat history, and workflow logs.
              </p>

              <form onSubmit={handleDelete} className="space-y-3">
                <label className="text-[9.5px] uppercase font-bold text-muted-foreground font-mono block">
                  To confirm, type <span className="text-destructive font-bold select-all">"{workspaceName}"</span> below:
                </label>
                
                <Input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Enter workspace name"
                  className="bg-background border-border text-foreground focus-visible:border-destructive/50 focus-visible:ring-destructive/10 text-xs py-2 px-3 h-9 rounded-xl"
                  disabled={isDeleting || !workspaceName}
                  required
                />

                {errorMsg && (
                  <p className="text-[10px] font-bold font-mono text-destructive bg-destructive/10 border border-destructive/30 p-2 rounded-lg">
                    {errorMsg}
                  </p>
                )}

                <DialogFooter className="pt-2 flex justify-end gap-2 border-0 bg-transparent p-0 -mx-0 -mb-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary/40 text-[10px] uppercase font-bold tracking-wider font-mono h-9 rounded-xl"
                    onClick={() => setIsOpen(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={!workspaceName || confirmName !== workspaceName || isDeleting}
                    className="bg-destructive hover:bg-destructive/80 text-white text-[10px] uppercase font-bold tracking-wider font-mono h-9 rounded-xl disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {isDeleting ? "Deleting Workspace..." : "Delete Workspace"}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </div>
      </Dialog>

      {/* Keyboard Shortcuts Modal */}
      <Dialog open={isShortcutOpen} onOpenChange={setIsShortcutOpen}>
        <DialogContent className="bg-popover border border-border text-foreground max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-foreground uppercase tracking-wider font-mono flex items-center gap-2">
              <Keyboard size="20" className="text-primary" />
              <span>Keyboard Shortcuts</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Quickly navigate HiveOS with hotkeys.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs font-mono">
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Shortcuts Helper</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">?</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Close Dialogs</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">ESC</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Go to Canvas</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">C</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Go to Tasks</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">T</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Go to Docs</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">D</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/55">
              <span className="text-muted-foreground">Go to Activity</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">A</kbd>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted-foreground">Go to Intelligence</span>
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border text-foreground font-bold text-[10px]">I</kbd>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full text-[10px] uppercase font-bold tracking-wider font-mono h-9 rounded-xl"
              onClick={() => setIsShortcutOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
