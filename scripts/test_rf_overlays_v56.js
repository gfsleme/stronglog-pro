// scripts/test_rf_overlays_v56.js
// Teste TDD Estrito para Hotfix v5.6: Blindagem de Overlays, Onboarding, Rest-Timer e Fluxo do Gabriel
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: Hotfix v5.6 - Blindagem de Overlays & Fluxo Gabriel');
console.log('================================================================\n');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');
const swJs = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf-8');
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

// 1. Verificação do #onboarding-modal no HTML inicial
it('1. #onboarding-modal deve conter a classe "hidden" no HTML inicial', () => {
    const match = html.match(/<div[^>]*id="onboarding-modal"[^>]*class="([^"]+)"/);
    assert(match, 'Elemento #onboarding-modal não encontrado em index.html');
    const classes = match[1].split(/\s+/);
    assert(classes.includes('hidden'), `#onboarding-modal não possui a classe 'hidden' no HTML inicial (classes: ${match[1]})`);
});

// 2. Verificação do #rest-timer-overlay no HTML inicial
it('2. #rest-timer-overlay deve conter a classe "hidden" no HTML inicial (não apenas translate)', () => {
    const match = html.match(/<div[^>]*id="rest-timer-overlay"[^>]*class="([^"]+)"/);
    assert(match, 'Elemento #rest-timer-overlay não encontrado em index.html');
    const classes = match[1].split(/\s+/);
    assert(classes.includes('hidden'), `#rest-timer-overlay não possui a classe 'hidden' no HTML inicial (classes: ${match[1]})`);
});

// 3. Auditoria global de todos os modais/overlays fixos
it('3. Auditoria Global: TODOS os 11 modais e overlays fixos devem conter "hidden" por padrão no HTML', () => {
    const REQUIRED_MODALS = [
        'onboarding-modal',
        'exercise-library-modal',
        'exercise-detail-modal',
        'workout-summary-modal',
        'custom-exercise-modal',
        'settings-modal',
        'help-modal',
        'set-type-picker-modal',
        'rpe-picker-modal',
        'confirm-dialog-modal',
        'rest-timer-overlay'
    ];

    REQUIRED_MODALS.forEach(id => {
        const regex = new RegExp(`<div[^>]*id="${id}"[^>]*class="([^"]+)"`);
        const match = html.match(regex);
        assert(match, `Modal/Overlay #${id} não encontrado em index.html`);
        const classes = match[1].split(/\s+/);
        assert(classes.includes('hidden'), `Modal/Overlay #${id} NÃO possui a classe 'hidden' inicial! Classes: ${match[1]}`);
    });
});

// 4. CSS deve forçar .hidden com display: none !important
it('4. styles.css deve definir .hidden com display: none !important', () => {
    assert(
        css.includes('.hidden') && css.includes('display: none !important'),
        'styles.css deve conter regra explícita .hidden { display: none !important; } para prevenir vazamentos de layout'
    );
});

// 5. Bump de versão para v5.6+ ou v7.0+ no Service Worker e app.js
it('5. Versão e CACHE_NAME devem ser bumpados para v5.6+', () => {
    assert(
        /CACHE_NAME = ['"]stronglog-pro-(?:v5\.6|v[6-9]\.\d+)['"]/.test(swJs),
        'sw.js deve conter CACHE_NAME = stronglog-pro-v5.6+ ou v7.0+'
    );
    assert(
        /APP_VERSION = ['"](?:v5\.6|v[6-9]\.\d+)['"]/.test(appJs),
        'app.js deve conter APP_VERSION = v5.6+ ou v7.0+'
    );
});

// MOCK ENVIRONMENT PARA TESTES DE EXECUÇÃO EM JS
const mockStorage = {};
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
global.window = {
    devicePixelRatio: 2,
    innerWidth: 390,
    innerHeight: 844,
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

const elementsMap = {};
function getMockElement(id) {
    if (!elementsMap[id]) {
        const classSet = new Set(['hidden']);
        elementsMap[id] = {
            id,
            tagName: 'DIV',
            value: '',
            innerText: '',
            innerHTML: '',
            style: {},
            classList: {
                add: (c) => classSet.add(c),
                remove: (c) => classSet.delete(c),
                toggle: (c, force) => {
                    if (force !== undefined) {
                        force ? classSet.add(c) : classSet.delete(c);
                    } else {
                        classSet.has(c) ? classSet.delete(c) : classSet.add(c);
                    }
                },
                contains: (c) => classSet.has(c)
            },
            setAttribute: () => {},
            getAttribute: () => null,
            focus: () => {}
        };
    }
    return elementsMap[id];
}

global.document = {
    getElementById: (id) => getMockElement(id),
    querySelector: (sel) => null,
    querySelectorAll: (sel) => Object.values(elementsMap)
};

let testApp = null;
try {
    const scriptCode = `
        function Dexie() { 
            this.version = () => ({ stores: () => ({}) }); 
            this.templates = { 
                toArray: async () => [{ id: 1, name: 'Supino Reto', body_part: 'Peitoral', equipment: 'Barra' }],
                get: async (id) => ({ id: 1, name: 'Supino Reto', body_part: 'Peitoral', equipment: 'Barra' })
            }; 
            this.plans = { toArray: async () => [], get: async () => null, put: async () => 1 };
            this.records = { get: async () => null, toArray: async () => [] };
            this.sessions = { toArray: async () => [] };
        }
        const lucide = { createIcons: () => {} };
        ${appJs}
        return app;
    `;
    testApp = new Function(scriptCode)();
} catch (e) {
    throw new Error('Falha ao carregar app.js: ' + e.message);
}

// 6. Teste de checkOnboarding com flag de primeiro uso setada
it('6. checkOnboarding() NUNCA deve abrir #onboarding-modal quando flag de primeiro uso estiver setada', (done) => {
    localStorage.setItem('stronglog_onboarded_v51', 'true');
    const modal = getMockElement('onboarding-modal');
    modal.classList.add('hidden');

    testApp.checkOnboarding();
    setTimeout(() => {
        assert(modal.classList.contains('hidden'), 'onboarding-modal foi aberto indevidamente mesmo com flag de primeiro uso setada!');
    }, 50);
});

// 7. Teste de controle do #rest-timer-overlay: showRestTimer / stopRestTimer
it('7. #rest-timer-overlay deve ter classe "hidden" quando parado e remove-la quando iniciado', () => {
    const overlay = getMockElement('rest-timer-overlay');
    overlay.classList.add('hidden');

    testApp.startRestTimer(60);
    assert(!overlay.classList.contains('hidden'), 'startRestTimer deve remover classe "hidden" do overlay');

    testApp.stopRestTimer();
    assert(overlay.classList.contains('hidden'), 'stopRestTimer deve adicionar classe "hidden" ao overlay');
});

// 8. Teste E2E do FLUXO EXATO DO GABRIEL: Nova Rotina -> Abrir Biblioteca -> Buscar -> Adicionar -> Voltar
it('8. Fluxo Exato do Gabriel: showNewPlanForm -> showExerciseLibrary -> focus busca -> adicionar -> voltar SEM overlay residual', async () => {
    // Configura elementos envolvidos
    const planEditorView = getMockElement('view-plan-editor');
    const libraryModal = getMockElement('exercise-library-modal');
    const onboardingModal = getMockElement('onboarding-modal');
    const restTimerOverlay = getMockElement('rest-timer-overlay');
    const searchInput = getMockElement('search-exercise');

    // Estado inicial: todos os modais fechados
    libraryModal.classList.add('hidden');
    onboardingModal.classList.add('hidden');
    restTimerOverlay.classList.add('hidden');

    // Passo 1: Usuário clica em "+ Nova Rotina"
    testApp.showNewPlanForm();
    assert(!planEditorView.classList.contains('hidden'), 'view-plan-editor deve estar visível após showNewPlanForm');

    // Passo 2: No editor de rotina, clica em "Buscar na Biblioteca"
    testApp.showExerciseLibrary('editor');
    assert(!libraryModal.classList.contains('hidden'), 'exercise-library-modal deve abrir');
    assert(testApp.libraryContext === 'editor', 'Contexto da biblioteca deve ser "editor"');

    // Passo 3: Usuário toca no input de busca #search-exercise
    testApp.onSearchExerciseFocus();
    assert(testApp.isSearchFocused === true, 'isSearchFocused deve ser true');
    assert(testApp.isVisualizerCollapsed === true, 'Visualizador deve auto-colapsar');

    // Passo 4: Usuário busca e adiciona "Supino Reto"
    await testApp.selectExerciseById(1);
    assert(testApp.editingPlan.exercises.includes('Supino Reto'), 'Exercício "Supino Reto" deve estar no plano');

    // Passo 5: Usuário clica em "Concluir e Voltar ao Plano" / fechar modal
    testApp.closeModal('exercise-library-modal');

    // Passo 6: Verificação de ausência de overlays residuais (Critério do Gabriel)
    assert(libraryModal.classList.contains('hidden'), 'exercise-library-modal deve estar com hidden');
    assert(onboardingModal.classList.contains('hidden'), 'onboarding-modal NUNCA deve estar aberto residualmente');
    assert(restTimerOverlay.classList.contains('hidden'), 'rest-timer-overlay deve permanecer hidden');
    assert(!planEditorView.classList.contains('hidden'), 'view-plan-editor deve continuar acessível na tela');
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO TESTES v5.6: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
