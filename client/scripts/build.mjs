import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

export function buildClientAssets() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy index.html
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf-8');

  // Transpile all .ts / .tsx files in src/ to dist/src/
  function processDir(currentSrc, currentOut) {
    if (!fs.existsSync(currentOut)) {
      fs.mkdirSync(currentOut, { recursive: true });
    }
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const fullSrc = path.join(currentSrc, entry.name);
      if (entry.isDirectory()) {
        processDir(fullSrc, path.join(currentOut, entry.name));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const sourceCode = fs.readFileSync(fullSrc, 'utf-8');
        // Rewrite relative imports ending in .ts/.tsx to .js for browser ES modules
        const rewritten = sourceCode.replace(
          /(from\s+['"]\.[^'"]+)\.(tsx|ts)(['"])/g,
          '$1.js$3'
        );
        const result = ts.transpileModule(rewritten, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
          },
          fileName: entry.name,
        });
        const outName = entry.name.replace(/\.(tsx|ts)$/, '.js');
        fs.writeFileSync(path.join(currentOut, outName), result.outputText, 'utf-8');
      } else {
        fs.copyFileSync(fullSrc, path.join(currentOut, entry.name));
      }
    }
  }

  processDir(srcDir, path.join(distDir, 'src'));
  console.log('[Kahoot Pro Client] Built clean ES modules into client/dist');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildClientAssets();
}
