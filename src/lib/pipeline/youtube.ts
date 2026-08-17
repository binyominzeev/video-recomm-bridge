import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface YTVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  upload_date: string;
  duration: number;
  view_count: number;
  webpage_url: string;
}

export async function discoverYouTubeVideos(
  channelUrl: string,
  limit: number
): Promise<YTVideoInfo[]> {
  const args = [
    "--flat-playlist",
    "--print-json",
    "--skip-download",
    "--no-warnings",
    "--playlist-end",
    String(limit * 3),
    channelUrl,
  ];

  let stdout = "";

  try {
    const result = await execFileAsync("yt-dlp", args, {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (error: unknown) {
    const err = error as { stdout?: string; message?: string };
    stdout = err.stdout || "";
    if (!stdout) {
      throw new Error(`yt-dlp failed: ${err.message || "unknown error"}`);
    }
  }

  const lines = stdout.trim().split("\n").filter(Boolean);
  const videos: YTVideoInfo[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Partial<YTVideoInfo> & {
        id?: string;
        webpage_url?: string;
        view_count?: number;
        thumbnail?: string;
      };

      if (!parsed.id) continue;

      videos.push({
        id: parsed.id,
        title: parsed.title || "",
        description: parsed.description || "",
        thumbnail:
          parsed.thumbnail || `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`,
        upload_date: parsed.upload_date || "",
        duration: Number(parsed.duration) || 0,
        view_count: Number(parsed.view_count) || 0,
        webpage_url:
          parsed.webpage_url || `https://www.youtube.com/watch?v=${parsed.id}`,
      });
    } catch {
      continue;
    }
  }

  videos.sort((a, b) => b.view_count - a.view_count);
  return videos.slice(0, limit);
}

export async function downloadAudio(
  videoUrl: string,
  outputPath: string
): Promise<string> {
  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "--no-playlist",
    "--no-warnings",
    "--print",
    "after_move:filepath",
    "-o",
    outputPath,
    videoUrl,
  ];

  try {
    const { stdout } = await execFileAsync("yt-dlp", args, {
      timeout: 300_000,
    });
    const reportedPaths = stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();
    const outputDir = path.dirname(outputPath);
    const outputName = path.basename(outputPath, path.extname(outputPath));
    const generatedPaths = fs
      .readdirSync(outputDir)
      .filter((name) => name.startsWith(`${outputName}.`))
      .map((name) => path.join(outputDir, name));
    const audioPath = [...reportedPaths, outputPath, ...generatedPaths].find(
      (candidate) => fs.existsSync(candidate)
    );

    if (!audioPath) {
      throw new Error(
        `yt-dlp completed but no audio file was created for ${outputPath}`
      );
    }

    return audioPath;
  } catch (error: unknown) {
    const details = error as { message?: string; stderr?: string };
    const stderr = details.stderr?.trim().slice(-2_000);
    throw new Error(
      `yt-dlp audio download failed: ${details.message || String(error)}${stderr ? `\nstderr: ${stderr}` : ""}`,
      { cause: error }
    );
  }
}

export async function downloadYouTubeSubtitles(
  videoUrl: string,
  outputDir: string
): Promise<string | null> {
  // Create output directory if it doesn't exist
  fs.mkdirSync(outputDir, { recursive: true });

  const subtitlePath = path.join(outputDir, "subtitles");

  // Try to download both manual and auto-generated captions
  const args = [
    "--write-subs",           // Manual captions
    "--write-auto-subs",      // Auto-generated captions
    "--sub-lang",
    "en",
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    "--print",
    "after_move:filepath",
    "-o",
    subtitlePath,
    videoUrl,
  ];

  try {
    const { stdout } = await execFileAsync("yt-dlp", args, {
      timeout: 300_000,
    });

    // Check for downloaded subtitle files (both manual and auto-generated)
    const files = fs.readdirSync(outputDir);
    // Look for .vtt or .srt files (both manual and auto-generated produce these)
    const vttFile = files.find((f) => f.startsWith("subtitles") && f.endsWith(".vtt"));
    const srtFile = files.find((f) => f.startsWith("subtitles") && f.endsWith(".srt"));

    const subtitleFile = vttFile || srtFile;
    if (subtitleFile) {
      const fullPath = path.join(outputDir, subtitleFile);
      return fullPath;
    }

    return null;
  } catch (error: unknown) {
    // If no subtitles are available, return null instead of throwing
    console.info("No subtitles available for this video", { videoUrl });
    return null;
  }
}
