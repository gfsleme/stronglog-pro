// scripts/test_rf_residual_v56.js
// Suíte TDD para os 4 Bugs Residuais reportados no Hotfix v5.6 pelo Maestro
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: Hotfix v5.6 - 4 Correções Residuais (Maestro Loop)');
console.log('================================================================\n');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');
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

// -------------------------------------------------------------
// MOCK DE AMBIENTE PARA EXECUÇÃO JS
// -------------------------------------------------------------
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
    location: { reload: () => {} },
    scrollTo: () => {}
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
    querySelectorAll: (sel) => {
        if (sel === 'main > section') {
            return [
                getMockElement('view-dashboard'),
                getMockElement('view-active-workout'),
                getMockElement('view-history'),
                getMockElement('view-plan-editor')
            ];
        }
        if (sel === '.nav-item') {
            return [
                { dataset: { view: 'dashboard' }, classList: { add: () => {}, remove: () => {} } },
                { dataset: { view: 'active-workout' }, classList: { add: () => {}, remove: () => {} } },
                { dataset: { view: 'history' }, classList: { add: () => {}, remove: () => {} } }
            ];
        }
        return Object.values(elementsMap);
    }
};

let rawDataset = [];
try {
    rawDataset = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/exercises.min.json'), 'utf-8'));
} catch (e) {
    rawDataset = [];
}

const mockPlans = [];
global.db = {
    plans: {
        toArray: async () => mockPlans,
        get: async (id) => mockPlans.find(p => p.id === id) || null,
        add: async (p) => { const id = mockPlans.length + 1; mockPlans.push({ ...p, id }); return id; },
        put: async (p) => { 
            const idx = mockPlans.findIndex(x => x.id === p.id); 
            if (idx >= 0) mockPlans[idx] = p; else mockPlans.push(p); 
            return p.id || 1; 
        }
    },
    templates: {
        count: async () => rawDataset.length,
        toArray: async () => rawDataset,
        get: async (id) => rawDataset.find(x => String(x.id) === String(id)) || null,
        clear: async () => {},
        bulkAdd: async () => {}
    },
    records: { get: async () => null, toArray: async () => [] },
    sessions: { toArray: async () => [] }
};

global.Dexie = function() {
    this.version = () => ({ stores: () => ({}) });
    this.plans = global.db.plans;
    this.templates = global.db.templates;
    this.records = global.db.records;
    this.sessions = global.db.sessions;
};

let testApp = null;
try {
    const scriptCode = `
        const lucide = { createIcons: () => {} };
        ${appJs}
        return app;
    `;
    testApp = new Function(scriptCode)();
} catch (e) {
    throw new Error('Falha ao compilar app.js: ' + e.message);
}

// -------------------------------------------------------------
// TESTE 1: #onboarding-modal NUNCA visível quando flag onboarding_done setada
// -------------------------------------------------------------
it('1. BUG 1: #onboarding-modal NUNCA deve ficar visível se localStorage.onboarding_done estiver setada (inclusive múltiplos reloads)', () => {
    localStorage.clear();
    localStorage.setItem('onboarding_done', 'true');

    const modal = getMockElement('onboarding-modal');
    modal.classList.add('hidden');

    // Simula 5 verificações/reloads sucessivos
    for (let r = 1; r <= 5; r++) {
        testApp.checkOnboarding();
        testApp.showOnboarding(false); // chamada com force=false simulando boot automático
        assert(
            modal.classList.contains('hidden'),
            `Reload #${r}: #onboarding-modal tornou-se visível apesar de onboarding_done = true!`
        );
    }
});

// -------------------------------------------------------------
// TESTE 2: Busca por 'supino' retorna > 0 resultados na biblioteca
// -------------------------------------------------------------
it('2. BUG 2: Busca por "supino" no #search-exercise deve retornar > 0 resultados (inclusive se filtro muscular ativo)', async () => {
    const searchInput = getMockElement('search-exercise');
    searchInput.value = 'supino';

    // Cenário A: Sem filtro de músculo prévio
    testApp.activeMuscleFilter = null;
    await testApp.filterExerciseLibrary();

    const listContainer = getMockElement('library-list');
    assert(
        !listContainer.innerHTML.includes('Nenhum exercício encontrado'),
        'Busca "supino" retornou ZERO resultados na biblioteca!'
    );
    assert(
        listContainer.innerHTML.toLowerCase().includes('supino'),
        'Resultado renderizado não contém a palavra "supino"!'
    );

    // Cenário B: Usuário havia clicado antes em outro músculo (ex: "calves")
    testApp.activeMuscleFilter = 'calves';
    await testApp.filterExerciseLibrary();
    assert(
        !listContainer.innerHTML.includes('Nenhum exercício encontrado'),
        'Busca textual direta "supino" deve ter precedência e NÃO retornar zero mesmo com activeMuscleFilter = calves'
    );
    assert(
        listContainer.innerHTML.toLowerCase().includes('supino'),
        'Exercícios de supino devem aparecer na busca mesmo com activeMuscleFilter residual'
    );
});

// -------------------------------------------------------------
// TESTE 2B: seedTemplates resiliente contra falha de fetch (fallback templates)
// -------------------------------------------------------------
it('2B. BUG 2 (Resiliência): app.defaultExerciseTemplates deve fornecer fallback caso fetch atrase ou falhe', () => {
    assert(
        Array.isArray(testApp.defaultExerciseTemplates) && testApp.defaultExerciseTemplates.length > 0,
        'app.defaultExerciseTemplates deve existir como array de fallbacks'
    );
    const supinoDefault = testApp.defaultExerciseTemplates.find(x => x.name.toLowerCase().includes('supino'));
    assert(supinoDefault, 'app.defaultExerciseTemplates deve conter pelo menos 1 exercício de supino');
});

// -------------------------------------------------------------
// TESTE 3: Botão de 'Nova Rotina' no dashboard com seletor e hitbox
// -------------------------------------------------------------
it('3. BUG 3: Botão "Nova Rotina" no dashboard deve possuir id "btn-new-plan", data-action="new-plan" e touch target >= 44px', () => {
    // Valida no HTML
    const match = html.match(/<button[^>]*id="btn-new-plan"[^>]*>/);
    assert(match, 'Botão com id="btn-new-plan" não encontrado no index.html');

    const btnHtml = match[0];
    assert(btnHtml.includes('app.showNewPlanForm()'), 'Botão #btn-new-plan deve chamar app.showNewPlanForm()');
    assert(btnHtml.includes('data-action="new-plan"'), 'Botão #btn-new-plan deve conter data-action="new-plan"');
    assert(
        btnHtml.includes('min-h-[44px]') || btnHtml.includes('h-11'),
        'Botão #btn-new-plan deve ter touch target vertical >= 44px (min-h-[44px] ou h-11)'
    );
});

// -------------------------------------------------------------
// TESTE 4: savePlan fecha o editor e exibe dashboard
// -------------------------------------------------------------
it('4. BUG 4: savePlan deve fechar o editor (adicionar hidden em view-plan-editor) e exibir dashboard', async () => {
    const editor = getMockElement('view-plan-editor');
    const dashboard = getMockElement('view-dashboard');
    const nameInput = getMockElement('plan-name-input');

    // Abre o editor
    testApp.showNewPlanForm();
    assert(!editor.classList.contains('hidden'), 'view-plan-editor deve estar visível após showNewPlanForm');

    // Preenche nome
    nameInput.value = 'Rotina A - Peito e Tríceps';
    testApp.editingPlan.exercises = ['Supino Reto'];

    // Executa salvar
    await testApp.savePlan();

    // Editor DEVE estar oculto e dashboard DEVE estar visível
    assert(editor.classList.contains('hidden'), 'view-plan-editor continuou visível após app.savePlan()!');
    assert(!dashboard.classList.contains('hidden'), 'view-dashboard deve estar visível após app.savePlan()');
});

// -------------------------------------------------------------
// TESTE 4B: savePlan sem preencher nome não trava o editor
// -------------------------------------------------------------
it('4B. BUG 4 (Robustez): savePlan sem preenchimento de nome deve salvar com nome padrão e fechar o editor', async () => {
    const editor = getMockElement('view-plan-editor');
    const dashboard = getMockElement('view-dashboard');
    const nameInput = getMockElement('plan-name-input');

    // Abre o editor
    testApp.showNewPlanForm();
    assert(!editor.classList.contains('hidden'), 'view-plan-editor deve abrir');

    // Deixa nome em branco
    nameInput.value = '';
    testApp.editingPlan.exercises = ['Supino Reto'];

    // Executa salvar
    await testApp.savePlan();

    // Editor DEVE fechar e exibir dashboard
    assert(editor.classList.contains('hidden'), 'view-plan-editor deve fechar mesmo sem nome digitado!');
    assert(!dashboard.classList.contains('hidden'), 'view-dashboard deve ser exibido após salvar!');
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO TESTES RESIDUAIS v5.6: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
