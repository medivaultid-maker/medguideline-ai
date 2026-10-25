
"use client";

import { useState } from "react";

export default function TestEmbeddingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function processEmbedding() {
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/documents/embed", {
        method: "POST",
      });

      const data = await response.json();

      setResult(
        JSON.stringify(data, null, 2)
      );
    } catch {
      setResult("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-bold">
        Tes Embedding PNPK
      </h1>

      <p className="mb-4 text-sm text-gray-600">
        Proses maksimal 10 chunk dokumen per klik.
      </p>

      <button
        onClick={processEmbedding}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Proses Embedding"}
      </button>

      {result && (
        <pre className="mt-6 overflow-auto rounded-lg bg-gray-100 p-4 text-sm">
          {result}
        </pre>
      )}
    </main>
  );
}
