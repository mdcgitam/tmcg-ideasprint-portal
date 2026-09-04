import type { ExitRequestRow } from "@/types/database";

/** Small status badge for a member's exit-request state, reused across Teams/TeamDetailModal/Overview. */
export function ExitStatusBadge({ request }: { request: ExitRequestRow | undefined }) {
  if (!request) {
    return <span className="font-heading text-xs text-ink-muted">Active</span>;
  }
  const label = request.status === "Approved" ? "Exited" : request.status === "Requested" ? "Exit Requested" : "Rejected";
  const className =
    request.status === "Approved"
      ? "text-danger"
      : request.status === "Requested"
        ? "text-gold"
        : "text-ink-muted";
  return <span className={`font-heading text-xs ${className}`}>{label}</span>;
}

/** True once a member's exit request has been approved (i.e. they're deactivated). */
export function isExited(request: ExitRequestRow | undefined): boolean {
  return request?.status === "Approved";
}
