import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="card p-10 text-center">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Spanish Practice Tutor</p>
      <h1 className="mb-4 text-4xl font-bold">Speak Spanish. Get coached turn by turn.</h1>
      <p className="mx-auto mb-8 max-w-2xl text-slate-600">
        Hablo is a voice-first Spanish coach for Spain Spanish. Record your answer, receive translations,
        corrections, and flashcards from recurring mistakes.
      </p>
      <div className="flex justify-center gap-3">
        <Link className="btn btn-primary" href="/signup">
          Start practising
        </Link>
        <Link className="btn btn-outline" href="/login">
          Log in
        </Link>
      </div>
    </main>
  );
}
