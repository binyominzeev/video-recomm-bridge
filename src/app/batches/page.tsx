"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface SourceOption {
  id: string;
  name: string;
  platform: string;
  videos?: Array<{ status: string }>;
  processingSummary?: {
    totalVideos: number;
    fullyProcessed: number;
    incomplete: {
      transcription: number;
      extraction: number;
      evaluation: number;
      embedding: number;
    };
  };
}

interface VideoOption {
  id: string;
  title: string;
  status: string;
  source: { name: string };
  duration?: number | null;
  processing?: {
    hasTranscription: boolean;
    hasExtraction: boolean;
    hasEvaluation: boolean;
    hasEmbedding: boolean;
    completionState: "unprocessed" | "partial" | "complete";
  };
}

type EstimateStage = "transcription" | "extraction" | "evaluation" | "embedding";

interface BatchRow {
  id: string;
  status: string;
  requestedStages: string[];
  currency: string;
  budgetLimit?: number | null;
  createdAt: string;
  approvedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  estimateSnapshot?: {
    totals?: { low?: number; base?: number; high?: number };
  } | null;
  progress: Record<string, number>;
  actualCost: number;
}

const STAGES: EstimateStage[] = [
  "transcription",
  "extraction",
  "evaluation",
  "embedding",
];

const VIDEO_STATUS_OPTIONS = [
  "ALL",
  "DISCOVERED",
  "SELECTED",
  "DOWNLOADING",
  "DOWNLOADED",
  "TRANSCRIBING",
  "TRANSCRIBED",
  "EXTRACTING",
  "EXTRACTED",
  "FAILED",
  "SKIPPED",
];

const batchColor: Record<string, string> = {
  ESTIMATED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-indigo-100 text-indigo-700",
  RUNNING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  PAUSED: "bg-slate-100 text-slate-700",
  DRAFT: "bg-slate-100 text-slate-700",
};

function money(value: number | null | undefined, currency = "USD") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${currency} ${value.toFixed(4)}`;
}

export default function BatchesPage() {
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [completionFilters, setCompletionFilters] = useState({
    unprocessed: true,
    partial: true,
    complete: false,
  });
  const [videoPage, setVideoPage] = useState(1);
  const [videoTotal, setVideoTotal] = useState(0);
  const [videoPages, setVideoPages] = useState(0);
  const [showProcessedSources, setShowProcessedSources] = useState(false);
  const [stages, setStages] = useState<EstimateStage[]>([...STAGES]);
  const [transcriptionProvider, setTranscriptionProvider] = useState<
    "assemblyai" | "faster-whisper"
  >("assemblyai");
  const [subtitleHitRate, setSubtitleHitRate] = useState("0.5");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = selectedVideoIds.length > 0 && stages.length > 0;

  const selectedCountText = useMemo(() => {
    if (selectedVideoIds.length === 0) return "No videos selected";
    if (selectedVideoIds.length === 1) return "1 video selected";
    return `${selectedVideoIds.length} videos selected`;
  }, [selectedVideoIds.length]);

  const visibleSources = useMemo(() => {
    if (showProcessedSources) {
      return sources;
    }

    return sources.filter((source) => {
      const summary = source.processingSummary;
      if (!summary || summary.totalVideos === 0) {
        return true;
      }

      return stages.some((stage) => summary.incomplete[stage] > 0);
    });
  }, [showProcessedSources, sources, stages]);

  const loadSources = useCallback(async () => {
    const response = await fetch("/api/sources");
    const data = (await response.json()) as SourceOption[];
    setSources(data);
  }, []);

  const loadVideos = useCallback(async () => {
    const selectedStates = (Object.keys(completionFilters) as Array<keyof typeof completionFilters>).filter(
      (key) => completionFilters[key]
    );

    const params = new URLSearchParams();
    if (sourceId) params.set("sourceId", sourceId);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (selectedStates.length > 0 && selectedStates.length < 3) {
      params.set("completionState", selectedStates.join(","));
    }
    params.set("page", String(videoPage));
    params.set("limit", "100");

    const response = await fetch(`/api/videos?${params.toString()}`);
    const data = (await response.json()) as {
      videos: VideoOption[];
      total: number;
      pages: number;
    };
    setVideos(data.videos);
    setVideoTotal(data.total);
    setVideoPages(data.pages);
  }, [completionFilters, sourceId, statusFilter, videoPage]);

  const loadBatches = useCallback(async () => {
    const response = await fetch("/api/batches?limit=20&page=1");
    const data = (await response.json()) as { batches: BatchRow[] };
    setBatches(data.batches);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    setVideoPage(1);
  }, [sourceId, statusFilter, completionFilters]);

  useEffect(() => {
    if (!sourceId) {
      return;
    }

    const selectedStillVisible = visibleSources.some((source) => source.id === sourceId);
    if (!selectedStillVisible) {
      setSourceId("");
    }
  }, [sourceId, visibleSources]);

  useEffect(() => {
    void loadBatches();
    const interval = setInterval(() => {
      void loadBatches();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadBatches]);

  const toggleVideo = (videoId: string) => {
    setSelectedVideoIds((current) =>
      current.includes(videoId)
        ? current.filter((id) => id !== videoId)
        : [...current, videoId]
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = videos.map((video) => video.id);
    const allSelected = visibleIds.every((id) => selectedVideoIds.includes(id));

    if (allSelected) {
      setSelectedVideoIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedVideoIds((current) => {
      const merged = new Set([...current, ...visibleIds]);
      return [...merged];
    });
  };

  const toggleCompletionFilter = (key: "unprocessed" | "partial" | "complete") => {
    setCompletionFilters((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleStage = (stage: EstimateStage) => {
    setStages((current) =>
      current.includes(stage)
        ? current.filter((value) => value !== stage)
        : [...current, stage]
    );
  };

  const createBatch = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const parsedSubtitleHitRate = Number(subtitleHitRate);
    const parsedBudgetLimit = budgetLimit.trim() ? Number(budgetLimit) : undefined;

    if (!Number.isFinite(parsedSubtitleHitRate) || parsedSubtitleHitRate < 0 || parsedSubtitleHitRate > 1) {
      setError("Subtitle hit rate must be between 0 and 1.");
      setLoading(false);
      return;
    }

    if (parsedBudgetLimit !== undefined && (!Number.isFinite(parsedBudgetLimit) || parsedBudgetLimit < 0)) {
      setError("Budget limit must be a positive number.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoIds: selectedVideoIds,
        stages,
        transcriptionProvider,
        subtitleHitRate: parsedSubtitleHitRate,
        budgetLimit: parsedBudgetLimit,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || `Batch creation failed (${response.status})`);
      setLoading(false);
      return;
    }

    setMessage("Batch created with estimate.");
    setSelectedVideoIds([]);
    setBudgetLimit("");
    await loadBatches();
    setLoading(false);
  };

  const approveBatch = async (batch: BatchRow) => {
    setError(null);
    setMessage(null);

    const highEstimate = batch.estimateSnapshot?.totals?.high;
    const fallbackBudget = typeof highEstimate === "number" ? highEstimate : undefined;
    const effectiveBudget = batch.budgetLimit ?? fallbackBudget;

    const response = await fetch(`/api/batches/${batch.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        effectiveBudget !== undefined ? { budgetLimit: effectiveBudget } : {}
      ),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || `Approve failed (${response.status})`);
      return;
    }

    setMessage(`Batch ${batch.id} approved.`);
    await loadBatches();
  };

  const runBatch = async (batchId: string) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/batches/${batchId}/run`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || `Run failed (${response.status})`);
      return;
    }

    setMessage(`Batch ${batchId} started.`);
    await loadBatches();
  };

  const cancelBatch = async (batchId: string) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/batches/${batchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error || `Cancel failed (${response.status})`);
      return;
    }

    setMessage(`Batch ${batchId} cancelled.`);
    await loadBatches();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Bulk Batches</h1>
        <button
          onClick={() => void loadBatches()}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {message && <div className="rounded bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Create Estimated Batch</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">All sources</option>
            {visibleSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} ({source.platform})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showProcessedSources}
              onChange={(e) => setShowProcessedSources(e.target.checked)}
            />
            Show processed sources
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            {VIDEO_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
            <span className="text-gray-500">Processing state:</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={completionFilters.unprocessed}
                onChange={() => toggleCompletionFilter("unprocessed")}
              />
              Unprocessed
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={completionFilters.partial}
                onChange={() => toggleCompletionFilter("partial")}
              />
              Partial
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={completionFilters.complete}
                onChange={() => toggleCompletionFilter("complete")}
              />
              Complete
            </label>
          </div>

          <button
            onClick={toggleAllVisible}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Toggle All Visible
          </button>
        </div>

        <div className="mb-4 max-h-64 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Source</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Duration</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.includes(video.id)}
                      onChange={() => toggleVideo(video.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{video.title}</td>
                  <td className="px-3 py-2 text-gray-500">{video.source.name}</td>
                  <td className="px-3 py-2 text-gray-500">{video.status}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {typeof video.duration === "number" ? `${Math.round(video.duration / 60)}m` : "-"}
                  </td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    No videos for the selected status/state filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {videoPages > 1 && (
          <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {videoPage} of {videoPages} ({videoTotal} videos match the current filters)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setVideoPage((current) => Math.max(1, current - 1))}
                disabled={videoPage <= 1}
                className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Prev
              </button>
              <button
                onClick={() => setVideoPage((current) => Math.min(videoPages, current + 1))}
                disabled={videoPage >= videoPages}
                className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 text-sm text-gray-600">{selectedCountText}</div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          {STAGES.map((stage) => (
            <label key={stage} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={stages.includes(stage)}
                onChange={() => toggleStage(stage)}
              />
              {stage}
            </label>
          ))}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-gray-700">
            Transcription provider
            <select
              value={transcriptionProvider}
              onChange={(e) => setTranscriptionProvider(e.target.value as "assemblyai" | "faster-whisper")}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="assemblyai">assemblyai</option>
              <option value="faster-whisper">faster-whisper</option>
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Subtitle hit rate (0..1)
            <input
              value={subtitleHitRate}
              onChange={(e) => setSubtitleHitRate(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="text-sm text-gray-700">
            Budget limit (optional)
            <input
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="e.g. 4.50"
            />
          </label>
        </div>

        <button
          onClick={() => void createBatch()}
          disabled={!canCreate || loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Estimate + Create Batch"}
        </button>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Recent Batches</h2>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Batch</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Stages</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Estimate (L/B/H)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actual</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Progress</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const low = batch.estimateSnapshot?.totals?.low;
                const base = batch.estimateSnapshot?.totals?.base;
                const high = batch.estimateSnapshot?.totals?.high;

                return (
                  <tr key={batch.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-gray-700">{batch.id}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(batch.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${batchColor[batch.status] || "bg-gray-100 text-gray-600"}`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{batch.requestedStages.join(", ")}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {money(low, batch.currency)} / {money(base, batch.currency)} / {money(high, batch.currency)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{money(batch.actualCost, batch.currency)}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {Object.keys(batch.progress).length === 0
                        ? "-"
                        : Object.entries(batch.progress)
                            .map(([key, value]) => `${key}:${value}`)
                            .join(" ")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {batch.status === "ESTIMATED" && (
                          <button
                            onClick={() => void approveBatch(batch)}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                          >
                            Approve
                          </button>
                        )}
                        {batch.status === "APPROVED" && (
                          <button
                            onClick={() => void runBatch(batch.id)}
                            className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                          >
                            Start
                          </button>
                        )}
                        {!["COMPLETED", "FAILED", "CANCELLED"].includes(batch.status) && (
                          <button
                            onClick={() => void cancelBatch(batch.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    No batches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
