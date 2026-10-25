
"use client";

import { useState } from "react";

export default function Home() {
  const [search, setSearch] = useState("");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-xl text-white">
            +
          </div>
          <div>
            <h1 className="font-bold tracking-tight">MedGuideline</h1>
            <p className="text-xs text-slate-500">AI Medical Library</p>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>

        <nav className="space-y-2">
          <div className="rounded-xl bg-teal-50 px-4 py-3 font-medium text-teal-800">
            <span className="mr-3">▦</span> Dashboard
          </div>
          <div className="rounded-xl px-4 py-3 text-slate-600">
            <span className="mr-3">▤</span> Perpustakaan PNPK
          </div>
          <div className="rounded-xl px-4 py-3 text-slate-600">
            <span className="mr-3">✎</span> Catatan Saya
          </div>
          <div className="rounded-xl px-4 py-3 text-slate-600">
            <span className="mr-3">◷</span> Riwayat Membaca
          </div>
        </nav>

        <div className="absolute bottom-6 left-6 right-6 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">Personal Knowledge Base</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Satu tempat untuk menyimpan dan mempelajari pedoman klinis.
          </p>
        </div>
      </aside>

      <section className="md:ml-64">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 md:px-10">
          <div>
            <p className="text-sm text-slate-500">Medical Knowledge Workspace</p>
            <h2 className="mt-1 text-xl font-bold">Dashboard</h2>
          </div>
          <div className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600">
            Personal Library
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-10">
          <section className="overflow-hidden rounded-3xl bg-teal-900 p-7 text-white md:p-10">
            <p className="text-sm font-medium text-teal-200">
              YOUR MEDICAL KNOWLEDGE BASE
            </p>
            <h3 className="mt-4 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
              Semua pedoman klinis. Satu perpustakaan pintar.
            </h3>
            <p className="mt-4 max-w-xl leading-7 text-teal-100">
              Simpan PNPK, baca PDF, tandai bagian penting, dan temukan jawaban
              berbasis dokumen dengan referensi halaman yang jelas.
            </p>

            <button
              onClick={() =>
                document.getElementById("library")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
              className="mt-7 rounded-xl bg-white px-5 py-3 font-semibold text-teal-900 hover:bg-teal-50"
            >
              Buka perpustakaan →
            </button>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Dokumen PNPK", value: "0", icon: "▤" },
              { label: "Catatan tersimpan", value: "0", icon: "✎" },
              { label: "Dokumen terakhir dibaca", value: "—", icon: "◷" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <span className="text-xl text-teal-700">{item.icon}</span>
                </div>
                <p className="mt-4 text-3xl font-bold">{item.value}</p>
              </div>
            ))}
          </section>

          <section id="library" className="scroll-mt-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h3 className="text-xl font-bold">Perpustakaan PNPK</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Kumpulan pedoman klinis pribadi Anda.
                </p>
              </div>
              <button
                onClick={() =>
                  alert("Fitur upload PDF akan kita bangun pada tahap berikutnya.")
                }
                className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800"
              >
                + Tambah dokumen
              </button>
            </div>

            <div className="mt-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul PNPK atau topik klinis..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-700">
                ▤
              </div>
              <h4 className="mt-4 font-semibold">Perpustakaan masih kosong</h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Dokumen PNPK yang Anda unggah nantinya akan tersimpan di
                perpustakaan ini dan dapat dibuka kembali kapan saja.
              </p>
            </div>
          </section>

          <footer className="border-t border-slate-200 py-5 text-xs text-slate-400">
            MedGuideline AI · Personal Medical Knowledge Library
          </footer>
        </div>
      </section>
    </main>
  );
}
