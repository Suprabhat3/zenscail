import { z } from "zod";
import { requireSession } from "@/lib/session";
import { ensureCorsairTenant } from "@/lib/tenant";
import { corsairTenant } from "@/lib/corsair";
import { getAttachment } from "@/lib/gmail";

/**
 * Stream one attachment from a received Gmail message back to the browser as a
 * download. The bytes are fetched live via the connected tenant (the same read
 * scope the thread view already uses) — we never cache attachment bodies. Auth
 * + tenant scoping mean a user can only pull attachments from their own mailbox.
 */

const QuerySchema = z.object({
  message: z.string().min(1),
  attachment: z.string().min(1),
  filename: z.string().min(1).max(255).default("attachment"),
  mime: z.string().min(1).max(255).default("application/octet-stream"),
});

/** Strip characters that would break the Content-Disposition header. */
function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n]/g, "").replace(/[\\/]/g, "_").slice(0, 255) || "attachment";
}

export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    message: url.searchParams.get("message"),
    attachment: url.searchParams.get("attachment"),
    filename: url.searchParams.get("filename") ?? undefined,
    mime: url.searchParams.get("mime") ?? undefined,
  });
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const tenantId = await ensureCorsairTenant(session.user.id);
  const t = corsairTenant(tenantId);
  const bytes = await getAttachment(t, parsed.data.message, parsed.data.attachment);
  if (!bytes) {
    return new Response("Attachment not found", { status: 404 });
  }

  const filename = sanitizeFilename(parsed.data.filename);
  // Hand the web Response an ArrayBuffer-backed Uint8Array (Buffer isn't a
  // BodyInit, and a view over ArrayBufferLike doesn't satisfy the type).
  const body = new Uint8Array(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": parsed.data.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Private user data — never cache on shared infrastructure.
      "Cache-Control": "private, no-store",
    },
  });
}
