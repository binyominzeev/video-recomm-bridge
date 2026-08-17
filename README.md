# Video Recomm Bridge – Admin

Local admin web application for collecting and analyzing short-form videos.

## Pipeline

Source → Discover → Select top N → Download audio → Transcribe → GPT Extract → Store

## Requirements

- Node.js 18+
- Docker with Docker Compose
- yt-dlp (`brew install yt-dlp` or `pip install yt-dlp`)

## Setup

```bash
docker compose up -d
cp .env.example .env
# Edit .env with your API keys

npm install
npx prisma migrate dev --name init
npm run dev
```

Then open http://localhost:3000

The Docker service runs a local PostgreSQL 16 database with the pgvector extension.
It is free to use and keeps its data in the `postgres_data` Docker volume.

## Database management

```bash
# Stop the local database without deleting its data
docker compose down

# Delete the local database and all of its data
docker compose down -v
```

After deleting the volume, run `docker compose up -d` and
`npx prisma migrate dev --name init` again.

## First steps

1. Click "Seed Initial Sources" on the dashboard
2. Go to Sources → click "Discover" on a YouTube source
3. Go to Videos → click "▶ Process" on a video

## Environment variables

| Variable | Description |
|---|---|
| DATABASE_URL | Local PostgreSQL connection string; set by `.env.example` for Docker |
| TRANSCRIPTION_PROVIDER | `assemblyai` or `faster-whisper` |
| ASSEMBLYAI_API_KEY | AssemblyAI API key |
| WHISPER_ENDPOINT | Faster-Whisper/RunPod endpoint |
| OPENAI_API_KEY | OpenAI API key for extraction + embeddings |
| EXTRACTION_MODEL | Model for extraction (default: gpt-4o-mini) |
