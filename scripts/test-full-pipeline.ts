import { prisma } from "@/lib/prisma";
import { runExtraction } from "@/lib/pipeline/runner";

const VIDEO_ID = "cmswqbgwg000349annkpfw9rm";

async function testFullPipeline() {
  console.log("🎬 Testing FULL PIPELINE: Caption extraction → Transcription → Extraction");
  console.log("=".repeat(70));

  try {
    // Get video info
    const video = await prisma.video.findUnique({
      where: { id: VIDEO_ID },
      include: { 
        source: true,
        transcripts: { orderBy: { createdAt: "desc" }, take: 1 },
        extractions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!video) {
      console.error("❌ Video not found");
      return;
    }

    console.log("\n📺 Video Info:");
    console.log("   Title:", video.title);
    console.log("   URL:", video.url);
    console.log("   Status:", video.status);

    console.log("\n📊 Current Pipeline State:");
    console.log("   Transcripts:", video.transcripts.length);
    if (video.transcripts.length > 0) {
      const t = video.transcripts[0];
      console.log(`     └─ Provider: ${t.provider}, Length: ${t.text.length} chars`);
    }
    console.log("   Extractions:", video.extractions.length);

    // Run extraction if transcript exists
    if (video.transcripts.length > 0) {
      console.log("\n🔄 Running extraction pipeline...");
      const startTime = Date.now();
      
      try {
        await runExtraction(VIDEO_ID);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Fetch updated extraction
        const extraction = await prisma.extraction.findFirst({
          where: { videoId: VIDEO_ID },
          orderBy: { createdAt: "desc" },
        });

        if (extraction) {
          console.log(`\n✅ Extraction successful (${duration}s)!`);
          console.log("   Model:", extraction.model);
          console.log("   Prompt Version:", extraction.promptVersion);
          
          const data = extraction.rawJson as Record<string, unknown>;
          if (data && typeof data === "object") {
            console.log("   Extracted fields:", Object.keys(data).join(", "));
            console.log("\n📄 Extracted Data Preview:");
            Object.entries(data).forEach(([key, value]) => {
              const valueStr = typeof value === "string" 
                ? value.substring(0, 80) + (value.length > 80 ? "..." : "")
                : JSON.stringify(value).substring(0, 80) + (JSON.stringify(value).length > 80 ? "..." : "");
              console.log(`   • ${key}: ${valueStr}`);
            });
          }
        } else {
          console.log("❌ Extraction completed but no result found");
        }
      } catch (error) {
        console.error("❌ Extraction failed:", (error as {message?: string})?.message);
      }
    } else {
      console.log("\n⚠️  No transcript available - skipping extraction");
    }

    console.log("\n" + "=".repeat(70));
    console.log("📊 FINAL RESULTS:");
    const updatedVideo = await prisma.video.findUnique({
      where: { id: VIDEO_ID },
      include: { 
        transcripts: { orderBy: { createdAt: "desc" }, take: 1 },
        extractions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (updatedVideo) {
      console.log("Video Status:", updatedVideo.status);
      if (updatedVideo.transcripts[0]) {
        const t = updatedVideo.transcripts[0];
        console.log(`Transcript: ${t.provider} (${t.text.length} chars)`);
      }
      if (updatedVideo.extractions[0]) {
        console.log("Extraction: ✅ Complete");
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullPipeline().catch(console.error);
