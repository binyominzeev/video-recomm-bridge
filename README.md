# Video Recomm Bridge – Admin

Local admin web application for collecting and analyzing short-form videos.

## Pipeline

Source → Discover → Select top N → Download audio → Transcribe → GPT Extract → Store

## Requirements

- Node.js 18+
- PostgreSQL with pgvector extension
- yt-dlp (`brew install yt-dlp` or `pip install yt-dlp`)

## Setup

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and API keys

npm install
npx prisma migrate dev --name init
npm run dev
```

Then open http://localhost:3000

## First steps

1. Click "Seed Initial Sources" on the dashboard
2. Go to Sources → click "Discover" on a YouTube source
3. Go to Videos → click "▶ Process" on a video

## Environment variables

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| TRANSCRIPTION_PROVIDER | `assemblyai` or `faster-whisper` |
| ASSEMBLYAI_API_KEY | AssemblyAI API key |
| WHISPER_ENDPOINT | Faster-Whisper/RunPod endpoint |
| OPENAI_API_KEY | OpenAI API key for extraction + embeddings |
| EXTRACTION_MODEL | Model for extraction (default: gpt-4o-mini) |
