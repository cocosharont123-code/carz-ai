"use client";

import { memo, type ReactNode } from "react";

/**
 * The small slice of markdown CarzBot actually writes.
 *
 * Written rather than installed. react-markdown with remark-gfm is the
 * obvious answer and it is 40-odd kilobytes of parser for a surface whose
 * input is one model, prompted by us, answering about cars -- paragraphs,
 * bold, bullets, numbered lists, inline code and a comparison table. §1 caps
 * a route at 150kB of client JS, and this is a few hundred bytes.
 *
 * It also has to do something a general parser does not: survive being handed
 * half a document. While an answer streams, the text ends wherever the last
 * token left it -- mid-word, mid-**bold**, mid-table-row -- and a parser that
 * renders what it sees would show the raw asterisks until the closing pair
 * arrived, which is exactly the flicker this is meant to prevent. Every
 * unclosed marker is dropped rather than drawn.
 *
 * What it deliberately does not support: links (CarzBot has nowhere to link
 * to and an unvalidated href from a model is a hole), images, blockquotes,
 * fenced code blocks, nested lists. Anything it does not recognise is a
 * paragraph, which is the right failure: text renders as text.
 */

/** A block, as the splitter below sees it. */
type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,6})\s+(.*)$/;
const TABLE_ROW = /^\s*\|(.+)$/;
/** |---|:--:|---| and friends: the row that makes the one above it a header. */
const TABLE_RULE = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

const cells = (line: string): string[] =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // Two sizes only. The prompt asks for headings rarely and the bubble is
      // 300px wide; six levels of hierarchy in a chat bubble is a joke.
      blocks.push({ kind: "h", level: heading[1].length <= 2 ? 2 : 3, text: heading[2] });
      i += 1;
      continue;
    }

    // A table needs its rule line to be a table. Without one this is a
    // paragraph that happens to contain pipes, which is what a half-streamed
    // table looks like for the few hundred milliseconds before the rule
    // arrives -- and a pipe in a sentence is less wrong than a one-cell table
    // that reflows into a real one a moment later.
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(BULLET.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (NUMBER.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBER.test(lines[i])) {
        items.push(NUMBER.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // A paragraph runs until a blank line or the start of something else.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !BULLET.test(lines[i]) &&
      !NUMBER.test(lines[i]) &&
      !HEADING.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) blocks.push({ kind: "p", lines: para });
  }

  return blocks;
}

/**
 * Inline markers, with the unfinished ones removed.
 *
 * One pass, left to right, taking only complete pairs. Whatever is left over
 * is a marker whose partner has not been typed yet, and the last step wipes
 * those: mid-stream, "**Ferrari" renders as "Ferrari" and thickens into bold
 * when the closing pair lands, rather than showing asterisks and then
 * reflowing.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  const plain = (s: string) => {
    // Dangling markers, and the escapes nobody wants to read.
    const cleaned = s
      .replace(/\*\*/g, "")
      .replace(/(^|\s)\*(?=\S)/g, "$1")
      .replace(/(?<=\S)\*(?=\s|$)/g, "")
      .replace(/`/g, "")
      .replace(/\\([*_`#|])/g, "$1");
    if (cleaned) out.push(cleaned);
  };

  while ((match = pattern.exec(text))) {
    if (match.index > last) plain(text.slice(last, match.index));
    const key = `${keyPrefix}-${n++}`;
    if (match[1] !== undefined) {
      out.push(
        <strong key={key} className="font-bold text-foreground">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      out.push(
        <em key={key} className="italic">
          {match[2]}
        </em>,
      );
    } else {
      out.push(
        <code
          key={key}
          className="rounded-[6px] bg-foreground/10 px-1 py-px text-[13px] tabular-nums"
        >
          {match[3]}
        </code>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) plain(text.slice(last));
  return out;
}

/**
 * @param text the answer so far, which may stop anywhere.
 *
 * Memoised on the text: the thread re-renders on every revealed character
 * while one answer streams, and the messages above it have not changed.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const blocks = parse(text);

  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          const Tag = b.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={i}
              className={
                b.level === 2
                  ? "text-[16px] font-bold leading-snug text-foreground"
                  : "text-[15px] font-semibold leading-snug text-foreground"
              }
            >
              {inline(b.text, `h${i}`)}
            </Tag>
          );
        }

        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind === "ul" ? "ul" : "ol";
          return (
            <List
              key={i}
              className={
                b.kind === "ul"
                  ? "list-disc space-y-1 pl-5 marker:text-[var(--color-muted-text)]"
                  : "list-decimal space-y-1 pl-5 tabular-nums marker:text-[var(--color-muted-text)]"
              }
            >
              {b.items.map((item, j) => (
                <li key={j} className="text-[15px] leading-[1.55] text-foreground">
                  {inline(item, `l${i}-${j}`)}
                </li>
              ))}
            </List>
          );
        }

        if (b.kind === "table") {
          return (
            // Sideways on a phone, because a three-car comparison is wider
            // than 390px and the alternative is a table that wraps every cell
            // onto four lines. §4 allows a horizontal scroller inside the
            // page's one vertical one.
            <div key={i} className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-max border-collapse text-left text-[14px]">
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th
                        key={j}
                        className="border-b border-[var(--line-divider)] px-2 py-1.5 text-[13px] font-semibold text-[var(--color-secondary-text)]"
                      >
                        {inline(h, `th${i}-${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td
                          key={k}
                          className="border-b border-[var(--line-divider)] px-2 py-1.5 align-top leading-[1.45] text-foreground"
                        >
                          {inline(cell, `td${i}-${j}-${k}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={i} className="text-[15px] leading-[1.55] text-foreground">
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && " "}
                {inline(line, `p${i}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
});
