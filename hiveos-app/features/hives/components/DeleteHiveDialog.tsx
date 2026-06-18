"use client";

/**
 * features/hives/components/DeleteHiveDialog.tsx — Delete Confirmation Dialog
 *
 * Purpose: Confirmation dialog before deleting a Hive.
 * Prevents accidental deletion with a clear warning and explicit confirmation.
 *
 * Pattern: "Destructive confirmation" — shows the hive name in the dialog
 * so users know exactly what they're deleting.
 *
 * On confirm → calls useDeleteHive mutation → closes dialog on success.
 * The list updates optimistically (card disappears immediately).
 *
 * Interactions:
 * - Uses: features/hives/hooks/useHives.ts (useDeleteHive)
 * - Uses: shadcn Dialog, Button
 * - Used by: features/hives/components/HiveGrid.tsx
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteHive } from "@/features/hives/hooks/useHives";
import type { Hive } from "@/features/hives/types";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteHiveDialogProps {
  hive: Hive | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteHiveDialog({
  hive,
  open,
  onOpenChange,
}: DeleteHiveDialogProps) {
  const deleteHive = useDeleteHive();

  function handleConfirm() {
    if (!hive) return;

    deleteHive.mutate(hive.id, {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        console.error("[DeleteHiveDialog] Delete failed:", err);
        // Error is visible via the mutation state — keep dialog open
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Prevent closing while delete is in progress
        if (!deleteHive.isPending) onOpenChange(o);
      }}
    >
      <DialogContent className="bg-[#141920] border-[#1e2533] max-w-[400px] text-[#f1f5f9]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
            </div>
            <DialogTitle
              className="text-[#f1f5f9] text-lg font-semibold"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              Delete Hive
            </DialogTitle>
          </div>
          <DialogDescription className="text-[#94a3b8] text-sm leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="text-[#f1f5f9] font-semibold">
              &quot;{hive?.name}&quot;
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Mutation error */}
        {deleteHive.isError && (
          <p className="text-[#ef4444] text-xs px-1 animate-fade-up" role="alert">
            Failed to delete: {deleteHive.error?.message}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deleteHive.isPending}
            className="text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={deleteHive.isPending}
            className="
              bg-[#ef4444] text-white font-bold
              hover:bg-[#dc2626]
              disabled:opacity-50
              min-w-[120px]
            "
          >
            {deleteHive.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              "Delete Hive"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
