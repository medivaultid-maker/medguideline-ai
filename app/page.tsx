
"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";


type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
  processing_status: string;
  page_count: number | null;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function DashboardPage() {
  
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [chunkingId, setChunkingId] = useState<string | null>(null);

const [question, setQuestion] = useState("");
const [aiAnswer, setAiAnswer] = useState("");
const [aiSources, setAiSources] = useState<
  {
    label: string;
    documentTitle: string;
    chunkIndex: number;
    pageStart: number | null;
    pageEnd: number | null;
  }[]
>([]);
const [askingAI, setAskingAI] = useState(false);
const [aiError, setAiError] = useState("");

  const loadDocuments = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("documents")
      .select(
  "id, title, file_name, storage_path, size_bytes, created_at, processing_status, page_count"
)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Gagal memuat dokumen: ${error.message}`);
      return;
    }

    setDocuments((data ?? []) as DocumentRow[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);

      const { data: rows, error: listError } = await supabase
        .from("documents")
        .select(
  "id, title, file_name, storage_path, size_bytes, created_at, processing_status, page_count"
)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (listError) {
        setMessage(`Gagal memuat dokumen: ${listError.message}`);
      } else {
        setDocuments((rows ?? []) as DocumentRow[]);
      }

      setLoading(false);
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!user) {
      setMessage("Silakan login kembali.");
      return;
    }

    if (!file) {
      setMessage("Pilih file PDF terlebih dahulu.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf") ||
        (file.type && file.type !== "application/pdf")) {
      setMessage("File harus berformat PDF.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage("Ukuran PDF maksimal 20 MB.");
      return;
    }

    const cleanName = file.name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .slice(-150);

    const storagePath =
      `${user.id}/${crypto.randomUUID()}-${cleanName}`;

    setUploading(true);

    const supabase = createClient();

    try {
      const { error: uploadError } = await supabase.storage
        .from("pnpk-pdfs")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        
.from("documents")
.insert({
  user_id: user.id,
  title: title.trim(),

  // Kolom wajib pada struktur database lama
  original_filename: file.name,
  file_path: storagePath,
  file_size: file.size,

  // Kolom yang digunakan oleh kode dashboard
  file_name: file.name,
  storage_path: storagePath,
  mime_type: "application/pdf",
  size_bytes: file.size,
})
;

      if (insertError) {
        await supabase.storage
          .from("pnpk-pdfs")
          .remove([storagePath]);

        throw insertError;
      }

      setTitle("");
      setFile(null);

      const input = document.getElementById(
        "pdf-file"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      setMessage("PDF berhasil diunggah!");
      await loadDocuments();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Upload gagal: ${error.message}`
          : "Upload gagal karena terjadi kesalahan."
      );
    } finally {
      setUploading(false);
    }
  }


async function extractDocument(doc: DocumentRow) {
  setMessage("");
  setExtractingId(doc.id);

  try {
    const response = await fetch(
      `/api/documents/${doc.id}/extract`,
      { method: "POST" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ekstraksi PDF gagal.");
    }

    setMessage(
      `Berhasil mengekstrak "${doc.title}". ` +
      `${result.page_count ?? "?"} halaman, ` +
      `${result.character_count} karakter teks.`
    );

    await loadDocuments();
  } catch (error) {
    setMessage(
      error instanceof Error
        ? `Ekstraksi gagal: ${error.message}`
        : "Terjadi kesalahan saat mengekstrak PDF."
    );
  } finally {
    setExtractingId(null);
  }
}


async function chunkDocument(doc: DocumentRow) {
  setMessage("");
  setChunkingId(doc.id);

  try {
    const response = await fetch(
      `/api/documents/${doc.id}/chunk`,
      { method: "POST" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Proses chunking gagal.");
    }

    setMessage(
      `Berhasil memproses "${doc.title}". ` +
      `${result.chunk_count} chunk tersimpan.`
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? `Chunking gagal: ${error.message}`
        : "Terjadi kesalahan saat memproses chunk."
    );
  } finally {
    setChunkingId(null);
  }
}

  async function openDocument(doc: DocumentRow) {
    setMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("pnpk-pdfs")
      .createSignedUrl(doc.storage_path, 60);

    if (error || !data?.signedUrl) {
      setMessage(
        `Gagal membuka PDF: ${error?.message ?? "URL tidak tersedia"}`
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(doc: DocumentRow) {
    const confirmed = window.confirm(
      `Hapus dokumen "${doc.title}" secara permanen?`
    );

    if (!confirmed) return;

    setMessage("");

    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (deleteError) {
      setMessage(`Gagal menghapus metadata: ${deleteError.message}`);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("pnpk-pdfs")
      .remove([doc.storage_path]);

    await loadDocuments();

    if (storageError) {
      setMessage(
        `Metadata terhapus, tetapi file Storage gagal dihapus: ${storageError.message}`
      );
    } else {
      setMessage("Dokumen berhasil dihapus.");
    }
  }


async function handleAskAI(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion || askingAI) return;

  setAskingAI(true);
  setAiAnswer("");
  setAiSources([]);
  setAiError("");

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: trimmedQuestion,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Gagal mendapatkan jawaban dari AI."
      );
    }

    setAiAnswer(result.answer || "AI belum menghasilkan jawaban.");
setAiSources(result.sources ?? []);

  } catch (error) {
    setAiError(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menghubungi AI."
    );
  } finally {
    setAskingAI(false);
  }
}


  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Gagal logout: ${error.message}`);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const filteredDocuments = documents.filter((doc) =>
    `${doc.title} ${doc.file_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Memuat MedGuideline AI...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-xl font-bold text-white">
              +
            </div>
            <div>
              <p className="font-bold tracking-tight text-teal-900">
                MedGuideline AI
              </p>
              <p className="text-xs text-slate-500">
                Personal Medical Knowledge Library
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            {loggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-3xl bg-gradient-to-br from-teal-900 to-teal-700 p-7 text-white sm:p-10">
          <p className="text-sm font-medium text-teal-200">
            PERSONAL MEDICAL LIBRARY
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Perpustakaan PNPK pribadimu.
          </h1>
          <p className="mt-4 text-sm leading-7 text-teal-50 sm:text-base">
            Simpan pedoman klinis, baca dokumen, dan bangun perpustakaan
            medis yang bisa kamu akses kembali kapan saja.
          </p>
          <p className="mt-5 break-all text-sm text-teal-100">
            Login sebagai: {user?.email}
          </p>
        </section>


<section
  id="tanya-ai"
  className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm sm:p-8"
>
  <div className="mb-5">
    <p className="text-sm font-semibold text-teal-700">
      ASISTEN KLINIS
    </p>
    <h2 className="mt-1 text-2xl font-bold">
      Tanya AI tentang PNPK
    </h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">
      Tanyakan isi pedoman yang tersimpan di perpustakaanmu.
      Jawaban didasarkan pada bagian dokumen yang ditemukan.
    </p>
  </div>

  <form onSubmit={handleAskAI} className="space-y-3">
    <label
      htmlFor="ai-question"
      className="block text-sm font-medium text-slate-700"
    >
      Pertanyaanmu
    </label>

    <textarea
      id="ai-question"
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      placeholder="Contoh: Bagaimana tata laksana pneumonia pada orang dewasa menurut PNPK?"
      maxLength={2000}
      rows={4}
      required
      className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
    />

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-400">
        Maksimal 2.000 karakter
      </p>

      <button
        type="submit"
        disabled={askingAI || !question.trim()}
        className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {askingAI ? "Sedang mencari jawaban..." : "Tanya AI"}
      </button>
    </div>
  </form>

  {askingAI && (
    <p role="status" className="mt-5 text-sm text-teal-700">
      AI sedang mencari referensi PNPK dan menyusun jawaban...
    </p>
  )}

  {aiError && (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {aiError}
    </div>
  )}

  {aiAnswer && (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h3 className="text-lg font-bold">Jawaban AI</h3>

     <div className="mt-3 break-words text-sm leading-7 text-slate-700 [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_strong]:font-bold">
  <ReactMarkdown>{aiAnswer}</ReactMarkdown>
</div>

      {aiSources.length > 0 && (
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <h4 className="font-semibold text-slate-800">
            Referensi dokumen
          </h4>

          <ul className="mt-3 space-y-3">
            {aiSources.map((source, index) => (
              <li
                key={`${source.documentTitle}-${source.chunkIndex}-${index}`}
                className="text-sm leading-6 text-slate-600"
              >
                <p className="font-medium text-slate-800">
                  {source.label}: {source.documentTitle}
                </p>

                <p>
                  {source.pageStart != null
                    ? `Halaman PDF ${
                        source.pageEnd != null &&
                        source.pageEnd !== source.pageStart
                          ? `${source.pageStart}–${source.pageEnd}`
                          : source.pageStart
                      }`
                    : "Halaman tidak tersedia"}
                  {" · "}
                  Chunk {source.chunkIndex}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-slate-400">
        Gunakan jawaban sebagai alat bantu memahami pedoman.
        Verifikasi rekomendasi klinis, dosis, dan halaman pada
        dokumen PNPK asli sebelum digunakan dalam praktik.
      </p>
    </div>
  )}
</section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">Tambah dokumen PNPK</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Pilih PDF maksimal 20 MB. File disimpan di bucket privat.
          </p>

          <form onSubmit={handleUpload} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="document-title"
                className="mb-2 block text-sm font-medium"
              >
                Judul dokumen
              </label>
              <input
                id="document-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Contoh: PNPK Tata Laksana Hipertensi"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label
                htmlFor="pdf-file"
                className="mb-2 block text-sm font-medium"
              >
                File PDF
              </label>
              <input
                id="pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={(e) =>
                  setFile(e.target.files?.[0] ?? null)
                }
                className="block w-full rounded-xl border border-slate-200 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:font-semibold file:text-teal-800"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Mengunggah..." : "Upload PDF"}
            </button>
          </form>

          {message && (
            <p
              role="status"
              className="mt-5 break-words rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700"
            >
              {message}
            </p>
          )}
        </section>

        <section>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-bold">Perpustakaan PNPK</h2>
              <p className="mt-2 text-sm text-slate-500">
                {documents.length} dokumen tersimpan
              </p>
            </div>

            <input
              aria-label="Cari dokumen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau nama file..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:max-w-sm"
            />
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <h3 className="font-semibold">
                {documents.length === 0
                  ? "Perpustakaanmu masih kosong"
                  : "Dokumen tidak ditemukan"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {documents.length === 0
                  ? "Unggah PDF PNPK pertamamu menggunakan formulir di atas."
                  : "Coba gunakan kata kunci pencarian yang berbeda."}
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredDocuments.map((doc) => (
                <article
                  key={doc.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">
                      {doc.title}
                    </h3>
                    <p className="mt-1 break-all text-sm text-slate-500">
                      {doc.file_name}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB
                      {" · "}
                      {new Date(doc.created_at).toLocaleDateString("id-ID")}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
  Status ekstraksi: {doc.processing_status || "pending"}
  {doc.page_count != null && ` · ${doc.page_count} halaman`}
</p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => openDocument(doc)}
                      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      Buka PDF
                    </button>

<button
  onClick={() => extractDocument(doc)}
  disabled={extractingId !== null}
  className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  {extractingId === doc.id
    ? "Mengekstrak..."
    : doc.processing_status === "completed"
      ? "Ekstrak Ulang"
      : "Ekstrak Teks"}
</button>

<button
  onClick={() => chunkDocument(doc)}
  disabled={
    extractingId !== null ||
    chunkingId !== null ||
    doc.processing_status !== "completed"
  }
  className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  {chunkingId === doc.id
    ? "Memproses..."
    : "Proses Chunk"}
</button>

                    <button
                      onClick={() => deleteDocument(doc)}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
