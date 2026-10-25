
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
        router.refresh();
        return;
      }

      setUser(data.user);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
        router.refresh();
      } else if (session.user) {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);
      alert(`Gagal logout: ${error.message}`);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

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
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {loggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="rounded-3xl bg-gradient-to-br from-teal-900 to-teal-700 p-7 text-white sm:p-10">
          <p className="text-sm font-medium text-teal-200">
            PERSONAL MEDICAL LIBRARY
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Perpustakaan PNPK pribadimu.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-teal-50 sm:text-base">
            Simpan pedoman klinis, buat catatan, dan pelajari dokumen medis
            dalam satu tempat.
          </p>

          <div className="mt-7 rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-teal-200">Login sebagai</p>
            <p className="mt-1 break-all font-medium">
              {user?.email ?? "Akun tidak diketahui"}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">Perpustakaan saya</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dokumen PNPK yang kamu simpan nantinya akan muncul di sini.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" />
              </svg>
            </div>
            <h3 className="mt-5 font-semibold">
              Perpustakaanmu masih kosong
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Selanjutnya kita akan membuat fitur untuk mengunggah dan
              menyimpan PDF PNPK ke perpustakaan pribadimu.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
