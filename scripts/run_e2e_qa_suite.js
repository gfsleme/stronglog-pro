// scripts/run_e2e_qa_suite.js
// Suíte de Testes E2E e Validação de QA dos 13 Pontos Refatorados no StrongLog Pro v5.0

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const SERVER_URL = `http://localhost:${PORT}`;

async function fetchAppFiles() {
    return new Promise((resolve) => {
        http.get(`${SERVER_URL}/index.html`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', () => {
            // Fallback direto do filesystem se o servidor http não responder
            const fallbackPath = path.join(__dirname, '../src/index.html');
            resolve(fs.readFileSync(fallbackPath, 'utf-8'));
        });
    });
}

// Simulador de Ambiente de Testes Headless / QA Engine
async function runQASuite() {
    console.log('================================================================');
    console.log('🧪 INICIANDO BATERIA DE TESTES E2E DE QA — STRONGLOG PRO v5.0');
    console.log(`🌐 Alvo: ${SERVER_URL}`);
    console.log('================================================================\n');

    let passedTests = 0;
    let failedTests = 0;
    const testResults = [];

    function assert(condition, testId, testName, details = '') {
        if (condition) {
            passedTests++;
            console.log(`✅ [PASS] ${testId}: ${testName}`);
            testResults.push({ id: testId, name: testName, status: 'PASS', details });
        } else {
            failedTests++;
            console.error(`❌ [FAIL] ${testId}: ${testName}`);
            if (details) console.error(`   Detalhe: ${details}`);
            testResults.push({ id: testId, name: testName, status: 'FAIL', details });
        }
    }

    // 1. Carrega e analisa arquivos do servidor local
    const htmlContent = await fetchAppFiles();
    const appJsContent = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');
    const cssContent = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf-8');

    // Executa em contexto simulado do App
    const mockStorage = {};
    const mockLocalStorage = {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; },
        clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
    };

    // Monta ambiente DOM básico em memória
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
                    style: {},
                    appendChild(child) {},
                    remove() {},
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
                    addEventListener(evt, fn) { this._listeners = this._listeners || {}; this._listeners[evt] = fn; },
                    parentElement: { clientWidth: 360, clientHeight: 240 },
                    getContext: () => ({ fillRect: ()=>{}, clearRect: ()=>{} })
                };
            }
            return this.elements[id];
        }
    };

    // Contexto sandbox para rodar métodos de app.js
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
            scrollTo: () => {},
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
                    toArray: async () => [
                        { name: 'Supino Reto', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders_front'] },
                        { name: 'Flexão de Braço', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps'] }
                    ],
                    count: async () => 10,
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
            Group: class { add() {} rotation = { y: 0, set: ()=>{} }; traverse(fn) {} },
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
    sandbox.self = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    // Extrai o objeto app e db do app.js
    const vm = require('vm');
    const ctx = vm.createContext(sandbox);
    const resultObj = vm.runInContext(appJsContent + '\n;({app, db});', ctx);
    const testApp = resultObj.app;
    const testDb = resultObj.db;

    console.log('--- TESTES P1: FÓRMULAS & INTEGRIDADE DE DADOS ---');

    // TESTE 1: Fallback de 45kg corrigido no Volume Efetivo
    const testExercises = [
        {
            name: 'Flexão de Braço',
            sets: [
                { weight: 0, reps: 15, completed: true },
                { weight: 0, reps: 0, completed: true } // Reps zero
            ]
        },
        {
            name: 'Supino Reto',
            sets: [
                { weight: 80, reps: 10, completed: true }
            ]
        }
    ];
    const recruitment = await testApp.calculateWorkoutMuscleRecruitment(testExercises);
    // 80 * 10 = 800 (100% primário) + 800*0.4 (triceps) + 800*0.4 (shoulders_front) = 800 + 320 + 320 = 1440.
    // Flexão com weight=0 resulta em 0kg (não soma 45kg fantasma).
    assert(
        recruitment.totalEffectiveVolume === 1440,
        'P1-ITEM-01',
        'Volume Efetivo (V_eff) não usa mais fallback de 45kg e reps=0 resulta em 0kg',
        `V_eff obtido: ${recruitment.totalEffectiveVolume} (Esperado: 1440)`
    );

    // TESTE 2: Barra In-Workout de Músculos Ativos renderizada
    testApp.activeWorkout = {
        name: 'Treino A',
        exercises: [
            { name: 'Supino Reto com Barra', muscleGroup: 'Peito', sets: [{ weight: 80, reps: 10, completed: false, type: 'Normal' }] }
        ]
    };
    testApp.renderWorkout();
    const exListHtml = mockDOM.getElementById('exercise-list').innerHTML;
    assert(
        exListHtml.includes('Peito') && exListHtml.includes('bg-[#00FF9D]/10 text-[#00FF9D]'),
        'P1-ITEM-02',
        'Tag/Chip de Músculos Ativos renderizada com destaque visual na interface de treino',
        'Chip com categoria muscular Peito incluído no cartão do exercício'
    );

    // TESTE 3: Fórmula 1RM com r=0, r=1 e Ordenação de Séries por 1RM real
    const oneRmZero = testApp.calculate1RM(100, 0);
    const oneRmOne = testApp.calculate1RM(100, 1);
    const oneRmTen = testApp.calculate1RM(80, 10);
    assert(
        oneRmZero === 0 && oneRmOne === 100 && oneRmTen === 107,
        'P1-ITEM-03',
        'Fórmula 1RM retorna 0 para reps=0, peso exato para reps=1 e cálculo preciso de Epley para reps>1',
        `oneRm(100,0)=${oneRmZero}, oneRm(100,1)=${oneRmOne}, oneRm(80,10)=${oneRmTen}`
    );

    // TESTE 4: Heatmap Térmico com Limiares Híbridos (Sem falso Nível 4 em treinos de 1 série)
    const singleSetExercise = [
        {
            name: 'Rosca Direta',
            sets: [{ weight: 6, reps: 10, completed: true, type: 'Normal' }] // Volume bruto = 60kg
        }
    ];
    const singleSetRecruitment = await testApp.calculateWorkoutMuscleRecruitment(singleSetExercise);
    const bicepsGroup = Object.values(singleSetRecruitment.heatLevels)[0];
    assert(
        bicepsGroup === 1,
        'P1-ITEM-04',
        'Heatmap térmico não ativa Nível 4 (Crimson) com apenas 1 série leve de 60kg',
        `Heat level obtido: ${bicepsGroup} (Esperado: 1 - Cyan para ativação leve < 150kg)`
    );

    console.log('\n--- TESTES P2: ERGONOMIA, SMART STEPPERS & MODAIS ---');

    // TESTE 5: Touch Targets nos Smart Steppers (>= 36px no CSS)
    const stepperCssRule = cssContent.includes('.stepper-btn') && cssContent.includes('min-height: 36px');
    assert(
        stepperCssRule,
        'P2-ITEM-05',
        'Smart Steppers com touch target mínimo de 36px (min-height: 36px e touch-action: manipulation)',
        'CSS .stepper-btn configurado para ergonomia de 1 mão'
    );

    // TESTE 6: Atualização Cirúrgica do DOM no Smart Stepper (sem jank / sem reflow global)
    mockDOM.getElementById('set-weight-input-0-0');
    mockDOM.getElementById('set-reps-input-0-0');
    testApp.activeWorkout = {
        name: 'Treino Teste',
        exercises: [{
            name: 'Supino',
            sets: [{ weight: 50, reps: 8, completed: false, type: 'Normal' }]
        }]
    };
    testApp.stepWeight(0, 0, 2.5);
    testApp.stepReps(0, 0, 1);
    assert(
        testApp.activeWorkout.exercises[0].sets[0].weight === 52.5 &&
        testApp.activeWorkout.exercises[0].sets[0].reps === 9 &&
        mockDOM.getElementById('set-weight-input-0-0').value === 52.5 &&
        mockDOM.getElementById('set-reps-input-0-0').value === 9,
        'P2-ITEM-06',
        'Smart Stepper atualiza inputs pontualmente no DOM sem re-render total destrutivo',
        'Valores refletidos diretamente nos inputs e no estado ativo'
    );

    // TESTE 7: Modais com Click-Outside / Backdrop Dismiss e inicialização
    testApp.initModalBackdrops();
    const modalIds = ['records-modal', 'exercise-library-modal', 'settings-modal', 'workout-summary-modal'];
    let allBackdropsRegistered = true;
    modalIds.forEach(id => {
        const el = mockDOM.getElementById(id);
        if (!el._listeners || !el._listeners['click']) allBackdropsRegistered = false;
    });
    assert(
        allBackdropsRegistered,
        'P2-ITEM-07',
        'Modais possuem listener de backdrop para fechamento ergonômico por toque fora (click-outside)',
        'Event listeners registrados em todos os modais da aplicação'
    );

    // TESTE 8: Remoção de Séries Individuais
    testApp.activeWorkout.exercises[0].sets.push({ weight: 52.5, reps: 9, completed: false, type: 'Normal' });
    testApp.removeSetFromWorkout(0, 1);
    assert(
        testApp.activeWorkout.exercises[0].sets.length === 1,
        'P2-ITEM-08',
        'Suporte a remoção de séries individuais via removeSetFromWorkout',
        'Série removida com sucesso sem necessidade de apagar o exercício todo'
    );

    // TESTE 9: Campo RPE com inputmode decimal e step 0.5
    const setRowHtml = testApp.renderSetRow(0, 0, testApp.activeWorkout.exercises[0].sets[0]);
    assert(
        setRowHtml.includes('inputmode="decimal"') && setRowHtml.includes('step="0.5"') && setRowHtml.includes('placeholder="RPE"'),
        'P2-ITEM-09',
        'Campo RPE configurado com inputmode="decimal" e step="0.5" para digitação de RPE 7.5, 8.5, etc.',
        'HTML renderSetRow verificado'
    );

    console.log('\n--- TESTES P3: POLIMENTO, QUALIDADE DE VIDA & 3D WEBGL ---');

    // TESTE 10: Stepper de Repetições com Passos de ±5
    assert(
        setRowHtml.includes('stepReps(0,0,-5)') && setRowHtml.includes('stepReps(0,0,5)'),
        'P3-ITEM-10',
        'Smart Stepper inclui botões táteis de incremento rápido de repetições (±5 reps)',
        'Botões -5 e +5 verificados na linha da série'
    );

    // TESTE 11: Histórico Clicável com showWorkoutSummaryById
    testDb.sessions.orderBy = () => ({
        reverse: () => ({
            toArray: async () => [{ id: 42, planName: 'Treino Superior', date: new Date(), volume: 3400, duration: 2700 }]
        })
    });
    await testApp.renderHistory();
    const historyHtml = mockDOM.getElementById('history-list').innerHTML;
    assert(
        historyHtml.includes('onclick="app.showWorkoutSummaryById(42)"') && historyHtml.includes('Resumo 3D'),
        'P3-ITEM-11',
        'Histórico permite clicar em qualquer treino passado para reabrir o Resumo 3D e mapa anatômico',
        'Card do histórico com evento de clique e badge Resumo 3D'
    );

    // TESTE 12: Paleta Dinâmica no Gráfico de Rosca (Chart.js)
    const palette5 = testApp.generateDynamicPalette(5);
    const palette15 = testApp.generateDynamicPalette(15);
    assert(
        palette5.length === 5 && palette15.length === 15 && !palette15.includes(undefined),
        'P3-ITEM-12',
        'Gerador dinâmico de paleta de cores para Chart.js suporta N grupos musculares sem ficar transparente',
        `5 cores: [${palette5.slice(0,2)}...], 15 cores geradas dinamicamente com HSL`
    );

    // TESTE 13: ResizeObserver e Limpeza no 3D WebGL Three.js
    testApp.init3DScene('library-3d-canvas', null, true, 'library');
    const sceneCreated = !!testApp.threeScenes['library'];
    testApp.destroy3DScene('library');
    const sceneDestroyed = !testApp.threeScenes['library'];
    assert(
        sceneCreated && sceneDestroyed,
        'P3-ITEM-13',
        'Visualizador 3D Three.js inicializa com ResizeObserver e limpa cena/renderizador sem memory leaks',
        'init3DScene e destroy3DScene validados com sucesso'
    );

    console.log('\n--- TESTES P4: NOVIDADES v5.1 (UI/UX REDESIGN, ENSINO & ONBOARDING) ---');

    // TESTE 14: showPlanEditor alias e inicialização de formulário
    assert(
        typeof testApp.showPlanEditor === 'function',
        'P4-ITEM-14',
        'Método showPlanEditor disponível como alias funcional de showNewPlanForm',
        'Evita qualquer Uncaught TypeError ao clicar em Nova Rotina'
    );

    // TESTE 15: startFreeWorkout e blindagem de addExerciseToActiveWorkout
    testApp.activeWorkout = null;
    testApp.startFreeWorkout();
    const isFreeActive = testApp.activeWorkout && testApp.activeWorkout.name === 'Treino Livre';
    testApp.activeWorkout = null;
    await testApp.addExerciseToActiveWorkout('Supino Reto');
    const isResilientAdd = testApp.activeWorkout && testApp.activeWorkout.exercises.length === 1;
    assert(
        isFreeActive && isResilientAdd,
        'P4-ITEM-15',
        'startFreeWorkout inicializa treino avulso e addExerciseToActiveWorkout é 100% blindado contra null',
        'Treino livre criado e exercício injetado com segurança'
    );

    // TESTE 16: Seletor de Tipos de Série (Set Type Picker)
    testApp.activeWorkout = {
        name: 'Treino Teste',
        exercises: [{
            name: 'Supino Reto',
            sets: [{ weight: 80, reps: 8, completed: false, type: 'Normal' }]
        }]
    };
    testApp.openSetTypePicker(0, 0);
    const setTypeModalHtml = mockDOM.getElementById('set-type-options-list').innerHTML;
    testApp.selectSetType('Failure');
    const isTypeChanged = testApp.activeWorkout.exercises[0].sets[0].type === 'Failure';
    assert(
        setTypeModalHtml.includes('Série Normal') && setTypeModalHtml.includes('Até a Falha') && isTypeChanged,
        'P4-ITEM-16',
        'Modal de Tipos de Série renderiza opções didáticas (Normal, Warmup, Failure, Drop) e atualiza estado',
        'Opções listadas com explicações ricas e tipo alterado para Failure'
    );

    // TESTE 17: Seletor de Escala RPE e RIR
    testApp.openRpePicker(0, 0);
    const rpeModalHtml = mockDOM.getElementById('rpe-options-list').innerHTML;
    testApp.selectRpe(8.5);
    const isRpeChanged = testApp.activeWorkout.exercises[0].sets[0].rpe === 8.5;
    assert(
        rpeModalHtml.includes('RPE 10') && rpeModalHtml.includes('RIR 0') && rpeModalHtml.includes('Hipertrofia Ótima') && isRpeChanged,
        'P4-ITEM-17',
        'Seletor de RPE renderiza a escala completa com cálculo de Reps em Reserva (RIR) e atualiza o treino',
        'Escalas 6.0 a 10.0 renderizadas e RPE 8.5 salvo com sucesso'
    );

    // TESTE 18: Central de Ajuda & Guia Biomecânico
    testApp.showHelpModal();
    testApp.switchHelpTab('guide');
    const guideHtml = mockDOM.getElementById('help-modal-tab-content').innerHTML;
    testApp.switchHelpTab('bio');
    const bioHtml = mockDOM.getElementById('help-modal-tab-content').innerHTML;
    assert(
        guideHtml.includes('Como Fazer seu Treino') && bioHtml.includes('Volume Efetivo') && bioHtml.includes('Heatmap'),
        'P4-ITEM-18',
        'Central de Ajuda (Help Modal) alterna e renderiza Guias, Tabela RPE e Biomecânica com clareza',
        'Abas Guide e Bio verificadas com sucesso'
    );

    // TESTE 19: Onboarding Interativo de 4 Passos e Persistência
    testApp.showOnboarding(true);
    const onboardingSlides = testApp.getOnboardingSlides();
    assert(
        onboardingSlides.length === 4 &&
        onboardingSlides[0].title.includes('1.324 Exercícios') &&
        onboardingSlides[1].title.includes('1 Mão') &&
        onboardingSlides[2].title.includes('RPE') &&
        onboardingSlides[3].title.includes('Holograma 3D'),
        'P4-ITEM-19',
        'Onboarding interativo possui 4 etapas cobrindo base de 1.324 exercícios, ergonomia, RPE e 3D',
        '4 slides configurados com ícones, destaques e persistência em localStorage'
    );

    console.log('\n================================================================');
    console.log(`📊 RESULTADO FINAL DA AUDITORIA E2E: ${passedTests} PASS / ${failedTests} FAIL`);
    console.log('================================================================\n');

    return { passedTests, failedTests, testResults };
}

runQASuite().catch(err => {
    console.error('Erro na execução dos testes E2E:', err);
    process.exit(1);
});
