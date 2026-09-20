"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Public-site content guard - deters casual copying (right-click "Save
 * image as" / "Open image in new tab", text selection, drag) and blocks
 * Ctrl+scroll zoom. Scoped to the public Home + Register pages only (see
 * PublicLayout) - the dashboards deliberately keep normal selection, since
 * staff regularly copy team IDs, emails, and phone numbers out of tables
 * there.
 *
 * This is a deterrent, not real protection - devtools, view-source, and
 * screenshots all bypass it, and keyboard/menu-driven browser zoom
 * (Ctrl+/Ctrl-, the browser's own zoom menu) can't be blocked by a page at
 * all; only Ctrl+wheel is interceptable.
 */
export function CopyGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    function blockCtrlWheelZoom(e: WheelEvent) {
      if (e.ctrlKey) e.preventDefault();
    }
    window.addEventListener("wheel", blockCtrlWheelZoom, { passive: false });
    return () => window.removeEventListener("wheel", blockCtrlWheelZoom);
  }, []);

  return (
    <div className="copy-guard" onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}
