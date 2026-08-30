// scripts/test_rf05_fallback_and_cache.js
// Teste TDD Estrito para RF05-v5.4: Fallbacks contra 'UNDEFINED', Bump CACHE_NAME v5.4 e Toast de Atualização
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: RF05-v5.4 - Fallback "UNDEFINED", Cache v5.4 & Toast');
console.log('================================================================\n');

const swJs = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');

let passed = 0;
let failed = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${desc}`);
        console.error(`   Motivo: ${err.message}`);
        failed++;
    }
}

// 1. Verificação de Bump de Cache no Service Worker (sw.js)
it('src/sw.js deve declarar CACHE_NAME com versão v5.4+', () => {
    assert(
        /CACHE_NAME = ['"]stronglog-pro-v5\.[4-9]['"]/.test(swJs),
        'CACHE_NAME em src/sw.js não foi atualizado para stronglog-pro-v5.4+'
    );
});

// 2. Verificação de Versão em app.js
it('src/app.js deve declarar APP_VERSION como v5.4+', () => {
    assert(
        /APP_VERSION = ['"]v5\.[4-9]['"]/.test(appJs),
        'APP_VERSION em src/app.js não foi atualizado para v5.4+'
    );
});

// Setup mock do ambiente para app.js
const mockStorage = {};
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
};
global.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { reload: () => {} }
};
let toastMessages = [];
let bannerVisible = false;
global.document = {
    getElementById: (id) => {
        if (id === 'update-toast') {
            return {
                classList: {
                    remove: (c) => { if (c === 'hidden') bannerVisible = true; },
                    add: (c) => { if (c === 'hidden') bannerVisible = false; }
                }
            };
        }
        return {
            id,
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            style: {},
            innerHTML: '',
            innerText: ''
        };
    },
    querySelector: () => null,
    querySelectorAll: () => []
};
Object.defineProperty(global, 'navigator', {
    value: {
        serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {} }), addEventListener: () => {} },
        vibrate: () => true
    },
    configurable: true
});

let loadedApp = null;
try {
    const scriptCode = `
        function Dexie() { this.version = () => ({ stores: () => ({}) }); this.templates = { toArray: async () => [] }; }
        const lucide = { createIcons: () => {} };
        ${appJs}
        return app;
    `;
    loadedApp = new Function(scriptCode)();
    loadedApp.toast = (msg) => { toastMessages.push(msg); };
} catch (e) {
    throw new Error('Falha ao instanciar app: ' + e.message);
}

// 3. Método de formatação com fallback amigável
it('app.formatExerciseBaseInfo deve retornar BASE: Livre e DESCANSO: 90s quando campos forem nulos ou undefined', () => {
    assert(
        typeof loadedApp.formatExerciseBaseInfo === 'function',
        'Método app.formatExerciseBaseInfo não encontrado em app.js'
    );

    const emptyExercise = { name: 'Exercício Teste' };
    const formatted = loadedApp.formatExerciseBaseInfo(emptyExercise);
    
    assert(formatted.base === 'Livre', `Esperado base 'Livre', recebido: ${formatted.base}`);
    assert(formatted.rest === 90, `Esperado rest 90, recebido: ${formatted.rest}`);
});

// 4. Renderização sem qualquer string 'UNDEFINED'
it('Exercício sem baseWeight/equipment/restSeconds não deve renderizar "undefined" na interface', () => {
    // Simula renderização de item na biblioteca
    const rawExercise = {
        id: 9999,
        name: 'Supino Halter Teste',
        body_part: 'Peitoral',
        equipment: undefined,
        baseWeight: undefined,
        restSeconds: undefined
    };

    const formatted = loadedApp.formatExerciseBaseInfo(rawExercise);
    const cardHtml = `
        <div>
            <span>BASE: ${formatted.base}</span>
            <span>DESCANSO: ${formatted.rest}s</span>
        </div>
    `;

    assert(!cardHtml.toLowerCase().includes('undefined'), `Detectada string "undefined" no card renderizado: ${cardHtml}`);
    assert(cardHtml.includes('BASE: Livre'), 'Card deve exibir BASE: Livre como fallback');
    assert(cardHtml.includes('DESCANSO: 90s'), 'Card deve exibir DESCANSO: 90s como fallback');
});

// 5. Toast de atualização v5.4
it('showUpdateAvailableBanner deve exibir banner #update-toast e acionar toast notificando a nova versão', () => {
    bannerVisible = false;
    toastMessages = [];
    loadedApp.showUpdateAvailableBanner();
    
    assert(bannerVisible, 'Banner #update-toast não foi tornado visível');
    assert(toastMessages.some(m => m.includes('v5.4') || m.includes('atualização') || m.includes('versão')), 'Toast com notificação de versão não foi disparado');
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF05: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
