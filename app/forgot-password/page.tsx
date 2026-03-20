import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="space-y-4">
      <ForgotPasswordForm />
      <p className="text-center text-sm text-slate-600">
        Back to <Link className="underline" href="/login">Log in</Link>
      </p>
    </main>
  );
}
