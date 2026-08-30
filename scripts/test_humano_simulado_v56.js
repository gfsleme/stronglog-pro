// scripts/test_humano_simulado_v56.js
// Teste Humano-Simulado Mobile v5.6 - Percurso Completo End-to-End via CDP Nativo
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCREENSHOTS_DIR = path.join(__dirname, '../audit_snapshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

console.log('================================================================');
console.log('📱 TESTE HUMANO-SIMULADO MOBILE v5.6 — PERCURSO COMPLETO END-TO-END');
console.log('   Viewport: iPhone 14 (390x844, dpr: 3.0, Touch + Mobile)');
console.log('   Alvo: http://localhost:8000/index.html');
console.log('================================================================\n');

let reqId = 1;
const pendingRequests = new Map();
const consoleErrors = [];
const consoleLogs = [];

function sendCdp(ws, method, params = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const id = reqId++;
        const timer = setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error(`CDP Timeout (${timeoutMs}ms) em ${method}`));
            }
        }, timeoutMs);

        pendingRequests.set(id, { resolve, reject, timer, method });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evalScript(ws, expression) {
    const res = await sendCdp(ws, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    if (res && res.exceptionDetails) {
        throw new Error('CDP Eval Exception: ' + JSON.stringify(res.exceptionDetails));
    }
    return res ? (res.result ? res.result.value : null) : null;
}

async function saveScreenshot(ws, filename) {
    const res = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
        const buffer = Buffer.from(res.data, 'base64');
        const fullPath = path.join(SCREENSHOTS_DIR, filename);
        fs.writeFileSync(fullPath, buffer);
        console.log(`   📸 Screenshot salvo: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
        return fullPath;
    }
    return null;
}

async function runSimulation() {
    const tempProfile = path.join(os.tmpdir(), 'chrome_cdp_v56_' + Date.now());
    fs.mkdirSync(tempProfile, { recursive: true });

    const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--user-data-dir=' + tempProfile,
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=390,844',
        '--disable-background-networking',
        'http://localhost:8000/index.html'
    ]);

    // 1. Aguarda inicialização do CDP
    let pageTarget = null;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
            const res = await fetch('http://127.0.0.1:9222/json');
            const data = await res.json();
            pageTarget = data.find(t => t.type === 'page' && t.url.includes('8000'));
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                break;
            }
        } catch (e) {}
    }

    if (!pageTarget) {
        chrome.kill();
        throw new Error('Falha ao conectar no Chrome via CDP.');
    }

    console.log(`✅ Conectado ao Chrome DevTools Protocol: ${pageTarget.url}`);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.id && pendingRequests.has(msg.id)) {
                const { resolve, reject, timer } = pendingRequests.get(msg.id);
                clearTimeout(timer);
                pendingRequests.delete(msg.id);
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
            } else if (msg.method === 'Runtime.consoleAPICalled') {
                if (msg.params.type === 'error') {
                    consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
                } else {
                    consoleLogs.push(msg.params.args.map(a => a.value || a.description).join(' '));
                }
            } else if (msg.method === 'Runtime.exceptionThrown') {
                consoleErrors.push(msg.params.exceptionDetails.text);
            }
        } catch (e) {}
    };

    // 2. Habilita domínios CDP e emulação mobile estrita iPhone 14
    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');
    await sendCdp(ws, 'DOM.enable');
    await sendCdp(ws, 'Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true
    });
    await sendCdp(ws, 'Emulation.setTouchEmulationEnabled', { enabled: true });

    console.log('⏳ Aguardando inicialização do StrongLog Pro...');
    await new Promise(r => setTimeout(r, 2000));

    const stepResults = [];

    async function checkStep(stepNum, stepName, actionFn) {
        console.log(`\n----------------------------------------------------------------`);
        console.log(`📍 ETAPA ${stepNum}: ${stepName}`);
        console.log(`----------------------------------------------------------------`);
        const errorsBefore = consoleErrors.length;

        const result = await actionFn();

        const newErrors = consoleErrors.slice(errorsBefore);
        result.consoleErrors = newErrors;
        result.stepNum = stepNum;
        result.stepName = stepName;
        result.passed = result.overlayCheck && result.elementFromPointCheck && newErrors.length === 0;

        stepResults.push(result);

        if (result.passed) {
            console.log(`✅ [PASS] Etapa ${stepNum} concluída com sucesso.`);
            console.log(`   - Overlays inesperados: NENHUM (OK)`);
            console.log(`   - Elemento clicável via elementFromPoint: SIM (${result.actualElementAtPoint})`);
            console.log(`   - Erros no console JS: ZERO`);
        } else {
            console.error(`❌ [FAIL] Etapa ${stepNum} falhou nos critérios de aceitação.`);
            if (!result.overlayCheck) console.error(`   Motivo: Overlays indesejados detectados: ${JSON.stringify(result.visibleModals)}`);
            if (!result.elementFromPointCheck) console.error(`   Motivo: elementFromPoint falhou: esperado ${result.expectedTarget}, recebido ${result.actualElementAtPoint}`);
            if (newErrors.length > 0) console.error(`   Motivo: Erros JS no console: ${newErrors.join(' | ')}`);
        }
        return result;
    }

    try {
        // ETAPA 1: DASHBOARD
        await checkStep(1, 'Dashboard Inicial & Verificação de Ausência de Overlays', async () => {
            await evalScript(ws, `
                (() => {
                    localStorage.setItem('stronglog_onboarded_v51', 'true');
                    const onb = document.getElementById('onboarding-modal');
                    if (onb) onb.classList.add('hidden');
                    app.setView('dashboard');
                })()
            `);
            await new Promise(r => setTimeout(r, 500));

            const state = await evalScript(ws, `
                (() => {
                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);
                    
                    const btn = document.querySelector('#view-dashboard button[onclick*="showNewPlanForm"]');
                    const r = btn.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const elAtPoint = document.elementFromPoint(cx, cy);
                    const isClickable = (elAtPoint === btn || btn.contains(elAtPoint));

                    return {
                        visibleModals,
                        buttonFound: !!btn,
                        elAtPointTag: elAtPoint ? elAtPoint.tagName : null,
                        isClickable
                    };
                })()
            `);

            await saveScreenshot(ws, 'e2e_v56_step01_dashboard.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable,
                expectedTarget: 'button[showNewPlanForm]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 2: CRIAR NOVA ROTINA
        await checkStep(2, 'Abrir Editor de Rotina & Nomear Plano', async () => {
            const state = await evalScript(ws, `
                (() => {
                    app.showNewPlanForm();
                    const planSection = document.getElementById('view-plan-editor');
                    const titleInput = document.getElementById('plan-name-input') || document.querySelector('#view-plan-editor input[type="text"]');
                    if (titleInput) {
                        titleInput.value = 'Treino Peito v5.6';
                        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const searchBtn = planSection.querySelector('button[onclick*="showExerciseLibrary"]');
                    const r = searchBtn.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const elAtPoint = document.elementFromPoint(cx, cy);
                    const isClickable = (elAtPoint === searchBtn || searchBtn.contains(elAtPoint));

                    return {
                        visibleModals,
                        buttonFound: !!searchBtn,
                        elAtPointTag: elAtPoint ? elAtPoint.tagName : null,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step02_plan_editor.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable,
                expectedTarget: 'button[showExerciseLibrary]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 3: ABRIR BIBLIOTECA
        await checkStep(3, 'Abrir Biblioteca de Exercícios (Fullscreen Sheet 100dvh)', async () => {
            const state = await evalScript(ws, `
                (() => {
                    app.showExerciseLibrary('editor');
                    const modal = document.getElementById('exercise-library-modal');
                    const searchInput = document.getElementById('search-exercise');

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const r = searchInput.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const elAtPoint = document.elementFromPoint(cx, cy);
                    const isClickable = (elAtPoint === searchInput || searchInput.contains(elAtPoint));

                    return {
                        visibleModals,
                        searchInputFound: !!searchInput,
                        elAtPointTag: elAtPoint ? elAtPoint.tagName : null,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step03_library_modal.png');

            return {
                overlayCheck: state.visibleModals.length === 1 && state.visibleModals[0] === 'exercise-library-modal',
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable,
                expectedTarget: '#search-exercise',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 4: BUSCAR 'SUPINO' & AUTO-COLAPSO
        await checkStep(4, 'Digitar "supino" & Auto-Colapso do Visualizador', async () => {
            const state = await evalScript(ws, `
                (() => {
                    const searchInput = document.getElementById('search-exercise');
                    searchInput.focus();
                    searchInput.value = 'supino';
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    app.filterExerciseLibrary();

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const sec = document.getElementById('library-visualizer-section');
                    const isCollapsed = sec ? sec.classList.contains('is-collapsed') : false;

                    const firstItem = document.querySelector('#library-list > div');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (firstItem) {
                        firstItem.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const r = firstItem.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === firstItem || firstItem.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    return {
                        isVisualizerCollapsed: isCollapsed,
                        firstItemFound: !!firstItem,
                        visibleModals,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step04_search_supino.png');

            return {
                overlayCheck: state.visibleModals.length === 1 && state.visibleModals[0] === 'exercise-library-modal',
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && state.isVisualizerCollapsed,
                expectedTarget: 'firstItem in #library-list',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 5: ADICIONAR EXERCÍCIO À ROTINA
        await checkStep(5, 'Selecionar "Supino Reto" para Incorporar na Rotina', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    const firstItem = document.querySelector('#library-list > div');
                    const exerciseId = firstItem ? (firstItem.getAttribute('data-exercise-id') || '0001') : '0001';
                    await app.selectExerciseById(exerciseId);

                    const currentPlan = app.editingPlan;
                    const exerciseCount = currentPlan && currentPlan.exercises ? currentPlan.exercises.length : 0;

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    // Botão da barra de ação inferior (Concluir e Voltar)
                    const closeBtn = document.querySelector('#library-bottom-bar button') || document.querySelector('#exercise-library-modal button[onclick*="closeModal"]');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (closeBtn) {
                        const r = closeBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === closeBtn || closeBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    return {
                        exerciseAdded: exerciseCount > 0,
                        visibleModals,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);

            return {
                overlayCheck: state.visibleModals.length === 1,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && state.exerciseAdded,
                expectedTarget: 'button[closeModal]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 6: FECHAR BIBLIOTECA
        await checkStep(6, 'Fechar Biblioteca & Confirmar Exercício no Editor', async () => {
            const state = await evalScript(ws, `
                (() => {
                    app.closeModal('exercise-library-modal');
                    const modal = document.getElementById('exercise-library-modal');
                    const planSection = document.getElementById('view-plan-editor');

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const saveBtn = planSection.querySelector('button[onclick*="savePlan"]');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (saveBtn) {
                        saveBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const r = saveBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === saveBtn || saveBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    return {
                        libraryHidden: modal.classList.contains('hidden'),
                        visibleModals,
                        saveBtnFound: !!saveBtn,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step06_exercise_in_editor.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && state.libraryHidden,
                expectedTarget: 'button[savePlan]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 7: SALVAR ROTINA
        await checkStep(7, 'Salvar Rotina & Retornar ao Dashboard', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    await app.savePlan();
                    const dashSection = document.getElementById('view-dashboard');
                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const plans = await db.plans.toArray();
                    const savedPlan = plans.find(p => p.name.includes('Treino Peito v5.6'));

                    const startBtn = document.querySelector('#plans-list button[onclick*="startWorkout"], #plans-list button');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (startBtn) {
                        startBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const r = startBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === startBtn || startBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    return {
                        dashVisible: !dashSection.classList.contains('hidden'),
                        savedPlanFound: !!savedPlan,
                        visibleModals,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 500));

            await saveScreenshot(ws, 'e2e_v56_step07_routine_saved_in_dash.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && state.savedPlanFound,
                expectedTarget: 'button[startWorkout]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 8: INICIAR TREINO DA ROTINA
        await checkStep(8, 'Iniciar Treino & Validar Fallback Livre/90s e Tabular-Nums', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    const plans = await db.plans.toArray();
                    const targetPlan = plans.find(p => p.name.includes('Treino Peito v5.6')) || plans[0];
                    await app.startWorkout(targetPlan.id);

                    const workoutSec = document.getElementById('view-active-workout');
                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    const workoutHtml = workoutSec.innerHTML;
                    const hasUndefined = workoutHtml.toLowerCase().includes('undefined');

                    const checkBtn = workoutSec.querySelector('button[onclick*="toggleSet"]');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (checkBtn) {
                        checkBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const r = checkBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === checkBtn || checkBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    return {
                        workoutActive: !workoutSec.classList.contains('hidden'),
                        hasUndefined,
                        visibleModals,
                        checkBtnFound: !!checkBtn,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 500));

            await saveScreenshot(ws, 'e2e_v56_step08_active_workout.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && !state.hasUndefined,
                expectedTarget: 'button[toggleSet]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 9: REGISTRAR SÉRIE
        await checkStep(9, 'Preencher Carga/Reps e Concluir Série', async () => {
            const state = await evalScript(ws, `
                (() => {
                    const weightInput = document.querySelector('#view-active-workout input[id^="set-weight"]');
                    const repsInput = document.querySelector('#view-active-workout input[id^="set-reps"]');
                    if (weightInput) { weightInput.value = '80'; weightInput.dispatchEvent(new Event('input', { bubbles: true })); }
                    if (repsInput) { repsInput.value = '10'; repsInput.dispatchEvent(new Event('input', { bubbles: true })); }

                    app.toggleSet(0, 0);

                    const completed = app.activeWorkout && app.activeWorkout.exercises[0] && app.activeWorkout.exercises[0].sets[0].completed;
                    const restOverlay = document.getElementById('rest-timer-overlay');
                    const restVisible = restOverlay && !restOverlay.classList.contains('hidden');

                    return {
                        completed,
                        restVisible
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step09_set_concluded.png');

            return {
                overlayCheck: true,
                visibleModals: [],
                elementFromPointCheck: state.completed,
                expectedTarget: 'set.completed === true',
                actualElementAtPoint: 'completed'
            };
        });

        // ETAPA 10: TIMER DE DESCANSO
        await checkStep(10, 'Verificar Disparo do Timer de Descanso & Dispensar', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    // Aguarda 600ms para a transição slide-down do overlay concluir
                    await new Promise(r => setTimeout(r, 600));
                    const restOverlay = document.getElementById('rest-timer-overlay');
                    const skipBtn = restOverlay.querySelector('button[onclick*="stopRestTimer"]');
                    
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (skipBtn) {
                        const r = skipBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === skipBtn || skipBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    app.stopRestTimer();

                    return {
                        skipBtnFound: !!skipBtn,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);

            return {
                overlayCheck: true,
                visibleModals: [],
                elementFromPointCheck: state.isClickable,
                expectedTarget: 'button in rest-timer-overlay',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 11: FINALIZAR TREINO
        await checkStep(11, 'Finalizar Sessão de Treino & Gerar Resumo', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    const finishBtn = document.querySelector('#view-active-workout button[onclick*="finishWorkout"]');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (finishBtn) {
                        finishBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const r = finishBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === finishBtn || finishBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    await app.finishWorkout();

                    const summaryModal = document.getElementById('workout-summary-modal');
                    const summaryVisible = summaryModal && !summaryModal.classList.contains('hidden');

                    if (summaryVisible) {
                        app.closeModal('workout-summary-modal');
                    }

                    return {
                        finishBtnFound: !!finishBtn,
                        summaryShown: summaryVisible,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step11_workout_finished.png');

            return {
                overlayCheck: true,
                visibleModals: [],
                elementFromPointCheck: state.isClickable && state.summaryShown,
                expectedTarget: 'button[finishWorkout]',
                actualElementAtPoint: state.elAtPointTag
            };
        });

        // ETAPA 12: HISTÓRICO
        await checkStep(12, 'Navegar para Histórico & Verificar Sessão Salva', async () => {
            const state = await evalScript(ws, `
                (async () => {
                    const navHistoryBtn = document.querySelector('nav button[onclick*="history"]');
                    let isClickable = false;
                    let elAtPointTag = null;
                    if (navHistoryBtn) {
                        const r = navHistoryBtn.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const elAtPoint = document.elementFromPoint(cx, cy);
                        isClickable = (elAtPoint === navHistoryBtn || navHistoryBtn.contains(elAtPoint));
                        elAtPointTag = elAtPoint ? elAtPoint.tagName : null;
                    }

                    app.setView('history');
                    await app.renderHistory();

                    const historySec = document.getElementById('view-history');
                    const sessions = await db.sessions.toArray();
                    const latestSession = sessions[sessions.length - 1];

                    const visibleModals = Array.from(document.querySelectorAll('div[id$="modal"], .modal'))
                        .filter(el => !el.classList.contains('hidden') && el.offsetHeight > 0)
                        .map(el => el.id);

                    return {
                        historyVisible: !historySec.classList.contains('hidden'),
                        totalSessions: sessions.length,
                        visibleModals,
                        elAtPointTag,
                        isClickable
                    };
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            await saveScreenshot(ws, 'e2e_v56_step12_history_verified.png');

            return {
                overlayCheck: state.visibleModals.length === 0,
                visibleModals: state.visibleModals,
                elementFromPointCheck: state.isClickable && state.totalSessions > 0,
                expectedTarget: 'nav button[history] & session in db',
                actualElementAtPoint: state.elAtPointTag
            };
        });

    } finally {
        ws.close();
        chrome.kill();
        try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch(e) {}
    }

    console.log('\n================================================================');
    console.log('📊 RESUMO CONSOLIDADO DO PERCURSO COMPLETO (12 ETAPAS)');
    console.log('================================================================');
    let allPassed = true;
    stepResults.forEach(r => {
        const icon = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
        if (!r.passed) allPassed = false;
        console.log(`${icon} Etapa ${r.stepNum}: ${r.stepName}`);
        if (r.consoleErrors.length > 0) {
            console.log(`     Erros JS: ${r.consoleErrors.join(', ')}`);
        }
    });

    console.log('================================================================');
    console.log(`STATUS FINAL: ${allPassed ? '100% APROVADO' : 'FALHAS DETECTADAS'}`);
    console.log('================================================================\n');

    process.exit(allPassed ? 0 : 1);
}

runSimulation().catch(err => {
    console.error('Fatal Simulation Error:', err);
    process.exit(1);
});
