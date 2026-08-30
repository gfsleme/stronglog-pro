// scripts/test_rf04_scroll_shielding.js
// Teste TDD Estrito para RF04-v5.4: Tabular-nums, Hairline Glassmorphism e Hitboxes de Topo >= 44px
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: RF04-v5.4 - Tabular-nums, Hairline & Hitboxes >=44px');
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

// TESTE 6: [RF04-v5.4] tabular-nums em cronômetros, pesos e contadores
it('styles.css deve aplicar font-variant-numeric: tabular-nums para cronômetros, timers e contadores', () => {
    assert(
        css.includes('tabular-nums') && (css.includes('font-variant-numeric: tabular-nums') || css.includes('font-feature-settings: "tnum"')),
        'Configuração tabular-nums não encontrada em styles.css para evitar oscilação de largura nos números'
    );
});

// TESTE 7: [RF04-v5.4] Bordas hairline glassmorphism anti-slop
it('styles.css deve definir bordas hairline anti-slop (1px solid rgba(255, 255, 255, 0.08)) para classes glass', () => {
    assert(
        css.includes('rgba(255, 255, 255, 0.08)') || css.includes('rgba(255,255,255,0.08)'),
        'Bordas hairline de precisão rgba(255, 255, 255, 0.08) não encontradas para o glassmorphism'
    );
});

// TESTE 8: [RF04-v5.4] Hitboxes de topo (Ajuda, Ajustes, Recordes) >= 44px
it('Hitboxes de topo (Ajuda, Ajustes, Recordes) em index.html devem possuir no mínimo 44x44px de área tátil', () => {
    // Procura botões de topo: showHelpModal, toggleSettings, showRecords
    const helpBtnMatch = html.match(/<button[^>]*onclick="app\.showHelpModal\(\)"[^>]*class="([^"]+)"/);
    const settingsBtnMatch = html.match(/<button[^>]*onclick="app\.toggleSettings\(\)"[^>]*class="([^"]+)"/);
    const recordsBtnMatch = html.match(/<button[^>]*onclick="app\.showRecords\(\)"[^>]*class="([^"]+)"/);

    assert(helpBtnMatch, 'Botão de Ajuda não encontrado no topo');
    assert(settingsBtnMatch, 'Botão de Ajustes não encontrado no topo');
    assert(recordsBtnMatch, 'Botão de Recordes não encontrado');

    const checkHitbox = (cls, name) => {
        const hasMinSize = cls.includes('min-w-[44px]') || cls.includes('w-11') || cls.includes('p-3') || cls.includes('h-11');
        assert(hasMinSize, `Botão ${name} não atende ao padrão de acessibilidade táctil >=44px (classes: ${cls})`);
    };

    checkHitbox(helpBtnMatch[1], 'Ajuda');
    checkHitbox(settingsBtnMatch[1], 'Ajustes');
    checkHitbox(recordsBtnMatch[1], 'Recordes');
});

// TESTE 9: app.js deve fornecer método verifyScrollIntegrity para auditoria E2E
it('app.js deve fornecer método verifyScrollIntegrity() validando todas as abas e modais', () => {
    assert(appJs.includes('verifyScrollIntegrity:'), 'app.verifyScrollIntegrity() não encontrado em app.js');
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF04: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
