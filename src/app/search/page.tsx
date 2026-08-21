"use client";

import Link from "next/link";
import { useState } from "react";

interface SearchResult {
  id: string;
  title: string;
  url: string;
  similarity: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as {
        error?: string;
        results?: SearchResult[];
      };

      if (data.error) {
        setError(data.error);
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Semantic Search</h1>
      <p className="mb-4 text-sm text-gray-500">
        Search across transcripts and extracted content using semantic
        similarity. Requires videos to be fully processed with embeddings.
      </p>

      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Israel deliberately targets civilians"
          className="flex-1 rounded border px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 sm:shrink-0"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between">
              <Link
                href={`/videos/${result.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {result.title}
              </Link>
              <span className="ml-2 shrink-0 text-xs text-gray-500">
                {(result.similarity * 100).toFixed(1)}% match
              </span>
            </div>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-gray-400 hover:underline"
            >
              {result.url}
            </a>
          </div>
        ))}
        {results.length === 0 && !loading && query && (
          <p className="text-sm text-gray-400">No results found.</p>
        )}
      </div>
    </div>
  );
}
