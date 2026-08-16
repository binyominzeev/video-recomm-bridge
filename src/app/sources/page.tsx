"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Source {
  id: string;
  name: string;
  url: string;
  platform: string;
  requestedVideoCount: number;
  status: string;
  errorMessage?: string;
  videos: Array<{ status: string }>;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState({
    url: "",
    name: "",
    requestedVideoCount: "50",
  });
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const fetchSources = () =>
    fetch("/api/sources")
      .then((r) => r.json())
      .then(setSources);

  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDiscover = async (id: string) => {
    setProcessing((current) => ({ ...current, [id]: true }));
    await fetch(`/api/sources/${id}/discover`, { method: "POST" });
    setTimeout(() => {
      setProcessing((current) => ({ ...current, [id]: false }));
      void fetchSources();
    }, 2000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        requestedVideoCount: Number(form.requestedVideoCount),
      }),
    });
    setForm({ url: "", name: "", requestedVideoCount: "50" });
    await fetchSources();
  };

  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    DISCOVERING: "bg-blue-100 text-blue-700",
    DONE: "bg-green-100 text-green-700",
    ERROR: "bg-red-100 text-red-700",
  };

  const platformIcon: Record<string, string> = {
    YOUTUBE: "🎥",
    INSTAGRAM: "📸",
    FACEBOOK: "👥",
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Sources</h1>

      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold">Add Source</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3">
          <input
            placeholder="URL"
            value={form.url}
            onChange={(e) => setForm((current) => ({ ...current, url: e.target.value }))}
            className="min-w-48 flex-1 rounded border px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            className="w-48 rounded border px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            placeholder="Video count"
            value={form.requestedVideoCount}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                requestedVideoCount: e.target.value,
              }))
            }
            className="w-32 rounded border px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Source
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Platform
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Requested
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Discovered
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Extracted
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const extracted = source.videos.filter(
                (video) => video.status === "EXTRACTED"
              ).length;

              return (
                <tr key={source.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{source.name}</div>
                    <div className="max-w-xs truncate text-xs text-gray-500">
                      {source.url}
                    </div>
                    {source.errorMessage && (
                      <div className="mt-1 text-xs text-red-500">
                        {source.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {platformIcon[source.platform]} {source.platform}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {source.requestedVideoCount}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/videos?sourceId=${source.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {source.videos.length}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">{extracted}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${statusColor[source.status] || "bg-gray-100"}`}
                    >
                      {source.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDiscover(source.id)}
                      disabled={
                        processing[source.id] || source.status === "DISCOVERING"
                      }
                      className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {processing[source.id] || source.status === "DISCOVERING"
                        ? "Running..."
                        : "Discover"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No sources yet. Click &quot;Seed Initial Sources&quot; on
                  dashboard or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
