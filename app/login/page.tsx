import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="space-y-4">
      <AuthForm mode="login" />
      <p className="text-center text-sm text-slate-600">
        Forgot password?{" "}
        <Link className="underline" href="/forgot-password">
          Reset it
        </Link>
      </p>
      <p className="text-center text-sm text-slate-600">
        Need an account? <Link className="underline" href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
