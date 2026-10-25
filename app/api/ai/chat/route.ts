
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMBEDDING_MODEL = "gemini-embedding-001";
const CHAT_MODEL = "gemini-3.5-flash-lite";
const RESULT_LIMIT = 5;

type SearchChunk = {
  document_id: string;
  chunk_index: number;
  content: string;
  page_start: number | null;
  page_end: number | null;
};

type KeywordChunk = SearchChunk & {
  rank: number;
};

type SemanticChunk = SearchChunk & {
  similarity: number;
};

type RankedChunk = SearchChunk & {
  fusionScore: number;
};

export async function POST(request: Request) {
  try {
    // 1. Pastikan pengguna sudah login.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    // 2. Validasi pertanyaan.
    const body = await request.json();
    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    if (!question || question.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pertanyaan wajib diisi dan maksimal 2000 karakter.",
        },
        { status: 400 }
      );
    }

    // 3. Pastikan API key tersedia.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Konfigurasi Gemini belum tersedia.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 4. Jalankan keyword search dan buat embedding
    // pertanyaan secara bersamaan.
    const [keywordResponse, embeddingResponse] =
      await Promise.all([
        supabase.rpc("search_pnpk_chunks", {
          search_text: question,
          result_limit: RESULT_LIMIT,
        }),
        ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: question,
          config: {
            outputDimensionality: 768,
          },
        }),
      ]);

    if (keywordResponse.error) {
      console.error(
        "Keyword search error:",
        keywordResponse.error.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mencari bagian dokumen PNPK.",
        },
        { status: 500 }
      );
    }

    const embedding = embeddingResponse.embeddings?.[0]?.values;

    if (!embedding || embedding.length !== 768) {
      throw new Error("Embedding pertanyaan tidak valid.");
    }

    // 5. Jalankan semantic search.
    const { data: semanticResults, error: semanticError } =
      await supabase.rpc("search_pnpk_chunks_semantic", {
        query_embedding: JSON.stringify(embedding),
        result_limit: RESULT_LIMIT,
      });

    if (semanticError) {
      console.error(
        "Semantic search error:",
        semanticError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Gagal melakukan pencarian semantik.",
        },
        { status: 500 }
      );
    }

    const keywordResults =
      (keywordResponse.data ?? []) as KeywordChunk[];

    const semanticChunks =
      (semanticResults ?? []) as SemanticChunk[];

    // 6. Gabungkan hasil dengan Reciprocal Rank Fusion (RRF).
    // Chunk yang ditemukan oleh kedua metode mendapat skor
    // gabungan lebih tinggi. Duplikat tidak dikirim dua kali.
    const merged = new Map<string, RankedChunk>();
    const rrfConstant = 60;

    function addResults(
      results: SearchChunk[],
      method: "keyword" | "semantic"
    ) {
      results.forEach((chunk, index) => {
        const key = `${chunk.document_id}:${chunk.chunk_index}`;
        const score = 1 / (rrfConstant + index + 1);

        const existing = merged.get(key);

        if (existing) {
          existing.fusionScore += score;
        } else {
          merged.set(key, {
            document_id: chunk.document_id,
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            fusionScore: score,
          });
        }
      });
    }

    addResults(keywordResults, "keyword");
    addResults(semanticChunks, "semantic");

    const ranked = Array.from(merged.values())
      .sort((a, b) => b.fusionScore - a.fusionScore)
      .slice(0, RESULT_LIMIT);

    
if (ranked.length === 0) {
  const answer =
    "Saya belum menemukan bagian PNPK yang cukup relevan untuk menjawab pertanyaan ini. Coba gunakan istilah klinis atau nama penyakit yang lebih spesifik.";

  const { error: historyError } = await supabase
    .from("ai_chat_history")
    .insert({
      user_id: user.id,
      question,
      answer,
      sources: [],
    });

  if (historyError) {
    console.error("Save AI history error:", historyError);
  }

  return NextResponse.json({
    success: true,
    answer,
    sources: [],
  });
}


    // 7. Ambil judul dokumen milik pengguna yang login.
    const documentIds = [
      ...new Set(ranked.map((chunk) => chunk.document_id)),
    ];

    const { data: documents, error: documentsError } =
      await supabase
        .from("documents")
        .select("id, title")
        .eq("user_id", user.id)
        .in("id", documentIds);

    if (documentsError) {
      console.error(
        "Document query error:",
        documentsError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil judul dokumen.",
        },
        { status: 500 }
      );
    }

    const titleById = new Map(
      (documents ?? []).map((doc) => [doc.id, doc.title])
    );

    // 8. Sertakan nomor halaman di konteks AI.
    const context = ranked
      .map((chunk, index) => {
        const title =
          titleById.get(chunk.document_id) ?? "Dokumen PNPK";

        const page =
          chunk.page_start != null
            ? chunk.page_end != null &&
              chunk.page_end !== chunk.page_start
              ? `${chunk.page_start}-${chunk.page_end}`
              : `${chunk.page_start}`
            : "Tidak diketahui";

        return [
          `[Sumber ${index + 1}]`,
          `Judul: ${title}`,
          `Halaman PDF: ${page}`,
          `Indeks chunk: ${chunk.chunk_index}`,
          `Teks:\n${String(chunk.content).slice(0, 5000)}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    // 9. Hasilkan jawaban berbasis konteks PNPK.
    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: `
Kamu adalah asisten informasi klinis yang membantu tenaga kesehatan
memahami dokumen PNPK Indonesia.

ATURAN WAJIB:
- Jawab berdasarkan konteks dokumen yang disediakan.
- Jangan mengarang rekomendasi, dosis, kontraindikasi, atau isi pedoman.
- Jika konteks tidak cukup, nyatakan dengan jelas bagian informasi
  yang belum ditemukan.
- Bedakan isi dokumen dari penjelasan tambahan.
- Gunakan label [Sumber 1], [Sumber 2], dan seterusnya hanya jika
  sumber tersebut benar-benar mendukung pernyataan.
- Cantumkan nomor halaman PDF jika tersedia pada konteks sumber.
- Jangan mengarang nomor halaman atau menganggap nomor halaman PDF
  pasti sama dengan nomor halaman tercetak di dokumen.
- Jangan menyimpulkan bahwa suatu rekomendasi tidak ada di PNPK
  hanya karena tidak ditemukan dalam potongan yang diberikan.
- Jawaban AI bukan pengganti penilaian klinis dan verifikasi dokumen asli.

KONTEKS DOKUMEN:
${context}

PERTANYAAN:
${question}
      `,
    });

   
const answer =
  result.text?.trim() ||
  "Gemini tidak menghasilkan jawaban. Silakan coba lagi.";

const sources = ranked.map((chunk, index) => ({
  label: `Sumber ${index + 1}`,
  documentTitle:
    titleById.get(chunk.document_id) ?? "Dokumen PNPK",
  chunkIndex: chunk.chunk_index,
  pageStart: chunk.page_start,
  pageEnd: chunk.page_end,
}));

const { error: historyError } = await supabase
  .from("ai_chat_history")
  .insert({
    user_id: user.id,
    question,
    answer,
    sources,
  });

if (historyError) {
  console.error("Save AI history error:", historyError);
}

return NextResponse.json({
  success: true,
  answer,
  sources,
});

  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "Terjadi kesalahan saat memproses pertanyaan.",
      },
      { status: 500 }
    );
  }
}
