#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");

// -------------------------------------
// Markdown → Graph Node
// -------------------------------------
function zettelMarkdownToNode(markdown, fileName = null) {
  // --- Frontmatter extrahieren ---
  const fmMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);

  let meta = {};
  if (fmMatch) {
    const fmLines = fmMatch[1].split("\n");
    for (const line of fmLines) {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) continue;

      meta[key.trim().toLowerCase()] = rest.join(":").trim();
    }
  }

  // --- Markdown ohne Frontmatter ---
  const body = markdown.replace(/^---[\s\S]*?\n---/, "").trim();

  // --- Titel aus erster H1 ---
  const titleMatch = body.match(/^#\s+(.*)$/m);
  const title = titleMatch ? titleMatch[1].trim() : (fileName || "Untitled");

  // --- Summary: erster Absatz nach Titel ---
  let summary = "";
  if (titleMatch) {
    const afterTitle = body.slice(titleMatch.index + titleMatch[0].length);

    const paragraphMatch = afterTitle
      .replace(/^\s+/, "")
      .match(/^[^\n#][\s\S]*?(?=\n\n|$)/);

    if (paragraphMatch) {
      summary = paragraphMatch[0]
        .replace(/\n/g, " ")
        .trim();
    }
  }

  // --- Tags ---
  const tags = meta.tags
    ? meta.tags.split(",").map(t => t.trim())
    : [];

  // --- Links / Referenzen im Body extrahieren ---
  const refs = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(body)) !== null) {
    const text = match[1];
    const href = match[2];

    // nur Zettel-Links auf .md berücksichtigen
    if (!href.endsWith(".md")) continue;

    // ./ vorne abschneiden, Query/Fragment ignorieren
    let targetPath = href.replace(/^\.\//, "");
    targetPath = targetPath.split(/[?#]/)[0];

    const targetFile = targetPath.split(/[\\/]/).pop();

    // ID am Dateianfang extrahieren: 20251209-091200
    let targetId = null;
    const idMatch = targetFile.match(/^(\d{8}-\d{6})/);
    if (idMatch) {
      targetId = idMatch[1];
    }

    refs.push({
      text,
      href,
      file: targetPath,
      targetId
    });
  }

  // --- Node JSON ---
  return {
    id: meta.id || crypto.randomUUID(),
    title,
    summary,
    tags,

    // fürs ForceGraph
    group: tags[0] ?? "zettel",
    size: 5,

    file: fileName || null,
    refs,        // <- hier sind deine Zettel-Links
    raw: markdown
  };
}

// -------------------------------------
// CLI
// -------------------------------------
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage:");
  console.error("  zettel-to-node.js <file1.md> [file2.md ...]");
  console.error("");
  console.error("Beispiel:");
  console.error("  zettel-to-node.js notes/*.md | jq -s '{nodes: ., links: []}' > graph.json");
  process.exit(1);
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    continue;
  }

  const markdown = fs.readFileSync(file, "utf8");
  const node = zettelMarkdownToNode(markdown, file);

  // ein JSON-Objekt pro Zeile
  console.log(JSON.stringify(node));
}
