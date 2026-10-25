
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage(
            "Pendaftaran berhasil. Periksa email untuk verifikasi jika diminta, lalu login."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-slate-900">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-teal-900 p-10 text-white md:flex">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-teal-800">
              +
            </div>
            <p className="mt-8 text-sm font-medium tracking-widest text-teal-200">
              MEDGUIDELINE AI
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">
              Pedoman klinis, tersimpan rapi dalam satu tempat.
            </h1>
            <p className="mt-5 leading-7 text-teal-100">
              Bangun perpustakaan PNPK pribadi, simpan catatan, dan pelajari
              dokumen dengan bantuan AI.
            </p>
          </div>
          <p className="text-sm text-teal-200">
            Personal Medical Knowledge Library
          </p>
        </section>

        <section className="p-7 sm:p-10">
          <div className="mb-8 md:hidden">
            <p className="font-bold text-teal-800">+ MedGuideline AI</p>
          </div>

          <h2 className="text-2xl font-bold">
            {mode === "login" ? "Selamat datang kembali" : "Buat akun"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "Login untuk membuka perpustakaan medis pribadimu."
              : "Daftarkan akun untuk mulai membangun perpustakaanmu."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Password
              </label>
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {message && (
              <p className="rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {loading
                ? "Memproses..."
                : mode === "login"
                  ? "Login"
                  : "Daftar akun"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
              className="font-semibold text-teal-800 hover:underline"
            >
              {mode === "login" ? "Daftar" : "Login"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
