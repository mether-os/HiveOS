"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Repository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  description: string;
  htmlUrl: string;
}

interface ConnectRepoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hiveId: string;
  onSuccess: () => void;
}

export function ConnectRepoModal({
  open,
  onOpenChange,
  hiveId,
  onSuccess,
}: ConnectRepoModalProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepoIndex, setSelectedRepoIndex] = useState<number>(-1);
  const [notConnected, setNotConnected] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    setSelectedRepoIndex(-1);
    try {
      const res = await fetch(`/api/hives/${hiveId}/github/repos`);
      const payload = await res.json();

      if (!res.ok) {
        if (payload.error === "github_not_connected") {
          setNotConnected(true);
        } else {
          setError(payload.message || "Failed to load GitHub repositories.");
        }
        return;
      }

      setRepos(payload.data || []);
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  }, [hiveId]);

  useEffect(() => {
    if (open) {
      fetchRepos();
    }
  }, [open, fetchRepos]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRepoIndex < 0) return;

    const repo = repos[selectedRepoIndex];
    if (!repo) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/hives/${hiveId}/github/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
        }),
      });
      
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to link repository.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to link repository.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-[#141920] border-[#1e2533]
          max-w-[460px]
          text-[#f1f5f9]
        "
      >
        <DialogHeader>
          <DialogTitle
            className="text-[#f1f5f9] text-xl font-semibold"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Connect GitHub Repository
          </DialogTitle>
          <DialogDescription className="text-[#94a3b8] text-sm">
            Link a GitHub repository to feed live event streams into your HiveOS timeline.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#f5a623]" />
            <p className="text-sm text-[#94a3b8]">Fetching repositories from GitHub...</p>
          </div>
        ) : notConnected ? (
          <div className="py-4 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertCircle className="h-6 w-6 text-[#f5a623]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#f1f5f9]">GitHub Account Not Linked</h3>
              <p className="text-sm text-[#94a3b8] px-4">
                To link a repository, you must connect your GitHub account. 
                Please log out and log back in using GitHub to grant repository access.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533]"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="flex items-start gap-2 text-red-400 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[#f1f5f9] text-sm font-medium">
                Select Repository
              </Label>
              {repos.length === 0 ? (
                <div className="text-center py-6 bg-[#0e1117] border border-[#1e2533] rounded-md text-sm text-[#475569]">
                  No repositories found on your GitHub account.
                </div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto border border-[#1e2533] rounded-md bg-[#0e1117] divide-y divide-[#1e2533]">
                  {repos.map((repo, idx) => (
                    <label
                      key={repo.id}
                      className={`
                        flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors text-sm
                        ${selectedRepoIndex === idx ? "bg-[#f5a623]/10" : "hover:bg-[#141920]"}
                      `}
                    >
                      <div className="flex flex-col space-y-0.5 max-w-[85%]">
                        <span className="font-medium text-[#f1f5f9] truncate">
                          {repo.fullName}
                        </span>
                        {repo.description && (
                          <span className="text-xs text-[#475569] truncate">
                            {repo.description}
                          </span>
                        )}
                      </div>
                      <input
                        type="radio"
                        name="repo"
                        checked={selectedRepoIndex === idx}
                        onChange={() => setSelectedRepoIndex(idx)}
                        className="h-4 w-4 accent-[#f5a623] cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || selectedRepoIndex < 0}
                className="
                  bg-[#f5a623] text-[#1a0e00] font-bold
                  hover:bg-[#e09415]
                  disabled:opacity-50
                  min-w-[120px]
                "
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  "Connect Repo"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
