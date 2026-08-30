// scripts/test_rf03_library_scroll.js
// Teste TDD Estrito para RF03-v5.4: Fullscreen Sheet (100dvh no mobile), Auto-colapso na Busca e Lista >= 85%
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: RF03-v5.4 - Fullscreen Sheet, Auto-Colapso & Lista >= 85%');
console.log('================================================================\n');

// 1. Carregar arquivos de produção
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf-8');

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

// TESTES DE CONTRATO E ELEMENTOS NO HTML
it('HTML deve conter botão/handle de colapsar/expandir o visualizador na Biblioteca com atributos de acessibilidade', () => {
    assert(
        html.includes('id="library-visualizer-toggle"') && html.includes('aria-expanded="true"'),
        'Botão de toggle do visualizador com aria-expanded não encontrado em index.html'
    );
});

it('HTML deve conter estrutura de visualizador colapsável com transição suave', () => {
    assert(
        html.includes('library-visualizer-wrapper') && html.includes('id="library-visualizer-section"'),
        'Wrapper colapsável do visualizador não encontrado em index.html'
    );
});

// TESTE DE FULLSCREEN SHEET NO MOBILE (<640px)
it('HTML deve configurar a Biblioteca como Fullscreen Sheet no mobile (100dvh / h-full, <640px)', () => {
    assert(
        html.includes('h-full') && html.includes('sm:h-[92vh]') && html.includes('sm:rounded-t-[45px]'),
        'Biblioteca modal não configurada como fullscreen sheet no mobile (esperado h-full sm:h-[92vh])'
    );
});

// TESTE DO AUTO-COLAPSO NA BUSCA
it('Input de busca #search-exercise deve possuir handler onfocus chamando app.onSearchExerciseFocus', () => {
    assert(
        html.includes('id="search-exercise"') && html.includes('onfocus="app.onSearchExerciseFocus()"'),
        '#search-exercise deve possuir onfocus="app.onSearchExerciseFocus()"'
    );
    assert(
        appJs.includes('onSearchExerciseFocus:'),
        'app.js deve implementar o método onSearchExerciseFocus'
    );
});

// TESTE DE DEFINIÇÃO NO CSS (styles.css)
it('styles.css deve definir .library-visualizer-wrapper e .is-collapsed com max-height e opacity', () => {
    assert(
        css.includes('.library-visualizer-wrapper') && css.includes('max-height: 280px'),
        '.library-visualizer-wrapper com max-height não encontrada em styles.css'
    );
    assert(
        css.includes('.library-visualizer-wrapper.is-collapsed') && css.includes('max-height: 0'),
        '.library-visualizer-wrapper.is-collapsed com max-height: 0 não encontrada em styles.css'
    );
    assert(
        css.includes('opacity: 0'),
        'Transição de opacity não encontrada em styles.css para colapso suave'
    );
});

// TESTES DE MÉTODOS NO APP.JS
it('app.js deve exportar o método toggleLibraryVisualizer operando via is-collapsed e aria-expanded (sem display:none abrupto)', () => {
    assert(
        appJs.includes('toggleLibraryVisualizer:'),
        'Método toggleLibraryVisualizer não encontrado no objeto app'
    );
    assert(
        appJs.includes('isVisualizerCollapsed'),
        'Propriedade isVisualizerCollapsed não encontrada no app'
    );
    assert(
        appJs.includes('is-collapsed'),
        'toggleLibraryVisualizer deve alternar a classe is-collapsed para transição CSS real'
    );
    assert(
        appJs.includes('aria-expanded'),
        'toggleLibraryVisualizer deve sincronizar aria-expanded no botão'
    );
});

// TESTES DE ERGONOMIA E ALTURA NO VIEWPORT 390x844 COM >= 85% NO FOCO DE BUSCA
it('Em viewport 390x844, lista de exercícios deve ter >= 85% da altura da tela quando focar a busca na fullscreen sheet', () => {
    const VIEWPORT_WIDTH = 390;
    const VIEWPORT_HEIGHT = 844;
    const MIN_REQUIRED_FOCUS_LIST_HEIGHT = 0.85 * VIEWPORT_HEIGHT; // 717.4px

    // Mock completo para carregar app.js de forma isolada
    const mockStorage = {};
    global.localStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; }
    };
    global.window = {
        devicePixelRatio: 2,
        addEventListener: () => {},
        removeEventListener: () => {},
        location: { reload: () => {} }
    };
    Object.defineProperty(global, 'navigator', {
        value: {
            serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {} }), addEventListener: () => {} },
            vibrate: () => true
        },
        configurable: true
    });
    global.document = {
        getElementById: () => ({ classList: { add: () => {}, remove: () => {}, contains: () => false }, style: {}, setAttribute: () => {} }),
        querySelector: () => null,
        querySelectorAll: () => []
    };

    // Avalia app no contexto
    let loadedApp = null;
    try {
        const scriptCode = `
            function Dexie() { this.version = () => ({ stores: () => ({}) }); this.templates = { toArray: async () => [] }; }
            const lucide = { createIcons: () => {} };
            ${appJs}
            return app;
        `;
        const fn = new Function(scriptCode);
        loadedApp = fn();
    } catch (e) {
        throw new Error('Falha ao instanciar app: ' + e.message);
    }

    assert(typeof loadedApp.toggleLibraryVisualizer === 'function', 'toggleLibraryVisualizer deve ser função');
    assert(typeof loadedApp.getLibraryListCalculatedHeight === 'function', 'getLibraryListCalculatedHeight deve ser função de layout');
    assert(typeof loadedApp.onSearchExerciseFocus === 'function', 'onSearchExerciseFocus deve ser função');

    // Altura calculada em modo fullscreen focado na busca para 390x844
    const heightSearchFocus = loadedApp.getLibraryListCalculatedHeight(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, true, true);
    console.log(`   Altura da lista (Foco de Busca / Fullscreen Mobile): ${heightSearchFocus}px (>= ${MIN_REQUIRED_FOCUS_LIST_HEIGHT}px necessários)`);
    assert(
        heightSearchFocus >= MIN_REQUIRED_FOCUS_LIST_HEIGHT,
        `Altura da lista no foco de busca (${heightSearchFocus}px) é inferior a 85% da tela (${MIN_REQUIRED_FOCUS_LIST_HEIGHT}px)`
    );
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF03: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
