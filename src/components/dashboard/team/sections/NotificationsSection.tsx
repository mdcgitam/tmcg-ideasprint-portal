"use client";

import type { NotificationRow } from "@/types/database";
import { markNotificationRead } from "@/lib/dashboard/team-actions";
import { NotificationsInbox } from "@/components/dashboard/NotificationsInbox";

/** Every notification addressed to this person — registration updates, approval/exit decisions, NOC/PPT/attendance notices, and anything an admin has broadcast. */
export function NotificationsSection({
  profileId,
  notifications,
}: {
  profileId: string;
  notifications: NotificationRow[];
}) {
  return <NotificationsInbox profileId={profileId} notifications={notifications} onMarkRead={markNotificationRead} />;
}
