import { getSession } from "@/lib/session";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";

// Long-lived SSE connection — never statically optimized, must run on Node.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Per-user Server-Sent Events stream. The inbox/calendar mount an EventSource
 * against this; the Corsair webhook receiver publishes to lib/realtime, which
 * fans events out here. Auth is the normal session cookie (EventSource sends
 * cookies same-origin), so each stream is scoped to one signed-in user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client gone) — cleanup runs via cancel().
        }
      };
      const send = (event: string, data: unknown) =>
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // Initial comment + hello so the client knows the stream is live.
      safeEnqueue(": connected\n\n");
      send("ready", { at: Date.now() });

      const unsubscribe = subscribe(userId, (e: RealtimeEvent) => send("inbox", e));

      // Heartbeat keeps proxies/load-balancers from closing the idle connection.
      const heartbeat = setInterval(() => safeEnqueue(": ping\n\n"), 25_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
