import { experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireSession } from "@/lib/session";
import { TRANSCRIBE_MODEL } from "@/lib/ai/models";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Speech-to-text for the voice-command mic. Takes a recorded audio blob
 * (multipart form field `audio`) and returns `{ text }`. Always uses our
 * OPENAI_API_KEY — transcription is OpenAI-specific and orthogonal to the
 * user's chosen chat model/provider.
 */
export async function POST(req: Request) {
  await requireSession();

  if (!process.env.OPENAI_API_KEY) {
    return new Response("Transcription is not configured", { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return new Response("No audio provided", { status: 400 });
  }
  // Guard against oversized uploads (~25MB, OpenAI's limit).
  if (file.size > 25 * 1024 * 1024) {
    return new Response("Audio too large", { status: 413 });
  }

  try {
    const audio = new Uint8Array(await file.arrayBuffer());
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text } = await transcribe({
      model: openai.transcription(TRANSCRIBE_MODEL),
      audio,
    });
    return Response.json({ text: text.trim() });
  } catch (err) {
    console.error("transcribe: failed", err);
    return new Response("Transcription failed", { status: 500 });
  }
}
