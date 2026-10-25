
import { NextResponse } from "next/server";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let documentId: string | null = null;
  let userId: string | null = null;

  try {
    const { id } = await params;
    documentId = id;
    supabase = await createClient();

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

    userId = user.id;

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, user_id, title, file_path, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Dokumen tidak ditemukan atau akses ditolak." },
        { status: 404 }
      );
    }

    const storagePath = document.storage_path || document.file_path;

    if (!storagePath) {
      return NextResponse.json(
        { error: "Lokasi file PDF tidak ditemukan." },
        { status: 400 }
      );
    }

    await supabase
      .from("documents")
      .update({
        processing_status: "processing",
        processing_error: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    const { data: file, error: downloadError } = await supabase.storage
      .from("pnpk-pdfs")
      .download(storagePath);

    if (downloadError || !file) {
      throw new Error(
        `Gagal mengunduh PDF: ${
          downloadError?.message || "File tidak ditemukan."
        }`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ekstrak teks per halaman sambil mempertahankan nomor halaman.
    const extractedPages: { page: number; text: string }[] = [];
    let currentPage = 0;

   const parsePdf = pdf as unknown as (
  data: Buffer,
  options: {
    pagerender: (pageData: any) => Promise<string>;
  }
) => Promise<{
  text: string;
  numpages: number;
}>;

const result = await parsePdf(buffer, {
      pagerender: async (pageData: any) => {
        currentPage += 1;

        const textContent = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });

        let lastY: number | undefined;
        let pageText = "";

        for (const item of textContent.items) {
          if (!("str" in item)) continue;

          const y = item.transform?.[5];

          if (lastY === undefined || y === lastY) {
            pageText += item.str;
          } else {
            pageText += "\n" + item.str;
          }

          lastY = y;
        }

        extractedPages.push({
          page: currentPage,
          text: pageText.trim(),
        });

        return pageText;
      },
    });

    const extractedText = result.text?.trim() ?? "";
    const pageCount = result.numpages ?? extractedPages.length;

    if (!extractedText) {
      throw new Error(
        "Teks PDF kosong. Jika PDF berupa hasil scan, diperlukan OCR."
      );
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        extracted_text: extractedText,
        extracted_pages: extractedPages,
        page_count: pageCount,
        processing_status: "completed",
        processing_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(
        `Gagal menyimpan hasil ekstraksi: ${updateError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      document_id: id,
      title: document.title,
      page_count: pageCount,
      extracted_page_count: extractedPages.length,
      character_count: extractedText.length,
      processing_status: "completed",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memproses PDF.";

    if (supabase && documentId && userId) {
      await supabase
        .from("documents")
        .update({
          processing_status: "failed",
          processing_error: message.slice(0, 1000),
        })
        .eq("id", documentId)
        .eq("user_id", userId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
