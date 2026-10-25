
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

type ExtractedPage = {
  page: number;
  text: string;
};

type PageChunk = {
  content: string;
  page_start: number;
  page_end: number;
};

function splitPages(pages: ExtractedPage[]): PageChunk[] {
  const chunks: PageChunk[] = [];

  for (const page of pages) {
    const text = page.text?.trim();
    if (!text) continue;

    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + CHUNK_SIZE, text.length);

      if (end < text.length) {
        const paragraphBreak = text.lastIndexOf("\n\n", end);
        const sentenceBreak = text.lastIndexOf(". ", end);
        const bestBreak = Math.max(paragraphBreak, sentenceBreak);

        if (bestBreak > start + CHUNK_SIZE * 0.6) {
          end = bestBreak + 1;
        }
      }

      const content = text.slice(start, end).trim();

      if (content) {
        chunks.push({
          content,
          page_start: page.page,
          page_end: page.page,
        });
      }

      if (end >= text.length) break;

      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
  }

  return chunks;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, title, extracted_pages, processing_status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Dokumen tidak ditemukan atau akses ditolak." },
        { status: 404 }
      );
    }

    if (
      document.processing_status !== "completed" ||
      !document.extracted_pages
    ) {
      return NextResponse.json(
        {
          error:
            "Ekstrak ulang PDF terlebih dahulu agar teks per halaman tersedia.",
        },
        { status: 400 }
      );
    }

    const pages = document.extracted_pages as unknown as ExtractedPage[];
    const chunks = splitPages(pages);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada teks yang bisa diproses." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(`Gagal menghapus chunk lama: ${deleteError.message}`);
    }

    const rows = chunks.map((chunk, index) => ({
      document_id: id,
      user_id: user.id,
      chunk_index: index,
      content: chunk.content,
      page_start: chunk.page_start,
      page_end: chunk.page_end,
    }));

    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(rows.slice(i, i + BATCH_SIZE));

      if (insertError) {
        throw new Error(`Gagal menyimpan chunk: ${insertError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      document_id: id,
      title: document.title,
      page_count: pages.length,
      chunk_count: chunks.length,
      chunk_size: CHUNK_SIZE,
      chunk_overlap: CHUNK_OVERLAP,
      page_mapping: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat membuat chunk.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
