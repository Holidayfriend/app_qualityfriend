import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const start = path.join(root, "components/recruiting/recruiting-ui.tsx");
const seen = new Set();
const hits = [];

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidates.find((item) => fs.existsSync(item) && fs.statSync(item).isFile()) ?? null;
}

function walk(file) {
  if (!file || seen.has(file)) return;
  seen.add(file);
  const text = fs.readFileSync(file, "utf8");
  if (/node:fs\/promises|from ["']fs\/promises["']/.test(text)) hits.push(file);
  const specs = [...text.matchAll(/from ["'](\.[^"']+)["']/g)].map((match) => match[1]);
  for (const spec of specs) walk(resolveImport(file, spec));
}

walk(start);
console.log(`files ${seen.size}`);
console.log(hits.map((file) => path.relative(root, file)).join("\n") || "no fs/promises");
