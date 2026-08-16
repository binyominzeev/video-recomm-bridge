import fs from "fs";

export interface TranscriptionResult {
  text: string;
  language: string;
  durationMs: number;
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

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Whisper endpoint error: ${response.statusText}`);
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
