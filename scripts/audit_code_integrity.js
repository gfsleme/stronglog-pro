// scripts/audit_code_integrity.js
// Auditoria Estática Profunda de QA: IDs, Handlers, Event Listeners e Typos

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../src/index.html');
const appJsPath = path.join(__dirname, '../src/app.js');
const cssPath = path.join(__dirname, '../src/styles.css');

const html = fs.readFileSync(htmlPath, 'utf-8');
const appJs = fs.readFileSync(appJsPath, 'utf-8');
const css = fs.readFileSync(cssPath, 'utf-8');

console.log('================================================================');
console.log('🔍 INICIANDO AUDITORIA ESTÁTICA PROFUNDA DE CÓDIGO (QA v5.1)');
console.log('================================================================\n');

// 1. Extrai todos os IDs do HTML
const htmlIds = new Set();
const htmlIdRegex = /id=["']([^"']+)["']/g;
let match;
while ((match = htmlIdRegex.exec(html)) !== null) {
    htmlIds.add(match[1]);
}

// 2. Extrai todos os IDs dinâmicos gerados em app.js (ex: templates literais)
const dynamicIdRegex = /id=["']([^"'$]+)["']/g;
while ((match = dynamicIdRegex.exec(appJs)) !== null) {
    htmlIds.add(match[1]);
}

// 3. Procura por todos os getElementById no app.js
const domIdRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const usedIds = new Set();
const missingIds = [];

while ((match = domIdRegex.exec(appJs)) !== null) {
    const id = match[1];
    usedIds.add(id);
    if (!htmlIds.has(id) && !id.includes('${') && !id.startsWith('set-')) {
        missingIds.push(id);
    }
}

console.log(`📌 IDs no HTML/Templates: ${htmlIds.size}`);
console.log(`📌 IDs buscados via getElementById: ${usedIds.size}`);
if (missingIds.length > 0) {
    console.warn(`⚠️ Possíveis IDs ausentes no HTML (${missingIds.length}):`, missingIds);
} else {
    console.log(`✅ 100% dos IDs chamados em document.getElementById() existem no DOM.`);
}

// 4. Procura por todos os onclick / onchange / oninput em HTML e app.js
const handlerRegex = /on(?:click|change|input)=["']([^"']+)["']/g;
const handlers = [];
while ((match = handlerRegex.exec(html)) !== null) {
    handlers.push({ source: 'index.html', code: match[1] });
}
while ((match = handlerRegex.exec(appJs)) !== null) {
    handlers.push({ source: 'app.js', code: match[1] });
}

// Extrai métodos de app
const appMethods = new Set();
const methodRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s*(?:async\s*)?\(/gm;
while ((match = methodRegex.exec(appJs)) !== null) {
    appMethods.add(match[1]);
}
const funcMethodRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/gm;
while ((match = funcMethodRegex.exec(appJs)) !== null) {
    appMethods.add(match[1]);
}

console.log(`\n📌 Métodos encontrados no objeto app: ${appMethods.size}`);

const brokenHandlers = [];
handlers.forEach(h => {
    // Procura chamadas do tipo app.metodo(...)
    const callMatch = h.code.match(/app\.([a-zA-Z0-9_]+)\s*\(/);
    if (callMatch) {
        const methodName = callMatch[1];
        if (!appMethods.has(methodName)) {
            brokenHandlers.push({ ...h, method: methodName });
        }
    }
});

if (brokenHandlers.length > 0) {
    console.warn(`⚠️ Handlers com métodos não encontrados no objeto app (${brokenHandlers.length}):`, brokenHandlers);
} else {
    console.log(`✅ 100% dos handlers inline apontam para métodos válidos no app.`);
}

// 5. Verifica botões sem onclick nem type="submit" no HTML
const buttonRegex = /<button\b([^>]*)>(.*?)<\/button>/gs;
const deadButtons = [];
while ((match = buttonRegex.exec(html)) !== null) {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!attrs.includes('onclick') && !attrs.includes('type="submit"') && !attrs.includes('id=') && !attrs.includes('data-')) {
        deadButtons.push({ text, attrs: attrs.trim() });
    }
}

if (deadButtons.length > 0) {
    console.warn(`⚠️ Botões sem handler onclick ou identificador (${deadButtons.length}):`, deadButtons);
} else {
    console.log(`✅ 100% dos botões no HTML possuem handler onclick, id ou atributo funcional.`);
}

// 6. Verifica querySelector e querySelectorAll no app.js
const qsRegex = /document\.querySelector(?:All)?\(['"]([^'"]+)['"]\)/g;
const selectors = [];
while ((match = qsRegex.exec(appJs)) !== null) {
    selectors.push(match[1]);
}
console.log(`\n📌 Seletores buscados via querySelector(All): ${selectors.length}`);
selectors.forEach(s => {
    if (s.startsWith('#')) {
        const id = s.slice(1);
        if (!htmlIds.has(id) && !id.includes('${')) {
            console.warn(`⚠️ Possível seletor de ID ausente: ${s}`);
        }
    }
});

// 7. Verifica links href="#"
const deadLinks = [];
const linkRegex = /<a\b([^>]*)>(.*?)<\/a>/gs;
while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1];
    const text = match[2].trim();
    if (attrs.includes('href="#"') && !attrs.includes('onclick')) {
        deadLinks.push({ text, attrs: attrs.trim() });
    }
}
if (deadLinks.length > 0) {
    console.warn(`⚠️ Links vazios / mortos (${deadLinks.length}):`, deadLinks);
} else {
    console.log(`✅ Nenhum link <a> morto ou sem destino encontrado.`);
}

console.log('\n================================================================');
console.log('🏁 FIM DA AUDITORIA ESTÁTICA');
console.log('================================================================\n');
