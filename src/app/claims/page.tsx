"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface SummaryRow {
  id: string;
  title: string;
  url: string;
  totalClaims: number;
  typeCounts: Record<string, number>;
}

interface ClaimResult {
  id: string;
  text: string;
  type: string;
  importance: number | null;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  sourceName: string;
}

interface TaxonomyCategory {
  id: string;
  name: string;
  topics: readonly string[];
}

interface TaxonomyResult {
  id: string;
  text: string;
  taxonomyCategoryId: string | null;
  taxonomyTopic: string | null;
  videoId: string;
  videoTitle: string;
  sourceName: string;
}

const ALL_CLAIMS = "claims";
const TAXONOMY = "taxonomy";

export default function ClaimsPage() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [processedVideos, setProcessedVideos] = useState(0);
  const [activeType, setActiveType] = useState(ALL_CLAIMS);
  const [activeView, setActiveView] = useState(ALL_CLAIMS);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [taxonomyResults, setTaxonomyResults] = useState<TaxonomyResult[]>([]);
  const [taxonomyTotal, setTaxonomyTotal] = useState(0);
  const [taxonomyClassified, setTaxonomyClassified] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/claims/summary");
      if (!response.ok) throw new Error("Az összesítő betöltése sikertelen.");
      const data = (await response.json()) as {
        rows: SummaryRow[];
        results: ClaimResult[];
        totals: Record<string, number>;
        processedVideos: number;
      };
      setRows(data.rows);
      setResults(data.results);
      setTotals(data.totals);
      setProcessedVideos(data.processedVideos);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Az összesítő betöltése sikertelen."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTaxonomy = async () => {
    try {
      const response = await fetch("/api/claims/taxonomy");
      if (!response.ok) throw new Error("A taxonómia betöltése sikertelen.");
      const data = (await response.json()) as {
        taxonomy: TaxonomyCategory[];
        total: number;
        classified: number;
        results: TaxonomyResult[];
      };
      setTaxonomy(data.taxonomy);
      setTaxonomyTotal(data.total);
      setTaxonomyClassified(data.classified);
      setTaxonomyResults(data.results);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "A taxonómia betöltése sikertelen."
      );
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    if (activeView !== TAXONOMY) return;
    void loadTaxonomy();
  }, [activeView]);

  useEffect(() => {
    if (activeView !== TAXONOMY || taxonomyTotal === 0 || taxonomyClassified >= taxonomyTotal) {
      return;
    }
    const interval = setInterval(() => void loadTaxonomy(), 3000);
    return () => clearInterval(interval);
  }, [activeView, taxonomyClassified, taxonomyTotal]);

  const types = useMemo(
    () => Object.keys(totals).sort((a, b) => a.localeCompare(b)),
    [totals]
  );
  const totalClaims = Object.values(totals).reduce(
    (sum, count) => sum + count,
    0
  );
  const tabs = [ALL_CLAIMS, ...types];
  const activeResults = useMemo(
    () =>
      results
        .filter((result) => activeType === ALL_CLAIMS || result.type === activeType)
        .sort((a, b) => a.text.localeCompare(b.text)),
    [activeType, results]
  );

  const taxonomyGroups = useMemo(
    () =>
      taxonomy.map((category) => ({
        category,
        results: taxonomyResults.filter(
          (result) => result.taxonomyCategoryId === category.id
        ),
      })),
    [taxonomy, taxonomyResults]
  );
  const uncategorizedResults = taxonomyResults.filter(
    (result) => !taxonomy.some((category) => category.id === result.taxonomyCategoryId)
  );

  const startClassification = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/claims/taxonomy", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "A besorolás nem indítható el.");
      await loadTaxonomy();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "A besorolás nem indítható el.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Claims</h1>
          <p className="text-sm text-gray-500">
            {processedVideos} feldolgozott videó · {totalClaims} claim összesen
          </p>
        </div>
        <button
          onClick={() => void loadSummary()}
          disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Betöltés…" : "Frissítés"}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-gray-200" aria-label="Claim nézetek">
        <button
          onClick={() => setActiveView(ALL_CLAIMS)}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeView === ALL_CLAIMS ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"
          }`}
        >
          Claims ({totalClaims})
        </button>
        <button
          onClick={() => setActiveView(TAXONOMY)}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeView === TAXONOMY ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"
          }`}
        >
          Taxonomy ({taxonomyClassified}/{taxonomyTotal || totalClaims})
        </button>
      </nav>

      {activeView === ALL_CLAIMS && <nav className="flex flex-wrap gap-1 border-b border-gray-200" aria-label="Claim típusok">
        {tabs.map((type) => {
          const count = type === ALL_CLAIMS ? totalClaims : totals[type];
          const selected = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <span className="capitalize">{type}</span> ({count})
            </button>
          );
        })}
      </nav>}

      {activeView === TAXONOMY ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white p-4">
            <div>
              <h2 className="font-semibold text-gray-800">Claim katalógus</h2>
              <p className="text-sm text-gray-500">
                {taxonomyClassified} / {taxonomyTotal} claim besorolva
              </p>
            </div>
            <button
              onClick={() => void startClassification()}
              disabled={loading || taxonomyClassified >= taxonomyTotal}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {taxonomyClassified > 0 && taxonomyClassified < taxonomyTotal
                ? "Besorolás folyamatban…"
                : taxonomyClassified >= taxonomyTotal
                  ? "Besorolás kész"
                  : "Besorolás indítása"}
            </button>
          </div>
          {taxonomyGroups.map(({ category, results: categoryResults }) => (
            <section key={category.id} className="rounded-lg bg-white shadow">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h2 className="font-semibold text-gray-800">{category.id} {category.name}</h2>
                <p className="text-sm text-gray-500">{categoryResults.length} claim</p>
              </div>
              <div className="divide-y">
                {category.topics.map((topic) => {
                  const topicResults = categoryResults.filter((result) => result.taxonomyTopic === topic);
                  if (topicResults.length === 0) return null;
                  return (
                    <div key={topic} className="px-4 py-3">
                      <h3 className="mb-2 text-sm font-semibold capitalize text-gray-700">{topic} ({topicResults.length})</h3>
                      <div className="space-y-2">
                        {topicResults.sort((a, b) => a.text.localeCompare(b.text)).map((result) => (
                          <div key={result.id} className="grid gap-1 text-sm md:grid-cols-[minmax(0,1fr)_18rem_10rem] md:gap-4">
                            <span className="text-gray-700">{result.text}</span>
                            <Link href={`/videos/${result.videoId}`} className="truncate text-blue-600 hover:underline">{result.videoTitle}</Link>
                            <span className="text-gray-500">{result.sourceName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {categoryResults.filter(
                  (result) => !result.taxonomyTopic || !category.topics.includes(result.taxonomyTopic)
                ).length > 0 && (
                  <div className="px-4 py-3">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      Egyéb ({categoryResults.filter((result) => !result.taxonomyTopic || !category.topics.includes(result.taxonomyTopic)).length})
                    </h3>
                    <div className="space-y-2">
                      {categoryResults
                        .filter((result) => !result.taxonomyTopic || !category.topics.includes(result.taxonomyTopic))
                        .sort((a, b) => a.text.localeCompare(b.text))
                        .map((result) => (
                          <div key={result.id} className="grid gap-1 text-sm md:grid-cols-[minmax(0,1fr)_18rem_10rem] md:gap-4">
                            <span className="text-gray-700">{result.text}</span>
                            <Link href={`/videos/${result.videoId}`} className="truncate text-blue-600 hover:underline">{result.videoTitle}</Link>
                            <span className="text-gray-500">{result.sourceName}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {categoryResults.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">Még nincs ide sorolt claim.</p>}
              </div>
            </section>
          ))}
          {uncategorizedResults.length > 0 && (
            <section className="rounded-lg bg-white shadow">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h2 className="font-semibold text-gray-800">Egyéb / nem besorolt</h2>
                <p className="text-sm text-gray-500">{uncategorizedResults.length} claim</p>
              </div>
              <div className="divide-y">
                {uncategorizedResults.sort((a, b) => a.text.localeCompare(b.text)).map((result) => (
                  <div key={result.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_18rem_10rem] md:gap-4">
                    <span className="text-gray-700">{result.text}</span>
                    <Link href={`/videos/${result.videoId}`} className="truncate text-blue-600 hover:underline">{result.videoTitle}</Link>
                    <span className="text-gray-500">{result.sourceName}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : activeType === ALL_CLAIMS ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Videó</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Claims</th>
                {types.map((type) => (
                  <th key={type} className="px-4 py-3 text-right font-medium capitalize text-gray-600">
                    {type}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-blue-50 font-semibold">
                <td className="px-4 py-3">Összesen</td>
                <td className="px-4 py-3 text-right">{totalClaims}</td>
                {types.map((type) => (
                  <td key={type} className="px-4 py-3 text-right">{totals[type]}</td>
                ))}
              </tr>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/videos/${row.id}`} className="text-blue-600 hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{row.totalClaims}</td>
                  {types.map((type) => (
                    <td key={type} className="px-4 py-3 text-right">{row.typeCounts[type] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Eredmény</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Videó</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Csatorna</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Importance</th>
              </tr>
            </thead>
            <tbody>
              {activeResults.map((result) => (
                <tr key={result.id} className="border-b align-top hover:bg-gray-50">
                  <td className="max-w-2xl px-4 py-3 text-gray-700">{result.text || "-"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/videos/${result.videoId}`} className="text-blue-600 hover:underline">
                      {result.videoTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{result.sourceName}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {result.importance === null ? "-" : result.importance.toFixed(2)}
                  </td>
                </tr>
              ))}
              {activeResults.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Nincs ilyen típusú eredmény.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}