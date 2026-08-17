"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface Video {
  id: string;
  title: string;
  thumbnail?: string;
  url: string;
  viewCount?: string;
  publishedAt?: string;
  status: string;
  source: { name: string; platform: string };
  evaluations: Array<{
    projectRelevance: string;
    projectRelevanceScore: number;
    recommendationValue: string;
    recommendationValueScore: number;
    exclude: boolean;
  }>;
}

const recommendationColor: Record<string, string> = {
  excellent: "bg-green-100 text-green-700",
  useful: "bg-teal-100 text-teal-700",
  limited: "bg-yellow-100 text-yellow-700",
  unsuitable: "bg-gray-100 text-gray-500",
};

interface SourceOption {
  id: string;
  name: string;
  platform: string;
}

const STATUS_OPTIONS = [
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
];

const statusColor: Record<string, string> = {
  SELECTED: "bg-blue-100 text-blue-700",
  DOWNLOADING: "bg-yellow-100 text-yellow-700",
  DOWNLOADED: "bg-orange-100 text-orange-700",
  TRANSCRIBING: "bg-purple-100 text-purple-700",
  TRANSCRIBED: "bg-indigo-100 text-indigo-700",
  EXTRACTING: "bg-cyan-100 text-cyan-700",
  EXTRACTED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function VideosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sourceId = searchParams.get("sourceId") || "";
  const statusFilter = searchParams.get("status") || "ALL";
  const page = Number.parseInt(searchParams.get("page") || "1", 10);

  const [data, setData] = useState<{
    videos: Video[];
    total: number;
    pages: number;
  } | null>(null);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [sources, setSources] = useState<SourceOption[]>([]);

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (sourceId) params.set("sourceId", sourceId);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", String(page));

    Object.entries(overrides).forEach(([key, value]) => {
      if (!value || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    return `/videos?${params.toString()}`;
  };

  useEffect(() => {
    const apiParams = new URLSearchParams();
    if (sourceId) apiParams.set("sourceId", sourceId);
    if (statusFilter !== "ALL") apiParams.set("status", statusFilter);
    apiParams.set("page", String(page));
    apiParams.set("limit", "20");

    fetch(`/api/videos?${apiParams.toString()}`)
      .then((r) => r.json())
      .then(setData);
  }, [page, sourceId, statusFilter]);

  useEffect(() => {
    fetch("/api/sources")
      .then((response) => response.json())
      .then((result: SourceOption[]) => setSources(result));
  }, []);

  const handleProcess = async (videoId: string) => {
    setProcessing((current) => ({ ...current, [videoId]: true }));
    await fetch(`/api/videos/${videoId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setTimeout(() => {
      setProcessing((current) => ({ ...current, [videoId]: false }));
    }, 2000);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Videos</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={sourceId}
          onChange={(e) =>
            router.push(buildUrl({ sourceId: e.target.value, page: "1" }))
          }
          className="rounded border px-3 py-2 text-sm"
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name} ({source.platform})
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            router.push(buildUrl({ status: e.target.value, page: "1" }))
          }
          className="rounded border px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="w-16 px-4 py-3 text-left font-medium text-gray-600">
                Thumb
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Title
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Source
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">
                Views
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Date
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Evaluation
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.videos.map((video) => (
              <tr key={video.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  {video.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-14 rounded bg-gray-200" />
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/videos/${video.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {video.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-500">{video.source.name}</td>
                <td className="px-4 py-2 text-right">
                  {video.viewCount
                    ? Number(video.viewCount).toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {video.publishedAt
                    ? new Date(video.publishedAt).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${statusColor[video.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    {video.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {video.evaluations?.[0] ? (
                    <span
                      title={`Project relevance: ${video.evaluations[0].projectRelevance} (${video.evaluations[0].projectRelevanceScore.toFixed(2)})`}
                      className={`rounded-full px-2 py-1 text-xs ${recommendationColor[video.evaluations[0].recommendationValue] || "bg-gray-100 text-gray-600"}`}
                    >
                      {video.evaluations[0].recommendationValue}
                      {video.evaluations[0].exclude ? " ⊘" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleProcess(video.id)}
                    disabled={processing[video.id]}
                    className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing[video.id] ? "..." : "▶ Process"}
                  </button>
                </td>
              </tr>
            ))}
            {data?.videos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No videos found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: data.pages }, (_, index) => index + 1).map(
            (currentPage) => (
              <button
                key={currentPage}
                onClick={() =>
                  router.push(buildUrl({ page: String(currentPage) }))
                }
                className={`rounded px-3 py-1 text-sm ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "border bg-white hover:bg-gray-50"
                }`}
              >
                {currentPage}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <VideosContent />
    </Suspense>
  );
}
