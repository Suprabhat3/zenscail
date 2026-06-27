"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SmartComposeTextarea } from "@/components/mail/SmartComposeTextarea";
import { saveDraft } from "@/app/(app)/mail/draft-actions";
import { useToast } from "@/components/ui/Toast";

/** Escape plain text and wrap into paragraphs for the rich editor. */
function textToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return "";
  return blocks
    .map((b) => `<p>${esc(b).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Rough HTML → plain text for switching back to the plain composer. */
function htmlToText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return (el.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "6" },
];

type Mode = "plain" | "rich";

/**
 * Compose body editor with a Plain mode (Gmail-style smart-compose ghost text)
 * and a Rich (styled HTML) mode with a formatting toolbar + an AI "Prettify"
 * button. Mirrors the active body into the form as `body`, with `isHtml` and
 * `draftId` hidden inputs the SendBar reads. Autosaves the whole draft (debounced)
 * to the database so the user can leave and return to it from the Drafts folder.
 */
export function RichComposer({
  defaultBody = "",
  defaultIsHtml = false,
  draftId: initialDraftId = "",
  subjectId = "subject",
  toName = "to",
  className = "px-5 py-4",
}: {
  defaultBody?: string;
  defaultIsHtml?: boolean;
  draftId?: string;
  subjectId?: string;
  toName?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef(initialDraftId);

  const [mode, setMode] = useState<Mode>(defaultIsHtml ? "rich" : "plain");
  const [richHtml, setRichHtml] = useState(defaultIsHtml ? defaultBody : "");
  const [plainText, setPlainText] = useState(defaultIsHtml ? "" : defaultBody);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [prettifying, setPrettifying] = useState(false);

  // Load the editor's HTML whenever we enter rich mode.
  useEffect(() => {
    if (mode === "rich" && editorRef.current) {
      editorRef.current.innerHTML = richHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const readForm = useCallback(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return null;
    const fd = new FormData(form);
    const isHtml = mode === "rich";
    const body =
      mode === "rich"
        ? editorRef.current?.innerHTML ?? ""
        : String(fd.get("body") ?? "");
    return {
      to: String(fd.get("to") ?? ""),
      cc: String(fd.get("cc") ?? "") || undefined,
      subject: String(fd.get("subject") ?? ""),
      body,
      isHtml,
      threadId: String(fd.get("threadId") ?? "") || undefined,
      inReplyTo: String(fd.get("inReplyTo") ?? "") || undefined,
    };
  }, [mode]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const data = readForm();
      if (!data) return;
      try {
        const { id } = await saveDraft({ id: draftIdRef.current || undefined, ...data });
        if (id) {
          draftIdRef.current = id;
          setDraftId(id);
        }
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 1200);
  }, [readForm]);

  // Autosave on any change to recipients / subject / plain body.
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const onInput = () => scheduleSave();
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, [scheduleSave]);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setRichHtml(editorRef.current?.innerHTML ?? "");
    scheduleSave();
  }

  function onEditorInput() {
    setRichHtml(editorRef.current?.innerHTML ?? "");
    scheduleSave();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "rich") {
      // Carry the plain text over as paragraphs.
      const ta = wrapRef.current?.querySelector<HTMLTextAreaElement>("textarea[name='body']");
      const text = ta?.value ?? plainText;
      setRichHtml(textToHtml(text));
    } else {
      const text = htmlToText(editorRef.current?.innerHTML ?? richHtml);
      setPlainText(text);
    }
    setMode(next);
    scheduleSave();
  }

  async function onPrettify() {
    const data = readForm();
    if (!data) return;
    const source = mode === "rich" ? htmlToText(data.body) : data.body;
    if (!source.trim()) {
      toast("Write a message first, then Prettify it");
      return;
    }
    setPrettifying(true);
    try {
      const res = await fetch("/api/compose/prettify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: source, subject: data.subject, to: data.to }),
      });
      const json: { html?: string } = res.ok ? await res.json() : {};
      if (!json.html) {
        toast("Couldn't prettify — try again");
        return;
      }
      setRichHtml(json.html);
      setMode("rich");
      // Apply to the editor once it's mounted.
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.innerHTML = json.html!;
      });
      scheduleSave();
      toast("Styled with AI — review and send");
    } catch {
      toast("Couldn't prettify — try again");
    } finally {
      setPrettifying(false);
    }
  }

  const tbBtn =
    "rounded-md px-2 py-1 text-sm text-(--ink-soft) transition hover:bg-(--bg) disabled:opacity-40";

  return (
    <div ref={wrapRef}>
      {/* Mode + actions bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-(--line-soft) px-5 py-2.5">
        <div className="inline-flex overflow-hidden rounded-full border border-(--line)">
          <button
            type="button"
            onClick={() => switchMode("plain")}
            className={`px-3 py-1 text-xs font-medium transition ${
              mode === "plain" ? "bg-(--ink) text-(--bg)" : "text-(--muted) hover:text-(--ink)"
            }`}
          >
            Plain
          </button>
          <button
            type="button"
            onClick={() => switchMode("rich")}
            className={`px-3 py-1 text-xs font-medium transition ${
              mode === "rich" ? "bg-(--ink) text-(--bg)" : "text-(--muted) hover:text-(--ink)"
            }`}
          >
            Styled
          </button>
        </div>

        <button
          type="button"
          onClick={onPrettify}
          disabled={prettifying}
          className="inline-flex items-center gap-1.5 rounded-full border border-(--accent)/40 bg-(--accent)/5 px-3 py-1 text-xs font-semibold text-(--accent) transition hover:bg-(--accent)/10 disabled:opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
          </svg>
          {prettifying ? "Prettifying…" : "Prettify with AI"}
        </button>

        <span className="ml-auto text-xs text-(--muted)">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>

      {/* Formatting toolbar (rich mode only) */}
      {mode === "rich" && (
        <div className="flex flex-wrap items-center gap-1 border-b border-(--line-soft) px-5 py-2">
          <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={`${tbBtn} font-bold`}>B</button>
          <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={`${tbBtn} italic`}>I</button>
          <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={`${tbBtn} underline`}>U</button>
          <span className="mx-1 h-4 w-px bg-(--line)" />
          <select
            title="Font size"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { exec("fontSize", e.target.value); e.target.selectedIndex = 1; }}
            defaultValue="3"
            className="rounded-md border border-(--line) bg-(--paper) px-1.5 py-1 text-xs text-(--ink-soft) focus:outline-none"
          >
            {FONT_SIZES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <label className="ml-1 flex items-center gap-1 text-xs text-(--muted)" title="Text color">
            <span>A</span>
            <input type="color" defaultValue="#25201a" onMouseDown={(e) => e.preventDefault()} onChange={(e) => exec("foreColor", e.target.value)} className="h-5 w-5 cursor-pointer rounded border border-(--line) bg-transparent p-0" />
          </label>
          <label className="ml-1 flex items-center gap-1 text-xs text-(--muted)" title="Highlight">
            <span>🖍</span>
            <input type="color" defaultValue="#fce9ed" onMouseDown={(e) => e.preventDefault()} onChange={(e) => exec("hiliteColor", e.target.value)} className="h-5 w-5 cursor-pointer rounded border border-(--line) bg-transparent p-0" />
          </label>
          <span className="mx-1 h-4 w-px bg-(--line)" />
          <button type="button" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={tbBtn}>• List</button>
          <button
            type="button"
            title="Insert link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url) exec("createLink", url);
            }}
            className={tbBtn}
          >
            🔗 Link
          </button>
          <button type="button" title="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")} className={tbBtn}>Clear</button>
        </div>
      )}

      {/* Body */}
      {mode === "plain" ? (
        <SmartComposeTextarea
          name="body"
          rows={13}
          defaultValue={plainText}
          placeholder="Write your message…"
          className={className}
          subjectId={subjectId}
          toName={toName}
        />
      ) : (
        <>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            data-placeholder="Write your message…"
            className={`zs-rich min-h-72 text-sm leading-relaxed text-(--ink) focus:outline-none ${className}`}
          />
          <input type="hidden" name="body" value={richHtml} />
          <style>{`
            .zs-rich:empty:before { content: attr(data-placeholder); color: var(--muted); }
            .zs-rich a { color: var(--accent); text-decoration: underline; }
            .zs-rich ul { list-style: disc; padding-left: 1.5rem; }
          `}</style>
        </>
      )}

      <input type="hidden" name="isHtml" value={mode === "rich" ? "1" : "0"} />
      <input type="hidden" name="draftId" value={draftId} />
    </div>
  );
}
