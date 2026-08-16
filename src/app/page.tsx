"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalSources: number;
  totalVideos: number;
  selected: number;
  downloaded: number;
  transcribed: number;
  extracted: number;
  failed: number;
  totalCost: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchStats = () =>
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await fetchStats();
    setSeeding(false);
  };

  const statCards = stats
    ? [
        { label: "Sources", value: stats.totalSources, color: "bg-blue-500" },
        {
          label: "Discovered Videos",
          value: stats.totalVideos,
          color: "bg-indigo-500",
        },
        { label: "Selected", value: stats.selected, color: "bg-purple-500" },
        {
          label: "Downloaded",
          value: stats.downloaded,
          color: "bg-yellow-500",
        },
        {
          label: "Transcribed",
          value: stats.transcribed,
          color: "bg-green-500",
        },
        {
          label: "Extracted",
          value: stats.extracted,
          color: "bg-teal-500",
        },
        { label: "Failed", value: stats.failed, color: "bg-red-500" },
        {
          label: "Est. Cost",
          value: `$${stats.totalCost.toFixed(4)}`,
          color: "bg-gray-600",
        },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {seeding ? "Seeding..." : "Seed Initial Sources"}
        </button>
      </div>

      {!stats ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`${card.color} rounded-lg p-4 text-white shadow`}
            >
              <div className="text-3xl font-bold">{card.value}</div>
              <div className="mt-1 text-sm opacity-80">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold text-gray-700">Pipeline</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {[
            "Source",
            "Discover",
            "Select top N",
            "Download audio",
            "Transcribe",
            "GPT Extract",
            "Store",
          ].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-3 py-1">{step}</span>
              {i < arr.length - 1 && <span className="text-gray-400">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
