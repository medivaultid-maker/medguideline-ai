
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from("ai_chat_history")
      .select("id, question, answer, sources, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Load AI history error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil riwayat percakapan.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      history: data ?? [],
    });
  } catch (error) {
    console.error("AI history API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan saat mengambil riwayat.",
      },
      { status: 500 }
    );
  }
}
