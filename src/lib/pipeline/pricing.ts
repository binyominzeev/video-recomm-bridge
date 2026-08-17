export const PRICING_VERSION = "2026-08-17";
export const CURRENCY = "USD";

export const pricing = {
  transcription: {
    assemblyaiPerAudioHour: 0.37,
    fasterWhisperPerAudioHour: null as number | null,
  },
  chat: {
    inputPerMillionTokens: 0.15,
    outputPerMillionTokens: 0.6,
  },
  embedding: {
    model: "text-embedding-3-small",
    perMillionTokens: 0.02,
  },
} as const;

export type TranscriptionProvider = "assemblyai" | "faster-whisper";

export function getChatTokenCost(inputTokens: number, outputTokens: number) {
  return (
    (inputTokens / 1_000_000) * pricing.chat.inputPerMillionTokens +
    (outputTokens / 1_000_000) * pricing.chat.outputPerMillionTokens
  );
}