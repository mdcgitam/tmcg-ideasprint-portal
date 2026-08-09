import type { Metadata } from "next";
import { RegistrationStepper } from "@/components/registration/RegistrationStepper";

export const metadata: Metadata = {
  title: "Register Your Team | TMCG IdeaSprint 4.0",
  description: "Register your team for TMCG IdeaSprint 4.0 — GITAM Visakhapatnam.",
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-void">
      <RegistrationStepper />
    </main>
  );
}
