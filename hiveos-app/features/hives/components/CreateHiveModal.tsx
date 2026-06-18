"use client";

/**
 * features/hives/components/CreateHiveModal.tsx — Create Hive Dialog
 *
 * Purpose: Modal dialog for creating a new Hive workspace.
 * Uses shadcn/ui Dialog for accessible, animated modal behavior.
 *
 * Form fields:
 * - Name (required, 1-50 chars)
 * - Description (optional, max 500 chars)
 *
 * On submit → calls useCreateHive mutation → closes modal on success
 *
 * Interactions:
 * - Uses: features/hives/hooks/useHives.ts (useCreateHive)
 * - Uses: shadcn Dialog, Input, Label, Button
 * - Used by: app/(dashboard)/dashboard/page.tsx
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateHive } from "@/features/hives/hooks/useHives";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface CreateHiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateHiveModal({ open, onOpenChange }: CreateHiveModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const createHive = useCreateHive();

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        nameInputRef.current?.focus();
        // Reset form state asynchronously to prevent setState in effect warning
        setName("");
        setDescription("");
        setValidationError(null);
      }, 100);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Hive name is required");
      return;
    }
    if (trimmedName.length > 50) {
      setValidationError("Name cannot exceed 50 characters");
      return;
    }

    setValidationError(null);

    createHive.mutate(
      { name: trimmedName, description: description.trim() || undefined },
      {
        onSuccess: (newHive) => {
          onOpenChange(false);
          router.push(`/hive/${newHive.id}/onboarding`);
        },
        onError: (err) => {
          setValidationError(err.message);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-[#141920] border-[#1e2533]
          max-w-[440px]
          text-[#f1f5f9]
        "
      >
        <DialogHeader>
          <DialogTitle
            className="text-[#f1f5f9] text-xl font-semibold"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Initialize Hive
          </DialogTitle>
          <DialogDescription className="text-[#94a3b8] text-sm">
            Create a new workspace for your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-2">
            <Label
              htmlFor="hive-name"
              className="text-[#f1f5f9] text-sm font-medium"
            >
              Hive Name{" "}
              <span className="text-[#ef4444]" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="hive-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Project_Ares"
              maxLength={50}
              className="
                bg-[#0e1117] border-[#1e2533] text-[#f1f5f9]
                placeholder:text-[#475569]
                focus:border-[#f5a623] focus:ring-0
                h-10
              "
              aria-required="true"
              aria-describedby={validationError ? "name-error" : undefined}
            />
            {/* Character count */}
            <p className="text-[11px] text-[#475569] text-right">
              {name.length}/50
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label
              htmlFor="hive-description"
              className="text-[#f1f5f9] text-sm font-medium"
            >
              Description{" "}
              <span className="text-[#475569] text-xs font-normal">
                (optional)
              </span>
            </Label>
            <textarea
              id="hive-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              maxLength={500}
              rows={3}
              className="
                w-full rounded-md border border-[#1e2533]
                bg-[#0e1117] text-[#f1f5f9]
                placeholder:text-[#475569]
                px-3 py-2 text-sm
                focus:outline-none focus:border-[#f5a623]
                resize-none transition-colors
              "
            />
            <p className="text-[11px] text-[#475569] text-right">
              {description.length}/500
            </p>
          </div>

          {/* Validation error */}
          {validationError && (
            <p
              id="name-error"
              className="text-[#ef4444] text-xs animate-fade-up"
              role="alert"
            >
              {validationError}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={createHive.isPending}
              className="text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2533]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createHive.isPending || !name.trim()}
              className="
                bg-[#f5a623] text-[#1a0e00] font-bold
                hover:bg-[#e09415]
                disabled:opacity-50
                min-w-[120px]
              "
            >
              {createHive.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Initialize Hive"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
