import {
  EVALUATION_SYSTEM_PROMPT,
  EVALUATION_USER_PROMPT,
} from "./evaluation";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from "./extraction";
import {
  CURRENCY,
  getChatTokenCost,
  pricing,
  PRICING_VERSION,
  TranscriptionProvider,
} from "./pricing";

export type EstimateStage = "transcription" | "extraction" | "evaluation" | "embedding";
export type EstimateScenario = "low" | "base" | "high";

export type EstimableVideo = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
};

export type EstimateInput = {
  videos: EstimableVideo[];
  stages: EstimateStage[];
  transcriptionProvider: TranscriptionProvider;
  subtitleHitRate?: number;
  transcriptCharactersPerMinute?: number;
  outputTokensPerChatStage?: number;
};

type StageEstimate = {
  low: number;
  base: number;
  high: number;
};

export type VideoEstimate = {
  videoId: string;
  durationSeconds: number | null;
  warnings: string[];
  stages: Partial<Record<EstimateStage, StageEstimate>>;
  totals: Record<EstimateScenario, number>;
};

export type BulkEstimate = {
  pricingVersion: string;
  currency: string;
  assumptions: {
    subtitleHitRate: number;
    transcriptCharactersPerMinute: number;
    outputTokensPerChatStage: number;
    embeddingCharacterLimit: number;
  };
  warnings: string[];
  videos: VideoEstimate[];
  totals: Record<EstimateScenario, number>;
};

const EMBEDDING_CHARACTER_LIMIT = 8_000;

function clampRate(value: number) {
  return Math.min(1, Math.max(0, value));
}

function estimateChatStage(inputCharacters: number, outputTokens: number): StageEstimate {
  const inputTokens = Math.ceil(inputCharacters / 4);
  const base = getChatTokenCost(inputTokens, outputTokens);
  return { low: base * 0.75, base, high: base * 1.5 };
}

export function estimateBulkCost(input: EstimateInput): BulkEstimate {
  const subtitleHitRate = clampRate(input.subtitleHitRate ?? 0.5);
  const transcriptCharactersPerMinute = input.transcriptCharactersPerMinute ?? 900;
  const outputTokensPerChatStage = input.outputTokensPerChatStage ?? 500;
  const videos = input.videos.map((video) => {
    const warnings: string[] = [];
    const stages: Partial<Record<EstimateStage, StageEstimate>> = {};
    const durationSeconds = video.duration;
    const durationMinutes = durationSeconds === null ? 10 : durationSeconds / 60;

    if (durationSeconds === null) {
      warnings.push("Missing duration; using a 10-minute fallback.");
    }

    if (input.stages.includes("transcription")) {
      const audioHours = durationMinutes / 60;
      const paidCost =
        input.transcriptionProvider === "assemblyai"
          ? audioHours * pricing.transcription.assemblyaiPerAudioHour
          : pricing.transcription.fasterWhisperPerAudioHour === null
            ? null
            : audioHours * pricing.transcription.fasterWhisperPerAudioHour;

      if (paidCost === null) {
        warnings.push("faster-whisper infrastructure pricing is not configured.");
        stages.transcription = { low: 0, base: 0, high: 0 };
      } else {
        stages.transcription = {
          low: paidCost * (1 - subtitleHitRate),
          base: paidCost * (1 - subtitleHitRate * 0.75),
          high: paidCost,
        };
      }
    }

    const transcriptCharacters = durationMinutes * transcriptCharactersPerMinute;
    if (input.stages.includes("extraction")) {
      const promptCharacters = EXTRACTION_SYSTEM_PROMPT.length + EXTRACTION_USER_PROMPT("x".repeat(Math.ceil(transcriptCharacters))).length;
      stages.extraction = estimateChatStage(promptCharacters, outputTokensPerChatStage);
    }

    if (input.stages.includes("evaluation")) {
      const transcript = "x".repeat(Math.ceil(transcriptCharacters));
      const promptCharacters = EVALUATION_SYSTEM_PROMPT.length + EVALUATION_USER_PROMPT(video.title, video.description || "", transcript).length;
      stages.evaluation = estimateChatStage(promptCharacters, outputTokensPerChatStage);
    }

    if (input.stages.includes("embedding")) {
      const embeddingCharacters = Math.min(
        EMBEDDING_CHARACTER_LIMIT,
        video.title.length + transcriptCharacters + (video.description?.length || 0)
      );
      const tokens = embeddingCharacters / 4;
      const base = (tokens / 1_000_000) * pricing.embedding.perMillionTokens;
      stages.embedding = { low: base * 0.75, base, high: base * 1.25 };
    }

    const totals = { low: 0, base: 0, high: 0 };
    for (const stage of Object.values(stages)) {
      if (stage) {
        totals.low += stage.low;
        totals.base += stage.base;
        totals.high += stage.high;
      }
    }

    return { videoId: video.id, durationSeconds, warnings, stages, totals };
  });

  const totals = { low: 0, base: 0, high: 0 };
  const warnings = new Set<string>();
  for (const video of videos) {
    totals.low += video.totals.low;
    totals.base += video.totals.base;
    totals.high += video.totals.high;
    video.warnings.forEach((warning) => warnings.add(warning));
  }

  return {
    pricingVersion: PRICING_VERSION,
    currency: CURRENCY,
    assumptions: {
      subtitleHitRate,
      transcriptCharactersPerMinute,
      outputTokensPerChatStage,
      embeddingCharacterLimit: EMBEDDING_CHARACTER_LIMIT,
    },
    warnings: [...warnings],
    videos,
    totals,
  };
}