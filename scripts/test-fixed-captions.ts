import { prisma } from "@/lib/prisma";
import { runTranscription } from "@/lib/pipeline/runner";

const VIDEO_ID = "cmswqbgwg000349annkpfw9rm";

async function testVideoTranscription() {
  console.log("🎬 Testing transcription with fixed auto-caption extraction");
  console.log("=".repeat(70));

  try {
    // Get video info
    const video = await prisma.video.findUnique({
      where: { id: VIDEO_ID },
      include: { 
        source: true,
        transcripts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!video) {
      console.error("❌ Video not found");
      return;
    }

    console.log("\n📺 Video Info:");
    console.log("   ID:", video.id);
    console.log("   Title:", video.title);
    console.log("   URL:", video.url);
    console.log("   Platform:", video.source.platform);

    // Check existing transcripts
    if (video.transcripts.length > 0) {
      const lastTranscript = video.transcripts[0];
      console.log("\n📝 Previous Transcript:");
      console.log("   Provider:", lastTranscript.provider);
      console.log("   Text length:", lastTranscript.text.length, "chars");
      console.log("   Created:", lastTranscript.createdAt);

      // Delete previous transcript to test fresh
      console.log("\n🗑️  Deleting previous transcript to test fresh...");
      await prisma.transcript.delete({ where: { id: lastTranscript.id } });
    }

    // Reset video status
    await prisma.video.update({
      where: { id: VIDEO_ID },
      data: { status: "SELECTED", errorMessage: null },
    });

    console.log("\n🔄 Running transcription with fixed caption extraction...");
    console.log("   Expected: YouTube auto-captions should be used");
    console.log("   Provider should be: 'youtube'");
    console.log();

    await runTranscription(VIDEO_ID);

    // Fetch result
    const transcript = await prisma.transcript.findFirst({
      where: { videoId: VIDEO_ID },
      orderBy: { createdAt: "desc" },
    });

    if (transcript) {
      console.log("\n✅ Transcription complete!");
      console.log("   Provider:", transcript.provider);
      console.log("   Language:", transcript.language);
      console.log("   Text length:", transcript.text.length, "characters");
      console.log("\n📄 First 600 characters:");
      console.log("   " + transcript.text.substring(0, 600).replace(/\n/g, "\n   "));

      if (transcript.provider === "youtube") {
        console.log("\n🎉 SUCCESS! YouTube auto-captions were used correctly!");
        console.log("✨ The fix is working - auto-captions are now extracted!");
      } else {
        console.log("\n⚠️  Audio transcription was used instead of captions");
        console.log("   Provider used:", transcript.provider);
      }
    } else {
      console.log("\n❌ No transcript found after processing");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testVideoTranscription().catch(console.error);
