
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gemini-embedding-001";
const BATCH_SIZE = 10;

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY belum dikonfigurasi." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const { data: chunks, error: queryError } = await supabase
      .from("document_chunks")
      .select("id, content")
      .eq("user_id", user.id)
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("Gagal mengambil chunks:", queryError);

      return NextResponse.json(
        { error: "Gagal mengambil potongan dokumen." },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        message: "Semua chunk sudah memiliki embedding.",
        processed: 0,
        remaining: 0,
      });
    }

    let processed = 0;

    for (const chunk of chunks) {
      const result = await ai.models.embedContent({
        model: MODEL,
        contents: chunk.content,
        config: {
          outputDimensionality: 768,
        },
      });

      const values = result.embeddings?.[0]?.values;

      if (!values || values.length !== 768) {
        throw new Error(
          `Embedding tidak valid untuk chunk ${chunk.id}`
        );
      }

      const { data: updatedRows, error: updateError } = await supabase
  .from("document_chunks")
  .update({
    embedding: JSON.stringify(values),
  })
  .eq("id", chunk.id)
  .eq("user_id", user.id)
  .is("embedding", null)
  .select("id");

if (updateError) {
  console.error("Gagal menyimpan embedding:", updateError);
  throw new Error(
    `Gagal menyimpan embedding: ${updateError.message}`
  );
}

if (!updatedRows || updatedRows.length === 0) {
  console.error("Embedding tidak tersimpan untuk chunk:", chunk.id);
  throw new Error(
    `Tidak ada baris yang diperbarui untuk chunk ${chunk.id}.`
  );
}

processed++;

      if (updateError) {
        console.error("Gagal menyimpan embedding:", updateError);
        throw new Error("Gagal menyimpan embedding ke Supabase.");
      }

      processed++;
    }

    const { count, error: countError } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("embedding", null);

    if (countError) {
      console.error("Gagal menghitung sisa chunks:", countError);
    }

    return NextResponse.json({
      message: "Batch embedding berhasil diproses.",
      processed,
      remaining: count ?? null,
    });
  } catch (error) {
    console.error("Embedding error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat membuat embedding.",
      },
      { status: 500 }
    );
  }
}
