
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gemini-embedding-001";

export async function POST(request: Request) {
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

    const body = await request.json();
    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    if (!question || question.length > 2000) {
      return NextResponse.json(
        { error: "Pertanyaan wajib diisi, maksimal 2000 karakter." },
        { status: 400 }
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

    const embeddingResult = await ai.models.embedContent({
      model: MODEL,
      contents: question,
      config: {
        outputDimensionality: 768,
      },
    });

    const values = embeddingResult.embeddings?.[0]?.values;

    if (!values || values.length !== 768) {
      throw new Error("Embedding pertanyaan tidak valid.");
    }

    const { data: results, error: searchError } = await supabase.rpc(
      "search_pnpk_chunks_semantic",
      {
        query_embedding: JSON.stringify(values),
        result_limit: 5,
      }
    );

    if (searchError) {
      console.error("Semantic search error:", searchError);

      return NextResponse.json(
        { error: "Gagal mencari referensi PNPK." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      question,
      results: results ?? [],
    });
  } catch (error) {
    console.error("Semantic search error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat pencarian semantik.",
      },
      { status: 500 }
    );
  }
}
