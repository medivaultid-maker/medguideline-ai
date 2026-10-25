
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "GEMINI_API_KEY belum terbaca." },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: "Balas hanya dengan kalimat: Koneksi Gemini berhasil.",
    });

    return NextResponse.json({
      success: true,
      message: response.text,
    });
  } catch (error) {
    console.error("Gemini test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghubungi Gemini. Periksa API key dan kuota.",
      },
      { status: 500 }
    );
  }
}
