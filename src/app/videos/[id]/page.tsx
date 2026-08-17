"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface VideoDetail {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
  publishedAt?: string;
  duration?: number;
  viewCount?: string;
  status: string;
  errorMessage?: string;
  source: { name: string; platform: string; url: string };
  transcripts: Array<{
    id: string;
    provider: string;
    text: string;
    language?: string;
    createdAt: string;
  }>;
  extractions: Array<{
    id: string;
    model: string;
    promptVersion: string;
    rawJson: {
      summary?: string;
      topics?: string[];
      contentTypes?: string[];
      claims?: Array<{
        text?: string;
        type?: string;
        importance?: number;
      }>;
    };
    createdAt: string;
  }>;
  costEvents: Array<{
    stage: string;
    provider: string;
    estimatedCost: number;
    createdAt: string;
  }>;
  evaluations: Array<{
    id: string;
    model: string;
    promptVersion: string;
    projectRelevanceScore: number;
    projectRelevance: string;
    relevanceTypes: string[];
    contentOrientation: string;
    targetNarratives: string[];
    recommendationValueScore: number;
    recommendationValue: string;
    reason: string;
    exclude: boolean;
    excludeReason?: string | null;
    createdAt: string;
  }>;
}

const COMPLETED_STATUS_BY_STAGE: Record<string, string> = {
  full: "EXTRACTED",
  transcribe: "TRANSCRIBED",
  extract: "EXTRACTED",
  evaluate: "EXTRACTED",
  embed: "EXTRACTED",
};

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fetchVideo = useCallback(async () => {
    const response = await fetch(`/api/videos/${id}`);
    if (!response.ok) {
      throw new Error(`Could not refresh video status (${response.status})`);
    }

    const nextVideo = (await response.json()) as VideoDetail;
    setVideo(nextVideo);
    return nextVideo;
  }, [id]);

  useEffect(() => {
    void fetchVideo();
  }, [fetchVideo]);

  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const pollStatus = async () => {
      try {
        const nextVideo = await fetchVideo();
        if (cancelled) return;

        if (
          nextVideo.status === "FAILED" ||
          nextVideo.status === COMPLETED_STATUS_BY_STAGE[running]
        ) {
          setRunning(null);
          return;
        }

        timeoutId = window.setTimeout(pollStatus, 1000);
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not refresh video status";
          setRequestError(message);
          setRunning(null);
        }
      }
    };

    void pollStatus();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [fetchVideo, running]);

  const runStage = async (stage: string) => {
    setRunning(stage);
    setRequestError(null);

    try {
      const response = await fetch(`/api/videos/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) {
        throw new Error(`Could not start processing (${response.status})`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not start processing";
      setRequestError(message);
      setRunning(null);
    }
  };

  if (!video) return <div className="text-gray-500">Loading...</div>;

  const latestExtraction = video.extractions[0];
  const latestEvaluation = video.evaluations[0];
  const latestTranscript = video.transcripts[0];
  const totalCost = video.costEvents.reduce(
    (sum, event) => sum + event.estimatedCost,
    0
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/videos" className="text-sm text-blue-600 hover:underline">
          ← Back to Videos
        </Link>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex gap-4">
          {video.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="h-28 w-40 rounded object-cover"
            />
          )}
          <div className="flex-1">
            <h1 className="mb-1 text-xl font-bold text-gray-800">
              {video.title}
            </h1>
            <div className="mb-2 text-sm text-gray-500">
              {video.source.name} · {video.source.platform}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>
                👁 {video.viewCount ? Number(video.viewCount).toLocaleString() : "?"}{" "}
                views
              </span>
              {video.publishedAt && (
                <span>📅 {new Date(video.publishedAt).toLocaleDateString()}</span>
              )}
              {video.duration && (
                <span>
                  ⏱ {Math.floor(video.duration / 60)}:
                  {String(video.duration % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="mt-2">
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Open original ↗
              </a>
            </div>
          </div>
        </div>

        {video.description && (
          <p className="mt-3 text-sm text-gray-600">{video.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              video.status === "EXTRACTED"
                ? "bg-green-100 text-green-700"
                : video.status === "FAILED"
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {video.status}
          </span>
          {video.errorMessage && (
            <span className="text-xs text-red-500">{video.errorMessage}</span>
          )}
          {running && (
            <span className="text-xs text-gray-500">
              Processing: {video.status.toLowerCase()}...
            </span>
          )}
          {requestError && (
            <span className="text-xs text-red-500">{requestError}</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => runStage("full")}
            disabled={!!running}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {running === "full" ? "Running..." : "▶ Run Full Pipeline"}
          </button>
          <button
            onClick={() => runStage("transcribe")}
            disabled={!!running}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {running === "transcribe" ? "Running..." : "Re-transcribe"}
          </button>
          <button
            onClick={() => runStage("extract")}
            disabled={!!running}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running === "extract" ? "Running..." : "Re-extract"}
          </button>
          <button
            onClick={() => runStage("evaluate")}
            disabled={!!running}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {running === "evaluate" ? "Running..." : "Re-evaluate"}
          </button>
        </div>

        {totalCost > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            Est. cost for this video: ${totalCost.toFixed(5)}
          </div>
        )}
      </div>

      {latestEvaluation && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 font-semibold text-gray-700">
            Counter-recommendation Evaluation ({latestEvaluation.model} ·{" "}
            {latestEvaluation.promptVersion})
          </h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
              Project relevance: {latestEvaluation.projectRelevance} (
              {latestEvaluation.projectRelevanceScore.toFixed(2)})
            </span>
            <span className="rounded-full bg-teal-100 px-2 py-1 text-xs text-teal-700">
              Recommendation value: {latestEvaluation.recommendationValue} (
              {latestEvaluation.recommendationValueScore.toFixed(2)})
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {latestEvaluation.contentOrientation}
            </span>
            {latestEvaluation.exclude && (
              <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                Excluded
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                Reason
              </h3>
              <p className="text-sm text-gray-700">{latestEvaluation.reason}</p>
            </div>
            {latestEvaluation.exclude && latestEvaluation.excludeReason && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  Exclude reason
                </h3>
                <p className="text-sm text-gray-700">
                  {latestEvaluation.excludeReason}
                </p>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Relevance Types
              </h3>
              <div className="flex flex-wrap gap-2">
                {latestEvaluation.relevanceTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Target Narratives
              </h3>
              <div className="space-y-1">
                {latestEvaluation.targetNarratives.map((narrative, index) => (
                  <p key={index} className="text-sm text-gray-700">
                    {narrative}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {latestTranscript && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 font-semibold text-gray-700">
            Transcript ({latestTranscript.provider} · {latestTranscript.language})
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {latestTranscript.text}
          </p>
        </div>
      )}

      {latestExtraction && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 font-semibold text-gray-700">
            Extraction ({latestExtraction.model} · {latestExtraction.promptVersion})
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                Summary
              </h3>
              <p className="text-sm text-gray-700">
                {latestExtraction.rawJson?.summary}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {(latestExtraction.rawJson?.topics || []).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Content Types
              </h3>
              <div className="flex flex-wrap gap-2">
                {(latestExtraction.rawJson?.contentTypes || []).map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Claims
              </h3>
              <div className="space-y-2">
                {(latestExtraction.rawJson?.claims || []).map((claim, index) => (
                  <div key={index} className="rounded bg-gray-50 p-3">
                    <div className="text-sm text-gray-700">{claim.text}</div>
                    <div className="mt-1 flex gap-2">
                      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                        {claim.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        importance: {claim.importance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Raw JSON
              </h3>
              <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-400">
                {JSON.stringify(latestExtraction.rawJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
