// scripts/test_rf03_library_scroll.js
// Teste TDD Estrito para RF03: Arquitetura de rolagem da Biblioteca
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD GREEN-TEST: RF03 - Arquitetura de Rolagem da Biblioteca');
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

// TESTES DE ERGONOMIA E ALTURA NO VIEWPORT 390x844
it('Em viewport 390x844, lista de exercícios deve ter >= 60% da altura da tela quando colapsado ou em modo lista', () => {
    const VIEWPORT_WIDTH = 390;
    const VIEWPORT_HEIGHT = 844;
    const MIN_REQUIRED_LIST_HEIGHT = 0.60 * VIEWPORT_HEIGHT; // 506.4px

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

    // Altura calculada em modo colapsado para 390x844
    const heightCollapsed = loadedApp.getLibraryListCalculatedHeight(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, true);
    console.log(`   Altura da lista (Colapsado / Modo Lista): ${heightCollapsed}px (>= ${MIN_REQUIRED_LIST_HEIGHT}px necessários)`);
    assert(
        heightCollapsed >= MIN_REQUIRED_LIST_HEIGHT,
        `Altura da lista colapsada (${heightCollapsed}px) é inferior a 60% da tela (${MIN_REQUIRED_LIST_HEIGHT}px)`
    );

    // Altura calculada em modo expandido deve ser menor mas o toggle deve permitir recuperar os >=60%
    const heightExpanded = loadedApp.getLibraryListCalculatedHeight(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, false);
    console.log(`   Altura da lista (Expandido 2D/3D): ${heightExpanded}px`);
    assert(
        heightExpanded < heightCollapsed,
        'Altura expandida deve ser menor que a altura colapsada'
    );
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF03: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
