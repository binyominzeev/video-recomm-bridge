import { prisma } from "@/lib/prisma";

async function listVideos() {
  console.log("📺 Videos in database:");
  console.log("=".repeat(80));

  try {
    const videos = await prisma.video.findMany({
      include: {
        source: true,
        transcripts: true,
        extractions: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (videos.length === 0) {
      console.log("No videos found");
      return;
    }

    videos.forEach((video, idx) => {
      console.log(`\n${idx + 1}. ${video.title}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   URL: ${video.url}`);
      console.log(`   Platform: ${video.source.platform}`);
      console.log(`   Status: ${video.status}`);
      console.log(`   Transcripts: ${video.transcripts.length}`);
      if (video.transcripts.length > 0) {
        const t = video.transcripts[0];
        console.log(`     └─ ${t.provider} (${t.text.length} chars)`);
      }
      console.log(`   Extractions: ${video.extractions.length}`);
    });

    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

listVideos().catch(console.error);
