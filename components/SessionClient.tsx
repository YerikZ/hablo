"use client";

import { useEffect, useRef, useState } from "react";

type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  contentText: string;
  language: "es" | "en";
  translationJson?: string[] | null;
};

type TurnAnalysis = {
  id: string;
  userMessageId: string;
  correctedTextEs: string | null;
  highlightsJson: { start: number; end: number; label: string }[];
  explanationsJson: string[];
  alternativesJson: { label: "more_natural" | "more_formal"; textEs?: string; text_es?: string }[];
  mistakesJson: { category: string; note: string; example_fix: string }[];
};

export function SessionClient({
  session,
  initialMessages,
  initialAnalyses
}: {
  session: { id: string; coachMode: boolean; level: string; theme: string; durationMinutes: number; startedAt: string };
  initialMessages: UIMessage[];
  initialAnalyses: TurnAnalysis[];
}) {
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [analyses, setAnalyses] = useState<TurnAnalysis[]>(initialAnalyses);
  const [textInput, setTextInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [pendingStage, setPendingStage] = useState<"idle" | "transcribing" | "responding">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingMimeTypeRef = useRef<string>("audio/webm");
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  const latestAnalysis = analyses[0];
  const sessionId = encodeURIComponent(session.id);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [session.startedAt]);

  const elapsedMinutesPart = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const elapsedSecondsPart = String(elapsedSeconds % 60).padStart(2, "0");

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, pendingStage]);

  async function playTts(textEs: string, options?: { silent?: boolean }) {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textEs })
    });

    if (!response.ok) {
      if (options?.silent) return;
      const data = await response.json();
      setError(data.error || "TTS failed");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    try {
      await audio.play();
    } catch {
      if (!options?.silent) {
        setError("Audio playback was blocked by the browser.");
      }
    }
  }

  async function sendUserMessage(contentText: string) {
    if (!contentText?.trim()) return;
    setBusy(true);
    setPendingStage("responding");
    setError(null);
    setStreamingText("");

    const userTempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userTempId, role: "user", contentText, language: "es", translationJson: null }
    ]);

    let response: Response;
    try {
      response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentText })
      });
    } catch {
      setError("Could not send message. Check your connection and try again.");
      setBusy(false);
      setPendingStage("idle");
      return;
    }

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({ error: "Failed to send message" }));
      setError(data.error || "Failed to send message");
      setBusy(false);
      setPendingStage("idle");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalAssistant: UIMessage | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventBlock of events) {
        const lines = eventBlock.split("\n");
        const type = lines.find((line) => line.startsWith("event:"))?.replace("event: ", "").trim();
        const dataLine = lines.find((line) => line.startsWith("data:"));
        if (!type || !dataLine) continue;

        let data: any;
        try {
          data = JSON.parse(dataLine.replace("data: ", "")) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (type === "assistant_delta") {
          setStreamingText((prev) => prev + data.text);
        }

        if (type === "assistant_final") {
          const assistantId = data.assistant_message_id || `assistant-${Date.now()}`;
          finalAssistant = {
            id: assistantId,
            role: "assistant",
            contentText: data.assistant_reply_es,
            language: "es",
            translationJson: data.assistant_reply_en_sentences
          };
          if (data.user_message_id) {
            setMessages((prev) =>
              prev.map((message) => (message.id === userTempId ? { ...message, id: data.user_message_id } : message))
            );
          }
          setStreamingText("");
          setMessages((prev) => [...prev, finalAssistant!]);
        }

        if (type === "user_translation") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === (data.user_message_id || userTempId)
                ? {
                    ...message,
                    language: data.user_text_language,
                    translationJson: data.user_translation_sentences
                  }
                : message
            )
          );
        }

        if (type === "turn_analysis") {
          setAnalyses((prev) => [data, ...prev]);
        }

        if (type === "error") {
          setError((data.message as string) || "Assistant stream failed");
        }
      }
    }

    if (!finalAssistant) {
      setError("Assistant response failed");
    }

    setBusy(false);
    setPendingStage("idle");
  }

  async function startRecording() {
    setError(null);

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setError("Microphone is unavailable here. Open the app on localhost or https, then try again.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not available in this browser. Use text input instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
      ];
      const selectedMimeType =
        preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recordingMimeTypeRef.current = recorder.mimeType || selectedMimeType || "audio/webm";

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === "NotAllowedError") {
        setError("Microphone access denied. Allow microphone permission in your browser.");
        return;
      }
      if (name === "NotFoundError") {
        setError("No microphone device found.");
        return;
      }
      setError("Could not start recording. If using HTTP, switch to localhost or https.");
    }
  }

  async function stopAndUploadRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorder.stream.getTracks().forEach((track) => track.stop());

    setRecording(false);
    const mimeType = recordingMimeTypeRef.current || "audio/webm";
    const extension = mimeType.includes("mp4")
      ? "m4a"
      : mimeType.includes("mpeg")
        ? "mp3"
        : "webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (!blob.size) {
      setError("No audio captured. Please record again.");
      return;
    }
    const formData = new FormData();
    formData.append("audio", blob, `speech.${extension}`);

    try {
      setBusy(true);
      setPendingStage("transcribing");
      const sttResponse = await fetch(`/api/sessions/${sessionId}/stt`, {
        method: "POST",
        body: formData
      });

      const sttData = await sttResponse.json();
      if (!sttResponse.ok) {
        setError(sttData.error || "STT failed");
        setBusy(false);
        setPendingStage("idle");
        return;
      }

      if (!sttData?.transcriptText?.trim()) {
        setError("Transcription was empty. Please try recording again.");
        setBusy(false);
        setPendingStage("idle");
        return;
      }

      await sendUserMessage(sttData.transcriptText);
    } catch {
      setError("Upload failed. Please refresh and try recording again.");
      setBusy(false);
      setPendingStage("idle");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{session.theme}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
              {session.level} · {session.durationMinutes}m · Spain
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
              Elapsed {elapsedMinutesPart}:{elapsedSecondsPart}
            </span>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => {
            const analysis = analyses.find((a) => a.userMessageId === message.id);
            const pronunciationTarget =
              analysis?.correctedTextEs ||
              (message.language === "en" ? message.translationJson?.[0] || "" : message.contentText);
            return (
              <div key={message.id} className={`rounded-xl p-3 ${message.role === "assistant" ? "bg-orange-50" : "bg-slate-100"}`}>
                <p className="mb-1 text-xs uppercase text-slate-500">{message.role}</p>
                <p className="whitespace-pre-wrap text-sm">{message.contentText}</p>
                {message.translationJson?.length ? (
                  <div className="mt-2 rounded-lg bg-white/80 p-2 text-xs text-slate-700">
                    {(message.translationJson || []).map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {message.role === "assistant" ? (
                    <button className="btn btn-outline" onClick={() => playTts(message.contentText)}>
                      Play Spanish
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline"
                      onClick={() => playTts(pronunciationTarget)}
                    >
                      Correct pronunciation
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {streamingText ? (
            <div className="rounded-xl bg-orange-100 p-3 text-sm text-slate-800">{streamingText}</div>
          ) : null}

          {pendingStage !== "idle" ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="mb-2 text-xs font-medium text-orange-800">
                {pendingStage === "transcribing" ? "Transcribing audio..." : "Waiting for tutor response..."}
              </p>
              <div className="h-2 overflow-hidden rounded bg-orange-100">
                <div className="h-full w-1/2 animate-pulse rounded bg-orange-500" />
              </div>
            </div>
          ) : null}
          <div ref={endOfMessagesRef} />
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const text = textInput;
            setTextInput("");
            await sendUserMessage(text);
          }}
        >
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Type fallback message"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" disabled={busy}>
              Send text
            </button>
            {!recording ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={startRecording}
                disabled={busy}
              >
                Record
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline"
                onClick={stopAndUploadRecording}
                disabled={busy}
              >
                Stop + Upload
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={async () => {
                await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
                window.location.href = "/app";
              }}
            >
              End session
            </button>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card p-3">
          <h2 className="mb-2 font-semibold">Tutor</h2>
          <img
            src="/rubio.png"
            alt="Tutor photo"
            className="h-[350px] w-full rounded-lg object-cover object-[center_50%]"
          />
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Corrections</h2>
          {latestAnalysis ? (
            <>
              {latestAnalysis.correctedTextEs ? (
                <p className="mb-2 text-sm">Corrected: {latestAnalysis.correctedTextEs}</p>
              ) : null}
              {(latestAnalysis.explanationsJson || []).map((line, idx) => (
                <p key={idx} className="mb-1 text-sm text-slate-700">
                  {line}
                </p>
              ))}
            </>
          ) : (
            <p className="text-sm text-slate-600">No correction yet.</p>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Vocabulary</h2>
          <p className="text-sm text-slate-600">Saved phrases can be generated into flashcards automatically.</p>
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Session settings</h2>
          <p className="text-sm">Theme: {session.theme}</p>
          <p className="text-sm">Level: {session.level}</p>
          <p className="text-sm">Region: Spain</p>
          <p className="text-sm">UI language: English</p>
          <p className="text-sm">Coach mode: {session.coachMode ? "On" : "Off"}</p>
        </div>
      </aside>
    </div>
  );
}
