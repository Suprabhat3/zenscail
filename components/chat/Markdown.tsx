"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for assistant messages, styled against the app's design
 * tokens. Tables/strikethrough/task-lists come from GFM.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body min-w-0 max-w-full text-sm leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mt-4 mb-1.5 font-serif text-lg text-(--ink) first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-4 mb-1.5 font-serif text-base text-(--ink) first:mt-0">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-3 mb-1 text-sm font-bold text-(--ink) first:mt-0">{children}</h5>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-(--ink)">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("/") ? undefined : "_blank"}
              rel="noreferrer"
              className="font-medium text-(--accent) underline decoration-(--accent-tint) underline-offset-2 [overflow-wrap:anywhere] hover:decoration-(--accent)"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ""}
                className="my-2 h-auto max-w-full rounded-xl border border-(--line-soft)"
              />
            ) : null,
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 marker:text-(--accent)">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-(--muted)">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-(--accent-tint) pl-3 text-(--muted) italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-(--line-soft)" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return <code className={`${className ?? ""} block`}>{children}</code>;
            }
            return (
              <code className="rounded bg-(--bg-deep) px-1.5 py-0.5 font-mono text-[0.85em] text-(--accent-deep) [overflow-wrap:anywhere]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-xl border border-(--line-soft) bg-(--ink) p-3 font-mono text-xs leading-relaxed text-(--bg)">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-(--line-soft)">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-(--bg-deep) text-(--ink)">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-(--line-soft) px-3 py-2 font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-(--line-soft) px-3 py-2 align-top last:border-b-0">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
