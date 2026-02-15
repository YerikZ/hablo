import { env, hasOpenAiConfigured } from "@/lib/env";
import { TurnModelOutput } from "@/lib/types";

const MODEL = "gpt-4.1-mini";

function detectLanguage(text: string): "es" | "en" {
  const lowered = text.toLowerCase();
  const hints = [" the ", " and ", " is ", " are ", "what", "how", "where"];
  return hints.some((h) => lowered.includes(h)) ? "en" : "es";
}

async function openAiFetch(path: string, init: RequestInit) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${msg}`);
  }

  return response;
}

export async function transcribeAudio(file: Blob | File) {
  if (!hasOpenAiConfigured()) {
    return { transcriptText: "No OpenAI key configured. Please type your message.", detectedLanguage: "en" as const };
  }

  const form = new FormData();
  form.append("model", "gpt-4o-mini-transcribe");
  const fileType = file.type || "audio/webm";
  const extension = fileType.includes("mp4")
    ? "m4a"
    : fileType.includes("mpeg")
      ? "mp3"
      : "webm";
  form.append("file", file, `speech.${extension}`);

  const res = await openAiFetch("/audio/transcriptions", { method: "POST", body: form });
  const json = (await res.json()) as { text: string };
  const transcriptText = (json.text || "").trim();

  return {
    transcriptText,
    detectedLanguage: detectLanguage(transcriptText)
  };
}

export async function synthesizeSpeech(textEs: string, voice: string) {
  if (!hasOpenAiConfigured()) {
    throw new Error("OPENAI_API_KEY is required for TTS");
  }

  return openAiFetch("/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: textEs })
  });
}

export async function generateTurn(params: {
  theme: string;
  level: string;
  durationMinutes: number;
  elapsedMinutes: number;
  memorySummary?: string | null;
  coachMode: boolean;
  messages: { role: "user" | "assistant" | "system"; contentText: string }[];
  userText: string;
}): Promise<TurnModelOutput> {
  const fallbackLang = detectLanguage(params.userText);

  if (!hasOpenAiConfigured()) {
    return {
      assistant_reply_es:
        fallbackLang === "en"
          ? "Buena idea. Responde en una o dos frases en espanol, por favor. ?Que hiciste hoy?"
          : "Muy bien. Sigamos practicando. ?Que parte de tu dia quieres describir?",
      assistant_reply_en_sentences: [
        "Good idea.",
        "Please answer in one or two Spanish sentences.",
        "What did you do today?"
      ],
      wrapup_triggered: params.elapsedMinutes >= params.durationMinutes,
      user_translation: {
        user_text_language: fallbackLang,
        user_translation_sentences: [params.userText]
      },
      analysis: params.coachMode
        ? {
            corrected_user_text_es: fallbackLang === "en" ? "Hoy practico espanol todos los dias." : null,
            highlights: [],
            explanations_en: ["Keep answers short and use present tense consistently."],
            alternatives: [],
            mistakes: [],
            flashcards_suggestions: [],
            session_memory_update: null
          }
        : undefined
    };
  }

  const schema = {
    name: "turn_output",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        assistant_reply_es: { type: "string" },
        assistant_reply_en_sentences: {
          type: "array",
          items: { type: "string" }
        },
        wrapup_triggered: { type: "boolean" },
        user_translation: {
          type: "object",
          additionalProperties: false,
          properties: {
            user_text_language: { type: "string", enum: ["es", "en"] },
            user_translation_sentences: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["user_text_language", "user_translation_sentences"]
        },
        analysis: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                corrected_user_text_es: { anyOf: [{ type: "string" }, { type: "null" }] },
                highlights: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      start: { type: "number" },
                      end: { type: "number" },
                      label: { type: "string" }
                    },
                    required: ["start", "end", "label"]
                  }
                },
                explanations_en: { type: "array", items: { type: "string" } },
                alternatives: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string", enum: ["more_natural", "more_formal"] },
                      text_es: { type: "string" }
                    },
                    required: ["label", "text_es"]
                  }
                },
                mistakes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      category: { type: "string" },
                      note: { type: "string" },
                      example_fix: { type: "string" }
                    },
                    required: ["category", "note", "example_fix"]
                  }
                },
                flashcards_suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      front: { type: "string" },
                      back: { type: "string" },
                      tags: { type: "array", items: { type: "string" } }
                    },
                    required: ["front", "back", "tags"]
                  }
                },
                session_memory_update: { anyOf: [{ type: "string" }, { type: "null" }] }
              },
              required: [
                "corrected_user_text_es",
                "highlights",
                "explanations_en",
                "alternatives",
                "mistakes",
                "flashcards_suggestions",
                "session_memory_update"
              ]
            }
          ]
        }
      },
      required: [
        "assistant_reply_es",
        "assistant_reply_en_sentences",
        "wrapup_triggered",
        "user_translation",
        "analysis"
      ]
    },
    strict: true
  };

  const systemText = [
    "You are Hablo coach, a concise Spanish tutor for Spain Spanish.",
    `Level: ${params.level}. Theme: ${params.theme}.`,
    `Elapsed: ${params.elapsedMinutes} minutes of ${params.durationMinutes}.`,
    "Respond in Spanish first; include concise English guidance if user writes in English.",
    "Keep feedback brief and capped at 3 explanations.",
    params.coachMode ? "Coach mode is ON." : "Coach mode is OFF; set analysis to null.",
    params.memorySummary ? `Session memory summary: ${params.memorySummary}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const conversation = params.messages.map((m) => `${m.role.toUpperCase()}: ${m.contentText}`).join("\n");
  const userPrompt = `Conversation:\n${conversation}\n\nLatest user text:\n${params.userText}`;

  const res = await openAiFetch("/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemText }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "turn_output",
          schema: schema.schema,
          strict: true
        }
      }
    })
  });

  const json = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text = json.output_text || json.output?.[0]?.content?.[0]?.text;
  if (!text) {
    throw new Error("OpenAI response did not include parseable output text");
  }
  const parsed = JSON.parse(text) as TurnModelOutput;

  if (!params.coachMode) {
    parsed.analysis = undefined;
  }

  return parsed;
}
