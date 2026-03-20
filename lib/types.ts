import { z } from "zod";

export const levels = ["A1", "A2", "B1", "B2", "C1"] as const;

export const createSessionSchema = z.object({
  theme: z.string().min(3).max(200),
  level: z.enum(levels),
  durationMinutes: z.number().int().min(5).max(180),
  coachMode: z.boolean()
});

export const updateSessionSchema = z.object({
  theme: z.string().min(3).max(200).optional(),
  level: z.enum(levels).optional(),
  durationMinutes: z.number().int().min(5).max(180).optional(),
  coachMode: z.boolean().optional()
});

export const authSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128)
});

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128)
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/)
});

export const confirmResetPasswordSchema = z.object({
  token: z.string().min(20).max(256),
  newPassword: z.string().min(8).max(128)
});

export const messageSchema = z.object({
  contentText: z.string().min(1).max(2000)
});

export const reviewSchema = z.object({
  rating: z.enum(["again", "good"])
});

export type TurnModelOutput = {
  assistant_reply_es: string;
  assistant_reply_en_sentences: string[];
  wrapup_triggered: boolean;
  user_translation: {
    user_text_language: "es" | "en";
    user_translation_sentences: string[];
  };
  analysis?: {
    corrected_user_text_es: string | null;
    highlights: { start: number; end: number; label: string }[];
    explanations_en: string[];
    alternatives: { label: "more_natural" | "more_formal"; text_es: string }[];
    mistakes: { category: string; note: string; example_fix: string }[];
    flashcards_suggestions: { front: string; back: string; tags: string[] }[];
    session_memory_update: string | null;
  };
};
