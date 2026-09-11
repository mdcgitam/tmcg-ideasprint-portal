/**
 * Mirrors resolve_member_exit's TEAM_MIN_SIZE gate (supabase/migrations/0038)
 * exactly, so the UI can disable an Approve button instead of only failing
 * after the click. Approving `memberId` is blocked only when the team's
 * OTHER active members would drop below 3 and at least one of them doesn't
 * already have an exit request of their own in flight (Requested or
 * Approved) — i.e. the whole team isn't exiting together.
 */
export function canApproveExit(
  memberId: string,
  activeMemberIds: string[],
  currentStatusByProfileId: Record<string, "Requested" | "Approved" | "Rejected" | undefined>,
): boolean {
  const others = activeMemberIds.filter((id) => id !== memberId);
  if (others.length >= 3) return true;
  return others.every((id) => {
    const status = currentStatusByProfileId[id];
    return status === "Requested" || status === "Approved";
  });
}
