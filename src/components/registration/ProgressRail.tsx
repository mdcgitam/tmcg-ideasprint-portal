import { cn } from "@/lib/utils";

interface ProgressRailProps {
  steps: readonly string[];
  activeIndex: number;
}

/**
 * Registration should feel like progressing through a mission, not filling
 * a boring form (prompt.md §4, §18) — a numbered rail rather than a plain
 * <progress> bar.
 */
export function ProgressRail({ steps, activeIndex }: ProgressRailProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {steps.map((label, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
        return (
          <div key={label} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs transition-colors duration-300",
                  state === "done" && "bg-gold text-void",
                  state === "active" && "border border-gold text-gold",
                  state === "upcoming" && "border border-border text-ink-faint",
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "hidden font-heading text-xs tracking-wide uppercase sm:block",
                  state === "upcoming" ? "text-ink-faint" : "text-ink",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-border">
                <span
                  className="block h-px bg-gold transition-all duration-500"
                  style={{ width: state === "done" ? "100%" : "0%" }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
