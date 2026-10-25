
"use client";

import { useState } from "react";

type Source = {
  label: string;
  documentTitle: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
};

export default function TestChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses pertanyaan.");
      }

      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tes MedGuideline AI</h1>
      <p className="text-sm text-gray-600">
        Uji jawaban berdasarkan chunk dokumen PNPK di perpustakaanmu.
      </p>

      <form onSubmit={sendQuestion} className="space-y-3">
        <label htmlFor="question" className="block font-medium">
          Pertanyaan klinis
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Contoh: Bagaimana tatalaksana pneumonia menurut PNPK?"
          className="min-h-28 w-full rounded-lg border p-3"
          maxLength={2000}
          required
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-teal-700 px-5 py-3 text-white disabled:opacity-50"
        >
          {loading ? "Sedang mencari dan menjawab..." : "Tanyakan ke AI"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-300 p-4 text-red-700">
          {error}
        </div>
      )}

      {answer && (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Jawaban</h2>
          <div className="whitespace-pre-wrap leading-7">{answer}</div>

          <h3 className="font-semibold">Sumber yang diambil</h3>
          {sources.length ? (
            <ul className="list-disc space-y-2 pl-5">
              {sources.map((source, index) => (
                <li key={`${source.label}-${source.chunkIndex}-${index}`}>
                  <strong>{source.documentTitle}</strong>
                  {" — Chunk "}
                  {source.chunkIndex}
                  {source.pageStart != null
                    ? ` — Halaman ${source.pageStart}${
                        source.pageEnd != null &&
                        source.pageEnd !== source.pageStart
                          ? `–${source.pageEnd}`
                          : ""
                      }`
                    : " — nomor halaman belum dipetakan"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">
              Tidak ada sumber yang cocok ditemukan.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
