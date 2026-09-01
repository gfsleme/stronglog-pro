// sync_static_assets.js — Sincroniza os assets estáticos canônicos (src/) para public/
// O source-of-truth do StrongLog é `src/` (AGENTS.md + suíte de testes leem de src/).
// O Astro serve arquivos estáticos de `public/` (copiados verbatim ao dist/).
// Este script (rodado como `prebuild`) propaga as edições de src/ para public/,
// garantindo que o build produza a versão correta.
//
// Arquivos sincronizados: app.js, sw.js, styles.css, manifest.json, data/, assets/, vendor/
// NÃO sincronizados (Astro source): src/pages/, src/layouts/, src/components/, content.config.ts, index.html

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

// pares [relativo, éDiretório]
const ASSETS = [
  ['app.js', false],
  ['sw.js', false],
  ['styles.css', false],
  ['manifest.json', false],
  ['data', true],
  ['assets', true],
  ['vendor', true],
];

function copy(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.cpSync(srcPath, destPath, { recursive: true });
}

let copied = 0;
for (const [rel, isDir] of ASSETS) {
  const s = path.join(SRC, rel);
  const d = path.join(PUBLIC, rel);
  if (!fs.existsSync(s)) {
    console.warn(`[sync] AVISO: origem ausente, pulando: src/${rel}`);
    continue;
  }
  copy(s, d);
  copied++;
  console.log(`[sync] src/${rel} -> public/${rel}`);
}
console.log(`[sync] Concluído: ${copied}/${ASSETS.length} assets sincronizados.`);
