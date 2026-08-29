// scripts/test_rf04_scroll_shielding.js
// Teste TDD Estrito para RF04: Blindagem de Scroll Global e Safe-Area Bottom-Nav
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD GREEN-TEST: RF04 - Blindagem de Scroll Global & Safe-Area');
console.log('================================================================\n');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');

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

// TESTE 1: CSS deve conter classes de blindagem safe-area e overscroll
it('styles.css deve conter classes .pb-safe, .bottom-nav-safe e propriedades de overscroll touch', () => {
    assert(css.includes('.pb-safe'), 'Classe .pb-safe não encontrada em styles.css');
    assert(css.includes('.bottom-nav-safe'), 'Classe .bottom-nav-safe não encontrada em styles.css');
    assert(css.includes('overscroll-behavior-y: contain'), 'Propriedade overscroll-behavior-y: contain não encontrada em styles.css');
    assert(css.includes('-webkit-overflow-scrolling: touch'), 'Propriedade -webkit-overflow-scrolling: touch não encontrada em styles.css');
});

// TESTE 2: index.html deve blindar view-history contra corte pela bottom-nav
it('index.html deve aplicar padding inferior seguro em view-history e history-list', () => {
    const historySection = html.slice(html.indexOf('id="view-history"'), html.indexOf('id="view-plan-editor"'));
    assert(
        historySection.includes('pb-32') || historySection.includes('pb-36') || historySection.includes('pb-safe'),
        'view-history não possui padding inferior seguro suficiente para evitar corte pela bottom-nav'
    );
});

// TESTE 3: index.html deve blindar records-modal (Hall of Fame) contra corte
it('records-modal deve possuir padding inferior seguro (pb-28+ ou safe-bottom) no container de lista', () => {
    const recordsSection = html.slice(html.indexOf('id="records-modal"'), html.indexOf('id="exercise-library-modal"'));
    assert(
        recordsSection.includes('pb-28') || recordsSection.includes('pb-32') || recordsSection.includes('safe-bottom'),
        'records-modal não possui padding inferior seguro suficiente para evitar corte do último registro'
    );
});

// TESTE 4: index.html deve blindar view-plan-editor e o botão SALVAR ROTINA
it('view-plan-editor deve possuir padding inferior seguro para o botão SALVAR ROTINA', () => {
    const planEditorSection = html.slice(html.indexOf('id="view-plan-editor"'), html.indexOf('</main>'));
    assert(
        planEditorSection.includes('pb-32') || planEditorSection.includes('pb-36') || planEditorSection.includes('pb-safe') || planEditorSection.includes('mb-24'),
        'view-plan-editor não possui espaçamento inferior seguro para evitar sobreposição do botão SALVAR ROTINA'
    );
});

// TESTE 5: nav flutuante deve aplicar classe .bottom-nav-safe
it('A barra de navegação inferior flutuante deve aplicar a classe bottom-nav-safe', () => {
    const navMatch = html.match(/<nav[^>]+class="([^"]+)"/);
    assert(navMatch && navMatch[1].includes('bottom-nav-safe'), 'Tag <nav> não possui a classe bottom-nav-safe');
});

// TESTE 6: app.js deve fornecer método verifyScrollIntegrity para auditoria E2E
it('app.js deve fornecer método verifyScrollIntegrity() validando todas as abas e modais', () => {
    assert(appJs.includes('verifyScrollIntegrity:'), 'app.verifyScrollIntegrity() não encontrado em app.js');

    // Execução simulada em Node.js
    const mockStorage = {};
    global.localStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; }
    };
    Object.defineProperty(global, 'navigator', {
        value: {
            serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {} }), addEventListener: () => {} },
            vibrate: () => true
        },
        configurable: true
    });
    global.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
    global.document = {
        createElement: () => ({ classList: { add: () => {}, remove: () => {}, contains: () => true }, style: {} }),
        getElementById: () => ({ classList: { add: () => {}, remove: () => {}, contains: () => true }, style: {} }),
        querySelector: () => null,
        querySelectorAll: () => []
    };

    let loadedApp = null;
    try {
        const scriptCode = `
            function Dexie() { this.version = () => ({ stores: () => ({}) }); this.templates = { toArray: async () => [] }; }
            const lucide = { createIcons: () => {} };
            ${appJs}
            return app;
        `;
        loadedApp = new Function(scriptCode)();
    } catch (e) {
        throw new Error('Falha ao instanciar app: ' + e.message);
    }

    assert(typeof loadedApp.verifyScrollIntegrity === 'function', 'verifyScrollIntegrity deve ser função');
    const integrity = loadedApp.verifyScrollIntegrity();
    assert(integrity.isShielded === true, 'Auditoria de integridade de scroll indicou falha');
    assert(integrity.checkedViews.length >= 4, 'Deve verificar no mínimo 4 visualizações críticas');
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RED-STAGE: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
