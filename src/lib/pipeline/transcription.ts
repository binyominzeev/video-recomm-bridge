import fs from "fs";

export interface TranscriptionResult {
  text: string;
  language: string;
  durationMs: number;
}

export function extractTextFromSubtitles(subtitlePath: string): string {
  const content = fs.readFileSync(subtitlePath, "utf-8");

  // Parse VTT or SRT format
  const lines = content.split("\n");
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and metadata
    if (
      trimmed === "WEBVTT" ||
      trimmed.startsWith("Kind:") ||
      trimmed.startsWith("Language:") ||
      trimmed.startsWith("NOTE") ||
      trimmed.startsWith("STYLE") ||
      trimmed === ""
    ) {
      continue;
    }

    // Skip timestamps (HH:MM:SS,mmm --> HH:MM:SS,mmm or HH:MM:SS.mmm --> HH:MM:SS.mmm format)
    if (trimmed.includes("-->")) {
      continue;
    }

    // Skip timing lines (contain : and look like timestamps)
    if (trimmed.match(/^\d{1,2}:\d{2}:\d{2}/)) {
      continue;
    }

    // Remove HTML/VTT tags like <v Speaker Name>, <c>, </c>, <i>, </i>, etc.
    const cleaned = trimmed
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();

    if (cleaned) {
      textLines.push(cleaned);
    }
  }

  return textLines.join(" ");
}

export async function transcribeAudio(
  audioPath: string
): Promise<TranscriptionResult> {
  const provider = process.env.TRANSCRIPTION_PROVIDER || "assemblyai";

  if (provider === "assemblyai") {
    return transcribeWithAssemblyAI(audioPath);
  }

  if (provider === "faster-whisper") {
    return transcribeWithFasterWhisper(audioPath);
  }

  throw new Error(`Unknown transcription provider: ${provider}`);
}

async function transcribeWithAssemblyAI(
  audioPath: string
): Promise<TranscriptionResult> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not set");

  const { AssemblyAI } = await import("assemblyai");
  const client = new AssemblyAI({ apiKey });

  const transcript = await client.transcripts.transcribe({
    audio: audioPath,
    language_detection: true,
  });

  if (transcript.status === "error") {
    throw new Error(`AssemblyAI error: ${transcript.error}`);
  }

  return {
    text: transcript.text || "",
    language: transcript.language_code || "en",
    durationMs: (transcript.audio_duration || 0) * 1000,
  };
}

async function transcribeWithFasterWhisper(
  audioPath: string
): Promise<TranscriptionResult> {
  const endpoint = process.env.WHISPER_ENDPOINT;
  if (!endpoint) throw new Error("WHISPER_ENDPOINT not set");

  const audioBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
  const formData = new FormData();
  formData.append("audio", blob, "audio.mp3");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (error: unknown) {
    const details = error as { message?: string; cause?: unknown };
    throw new Error(
      `Whisper request failed (endpoint: ${new URL(endpoint).origin}, audioBytes: ${audioBuffer.byteLength}): ${details.message || String(error)}`,
      { cause: details.cause || error }
    );
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Whisper endpoint error (${response.status} ${response.statusText}, endpoint: ${new URL(endpoint).origin}): ${responseBody.slice(0, 1_000)}`
    );
  }

  const data = (await response.json()) as {
    text?: string;
    language?: string;
    duration?: number;
  };

  return {
    text: data.text || "",
    language: data.language || "en",
    durationMs: (data.duration || 0) * 1000,
  };
}
