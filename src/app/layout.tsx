import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { SvgFilterDefs } from "@/components/motion/SvgFilterDefs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tmcg.mdcgitam.in"),
  title: "TMCG IdeaSprint 4.0 | GITAM Visakhapatnam",
  description:
    "TMCG IdeaSprint 4.0 — the official campus innovation event portal for GITAM University Visakhapatnam, jointly organized by TMCG and Meta Developer Communities (MDC) GITAM Visakhapatnam.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-void text-ink">
        <SvgFilterDefs />
        {children}
      </body>
    </html>
  );
}
