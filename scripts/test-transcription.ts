import { prisma } from "@/lib/prisma";
import {
  runFullPipeline,
  runTranscription,
} from "@/lib/pipeline/runner";

// Test video URL - choose one with subtitles
const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // A popular YouTube video with captions

async function testTranscription() {
  console.log("🎬 Testing video transcription with YouTube subtitles fallback...\n");

  try {
    // Create or get test source
    const source = await prisma.source.upsert({
      where: { url: "https://www.youtube.com/test-source" },
      create: {
        url: "https://www.youtube.com/test-source",
        platform: "YOUTUBE",
        name: "Test Source",
        requestedVideoCount: 1,
        status: "DONE",
      },
      update: { status: "DONE" },
    });

    console.log("✅ Source created/updated:", source.id);

    // Create or get test video
    const video = await prisma.video.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: "test-video-001",
        },
      },
      create: {
        sourceId: source.id,
        externalId: "test-video-001",
        url: TEST_VIDEO_URL,
        title: "Test Video with Captions",
        description: "A test video to validate subtitle extraction",
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        status: "SELECTED",
        duration: 214,
      },
      update: { status: "SELECTED" },
    });

    console.log("✅ Test video created/updated:", video.id);
    console.log("📺 Video URL:", video.url);
    console.log();

    // Run transcription
    console.log("🔄 Running transcription...");
    console.log("   This will:");
    console.log("   1️⃣  Try to fetch YouTube subtitles");
    console.log("   2️⃣  If successful, use those (provider='youtube')");
    console.log("   3️⃣  If not available, fall back to audio transcription\n");

    await runTranscription(video.id);

    // Fetch and display result
    const transcript = await prisma.transcript.findFirst({
      where: { videoId: video.id },
      orderBy: { createdAt: "desc" },
    });

    if (transcript) {
      console.log("\n✅ Transcription successful!");
      console.log("   Provider:", transcript.provider);
      console.log("   Language:", transcript.language);
      console.log(
        "   Text length:",
        transcript.text.length,
        "characters"
      );
      console.log("\n📄 First 500 characters:");
      console.log(
        "   " +
          transcript.text.substring(0, 500).replace(/\n/g, "\n   ")
      );

      if (transcript.provider === "youtube") {
        console.log("\n🎉 SUCCESS! YouTube subtitles were used!");
      } else {
        console.log("\n⚠️  Audio transcription was used (subtitles not available)");
      }
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testTranscription().catch(console.error);
