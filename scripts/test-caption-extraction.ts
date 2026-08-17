#!/usr/bin/env node
/**
 * Simple test runner for caption extraction
 * Run with: npx tsx scripts/test-caption-extraction.ts
 */

import { downloadYouTubeSubtitles } from "@/lib/pipeline/youtube";
import { extractTextFromSubtitles } from "@/lib/pipeline/transcription";
import path from "path";
import fs from "fs";

const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function testCaptions() {
  console.log("🎬 Testing YouTube caption extraction...\n");
  console.log("Testing with:", TEST_VIDEO_URL);
  console.log();

  const testDir = path.join(process.cwd(), ".cache", "test-captions");

  try {
    // Test 1: Try to download subtitles
    console.log("📥 Step 1: Downloading YouTube subtitles...");
    const subtitlePath = await downloadYouTubeSubtitles(TEST_VIDEO_URL, testDir);

    if (!subtitlePath) {
      console.log("❌ No subtitles found for this video");
      return;
    }

    console.log("✅ Subtitle file found:", path.basename(subtitlePath));
    console.log();

    // Test 2: Extract text from subtitles
    console.log("📝 Step 2: Extracting text from subtitles...");
    const text = extractTextFromSubtitles(subtitlePath);

    if (!text) {
      console.log("❌ No text extracted from subtitles");
      return;
    }

    console.log("✅ Text extracted successfully!");
    console.log();

    // Display results
    console.log("📊 Results:");
    console.log("   Text length:", text.length, "characters");
    console.log("   First 300 characters:");
    console.log("   " + text.substring(0, 300).replace(/\n/g, "\n   "));
    console.log();
    console.log("🎉 SUCCESS! Caption extraction is working!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    } catch {
      // ignore
    }
  }
}

testCaptions();
