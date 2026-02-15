export const env = {
  authSecret: process.env.AUTH_SECRET || "dev-secret-change-me",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  dailyTurnLimit: Number(process.env.DAILY_TURN_LIMIT || "120"),
  memorySummaryEveryN: Number(process.env.MEMORY_SUMMARY_EVERY_N || "6"),
  defaultTtsVoice: process.env.DEFAULT_TTS_VOICE || "shimmer"
};

export function hasOpenAiConfigured() {
  return Boolean(env.openAiApiKey);
}
