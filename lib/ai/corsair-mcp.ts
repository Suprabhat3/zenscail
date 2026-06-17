import "server-only";

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  [k: string]: unknown;
};

/**
 * Minimal MCP streamable-HTTP transport tailored to Corsair's hosted server.
 *
 * Why not the Vercel AI SDK's built-in `type: "http"` transport? After the
 * `notifications/initialized` 202 ack, that transport opens a background GET
 * "inbound SSE" stream for server→client messages. Corsair answers that GET
 * with `404 {"error":"Session not found"}` (instead of the spec's 405 "not
 * supported"), and the GET's response can clobber the negotiated session id —
 * so the very next POST (`tools/list` or a tool call) fails intermittently
 * with the same 404. That's the "sometimes works, mostly errors" the chat hit.
 *
 * We only need request/response tool calling — no server-initiated messages —
 * so this transport does just the POSTs (initialize → initialized → calls),
 * reusing the session id across them, and never opens that GET. Sequential
 * POSTs are exactly what a raw probe of the endpoint handles reliably.
 */
export class CorsairHttpTransport {
  sessionId?: string;
  protocolVersion?: string;
  onmessage?: (message: unknown) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  private readonly url: string;
  private readonly baseHeaders: Record<string, string>;

  constructor(opts: { url: string; headers?: Record<string, string> }) {
    this.url = opts.url;
    this.baseHeaders = opts.headers ?? {};
  }

  async start(): Promise<void> {
    // No persistent connection to open — POSTs carry everything.
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    const headers: Record<string, string> = {
      ...this.baseHeaders,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    if (this.protocolVersion) headers["mcp-protocol-version"] = this.protocolVersion;

    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;

    // 202 = notification accepted; there's no response body to dispatch.
    if (res.status === 202) return;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Corsair MCP POST failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      for (const m of Array.isArray(data) ? data : [data]) this.onmessage?.(m);
      return;
    }
    if (contentType.includes("text/event-stream")) {
      const body = await res.text();
      for (const evt of parseSseMessages(body)) this.onmessage?.(evt);
      return;
    }
    // Empty/other body: nothing to dispatch (e.g. a bare 200 ack).
  }

  async close(): Promise<void> {
    try {
      if (this.sessionId) {
        await fetch(this.url, {
          method: "DELETE",
          headers: { ...this.baseHeaders, "mcp-session-id": this.sessionId },
        });
      }
    } catch {
      // Best-effort teardown; the session expires server-side regardless.
    }
    this.onclose?.();
  }
}

/** Parse `event:`/`data:` SSE frames, returning the JSON payload of each. */
function parseSseMessages(raw: string): unknown[] {
  const out: unknown[] = [];
  for (const frame of raw.split(/\r?\n\r?\n/)) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      out.push(JSON.parse(data));
    } catch {
      // Ignore keep-alives / non-JSON frames.
    }
  }
  return out;
}
