/**
 * components/workspace/WorkspaceEmptySection.tsx — Empty Section Placeholder
 *
 * Purpose: Shared component for workspace tab pages that have no functionality yet.
 * Shows a styled empty state that matches the HiveOS aesthetic.
 *
 * Interactions:
 * - Used by: ALL workspace tab pages (canvas, tasks, documents, activity, intelligence)
 */

interface WorkspaceEmptySectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function WorkspaceEmptySection({
  icon,
  title,
  description,
  badge,
}: WorkspaceEmptySectionProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center animate-fade-up">
        {/* Icon container */}
        <div className="w-20 h-20 rounded-2xl bg-[#1a1f2c] border border-[#1e2533] flex items-center justify-center mx-auto mb-6 text-[#475569]">
          {icon}
        </div>

        {/* Optional badge */}
        {badge && (
          <span
            className="inline-block px-3 py-1 mb-4 text-[10px] font-bold tracking-[0.12em] uppercase rounded bg-[#1e2533] text-[#94a3b8]"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {badge}
          </span>
        )}

        <h2
          className="text-[#f1f5f9] font-bold text-2xl mb-3"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          {title}
        </h2>
        <p className="text-[#94a3b8] text-sm max-w-[320px] mx-auto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
