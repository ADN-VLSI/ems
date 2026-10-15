import type { ReactNode } from "react";
import careerProgressionPolicy from "../policies/career_progression_policy.md?raw";
import leavePolicy from "../policies/leave_policy.md?raw";

type PolicyDocument = {
  content: string;
  fileName: string;
  id: PolicyId;
};

export type PolicyId = "leave-policy" | "career-policy";

const policyDocuments: PolicyDocument[] = [
  { content: leavePolicy, fileName: "leave_policy.md", id: "leave-policy" },
  {
    content: careerProgressionPolicy,
    fileName: "career_progression_policy.md",
    id: "career-policy",
  },
];

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (/^#\s+/.test(line)) {
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() ?? "";
    if (line.startsWith("|") && /^\|?\s*:?-{3,}:?\s*\|/.test(nextLine)) {
      const headings = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="policy-table-wrap" key={`table-${index}`}>
          <table>
            <thead><tr>{headings.map((cell, cellIndex) => <th key={cellIndex}>{inlineMarkdown(cell)}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headings.map((_, cellIndex) => (
                    <td key={cellIndex}>{inlineMarkdown(row[cellIndex] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}
        </ul>,
      );
      continue;
    }

    const heading = line.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h3 key={`heading-${index}`} className={`policy-heading policy-heading-${heading[1].length}`}>
          {inlineMarkdown(heading[2])}
        </h3>,
      );
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,6}\s+/.test(lines[index].trim()) &&
      !/^-\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("|")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{inlineMarkdown(paragraph.join(" "))}</p>);
  }

  return blocks;
}

function readFrontMatter(markdown: string): { body: string; metadata: Record<string, string> } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: markdown, metadata: {} };

  const metadata: Record<string, string> = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const entry = line.match(/^([^:]+):\s*(.+)$/);
    if (entry) metadata[entry[1].trim()] = entry[2].trim();
  });
  return { body: markdown.slice(match[0].length), metadata };
}

function PolicyArticle({ content, fileName }: PolicyDocument) {
  const { body, metadata } = readFrontMatter(content);
  const title = body.match(/^#\s+(.+)$/m)?.[1] ?? fileName;

  return (
    <article className="panel policy-document">
      <header className="policy-document-header">
        <h2>{title}</h2>
        <div className="policy-metadata">
          {metadata.Version && <span>Version {metadata.Version}</span>}
          {metadata.Effective_Date && <span>Effective {metadata.Effective_Date}</span>}
          {metadata.Last_Reviewed && <span>Reviewed {metadata.Last_Reviewed}</span>}
        </div>
      </header>
      <div className="policy-content">{renderMarkdown(body)}</div>
    </article>
  );
}

export function PolicyPage({ policyId }: { policyId: PolicyId }) {
  const policy = policyDocuments.find(({ id }) => id === policyId);
  if (!policy) return null;

  return <PolicyArticle {...policy} />;
}
