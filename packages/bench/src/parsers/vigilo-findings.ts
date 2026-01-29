import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, basename, relative } from "path";
import type { VigiloFinding, Severity } from "../types.js";

function parseSeverity(dir: string): Severity {
  const name = dir.toLowerCase();
  if (name === "critical") return "critical";
  if (name === "high") return "high";
  if (name === "medium") return "medium";
  if (name === "low") return "low";
  return "informational";
}

function parseMarkdownFinding(content: string, filePath: string, severity: Severity, auditor: string): VigiloFinding {
  const fileName = basename(filePath, ".md");
  const lines = content.split("\n");

  let title = fileName;
  const titleLine = lines.find((l) => l.startsWith("# "));
  if (titleLine) {
    title = titleLine.replace(/^#\s+/, "").trim();
  }

  const idMatch = fileName.match(/^[A-Z]-(\d+)/);
  const id = idMatch ? `${severity[0].toUpperCase()}-${idMatch[1]}` : fileName;

  let file: string | undefined;
  for (const line of lines) {
    const fileMatch = line.match(/(?:File|Location|Contract):\s*[`"]?([^\s`"]+\.sol)/i);
    if (fileMatch) {
      file = fileMatch[1];
      break;
    }
  }

  return {
    id: `${auditor}/${id}`,
    title,
    severity,
    auditor,
    description: content,
    file,
    filePath,
  };
}

export function parseVigiloFindings(findingsDir: string): VigiloFinding[] {
  const findings: VigiloFinding[] = [];

  if (!existsSync(findingsDir)) return findings;

  const severityDirs = readdirSync(findingsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const sevDir of severityDirs) {
    const severity = parseSeverity(sevDir);
    const sevPath = resolve(findingsDir, sevDir);

    const auditorDirs = readdirSync(sevPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (auditorDirs.length === 0) {
      const mdFiles = readdirSync(sevPath).filter((f) => f.endsWith(".md"));
      for (const mdFile of mdFiles) {
        const filePath = resolve(sevPath, mdFile);
        const content = readFileSync(filePath, "utf-8");
        findings.push(parseMarkdownFinding(content, filePath, severity, "unknown"));
      }
    } else {
      for (const auditorDir of auditorDirs) {
        const auditorPath = resolve(sevPath, auditorDir);
        const mdFiles = readdirSync(auditorPath).filter((f) => f.endsWith(".md"));
        for (const mdFile of mdFiles) {
          const filePath = resolve(auditorPath, mdFile);
          const content = readFileSync(filePath, "utf-8");
          findings.push(parseMarkdownFinding(content, filePath, severity, auditorDir));
        }
      }
    }
  }

  return findings;
}
