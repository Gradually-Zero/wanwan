const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");

const replacements = [
  [/from "node:([^"]+)"/g, 'from "$1"'],
  [/from 'node:([^']+)'/g, "from '$1'"],
  [/require\("node:([^"]+)"\)/g, 'require("$1")'],
  [/require\('node:([^']+)'\)/g, "require('$1')"]
];

const targetMatchers = [
  (fullPath) => fullPath.includes(`${path.sep}jiti${path.sep}dist${path.sep}`),
  (fullPath) => fullPath.includes(`${path.sep}jiti${path.sep}lib${path.sep}`),
  (fullPath) => fullPath.endsWith(`${path.sep}@tailwindcss${path.sep}oxide${path.sep}index.js`)
];

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const results = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function patchFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  if (next !== original) {
    fs.writeFileSync(filePath, next);
    return true;
  }

  return false;
}

if (!fs.existsSync(pnpmDir)) {
  process.exit(0);
}

let patchedCount = 0;
for (const filePath of walkFiles(pnpmDir)) {
  if (!targetMatchers.some((matcher) => matcher(filePath))) {
    continue;
  }

  if (patchFile(filePath)) {
    patchedCount += 1;
  }
}

if (patchedCount > 0) {
  console.log(`Patched Tailwind v4 compatibility files: ${patchedCount}`);
}
