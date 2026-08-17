import { prisma } from "@/lib/prisma";
import { downloadYouTubeSubtitles } from "@/lib/pipeline/youtube";
import { extractTextFromSubtitles } from "@/lib/pipeline/transcription";
import fs from "fs";
import path from "path";

const VIDEO_ID = "cmswqbgwg000349annkpfw9rm";

async function debugCaptions() {
  console.log("🔍 Debugging caption extraction for video:", VIDEO_ID);
  console.log("=".repeat(70));

  try {
    // Fetch video from database
    const video = await prisma.video.findUnique({
      where: { id: VIDEO_ID },
      include: { source: true },
    });

    if (!video) {
      console.error("❌ Video not found in database");
      return;
    }

    console.log("\n📺 Video Details:");
    console.log("   ID:", video.id);
    console.log("   Title:", video.title);
    console.log("   URL:", video.url);
    console.log("   Platform:", video.source.platform);
    console.log("   Status:", video.status);

    if (video.source.platform !== "YOUTUBE") {
      console.log("⚠️  Platform is not YouTube, skipping caption extraction");
      return;
    }

    // Test caption download
    console.log("\n🔄 Attempting to download YouTube captions...");
    const subtitleCacheDir = path.join(
      process.cwd(),
      ".cache",
      "subtitles-debug",
      VIDEO_ID
    );

    // Clean up if exists
    if (fs.existsSync(subtitleCacheDir)) {
      fs.rmSync(subtitleCacheDir, { recursive: true });
    }

    try {
      console.log("   Cache directory:", subtitleCacheDir);
      const subtitlePath = await downloadYouTubeSubtitles(
        video.url,
        subtitleCacheDir
      );

      if (subtitlePath) {
        console.log("✅ Subtitle file found:", subtitlePath);

        if (fs.existsSync(subtitlePath)) {
          // Read file size and first 500 bytes
          const stats = fs.statSync(subtitlePath);
          const content = fs.readFileSync(subtitlePath, "utf-8");

          console.log("   File size:", stats.size, "bytes");
          console.log("   Content type: " + path.extname(subtitlePath));
          console.log("\n   First 300 characters:");
          console.log("   " + content.substring(0, 300).replace(/\n/g, "\n   "));

          // Try to extract text
          console.log("\n🔄 Extracting text from subtitles...");
          const extractedText = extractTextFromSubtitles(subtitlePath);

          if (extractedText && extractedText.trim().length > 0) {
            console.log("✅ Text extraction successful!");
            console.log("   Extracted text length:", extractedText.length, "characters");
            console.log("\n   First 500 characters:");
            console.log("   " + extractedText.substring(0, 500).replace(/\n/g, "\n   "));
          } else {
            console.log("❌ Extracted text is empty!");
          }
        } else {
          console.log("❌ Subtitle file path exists but file not found on disk");
        }
      } else {
        console.log("❌ No subtitle file found - yt-dlp returned null");
        console.log("\n   Checking cache directory contents:");
        if (fs.existsSync(subtitleCacheDir)) {
          const files = fs.readdirSync(subtitleCacheDir);
          if (files.length > 0) {
            console.log("   Files in cache:");
            files.forEach((f) => console.log("     -", f));
          } else {
            console.log("   Cache directory is empty!");
          }
        } else {
          console.log("   Cache directory doesn't exist!");
        }
      }
    } catch (error) {
      console.error("❌ Caption download failed:", error);
      if (fs.existsSync(subtitleCacheDir)) {
        console.log("\n   Cache directory contents at time of error:");
        const files = fs.readdirSync(subtitleCacheDir);
        files.forEach((f) => {
          const fullPath = path.join(subtitleCacheDir, f);
          const size = fs.statSync(fullPath).size;
          console.log(`     - ${f} (${size} bytes)`);
        });
      }
    }

    // Clean up
    console.log("\n🧹 Cleaning up debug cache...");
    if (fs.existsSync(subtitleCacheDir)) {
      fs.rmSync(subtitleCacheDir, { recursive: true });
      console.log("✅ Cleanup complete");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCaptions().catch(console.error);
