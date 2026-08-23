// scripts/test_exercise_picker_flow.js
// Bateria de Testes E2E: Nova Biblioteca de Exercícios, Modelos 2D/3D e Adição Múltipla

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appJsPath = path.join(__dirname, '../src/app.js');
const ontologyPath = path.join(__dirname, '../src/data/muscle_ontology.json');
const exercisesPath = path.join(__dirname, '../src/data/exercises.min.json');

const appJsContent = fs.readFileSync(appJsPath, 'utf-8');
const ontology = JSON.parse(fs.readFileSync(ontologyPath, 'utf-8'));
const allExercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));

async function runExercisePickerTests() {
    console.log('================================================================');
    console.log('🧬 TESTES E2E: BIBLIOTECA DE EXERCÍCIOS, MODELOS 2D/3D & MULTI-ADD');
    console.log(`📚 Dataset: ${allExercises.length} exercícios científicos | ${Object.keys(ontology.groups).length} grupos musculares`);
    console.log('================================================================\n');

    let passedTests = 0;
    let failedTests = 0;
    const testResults = [];

    function assert(condition, testId, testName, details = '') {
        if (condition) {
            passedTests++;
            console.log(`✅ [PASS] ${testId}: ${testName}`);
            if (details) console.log(`   └─ ${details}`);
            testResults.push({ id: testId, name: testName, status: 'PASS', details });
        } else {
            failedTests++;
            console.error(`❌ [FAIL] ${testId}: ${testName}`);
            if (details) console.error(`   └─ Detalhe: ${details}`);
            testResults.push({ id: testId, name: testName, status: 'FAIL', details });
        }
    }

    // Mock DOM Engine
    const mockDOM = {
        elements: {},
        createElement(tag) {
            return {
                tagName: tag,
                textContent: '',
                get innerHTML() { return this.textContent; },
                set innerHTML(val) { this.textContent = val; },
                remove() {}
            };
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById(id) {
            if (!this.elements[id]) {
                this.elements[id] = {
                    id: id,
                    value: '',
                    innerText: '',
                    innerHTML: '',
                    className: '',
                    _listeners: {},
                    classList: {
                        classes: new Set(),
                        add(c) { this.classes.add(c); },
                        remove(c) { this.classes.delete(c); },
                        toggle(c, force) {
                            if (force !== undefined) {
                                force ? this.classes.add(c) : this.classes.delete(c);
                            } else {
                                this.classes.has(c) ? this.classes.delete(c) : this.classes.add(c);
                            }
                        },
                        contains(c) { return this.classes.has(c); }
                    },
                    style: {},
                    closest: () => null,
                    appendChild(el) {},
                    removeChild(el) {},
                    addEventListener(evt, fn) { 
                        this._listeners[evt] = this._listeners[evt] || [];
                        this._listeners[evt].push(fn);
                    },
                    dispatchEvent(evt) {
                        const list = this._listeners[evt.type] || [];
                        list.forEach(fn => fn(evt));
                    },
                    parentElement: { clientWidth: 360, clientHeight: 240 },
                    getContext: () => ({ fillRect: ()=>{}, clearRect: ()=>{} })
                };
            }
            return this.elements[id];
        }
    };

    const mockStorage = {};
    const mockLocalStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; },
        clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
    };

    const sandbox = {
        console,
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
        requestAnimationFrame: (cb) => setTimeout(cb, 16),
        cancelAnimationFrame: (id) => clearTimeout(id),
        window: {
            addEventListener: () => {},
            location: { reload: () => {} },
            requestAnimationFrame: (cb) => setTimeout(cb, 16),
            cancelAnimationFrame: (id) => clearTimeout(id)
        },
        document: mockDOM,
        navigator: {
            vibrate: () => true,
            wakeLock: { request: async () => ({ release: async () => {}, addEventListener: () => {} }) },
            deviceMemory: 4
        },
        localStorage: mockLocalStorage,
        Dexie: class {
            constructor() {
                this.plans = { toArray: async () => [], get: async () => null, put: async () => {} };
                this.sessions = { orderBy: () => ({ reverse: () => ({ toArray: async () => [], limit: () => ({ toArray: async () => [] }) }) }), get: async () => null, add: async () => 1 };
                this.templates = {
                    toArray: async () => allExercises,
                    count: async () => allExercises.length,
                    get: async (id) => allExercises.find(x => x.id === id || String(x.id) === String(id)),
                    where: () => ({ equals: () => ({ first: async () => null }) })
                };
                this.records = { count: async () => 0, get: async () => null, put: async () => {}, toArray: async () => [] };
            }
            version() { return { stores: () => {} }; }
        },
        lucide: { createIcons: () => {} },
        Chart: class { constructor() {} destroy() {} },
        THREE: {
            Scene: class { add() {} },
            PerspectiveCamera: class { position = { set: ()=>{} }; aspect = 1; updateProjectionMatrix() {} },
            WebGLRenderer: class { setSize() {} setPixelRatio() {} render() {} dispose() {} },
            AmbientLight: class {},
            DirectionalLight: class { position = { set: ()=>{} }; },
            GridHelper: class { position = { y: 0 }; },
            Group: class { add() {} rotation = { y: 0, set: ()=>{} }; traverse() {} },
            BoxGeometry: class {},
            CylinderGeometry: class {},
            SphereGeometry: class {},
            IcosahedronGeometry: class {},
            MeshStandardMaterial: class {},
            Mesh: class { position = { set: ()=>{} }; rotation = { set: ()=>{} }; scale = { set: ()=>{} }; userData = {}; },
            OrbitControls: class { enableDamping=true; dampingFactor=0.08; enableZoom=false; autoRotate=true; autoRotateSpeed=2.5; target={set:()=>{}}; update() {}; dispose() {} }
        },
        ResizeObserver: class { observe() {} disconnect() {} }
    };

    const ctx = vm.createContext(sandbox);
    const { app: testApp, db: testDb } = vm.runInContext(appJsContent + '\n;({app, db});', ctx);
    testApp.muscleOntology = ontology;

    console.log('--- TESTES REQUISITO 1: VALIDAÇÃO DOS 19 GRUPOS MUSCULARES ---');
    const ontologyGroups = Object.keys(ontology.groups);
    let allGroupsHaveExercises = true;
    const groupCounts = {};

    ontologyGroups.forEach(groupKey => {
        const filtered = allExercises.filter(ex => testApp.matchesMuscleHierarchy(ex, groupKey));
        groupCounts[groupKey] = filtered.length;
        if (filtered.length === 0) {
            allGroupsHaveExercises = false;
            console.error(`❌ Grupo muscular '${groupKey}' retornou 0 exercícios!`);
        }
    });

    assert(
        ontologyGroups.length === 19,
        'REQ1-ITEM-01',
        'Ontologia possui exatamente os 19 grupos anatômicos canônicos',
        `Grupos mapeados: ${ontologyGroups.join(', ')}`
    );

    assert(
        allGroupsHaveExercises,
        'REQ1-ITEM-02',
        'Todos os 19 grupos musculares retornam > 0 exercícios no filtro hierárquico',
        `Exemplos de contagem: Peito=${groupCounts['chest']}, Dorsais=${groupCounts['lats']}, Quadríceps=${groupCounts['quads']}, Abdômen=${groupCounts['abs']}, Trapézio=${groupCounts['traps']}, Adutores=${groupCounts['adductors']}, Abdutores=${groupCounts['abductors']}`
    );

    console.log('\n--- TESTES REQUISITO 2: FLUXO DE ADIÇÃO MÚLTIPLA & CONTADOR INFERIOR ---');
    
    // 2.1 Contexto de Treino Ativo (workout)
    testApp.activeWorkout = {
        name: 'Treino Hipertrofia',
        startTime: Date.now(),
        exercises: []
    };
    testApp.libraryContext = 'workout';
    testApp.updateLibraryBottomBar();

    const bottomBarEl = mockDOM.getElementById('library-bottom-bar');
    const counterEl = mockDOM.getElementById('library-bottom-counter');
    const libModalEl = mockDOM.getElementById('exercise-library-modal');

    // Inicialmente 0 exercícios
    assert(
        counterEl.innerText.includes('0 exercícios no treino'),
        'REQ2-ITEM-01',
        'Barra inferior da biblioteca inicializa com contagem 0 no contexto de treino',
        `Texto: "${counterEl.innerText}"`
    );

    // Adiciona Exercício 1
    await testApp.selectExercise('Supino Reto com Barra');
    const modalStillOpen1 = !libModalEl.classList.contains('hidden');
    assert(
        modalStillOpen1 && testApp.activeWorkout.exercises.length === 1 && counterEl.innerText.includes('1 exercício no treino'),
        'REQ2-ITEM-02',
        'Adicionar 1º exercício não fecha o modal e atualiza a barra inferior para 1 exercício',
        `Modal aberto: ${modalStillOpen1} | Contador: "${counterEl.innerText}"`
    );

    // Adiciona Exercício 2
    await testApp.selectExercise('Puxada no Pulley');
    const modalStillOpen2 = !libModalEl.classList.contains('hidden');
    assert(
        modalStillOpen2 && testApp.activeWorkout.exercises.length === 2 && counterEl.innerText.includes('2 exercícios no treino'),
        'REQ2-ITEM-03',
        'Adicionar 2º exercício em sequência mantém o modal aberto e incrementa o contador para 2',
        `Exercícios no treino ativo: ${testApp.activeWorkout.exercises.map(e=>e.name).join(' + ')}`
    );

    // Adiciona Exercício 3
    await testApp.selectExercise('Desenvolvimento Militar');
    assert(
        !libModalEl.classList.contains('hidden') && testApp.activeWorkout.exercises.length === 3 && counterEl.innerText.includes('3 exercícios no treino'),
        'REQ2-ITEM-04',
        'Adição Múltipla contínua bem-sucedida com 3 exercícios no treino sem interrupção de tela',
        `Contador: "${counterEl.innerText}"`
    );

    // 2.2 Contexto de Editor de Planos (editor)
    testApp.editingPlan = { name: 'Novo Plano', exercises: [] };
    testApp.libraryContext = 'editor';
    testApp.updateLibraryBottomBar();

    await testApp.selectExercise('Agachamento Livre');
    await testApp.selectExercise('Leg Press 45');
    assert(
        !libModalEl.classList.contains('hidden') && testApp.editingPlan.exercises.length === 2 && counterEl.innerText.includes('2 exercícios no plano'),
        'REQ2-ITEM-05',
        'Adição Múltipla no Editor de Planos mantém modal aberto e atualiza contador de plano',
        `Contador: "${counterEl.innerText}"`
    );

    console.log('\n--- TESTES REQUISITO 3: BACKDROP CLICK & PROTEÇÃO CONTRA CLIQUES NO 3D/2D ---');
    testApp.initModalBackdrops();

    const libModal = mockDOM.getElementById('exercise-library-modal');
    libModal.classList.remove('hidden');

    // 3.1 Simula clique/arrasto originado dentro de um elemento Canvas (3D Stage)
    const mockCanvas = {
        closest: (sel) => (sel === 'canvas' || sel === '#library-3d-container' || sel === '.glass') ? {} : null
    };
    
    // Pointerdown / mousedown no canvas
    libModal.dispatchEvent({ type: 'pointerdown', target: mockCanvas });
    libModal.dispatchEvent({ type: 'click', target: mockCanvas });

    assert(
        !libModal.classList.contains('hidden'),
        'REQ3-ITEM-01',
        'Toques, cliques e arrastes 360° dentro do Canvas 3D NÃO fecham o modal de biblioteca',
        'Modal permaneceu aberto após evento no canvas 3D'
    );

    // 3.2 Simula clique em nó anatômico dentro do SVG 2D
    const mockSvgNode = {
        closest: (sel) => (sel === 'svg' || sel === '#library-map-container' || sel === '.glass') ? {} : null
    };
    libModal.dispatchEvent({ type: 'pointerdown', target: mockSvgNode });
    libModal.dispatchEvent({ type: 'click', target: mockSvgNode });

    assert(
        !libModal.classList.contains('hidden'),
        'REQ3-ITEM-02',
        'Toques nos músculos do Mapa Anatômico 2D SVG NÃO fecham o modal de biblioteca',
        'Modal permaneceu aberto após clique no mapa 2D'
    );

    // 3.3 Simula clique no backdrop escuro externo (fora do cartão)
    libModal.dispatchEvent({ type: 'pointerdown', target: libModal });
    libModal.dispatchEvent({ type: 'click', target: libModal });

    assert(
        libModal.classList.contains('hidden'),
        'REQ3-ITEM-03',
        'Clique intencional no backdrop escuro externo fecha o modal com ergonomia de 1 mão',
        'Modal fechado corretamente (hidden adicionado)'
    );

    console.log('\n================================================================');
    console.log(`📊 RESULTADO DOS TESTES DA BIBLIOTECA & 3D/2D: ${passedTests} PASS / ${failedTests} FAIL`);
    console.log('================================================================\n');

    if (failedTests > 0) process.exit(1);
}

runExercisePickerTests().catch(err => {
    console.error('Erro na execução dos testes de biblioteca:', err);
    process.exit(1);
});
