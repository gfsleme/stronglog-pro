// StrongLog Pro v5.6 - UX Ergonomics, Interactive Guidance & 3D Sci-Fi Engine
const APP_VERSION = 'v5.6';
let swRegistration = null;
let waitingWorker = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
            swRegistration = reg;
            console.log(`[App] SW ${APP_VERSION} registrado com sucesso`);
            
            // Verifica se há worker em espera (waiting)
            if (reg.waiting) {
                waitingWorker = reg.waiting;
                app.showUpdateAvailableBanner();
            }

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        waitingWorker = newWorker;
                        console.log('[App] Nova versão pronta para ativação!');
                        app.showUpdateAvailableBanner();
                    }
                });
            });

            // Polling de verificação periódica a cada 30 minutos
            setInterval(() => { reg.update().catch(()=>{}); }, 30 * 60 * 1000);
        }).catch(err => console.error('[App] Erro ao registrar SW:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log('[App] Service Worker assumiu o controle. Recarregando...');
            window.location.reload();
        }
    });
}

const db = new Dexie("StrongLog_v4_Pro");
db.version(4).stores({ 
    plans: '++id, name', 
    sessions: '++id, planName, date', 
    templates: '++id, name, body_part, equipment, target, primary_muscle_group',
    records: 'name' // Exercise name as key
});

const app = {
    activeWorkout: null,
    editingPlan: { name: '', exercises: [] },
    get currentEditingPlan() { return app.editingPlan; },
    set currentEditingPlan(v) { app.editingPlan = v; },
    timerInterval: null,
    startTime: null,
    templates: [],
    customExercises: [],
    restTimerInterval: null,
    restRemainingTime: 0,
    restTotalTime: 90,
    libraryContext: 'library',
    exerciseFilterDebounce: null,
    currentDetailTab: 'steps',
    muscleOntology: null,
    graphicMode: localStorage.getItem('stronglog_graphic_mode') || 'tier_0',
    threeScenes: {},
    libraryViewMode: 'list',
    isVisualizerCollapsed: false,
    activeSvgView: 'anterior',
    svgActiveView: 'anterior',
    summaryHeatmapMode: '3d',
    wakeLockSentinel: null,
    onboardingCurrentSlide: 0,
    currentHelpTab: 'guide',
    activeSetPickerTarget: { exI: 0, sI: 0 },
    activeRpePickerTarget: { exI: 0, sI: 0 },

    init: async () => {
        app.updateDate();
        const verEl = document.getElementById('pwa-version-display');
        if (verEl) verEl.innerText = APP_VERSION;
        
        await app.loadMuscleOntology();
        await app.seedTemplates();
        await app.rebuildRecords();
        await app.renderPlans();
        await app.renderHistory();
        app.checkActiveWorkoutRecovery();
        app.initCharts();
        app.initGraphicTier();
        app.initModalBackdrops();
        if (app.isOnboarded()) {
            const onboardingEl = document.getElementById('onboarding-modal');
            if (onboardingEl) onboardingEl.classList.add('hidden');
        } else {
            app.checkOnboarding();
        }
        lucide.createIcons();
    },

    initModalBackdrops: () => {
        const modalIds = [
            'records-modal',
            'exercise-library-modal',
            'exercise-detail-modal',
            'workout-summary-modal',
            'custom-exercise-modal',
            'settings-modal',
            'confirm-dialog-modal',
            'help-modal',
            'onboarding-modal',
            'set-type-picker-modal',
            'rpe-picker-modal'
        ];
        
        modalIds.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                let pointerStartedInsideCard = false;

                const checkInside = (e) => {
                    const isCardOrCanvasOrSvg = !!(
                        e.target.closest('.glass') || 
                        e.target.closest('.modal-content') || 
                        e.target.closest('canvas') || 
                        e.target.closest('svg') || 
                        e.target.closest('#library-3d-container') || 
                        e.target.closest('#library-map-container') ||
                        e.target.closest('#summary-3d-container') ||
                        e.target.closest('#summary-2d-container')
                    );
                    return isCardOrCanvasOrSvg || e.target !== modal;
                };

                modal.addEventListener('pointerdown', (e) => {
                    pointerStartedInsideCard = checkInside(e);
                }, { passive: true });

                modal.addEventListener('touchstart', (e) => {
                    pointerStartedInsideCard = checkInside(e);
                }, { passive: true });

                modal.addEventListener('mousedown', (e) => {
                    pointerStartedInsideCard = checkInside(e);
                }, { passive: true });

                modal.addEventListener('click', (e) => {
                    if (pointerStartedInsideCard) {
                        pointerStartedInsideCard = false;
                        return;
                    }
                    const contentCard = e.target.closest('.glass') || e.target.closest('.modal-content') || e.target.closest('canvas') || e.target.closest('svg');
                    if (!contentCard && e.target === modal) {
                        app.closeModal(id);
                    }
                    pointerStartedInsideCard = false;
                });
            }
        });
    },

    loadMuscleOntology: async () => {
        try {
            const res = await fetch('./data/muscle_ontology.json');
            if (res.ok) {
                app.muscleOntology = await res.json();
            }
        } catch(e) {
            console.warn('[App] Ontologia carregada com fallback local:', e);
        }
    },

    initGraphicTier: () => {
        const tier = app.detectDeviceTier();
        const badge = document.getElementById('tier-badge');
        const select = document.getElementById('setting-graphic-mode');
        if (badge) {
            const label = app.graphicMode === 'tier_0' ? 'Tier 0 (60 FPS)' : (app.graphicMode === 'tier_1' ? 'Tier 1 (Econômico)' : 'Tier 2 (2D Puro)');
            badge.innerText = label;
        }
        if (select) select.value = app.graphicMode || tier;
    },

    detectDeviceTier: () => {
        const memory = navigator.deviceMemory || 4;
        const isSaveData = navigator.connection?.saveData || false;
        if (isSaveData || memory < 2) return 'tier_2';
        if (memory < 4) return 'tier_1';
        return 'tier_0';
    },

    setGraphicMode: (mode) => {
        app.graphicMode = mode;
        localStorage.setItem('stronglog_graphic_mode', mode);
        app.initGraphicTier();
        app.toast(`Modo gráfico alterado para ${mode.toUpperCase()}`, 'info');
        
        // Re-render current visualizer if active
        if (app.libraryViewMode === '3d') {
            app.init3DScene('library-3d-canvas', null, true, 'library');
        }
    },

    requestWakeLock: async () => {
        if ('wakeLock' in navigator) {
            try {
                app.wakeLockSentinel = await navigator.wakeLock.request('screen');
                app.updateWakeLockUI(true);
                app.wakeLockSentinel.addEventListener('release', () => {
                    app.updateWakeLockUI(false);
                });
                console.log('[WakeLock] Tela ativa durante o treino.');
            } catch (err) {
                console.log('[WakeLock] Não disponível ou bloqueado:', err);
                app.updateWakeLockUI(false);
            }
        }
    },

    releaseWakeLock: async () => {
        if (app.wakeLockSentinel) {
            try {
                await app.wakeLockSentinel.release();
            } catch(e) {}
            app.wakeLockSentinel = null;
            app.updateWakeLockUI(false);
            console.log('[WakeLock] Tela liberada.');
        }
    },

    updateWakeLockUI: (isActive) => {
        const el = document.getElementById('wakelock-indicator');
        if (el) {
            el.classList.toggle('hidden', !isActive);
        }
    },

    // Toast Notification System
    toast: (message, type = 'success', duration = 3200) => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'check-circle',
            info: 'info',
            warning: 'alert-triangle',
            error: 'x-circle'
        };
        const iconColors = {
            success: 'text-[#00FF9D]',
            info: 'text-blue-400',
            warning: 'text-amber-400',
            error: 'text-red-400'
        };

        const iconName = icons[type] || 'info';
        const iconColor = iconColors[type] || 'text-white';

        const toastEl = document.createElement('div');
        toastEl.className = `toast-item toast-${type}`;
        toastEl.innerHTML = `
            <div class="flex items-center gap-3">
                <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor} shrink-0"></i>
                <span class="text-xs font-bold text-white leading-tight">${app.sanitize(message)}</span>
            </div>
            <button onclick="this.parentElement.remove()" class="p-1 text-gray-500 hover:text-white"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        `;

        container.appendChild(toastEl);
        lucide.createIcons();

        setTimeout(() => {
            if (toastEl && toastEl.classList) {
                toastEl.classList.add('toast-out');
                setTimeout(() => { if (toastEl && typeof toastEl.remove === 'function') toastEl.remove(); }, 250);
            }
        }, duration);
    },

    // PWA Lifecycle & 1-Click Update
    showUpdateAvailableBanner: () => {
        const banner = document.getElementById('update-toast');
        if (banner) {
            banner.classList.remove('hidden');
            lucide.createIcons();
        }
        if (typeof app.toast === 'function') {
            app.toast('Nova versão v5.6 pronta para atualização!', 'info', 3500);
        }
    },

    applyPwaUpdate: () => {
        app.toast('Aplicando atualização mais recente...', 'info', 2000);
        if (waitingWorker) {
            waitingWorker.postMessage({ action: 'skipWaiting' });
        } else if (navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg && reg.waiting) {
                    reg.waiting.postMessage({ action: 'skipWaiting' });
                } else {
                    window.location.reload();
                }
            });
        } else {
            window.location.reload();
        }
    },

    checkForUpdates: async (isUserTriggered = false) => {
        if (!('serviceWorker' in navigator)) {
            app.toast('Service Worker não suportado neste navegador.', 'warning');
            return;
        }

        if (isUserTriggered) {
            app.toast('Buscando atualizações no servidor...', 'info', 2000);
        }

        try {
            const reg = swRegistration || await navigator.serviceWorker.getRegistration();
            if (reg) {
                await reg.update();
                if (reg.waiting || (reg.installing && reg.installing.state === 'installed')) {
                    waitingWorker = reg.waiting || reg.installing;
                    app.showUpdateAvailableBanner();
                    app.toast('🚀 Nova versão encontrada! Clique em Atualizar.', 'success', 4000);
                } else if (isUserTriggered) {
                    setTimeout(() => {
                        app.toast(`✅ Seu StrongLog já está na versão mais recente (${APP_VERSION})!`, 'success');
                    }, 600);
                }
            } else if (isUserTriggered) {
                window.location.reload();
            }
        } catch (err) {
            console.error('[Update] Erro ao verificar atualizações:', err);
            if (isUserTriggered) {
                app.toast('Não foi possível verificar no momento (modo offline).', 'warning');
            }
        }
    },

    forcePwaReload: () => {
        app.showConfirmDialog({
            title: 'Forçar Atualização Completa',
            subtitle: 'PWA Cache Clean',
            message: 'Isso irá limpar os arquivos temporários em cache e recarregar a aplicação para a última versão disponível. Seus treinos, históricos e planos salvos NÃO serão afetados.',
            confirmText: 'Atualizar Agora',
            cancelText: 'Voltar',
            isDanger: false,
            onConfirm: async () => {
                app.toast('Limpando cache de aplicação e recarregando...', 'info');
                try {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    if (navigator.serviceWorker) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map(r => r.unregister()));
                    }
                } catch (e) {
                    console.error('[PWA] Erro na limpeza forçada:', e);
                }
                setTimeout(() => {
                    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
                }, 400);
            }
        });
    },

    // Custom Glassmorphism Confirm Dialog
    showConfirmDialog: ({ title, subtitle = 'Atenção', message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = true, onConfirm }) => {
        const modal = document.getElementById('confirm-dialog-modal');
        const titleEl = document.getElementById('confirm-dialog-title');
        const subEl = document.getElementById('confirm-dialog-subtitle');
        const msgEl = document.getElementById('confirm-dialog-msg');
        const iconEl = document.getElementById('confirm-dialog-icon');
        const btnCancel = document.getElementById('confirm-dialog-btn-cancel');
        const btnConfirm = document.getElementById('confirm-dialog-btn-confirm');

        if (!modal) return;

        if (titleEl) titleEl.innerText = title;
        if (subEl) subEl.innerText = subtitle;
        if (msgEl) msgEl.innerText = message;
        if (btnCancel) btnCancel.innerText = cancelText;
        if (btnConfirm) {
            btnConfirm.innerText = confirmText;
            if (isDanger) {
                btnConfirm.className = 'p-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-all';
                if (iconEl) iconEl.className = 'p-3 rounded-xl bg-red-500/10 text-red-400';
            } else {
                btnConfirm.className = 'p-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[#00FF9D] text-black shadow-lg shadow-[#00FF9D]/20 active:scale-95 transition-all';
                if (iconEl) iconEl.className = 'p-3 rounded-xl bg-[#00FF9D]/10 text-[#00FF9D]';
            }
            btnConfirm.onclick = () => {
                app.closeModal('confirm-dialog-modal');
                if (onConfirm) onConfirm();
            };
        }

        modal.classList.remove('hidden');
        lucide.createIcons();
    },

    rebuildRecords: async () => {
        const count = await db.records.count();
        if (count > 0) return;

        console.log('[App] Reconstruindo recordes históricos...');
        const sessions = await db.sessions.toArray();
        const recs = {};
        
        sessions.forEach(s => {
            (s.exercises || []).forEach(ex => {
                const completedSets = (ex.sets || []).filter(x => x.completed && (parseFloat(x.weight) || 0) > 0 && (parseInt(x.reps) || 0) > 0);
                const bestSet = completedSets.sort((a, b) => app.calculate1RM(b.weight, b.reps) - app.calculate1RM(a.weight, a.reps))[0];
                if (bestSet) {
                    const best1RM = app.calculate1RM(bestSet.weight, bestSet.reps);
                    const existing1RM = recs[ex.name] ? app.calculate1RM(recs[ex.name].weight, recs[ex.name].reps) : 0;
                    if (!recs[ex.name] || best1RM > existing1RM) {
                        recs[ex.name] = { name: ex.name, weight: bestSet.weight, reps: bestSet.reps, date: s.date };
                    }
                }
            });
        });

        const recordsToSave = Object.values(recs);
        if (recordsToSave.length > 0) await db.records.bulkAdd(recordsToSave);
    },

    // Security: Sanitization
    sanitize: (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    updateDate: () => {
        const el = document.getElementById('current-date');
        if (el) el.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    },

    defaultExerciseTemplates: [
        { id: 1, name: 'Supino Reto com Barra', name_en: 'Barbell Bench Press', body_part: 'Peito', equipment: 'Barra', target: 'Peitoral', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders_front'] },
        { id: 2, name: 'Supino Inclinado com Halteres', name_en: 'Incline Dumbbell Press', body_part: 'Peito', equipment: 'Halter', target: 'Peitoral Superior', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps', 'shoulders_front'] },
        { id: 3, name: 'Crucifixo Reto com Halteres', name_en: 'Dumbbell Flyes', body_part: 'Peito', equipment: 'Halter', target: 'Peitoral', primary_muscle_group: 'chest', secondary_muscle_groups: ['shoulders_front'] },
        { id: 4, name: 'Puxada Frontal no Pulley', name_en: 'Lat Pulldown', body_part: 'Costas', equipment: 'Cabo', target: 'Dorsais', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps', 'upper_back'] },
        { id: 5, name: 'Remada Curvada com Barra', name_en: 'Bent Over Barbell Row', body_part: 'Costas', equipment: 'Barra', target: 'Costas Geral', primary_muscle_group: 'upper_back', secondary_muscle_groups: ['biceps', 'lats'] },
        { id: 6, name: 'Agachamento Livre com Barra', name_en: 'Barbell Back Squat', body_part: 'Pernas', equipment: 'Barra', target: 'Quadríceps', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes', 'hamstrings'] },
        { id: 7, name: 'Leg Press 45°', name_en: 'Leg Press 45', body_part: 'Pernas', equipment: 'Máquina', target: 'Quadríceps', primary_muscle_group: 'quads', secondary_muscle_groups: ['glutes'] },
        { id: 8, name: 'Levantamento Terra Convencional', name_en: 'Deadlift', body_part: 'Costas/Pernas', equipment: 'Barra', target: 'Posterior e Glúteos', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes', 'lower_back', 'traps'] },
        { id: 9, name: 'Desenvolvimento com Halteres', name_en: 'Dumbbell Shoulder Press', body_part: 'Ombros', equipment: 'Halter', target: 'Deltoide Anterior', primary_muscle_group: 'shoulders_front', secondary_muscle_groups: ['triceps', 'shoulders_side'] },
        { id: 10, name: 'Elevação Lateral com Halteres', name_en: 'Side Lateral Raise', body_part: 'Ombros', equipment: 'Halter', target: 'Deltoide Lateral', primary_muscle_group: 'shoulders_side', secondary_muscle_groups: ['traps'] },
        { id: 11, name: 'Rosca Direta com Barra W', name_en: 'EZ-Bar Curl', body_part: 'Braços', equipment: 'Barra', target: 'Bíceps', primary_muscle_group: 'biceps', secondary_muscle_groups: ['forearms'] },
        { id: 12, name: 'Tríceps Pulley Corda', name_en: 'Triceps Rope Pushdown', body_part: 'Braços', equipment: 'Cabo', target: 'Tríceps', primary_muscle_group: 'triceps', secondary_muscle_groups: [] },
        { id: 13, name: 'Abdominal Crunch no Solo', name_en: 'Crunch', body_part: 'Abdômen', equipment: 'Peso Corporal', target: 'Abdômen Reto', primary_muscle_group: 'abs', secondary_muscle_groups: [] },
        { id: 14, name: 'Panturrilha em Pé na Máquina', name_en: 'Standing Calf Raise', body_part: 'Pernas', equipment: 'Máquina', target: 'Gastrocnêmio', primary_muscle_group: 'calves', secondary_muscle_groups: [] }
    ],

    seedPromise: null,

    seedTemplates: async () => {
        if (app.seedPromise) return app.seedPromise;
        app.seedPromise = (async () => {
            try {
                const DATASET_VERSION = 'stronglog_dataset_v5.0';
                const currentVer = localStorage.getItem('stronglog_dataset_version');
                const count = await db.templates.count();
                
                if (currentVer !== DATASET_VERSION || count < 100) {
                    console.log('[App] Atualizando base científica de 1.324 exercícios desambiguados com ontologia 3D...');
                    if (count > 0) await db.templates.clear();
                    
                    let data = null;
                    try {
                        const res = await fetch('./data/exercises.min.json');
                        if (res.ok) data = await res.json();
                    } catch (fetchErr) {
                        console.warn('[App] Fetch relativo falhou, tentando rota raiz:', fetchErr);
                    }
                    
                    if (!data || !data.length) {
                        try {
                            const resRoot = await fetch('/data/exercises.min.json');
                            if (resRoot.ok) data = await resRoot.json();
                        } catch (e) {}
                    }
                    
                    if (data && data.length) {
                        await db.templates.bulkAdd(data);
                        localStorage.setItem('stronglog_dataset_version', DATASET_VERSION);
                        console.log(`[App] ${data.length} exercícios semeados com sucesso!`);
                    } else {
                        console.warn('[App] JSON externo inacessível, utilizando base default local.');
                        await db.templates.bulkAdd(app.defaultExerciseTemplates);
                    }
                }
            } catch (err) {
                console.error('[App] Erro no seed de exercícios:', err);
                const count = await db.templates.count();
                if (count === 0) {
                    await db.templates.bulkAdd(app.defaultExerciseTemplates);
                }
            }
        })();
        return app.seedPromise;
    },

    setView: (view) => {
        document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
        const el = document.getElementById(`view-${view}`);
        if (el) el.classList.remove('hidden');
        
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.remove('active');
            if(i.dataset.view === view) i.classList.add('active');
        });

        if (view === 'active-workout') {
            const hasActiveWorkout = app.activeWorkout && app.activeWorkout.exercises && app.activeWorkout.exercises.length > 0;
            const inactiveCard = document.getElementById('workout-inactive-card');
            const activeContent = document.getElementById('workout-active-content');
            if (inactiveCard && activeContent) {
                if (hasActiveWorkout) {
                    inactiveCard.classList.add('hidden');
                    activeContent.classList.remove('hidden');
                } else {
                    inactiveCard.classList.remove('hidden');
                    activeContent.classList.add('hidden');
                }
            }
        }

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo(0,0);
        }
    },

    showPlanEditor: () => app.showNewPlanForm(),

    showCustomExerciseForm: () => {
        const nameInput = document.getElementById('custom-ex-name');
        if (nameInput) nameInput.value = '';
        document.getElementById('custom-exercise-modal').classList.remove('hidden');
    },

    saveCustomExerciseFromModal: async () => {
        const nameInput = document.getElementById('custom-ex-name');
        const name = nameInput ? nameInput.value.trim() : '';
        const groupSelect = document.getElementById('custom-ex-group').value;
        if (!name) {
            app.toast('Informe o nome do exercício.', 'warning');
            return;
        }
        
        const customId = `custom_${Date.now()}`;
        const primaryGroup = app.inferMuscleGroupLocal(name, groupSelect);
        await db.templates.add({
            id: customId,
            name: app.sanitize(name),
            name_en: name,
            body_part: groupSelect,
            equipment: 'Personalizado',
            target: groupSelect,
            primary_muscle_group: primaryGroup,
            secondary_muscles: [],
            secondary_muscle_groups: [],
            media_id: '',
            instruction_steps: ['Exercício adicionado manualmente pelo usuário.']
        });
        
        app.closeModal('custom-exercise-modal');
        app.filterExerciseLibrary();
        app.toast(`"${name}" cadastrado com sucesso!`, 'success');
    },

    deleteTemplate: (id) => {
        app.showConfirmDialog({
            title: 'Excluir Exercício',
            subtitle: 'Biblioteca',
            message: 'Tem certeza que deseja apagar este exercício customizado permanentemente?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            isDanger: true,
            onConfirm: async () => {
                await db.templates.delete(id);
                app.filterExerciseLibrary();
                app.toast('Exercício removido da biblioteca.', 'info');
            }
        });
    },

    showExerciseManager: () => {
        app.libraryContext = 'manager';
        app.showExerciseLibrary('manager');
    },

    renderPlans: async () => {
        const plans = await db.plans.toArray();
        const list = document.getElementById('workout-list');
        const plansList = document.getElementById('plans-list');
        const targetContainer = plansList || list;
        if (!targetContainer) return;

        const plansHtml = plans.length ? plans.map(p => `
            <div class="glass p-5 rounded-2xl flex justify-between items-center active:scale-[0.98] transition-all animate-fade bg-white/[0.01]">
                <div class="flex-1 cursor-pointer pr-2" onclick="app.startWorkout(${p.id})">
                    <h3 class="font-black text-lg tracking-tighter italic uppercase text-white">${app.sanitize(p.name)}</h3>
                    <p class="text-[9px] text-[#00FF9D]/80 font-black uppercase tracking-[0.2em] mt-1">${(p.exercises || []).length} EXERCÍCIOS · TOQUE P/ TREINAR</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="app.startWorkout(${p.id})" class="bg-[#00FF9D] text-black text-[10px] font-black py-2.5 px-3.5 rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-[#00FF9D]/20 flex items-center gap-1 shrink-0" title="Iniciar Treino"><i data-lucide="play" class="w-3.5 h-3.5"></i> Treinar</button>
                    <button onclick="app.editPlan(${p.id})" class="p-3 glass text-gray-400 hover:text-white active:scale-90" title="Editar Rotina"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="app.deletePlan(${p.id})" class="p-3 glass text-red-500/50 hover:text-red-500 active:scale-90" title="Excluir Rotina"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `).join('') : `
            <div class="glass p-6 text-center space-y-4 rounded-3xl border-dashed border-2 border-white/10 bg-white/[0.01]">
                <div class="w-12 h-12 rounded-2xl bg-[#00FF9D]/10 border border-[#00FF9D]/20 flex items-center justify-center mx-auto text-[#00FF9D]">
                    <i data-lucide="book-open" class="w-6 h-6"></i>
                </div>
                <div class="space-y-1">
                    <h4 class="font-black text-sm uppercase italic tracking-tight text-white">Nenhuma Rotina Criada</h4>
                    <p class="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">Você pode iniciar um <b>Treino Livre</b> avulso a qualquer momento ou criar uma rotina personalizada com exercícios catalogados.</p>
                </div>
                <div class="flex flex-wrap justify-center gap-2 pt-1">
                    <button id="btn-create-first-plan" data-action="new-plan" onclick="app.showNewPlanForm()" class="bg-[#00FF9D] text-black text-[10px] font-black min-h-[44px] py-2.5 px-4 rounded-xl uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-[#00FF9D]/20 flex items-center justify-center">+ Criar Primeira Rotina</button>
                    <button onclick="app.startFreeWorkout()" class="glass text-white text-[10px] font-black py-2.5 px-4 rounded-xl uppercase tracking-wider active:bg-white/10 transition-all">⚡ Treino Livre</button>
                    <button onclick="app.showHelpModal()" class="glass text-[#00FF9D] text-[10px] font-black py-2.5 px-4 rounded-xl uppercase tracking-wider active:bg-white/10 transition-all">📖 Guia de Uso</button>
                </div>
            </div>
        `;

        targetContainer.innerHTML = plansHtml;
        lucide.createIcons();
    },

    startFreeWorkout: () => {
        app.activeWorkout = {
            id: null,
            name: 'Treino Livre',
            startTime: Date.now(),
            exercises: []
        };
        app.startTime = app.activeWorkout.startTime;
        const nameEl = document.getElementById('active-workout-name');
        if (nameEl) nameEl.innerText = 'Treino Livre';
        
        const inactiveCard = document.getElementById('workout-inactive-card');
        const activeContent = document.getElementById('workout-active-content');
        if (inactiveCard) inactiveCard.classList.add('hidden');
        if (activeContent) activeContent.classList.remove('hidden');

        app.renderWorkout();
        app.saveActiveWorkoutState();
        app.setView('active-workout');
        app.startTimer();
        app.requestWakeLock();
        app.showExerciseLibrary('workout');
        app.toast('Treino Livre iniciado! Escolha seus exercícios.', 'info', 2500);
    },

    showNewPlanForm: () => {
        app.editingPlan = { name: '', exercises: [] };
        document.getElementById('plan-name-input').value = '';
        document.getElementById('plan-editor-title').innerText = 'Nova Rotina';
        app.renderEditorExercises();
        app.setView('plan-editor');
    },

    editPlan: async (id) => {
        app.editingPlan = await db.plans.get(id);
        document.getElementById('plan-name-input').value = app.editingPlan.name;
        document.getElementById('plan-editor-title').innerText = 'Editar Rotina';
        app.renderEditorExercises();
        app.setView('plan-editor');
    },

    renderEditorExercises: () => {
        const list = document.getElementById('selected-exercises-list');
        if (!list) return;

        list.innerHTML = app.editingPlan.exercises.map((ex, i) => `
            <div class="glass p-5 flex justify-between items-center animate-fade bg-white/[0.01]">
                <span class="font-black text-xs uppercase tracking-tight text-gray-300">${app.sanitize(ex)}</span>
                <button onclick="app.editingPlan.exercises.splice(${i},1); app.renderEditorExercises()" class="text-red-500/40 p-1 active:text-red-500"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    },

    deletePlan: (id) => {
        app.showConfirmDialog({
            title: 'Excluir Rotina',
            subtitle: 'Gerenciador de Planos',
            message: 'Deseja apagar esta rotina de treino permanentemente?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            isDanger: true,
            onConfirm: async () => {
                await db.plans.delete(id);
                app.setView('dashboard');
                app.renderPlans();
                app.toast('Rotina excluída.', 'info');
            }
        });
    },

    closePlanEditor: () => {
        const editor = document.getElementById('view-plan-editor');
        if (editor) editor.classList.add('hidden');
        app.setView('dashboard');
    },

    savePlan: async () => {
        const nameInput = document.getElementById('plan-name-input');
        const rawName = nameInput ? nameInput.value.trim() : '';
        const name = rawName || 'Minha Rotina';
        
        if (!app.editingPlan) {
            app.editingPlan = { name: '', exercises: [] };
        }
        if (!app.editingPlan.exercises) {
            app.editingPlan.exercises = [];
        }
        
        app.editingPlan.name = name;
        
        try {
            if (typeof db !== 'undefined') {
                if (db.plans) {
                    if (app.editingPlan.id) {
                        await db.plans.put(app.editingPlan);
                    } else {
                        const newId = await db.plans.add(app.editingPlan);
                        app.editingPlan.id = newId;
                    }
                }
                if (db.templates) {
                    try {
                        await db.templates.put({
                            id: 'plan_' + (app.editingPlan.id || Date.now()),
                            name: name,
                            body_part: 'Rotina',
                            equipment: 'Misto',
                            target: 'Geral',
                            primary_muscle_group: 'chest',
                            isPlan: true,
                            exercises: app.editingPlan.exercises
                        });
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.error('[App] Erro ao persistir rotina no banco:', err);
        }
        
        // Garante que o editor é fechado e retorna ao dashboard
        app.closePlanEditor();
        if (typeof app.renderPlans === 'function') {
            await app.renderPlans();
        }
        app.toast(`Rotina "${name}" salva com sucesso!`, 'success');
    },

    calculate1RM: (weight, reps) => {
        const w = parseFloat(weight) || 0;
        const r = parseInt(reps) || 0;
        if (w <= 0 || r <= 0) return 0;
        if (r === 1) return Math.round(w);
        return Math.round(w * (1 + r / 30));
    },

    calculateEffectiveVolume: (weight, reps, isPrimary = true) => {
        const w = parseFloat(weight) || 0;
        const r = parseInt(reps) || 0;
        if (w <= 0 || r <= 0) return 0;
        const rawVol = w * r;
        return isPrimary ? rawVol : Math.round(rawVol * 0.4);
    },

    calculateWorkoutMuscleRecruitment: async (exercises) => {
        const templates = await db.templates.toArray();
        const templateMap = Object.fromEntries(templates.map(t => [t.name, t]));
        
        const volumeByGroup = {};
        let totalEffectiveVolume = 0;

        for (const ex of exercises) {
            const tmpl = templateMap[ex.name] || {};
            const primaryGroup = tmpl.primary_muscle_group || app.inferMuscleGroupLocal(ex.name, ex.muscleGroup || ex.body_part) || 'other';
            const secondaryGroups = tmpl.secondary_muscle_groups || [];

            for (const set of (ex.sets || [])) {
                if (!set.completed) continue;
                const setWeight = parseFloat(set.weight) || 0;
                const setReps = parseInt(set.reps) || 0;
                if (setWeight <= 0 || setReps <= 0) continue;

                const primaryVol = app.calculateEffectiveVolume(setWeight, setReps, true);
                if (primaryVol > 0) {
                    volumeByGroup[primaryGroup] = (volumeByGroup[primaryGroup] || 0) + primaryVol;
                    totalEffectiveVolume += primaryVol;
                }

                for (const secGroup of secondaryGroups) {
                    const secVol = app.calculateEffectiveVolume(setWeight, setReps, false);
                    if (secVol > 0) {
                        volumeByGroup[secGroup] = (volumeByGroup[secGroup] || 0) + secVol;
                        totalEffectiveVolume += secVol;
                    }
                }
            }
        }

        const maxVol = Math.max(...Object.values(volumeByGroup), 0);
        const heatLevels = {};
        for (const [group, vol] of Object.entries(volumeByGroup)) {
            if (vol <= 0) {
                heatLevels[group] = 0;
            } else if (vol > 150 && vol >= maxVol * 0.75) {
                heatLevels[group] = 4; // Crimson (Recrutamento Máximo)
            } else if (vol >= maxVol * 0.50) {
                heatLevels[group] = 3; // Amber (Recrutamento Intenso)
            } else if (vol >= maxVol * 0.25) {
                heatLevels[group] = 2; // Neon Mint (Recrutamento Efetivo)
            } else {
                heatLevels[group] = 1; // Cyan (Recrutamento Leve / Sinergista)
            }
        }

        return {
            volumeByGroup,
            totalEffectiveVolume,
            heatLevels
        };
    },

    getExerciseHistoryDetailed: async (exName) => {
        const sessions = await db.sessions.orderBy('date').reverse().toArray();
        const recent = [];
        let record = await db.records.get(exName);
        let max1RM = 0;

        for (let s of sessions) {
            const ex = (s.exercises || []).find(e => e.name === exName);
            if (ex && ex.sets && ex.sets.length > 0) {
                const completedSets = ex.sets.filter(st => st.completed && (parseFloat(st.weight) || 0) > 0 && (parseInt(st.reps) || 0) > 0);
                if (completedSets.length > 0) {
                    if (recent.length < 5) {
                        recent.push({
                            date: s.date,
                            planName: s.planName,
                            sets: completedSets
                        });
                    }
                    completedSets.forEach(st => {
                        const est1RM = app.calculate1RM(st.weight, st.reps);
                        if (est1RM > max1RM) max1RM = est1RM;
                    });
                }
            }
        }

        const estimated1RM = record ? Math.max(max1RM, app.calculate1RM(record.weight, record.reps)) : max1RM;

        return {
            record,
            estimated1RM,
            recentSessions: recent
        };
    },

    startWorkout: async (planId) => {
        let plan = null;
        if (typeof db !== 'undefined' && db.plans) {
            try {
                plan = await db.plans.get(planId);
            } catch (e) {}
            if (!plan) {
                try {
                    const allPlans = await db.plans.toArray();
                    plan = allPlans.find(p => p.id === planId || p.name === planId || (typeof planId === 'string' && p.name && p.name.includes(planId))) || allPlans[0];
                } catch (e) {}
            }
        }
        if (!plan && typeof db !== 'undefined' && db.templates) {
            try {
                const tmpl = await db.templates.get(planId);
                if (tmpl && (tmpl.isPlan || tmpl.exercises)) plan = tmpl;
            } catch (e) {}
        }
        if (!plan) {
            plan = { name: 'Treino Livre', exercises: ['Supino Reto com Barra'] };
        }
        if (!plan.exercises || !plan.exercises.length) {
            plan.exercises = ['Supino Reto com Barra'];
        }
        
        const templates = await db.templates.toArray();
        const templateMap = Object.fromEntries(templates.map(t => [t.name, t]));

        const workoutExercises = [];
        for(let name of plan.exercises) {
            const lastData = await app.getExerciseHistory(name);
            const tmpl = templateMap[name] || {};
            const muscleGroup = tmpl.body_part || tmpl.target || tmpl.primary_muscle_group || app.inferMuscleGroupLocal(name, '') || 'Geral';
            workoutExercises.push({
                name: name,
                muscleGroup: muscleGroup,
                body_part: tmpl.body_part || muscleGroup,
                target: tmpl.target || muscleGroup,
                restTime: 90,
                historyPreview: lastData ? `${lastData.weight}kg x ${lastData.reps}` : 'Novo',
                sets: [
                    { weight: lastData ? lastData.weight : 0, reps: lastData ? lastData.reps : 0, completed: false, type: 'Normal', rpe: '' },
                    { weight: lastData ? lastData.weight : 0, reps: lastData ? lastData.reps : 0, completed: false, type: 'Normal', rpe: '' },
                    { weight: lastData ? lastData.weight : 0, reps: lastData ? lastData.reps : 0, completed: false, type: 'Normal', rpe: '' }
                ]
            });
        }
        app.activeWorkout = { ...plan, startTime: Date.now(), exercises: workoutExercises };
        app.startTime = app.activeWorkout.startTime;
        document.getElementById('active-workout-name').innerText = plan.name;
        
        const inactiveCard = document.getElementById('workout-inactive-card');
        const activeContent = document.getElementById('workout-active-content');
        if (inactiveCard) inactiveCard.classList.add('hidden');
        if (activeContent) activeContent.classList.remove('hidden');

        app.renderWorkout();
        app.saveActiveWorkoutState();
        app.setView('active-workout');
        app.startTimer();
        app.requestWakeLock();
    },

    getExerciseHistory: async (exName) => {
        const sessions = await db.sessions.orderBy('date').reverse().toArray();
        for(let s of sessions) {
            const ex = (s.exercises || []).find(e => e.name === exName);
            if(ex) {
                const best = [...(ex.sets || [])].filter(x => x.completed && (parseFloat(x.weight) || 0) > 0 && (parseInt(x.reps) || 0) > 0).sort((a,b) => app.calculate1RM(b.weight, b.reps) - app.calculate1RM(a.weight, a.reps))[0];
                if(best) return best;
            }
        }
        return null;
    },

    showExerciseDetailsByName: async (name) => {
        if (!name) return;
        let tmpl = await db.templates.where('name').equals(name).first();
        if (!tmpl) {
            const all = await db.templates.toArray();
            const q = name.toLowerCase().trim();
            tmpl = all.find(t => t.name && t.name.toLowerCase() === q) ||
                   all.find(t => t.name_en && t.name_en.toLowerCase() === q) ||
                   all.find(t => t.name && t.name.toLowerCase().includes(q)) ||
                   all.find(t => q.includes(t.name.toLowerCase()));
        }
        if (tmpl && tmpl.id) {
            app.showExerciseDetails(tmpl.id);
        } else {
            app.toast(`Buscando "${name}" na biblioteca...`, 'info', 1500);
            app.showExerciseLibrary('workout');
            const searchInput = document.getElementById('search-exercise') || document.getElementById('exercise-search-input');
            if (searchInput) {
                searchInput.value = name;
                app.filterExerciseLibrary();
            }
        }
    },

    formatExerciseBaseInfo: (ex) => {
        if (!ex) return { base: 'Livre', rest: 90 };
        let base = 'Livre';
        if (ex.historyPreview && String(ex.historyPreview).toLowerCase() !== 'undefined' && String(ex.historyPreview).trim() !== '') {
            base = ex.historyPreview;
        } else if (ex.baseWeight !== undefined && ex.baseWeight !== null && String(ex.baseWeight).toLowerCase() !== 'undefined') {
            base = `${ex.baseWeight}kg`;
        } else if (ex.equipment && String(ex.equipment).toLowerCase() !== 'undefined' && String(ex.equipment).trim() !== '') {
            base = ex.equipment;
        }

        let rest = 90;
        if (ex.restTime !== undefined && ex.restTime !== null && !isNaN(ex.restTime)) {
            rest = Number(ex.restTime);
        } else if (ex.restSeconds !== undefined && ex.restSeconds !== null && !isNaN(ex.restSeconds)) {
            rest = Number(ex.restSeconds);
        }

        return { base, rest };
    },

    renderActiveWorkout: () => {
        return app.renderWorkout();
    },

    renderWorkout: () => {
        const list = document.getElementById('exercise-list');
        if (!list || !app.activeWorkout) return;

        const hasExercises = app.activeWorkout.exercises && app.activeWorkout.exercises.length > 0;
        const inactiveCard = document.getElementById('workout-inactive-card');
        const activeContent = document.getElementById('workout-active-content');

        if (!hasExercises) {
            list.innerHTML = `
                <div class="glass p-6 text-center space-y-3 rounded-2xl border-dashed border-2 border-white/10">
                    <p class="text-xs font-black uppercase tracking-wider text-gray-400">Nenhum exercício neste treino</p>
                    <button onclick="app.showExerciseLibrary('workout')" class="bg-[#00FF9D] text-black text-[10px] font-black py-2.5 px-4 rounded-xl uppercase tracking-wider active:scale-95 transition-all">+ Injetar Primeiro Exercício</button>
                </div>
            `;
            return;
        }

        if (inactiveCard) inactiveCard.classList.add('hidden');
        if (activeContent) activeContent.classList.remove('hidden');

        list.innerHTML = app.activeWorkout.exercises.map((ex, exIdx) => {
            const muscleTag = ex.muscleGroup || ex.body_part || ex.target || 'Musculação';
            const baseInfo = app.formatExerciseBaseInfo(ex);
            return `
            <div class="glass p-5 space-y-4 animate-fade" data-exercise-index="${exIdx}">
                <div class="flex justify-between items-start">
                    <div class="space-y-1">
                        <h4 onclick="app.showExerciseDetailsByName('${app.sanitize(ex.name)}')" class="font-black text-[#00FF9D] uppercase tracking-tighter text-base italic leading-tight cursor-pointer hover:underline flex items-center gap-1.5" title="Toque para ver execução e biomecânica">
                            ${app.sanitize(ex.name)}
                            <i data-lucide="info" class="w-3.5 h-3.5 opacity-60"></i>
                        </h4>
                        <div class="flex items-center flex-wrap gap-2 pt-0.5">
                            <span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-[#00FF9D]/10 text-[#00FF9D] border border-[#00FF9D]/20">${app.sanitize(muscleTag)}</span>
                            <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">BASE: ${baseInfo.base}</div>
                            <div class="text-[9px] font-black text-[#00FF9D]/60 uppercase tracking-widest cursor-pointer hover:text-[#00FF9D]" onclick="app.setRest(${exIdx})">DESCANSO: ${baseInfo.rest}s</div>
                        </div>
                    </div>
                    <button onclick="app.removeExerciseFromWorkout(${exIdx})" class="p-2 text-gray-600 hover:text-red-500 active:text-red-500 transition-colors" title="Remover Exercício"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>

                <!-- Table Header for Sets -->
                <div class="grid grid-cols-12 text-[8px] font-black uppercase text-gray-500 tracking-wider px-2 pt-1 pb-1 border-b border-white/5">
                    <div class="col-span-2">TIPO</div>
                    <div class="col-span-3 text-center">CARGA (KG)</div>
                    <div class="col-span-3 text-center">REPS</div>
                    <div class="col-span-2 text-center">RPE</div>
                    <div class="col-span-2 text-right pr-1">CONCLUIR</div>
                </div>

                <div class="space-y-2.5" id="exercise-sets-container-${exIdx}">${ex.sets.map((s, sIdx) => app.renderSetRow(exIdx, sIdx, s)).join('')}</div>
                <button onclick="app.addSetToWorkout(${exIdx})" class="w-full py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[9px] font-black tracking-[0.3em] text-gray-400 active:bg-white/15 uppercase transition-all">+ Add Série</button>
            </div>
        `}).join('');
        lucide.createIcons();
    },

    // In-Workout Ergonomics: Smart Steppers & Fast 1-Touch Adjust
    renderSetRow: (exI, sI, s) => {
        const typeBadgeClass = s.type === 'Warmup' ? 'badge-set-warmup' : (s.type === 'Failure' ? 'badge-set-failure' : (s.type === 'Drop' ? 'badge-set-drop' : 'badge-set-normal'));
        const typeLetter = s.type === 'Warmup' ? 'W' : (s.type === 'Failure' ? 'F' : (s.type === 'Drop' ? 'D' : 'N'));

        return `
        <div class="space-y-2 p-2.5 rounded-2xl bg-black/40 border border-white/5 ${s.completed ? 'opacity-40 grayscale' : ''} transition-all" id="set-row-${exI}-${sI}">
            <div class="flex items-center gap-2">
                <button onclick="app.openSetTypePicker(${exI},${sI})" class="w-8 h-9 flex items-center justify-center rounded-xl ${typeBadgeClass} text-[10px] font-black uppercase italic shrink-0 active:scale-90" title="Tipo: ${s.type} (Toque para alterar)">${typeLetter}</button>
                <div class="flex-1 grid grid-cols-3 gap-1.5 h-9">
                    <div class="flex items-center glass px-1">
                        <input id="set-weight-input-${exI}-${sI}" onfocus="this.select()" oninput="app.updateSet(${exI},${sI},'weight',this.value)" onchange="app.updateSet(${exI},${sI},'weight',this.value)" type="number" inputmode="decimal" value="${s.weight}" class="w-full text-center text-xs font-black focus:outline-none text-white bg-transparent" placeholder="KG">
                    </div>
                    <div class="flex items-center glass px-1">
                        <input id="set-reps-input-${exI}-${sI}" onfocus="this.select()" oninput="app.updateSet(${exI},${sI},'reps',this.value)" onchange="app.updateSet(${exI},${sI},'reps',this.value)" type="number" inputmode="numeric" value="${s.reps}" class="w-full text-center text-xs font-black focus:outline-none text-white bg-transparent" placeholder="REPS">
                    </div>
                    <div class="flex items-center glass px-1 bg-white/[0.01] cursor-pointer" onclick="app.openRpePicker(${exI},${sI})">
                        <input id="set-rpe-input-${exI}-${sI}" onfocus="this.select()" oninput="app.updateSet(${exI},${sI},'rpe',this.value)" onchange="app.updateSet(${exI},${sI},'rpe',this.value)" type="number" inputmode="decimal" step="0.5" min="1" max="10" value="${s.rpe !== undefined ? s.rpe : ''}" class="w-full text-center text-[10px] font-black text-gray-300 focus:text-[#00FF9D] focus:outline-none bg-transparent cursor-pointer" placeholder="RPE">
                    </div>
                </div>
                <button onclick="app.toggleSet(${exI},${sI})" class="p-2.5 glass shrink-0 ${s.completed ? 'bg-[#00FF9D]/20 border-[#00FF9D]' : 'active:scale-90'}" title="Concluir Série">
                    <i data-lucide="check" class="w-4 h-4 ${s.completed ? 'text-[#00FF9D]' : 'text-gray-800'}"></i>
                </button>
                <button onclick="app.removeSetFromWorkout(${exI},${sI})" class="p-2 text-gray-700 hover:text-red-400 active:text-red-500 transition-colors shrink-0" title="Remover Série">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <!-- Tactile Smart Stepper Controls (1-Hand Workout Use, touch targets >= 36px) -->
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                <div class="flex items-center justify-between bg-white/[0.02] p-1 rounded-xl border border-white/5">
                    <div class="flex items-center gap-1">
                        <button onclick="app.stepWeight(${exI},${sI},-5)" class="stepper-btn text-[9px] font-mono font-bold text-gray-400 active:text-white" title="-5 kg">-5</button>
                        <button onclick="app.stepWeight(${exI},${sI},-2.5)" class="stepper-btn text-[9px] font-mono font-bold text-gray-400 active:text-white" title="-2.5 kg">-2.5</button>
                    </div>
                    <span class="text-[7px] uppercase font-mono text-gray-500 font-black px-1">KG</span>
                    <div class="flex items-center gap-1">
                        <button onclick="app.stepWeight(${exI},${sI},2.5)" class="stepper-btn text-[9px] font-mono font-bold text-[#00FF9D]" title="+2.5 kg">+2.5</button>
                        <button onclick="app.stepWeight(${exI},${sI},5)" class="stepper-btn text-[9px] font-mono font-bold text-[#00FF9D]" title="+5 kg">+5</button>
                    </div>
                </div>
                <div class="flex items-center justify-between bg-white/[0.02] p-1 rounded-xl border border-white/5">
                    <div class="flex items-center gap-1">
                        <button onclick="app.stepReps(${exI},${sI},-5)" class="stepper-btn text-[9px] font-mono font-bold text-gray-400 active:text-white" title="-5 reps">-5</button>
                        <button onclick="app.stepReps(${exI},${sI},-1)" class="stepper-btn text-[9px] font-mono font-bold text-gray-400 active:text-white" title="-1 rep">-1</button>
                    </div>
                    <span class="text-[7px] uppercase font-mono text-gray-500 font-black px-1">REPS</span>
                    <div class="flex items-center gap-1">
                        <button onclick="app.stepReps(${exI},${sI},1)" class="stepper-btn text-[9px] font-mono font-bold text-[#00FF9D]" title="+1 rep">+1</button>
                        <button onclick="app.stepReps(${exI},${sI},5)" class="stepper-btn text-[9px] font-mono font-bold text-[#00FF9D]" title="+5 reps">+5</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    },

    stepWeight: (exI, sI, delta) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises[exI] || !app.activeWorkout.exercises[exI].sets[sI]) return;
        const set = app.activeWorkout.exercises[exI].sets[sI];
        const newWeight = Math.max(0, Math.round(((parseFloat(set.weight) || 0) + delta) * 10) / 10);
        set.weight = newWeight;
        const inputEl = document.getElementById(`set-weight-input-${exI}-${sI}`);
        if (inputEl) inputEl.value = newWeight;
        if (navigator.vibrate) navigator.vibrate(15);
        app.saveActiveWorkoutState();
    },

    stepReps: (exI, sI, delta) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises[exI] || !app.activeWorkout.exercises[exI].sets[sI]) return;
        const set = app.activeWorkout.exercises[exI].sets[sI];
        const newReps = Math.max(0, (parseInt(set.reps) || 0) + delta);
        set.reps = newReps;
        const inputEl = document.getElementById(`set-reps-input-${exI}-${sI}`);
        if (inputEl) inputEl.value = newReps;
        if (navigator.vibrate) navigator.vibrate(15);
        app.saveActiveWorkoutState();
    },

    removeSetFromWorkout: (exI, sI) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises[exI]) return;
        const ex = app.activeWorkout.exercises[exI];
        if (!ex.sets || !ex.sets[sI]) return;
        
        if (ex.sets.length <= 1) {
            app.showConfirmDialog({
                title: 'Remover Exercício',
                subtitle: 'Última série',
                message: `Esta é a única série de "${ex.name}". Deseja remover o exercício do treino?`,
                confirmText: 'Remover',
                cancelText: 'Manter',
                isDanger: true,
                onConfirm: () => {
                    app.activeWorkout.exercises.splice(exI, 1);
                    app.renderWorkout();
                    app.saveActiveWorkoutState();
                    app.toast('Exercício removido do treino.', 'info');
                }
            });
            return;
        }

        ex.sets.splice(sI, 1);
        app.renderWorkout();
        app.saveActiveWorkoutState();
        app.toast(`Série ${sI + 1} removida.`, 'info', 1500);
    },

    setRest: (idx) => {
        const cur = app.activeWorkout.exercises[idx].restTime || 90;
        const options = [30, 45, 60, 90, 120, 180];
        const next = options[(options.indexOf(cur) + 1) % options.length] || 90;
        app.activeWorkout.exercises[idx].restTime = next;
        app.renderWorkout();
        app.saveActiveWorkoutState();
    },

    updateSet: (exI, sI, f, v) => { 
        if (!app.activeWorkout) return;
        app.activeWorkout.exercises[exI].sets[sI][f] = parseFloat(v) || v; 
        app.saveActiveWorkoutState();
    },
    
    cycleSetType: (exI, sI) => { 
        const types = ['Normal', 'Warmup', 'Failure', 'Drop'];
        const cur = app.activeWorkout.exercises[exI].sets[sI].type;
        app.activeWorkout.exercises[exI].sets[sI].type = types[(types.indexOf(cur) + 1) % types.length];
        app.renderWorkout();
        app.saveActiveWorkoutState();
    },

    openSetTypePicker: (exI, sI) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises[exI] || !app.activeWorkout.exercises[exI].sets[sI]) return;
        app.activeSetPickerTarget = { exI, sI };
        const cur = app.activeWorkout.exercises[exI].sets[sI].type;
        const list = document.getElementById('set-type-options-list');
        if (!list) return;

        const options = [
            { type: 'Normal', badge: 'badge-set-normal', letter: 'N', title: 'Série Normal', desc: 'Série de trabalho padrão na faixa alvo de hipertrofia.' },
            { type: 'Warmup', badge: 'badge-set-warmup', letter: 'W', title: 'Aquecimento (Warmup)', desc: 'Carga preparatória leve (não conta no cálculo de fadiga).' },
            { type: 'Failure', badge: 'badge-set-failure', letter: 'F', title: 'Até a Falha (Failure)', desc: 'Executada até a falha concêntrica total (RPE 10 / RIR 0).' },
            { type: 'Drop', badge: 'badge-set-drop', letter: 'D', title: 'Drop-set', desc: 'Redução imediata de carga sem descanso pós-falha.' }
        ];

        list.innerHTML = options.map(opt => `
            <div onclick="app.selectSetType('${opt.type}')" class="glass p-3.5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${cur === opt.type ? 'border-[#00FF9D]/60 bg-[#00FF9D]/10' : 'border-white/5 bg-white/[0.01]'}">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-xl ${opt.badge} flex items-center justify-center text-xs font-black">${opt.letter}</span>
                    <div>
                        <h4 class="font-black text-xs uppercase text-white">${opt.title}</h4>
                        <p class="text-[9px] text-gray-400">${opt.desc}</p>
                    </div>
                </div>
                ${cur === opt.type ? '<i data-lucide="check" class="w-4 h-4 text-[#00FF9D]"></i>' : ''}
            </div>
        `).join('');

        lucide.createIcons();
        document.getElementById('set-type-picker-modal').classList.remove('hidden');
    },

    selectSetType: (type) => {
        const { exI, sI } = app.activeSetPickerTarget;
        if (app.activeWorkout && app.activeWorkout.exercises[exI] && app.activeWorkout.exercises[exI].sets[sI]) {
            app.activeWorkout.exercises[exI].sets[sI].type = type;
            app.renderWorkout();
            app.saveActiveWorkoutState();
        }
        app.closeModal('set-type-picker-modal');
    },

    openRpePicker: (exI, sI) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises[exI] || !app.activeWorkout.exercises[exI].sets[sI]) return;
        app.activeRpePickerTarget = { exI, sI };
        const cur = parseFloat(app.activeWorkout.exercises[exI].sets[sI].rpe) || null;
        const list = document.getElementById('rpe-options-list');
        if (!list) return;

        const scales = [
            { rpe: 10, rir: 'RIR 0', label: 'Falha Muscular Absoluta', color: 'text-red-400' },
            { rpe: 9.5, rir: 'RIR 0-1', label: 'Quase Falha (talvez 0.5 rep)', color: 'text-orange-400' },
            { rpe: 9.0, rir: 'RIR 1', label: 'Esforço Máximo (1 rep reserva)', color: 'text-amber-400' },
            { rpe: 8.5, rir: 'RIR 1-2', label: 'Esforço Alto (1-2 reps reserva)', color: 'text-amber-300' },
            { rpe: 8.0, rir: 'RIR 2', label: 'Hipertrofia Ótima (2 reps reserva)', color: 'text-[#00FF9D]' },
            { rpe: 7.5, rir: 'RIR 2-3', label: 'Esforço Moderado Alto', color: 'text-[#00FF9D]' },
            { rpe: 7.0, rir: 'RIR 3', label: 'Velocidade e Força Dinâmica', color: 'text-cyan-400' },
            { rpe: 6.5, rir: 'RIR 3+', label: 'Série Leve / Técnica', color: 'text-blue-400' },
            { rpe: 6.0, rir: 'RIR 4+', label: 'Aquecimento / Séries Iniciais', color: 'text-gray-400' }
        ];

        list.innerHTML = `
            <div onclick="app.selectRpe('')" class="glass p-2.5 rounded-xl flex justify-between items-center cursor-pointer mb-2 border-dashed border-white/10 active:scale-[0.98]">
                <span class="text-[10px] font-black uppercase text-gray-500">Limpar RPE (Sem valor)</span>
                ${cur === null ? '<i data-lucide="check" class="w-3.5 h-3.5 text-gray-400"></i>' : ''}
            </div>
            ${scales.map(sc => `
                <div onclick="app.selectRpe(${sc.rpe})" class="glass p-3 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${cur === sc.rpe ? 'border-[#00FF9D]/60 bg-[#00FF9D]/10' : 'border-white/5 bg-white/[0.01]'}">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-black font-mono ${sc.color} w-16">RPE ${sc.rpe}</span>
                        <div>
                            <div class="text-xs font-black text-white">${sc.label}</div>
                            <div class="text-[8px] font-bold text-gray-500 uppercase tracking-widest">${sc.rir}</div>
                        </div>
                    </div>
                    ${cur === sc.rpe ? '<i data-lucide="check" class="w-4 h-4 text-[#00FF9D]"></i>' : ''}
                </div>
            `).join('')}
        `;

        lucide.createIcons();
        document.getElementById('rpe-picker-modal').classList.remove('hidden');
    },

    selectRpe: (value) => {
        const { exI, sI } = app.activeRpePickerTarget;
        if (app.activeWorkout && app.activeWorkout.exercises[exI] && app.activeWorkout.exercises[exI].sets[sI]) {
            app.activeWorkout.exercises[exI].sets[sI].rpe = value;
            const inputEl = document.getElementById(`set-rpe-input-${exI}-${sI}`);
            if (inputEl) inputEl.value = value;
            app.saveActiveWorkoutState();
        }
        app.closeModal('rpe-picker-modal');
    },

    toggleSet: (exI, sI) => {
        if (!app.activeWorkout || !app.activeWorkout.exercises || !app.activeWorkout.exercises[exI]) return;
        const ex = app.activeWorkout.exercises[exI];
        if (!ex.sets || !ex.sets[sI]) return;
        const s = ex.sets[sI];
        s.completed = !s.completed;
        if(s.completed) { 
            app.startRestTimer(ex.restTime || 90); 
            if(navigator.vibrate) navigator.vibrate(40);
        } else {
            app.stopRestTimer();
        }
        app.renderWorkout();
        app.saveActiveWorkoutState();
    },

    addSetToWorkout: (exI) => { 
        const sets = app.activeWorkout.exercises[exI].sets;
        sets.push({...sets[sets.length-1], completed: false}); 
        app.renderWorkout(); 
        app.saveActiveWorkoutState();
    },

    addExerciseToActiveWorkout: async (n) => { 
        if (!app.activeWorkout) {
            app.activeWorkout = {
                id: null,
                name: 'Treino Livre',
                startTime: Date.now(),
                exercises: []
            };
            app.startTime = app.activeWorkout.startTime;
            document.getElementById('active-workout-name').innerText = 'Treino Livre';
            app.startTimer();
            app.requestWakeLock();
        }

        const lastData = await app.getExerciseHistory(n);
        const tmpl = await db.templates.where('name').equals(n).first();
        const muscleGroup = tmpl ? (tmpl.body_part || tmpl.target || tmpl.primary_muscle_group) : (app.inferMuscleGroupLocal(n, '') || 'Geral');
        app.activeWorkout.exercises.push({
            name: n, 
            muscleGroup: muscleGroup,
            body_part: tmpl ? tmpl.body_part : muscleGroup,
            target: tmpl ? tmpl.target : muscleGroup,
            restTime: 90, 
            historyPreview: lastData ? `${lastData.weight}kg x ${lastData.reps}` : 'Novo',
            sets: [{ 
                weight: lastData ? lastData.weight : 0, 
                reps: lastData ? lastData.reps : 0, 
                completed: false, 
                type: 'Normal', 
                rpe: '' 
            }]
        }); 
        app.renderWorkout(); 
        app.saveActiveWorkoutState();
    },

    removeExerciseFromWorkout: (i) => { 
        const exName = app.activeWorkout.exercises[i] ? app.activeWorkout.exercises[i].name : 'Exercício';
        app.showConfirmDialog({
            title: 'Remover Exercício',
            subtitle: 'Treino Ativo',
            message: `Deseja remover "${exName}" desta sessão de treino?`,
            confirmText: 'Remover',
            cancelText: 'Manter',
            isDanger: true,
            onConfirm: () => {
                app.activeWorkout.exercises.splice(i, 1); 
                app.renderWorkout(); 
                app.saveActiveWorkoutState();
                app.toast('Exercício removido do treino.', 'info');
            }
        });
    },
    
    cancelWorkout: () => { 
        app.showConfirmDialog({
            title: 'Descartar Treino Atual',
            subtitle: 'Sessão em Andamento',
            message: 'Tem certeza que deseja cancelar o treino? Todo o progresso registrado nesta sessão será perdido.',
            confirmText: 'Sim, Cancelar',
            cancelText: 'Continuar Treinando',
            isDanger: true,
            onConfirm: () => {
                clearInterval(app.timerInterval); 
                app.stopRestTimer(); 
                app.releaseWakeLock();
                app.activeWorkout = null; 
                app.clearActiveWorkoutState();
                app.setView('dashboard'); 
                app.toast('Treino cancelado.', 'info');
            }
        });
    },
    
    finishWorkout: async () => {
        if (!app.activeWorkout || !app.activeWorkout.exercises || app.activeWorkout.exercises.length === 0) {
            app.toast('Adicione exercícios antes de finalizar a sessão.', 'warning');
            return;
        }

        clearInterval(app.timerInterval);
        app.stopRestTimer();
        app.releaseWakeLock();
        
        let vol = 0;
        const newPRs = [];
        
        for (const ex of app.activeWorkout.exercises) {
            const completedSets = (ex.sets || []).filter(s => s.completed && (parseFloat(s.weight) || 0) > 0 && (parseInt(s.reps) || 0) > 0);
            const bestSet = completedSets.sort((a, b) => app.calculate1RM(b.weight, b.reps) - app.calculate1RM(a.weight, a.reps))[0];
            if (bestSet) {
                const best1RM = app.calculate1RM(bestSet.weight, bestSet.reps);
                if (best1RM > 0) {
                    const existingRecord = await db.records.get(ex.name);
                    const existing1RM = existingRecord ? app.calculate1RM(existingRecord.weight, existingRecord.reps) : 0;
                    if (!existingRecord || best1RM > existing1RM) {
                        const recordData = { name: ex.name, weight: bestSet.weight, reps: bestSet.reps, date: new Date() };
                        await db.records.put(recordData);
                        newPRs.push(recordData);
                    }
                }
            }
            (ex.sets || []).forEach(s => { if(s.completed) vol += ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)); });
        }

        const durationSec = Math.floor((Date.now()-app.startTime)/1000);
        const recruitment = await app.calculateWorkoutMuscleRecruitment(app.activeWorkout.exercises);

        const sessionData = { 
            planName: app.activeWorkout.name, 
            date: new Date(), 
            duration: durationSec, 
            volume: vol, 
            effectiveVolume: recruitment.totalEffectiveVolume,
            recruitment: recruitment,
            exercises: app.activeWorkout.exercises 
        };

        const sessId = await db.sessions.add(sessionData);
        sessionData.id = sessId;

        if (newPRs.length > 0) {
            app.showPRNotification(newPRs);
        }

        // Exibe o modal sci-fi de resumo pós-treino com o holograma 3D / mapa 2D
        app.showWorkoutSummaryModal(sessionData);

        app.activeWorkout = null; 
        app.clearActiveWorkoutState();
        app.renderHistory(); 
        app.initCharts();
    },

    // Motor de Cálculo de Volume Efetivo & Fadiga Muscular
    calculateWorkoutMuscleRecruitment: async (exercises) => {
        const templates = await db.templates.toArray();
        const templateMap = Object.fromEntries(templates.map(t => [t.name, t]));
        
        const muscleVolumes = {};
        let totalEffectiveVolume = 0;
        let completedSetsCount = 0;

        (exercises || []).forEach(ex => {
            const tmpl = templateMap[ex.name] || {};
            const primary = tmpl.primary_muscle_group || app.inferMuscleGroupLocal(ex.name, tmpl.target);
            const secondary = tmpl.secondary_muscle_groups || [];

            (ex.sets || []).forEach(st => {
                if (st.completed) {
                    completedSetsCount++;
                    const w = Math.max(0, parseFloat(st.weight) || 0);
                    const r = Math.max(0, parseInt(st.reps) || 0);
                    const rawVol = w * r;

                    if (rawVol > 0) {
                        // 100% no músculo primário
                        muscleVolumes[primary] = (muscleVolumes[primary] || 0) + rawVol;
                        totalEffectiveVolume += rawVol;

                        // 40% nos sinergistas secundários
                        secondary.forEach(sec => {
                            const secVol = rawVol * 0.4;
                            muscleVolumes[sec] = (muscleVolumes[sec] || 0) + secVol;
                            totalEffectiveVolume += secVol;
                        });
                    }
                }
            });
        });

        const maxVol = Math.max(...Object.values(muscleVolumes), 1);
        const heatLevels = {};
        const breakdown = [];

        Object.keys(muscleVolumes).forEach(grp => {
            const vol = muscleVolumes[grp] || 0;
            if (vol <= 0) return;

            const ratio = vol / maxVol;
            let level = 1;

            // Limiares híbridos: volume absoluto mínimo e proporção relativa ao pico da sessão
            if ((vol >= 800 && ratio >= 0.75) || vol >= 2000) {
                level = 4; // Crimson - Carga máxima / Sobrecarga
            } else if ((vol >= 400 && ratio >= 0.45) || vol >= 1000) {
                level = 3; // Âmbar - Alta intensidade / Estimulação forte
            } else if ((vol >= 150 && ratio >= 0.20) || vol >= 400) {
                level = 2; // Neon Mint - Estimulação moderada
            } else {
                level = 1; // Cyan - Aquecimento / Ativação leve
            }

            heatLevels[grp] = level;

            const grpInfo = app.muscleOntology?.groups?.[grp] || { name: grp };
            breakdown.push({
                groupId: grp,
                name: grpInfo.name || grp,
                volume: Math.round(vol),
                level: level,
                percentage: Math.round(ratio * 100)
            });
        });

        breakdown.sort((a, b) => b.volume - a.volume);

        return {
            muscleVolumes,
            totalEffectiveVolume: Math.round(totalEffectiveVolume),
            completedSetsCount,
            heatLevels,
            breakdown
        };
    },

    inferMuscleGroupLocal: (name, target) => {
        const n = (name || '').toLowerCase();
        const t = (target || '').toLowerCase();
        if (t.includes('peitoral') || n.includes('supino') || n.includes('crucifixo') || n.includes('peck deck')) return 'chest';
        if (t.includes('dorsal') || n.includes('puxada') || n.includes('pulley') || n.includes('barra fixa') || n.includes('pulldown')) return 'lats';
        if (t.includes('costas') || n.includes('remada')) return 'upper_back';
        if (t.includes('trapézio') || n.includes('encolhimento')) return 'traps';
        if (t.includes('bíceps') || n.includes('rosca')) return 'biceps';
        if (t.includes('tríceps') || n.includes('testa') || n.includes('corda') || n.includes('paralelas')) return 'triceps';
        if (t.includes('antebraço') || n.includes('punho')) return 'forearms';
        if (t.includes('quadríceps') || n.includes('agachamento') || n.includes('leg press') || n.includes('extensora')) return 'quads';
        if (t.includes('posterior') || n.includes('stiff') || n.includes('flexora') || n.includes('romeno')) return 'hamstrings';
        if (t.includes('glúteo') || n.includes('elevação pélvica') || n.includes('hip thrust')) return 'glutes';
        if (t.includes('panturrilha') || n.includes('gêmeos')) return 'calves';
        if (t.includes('abdômen') || n.includes('abdominal') || n.includes('prancha')) return 'abs';
        if (t.includes('deltoide') || n.includes('desenvolvimento') || n.includes('elevação lateral')) return 'shoulders_side';
        return 'upper_back';
    },

    showWorkoutSummaryById: async (id) => {
        try {
            const session = await db.sessions.get(Number(id));
            if (!session) {
                app.toast('Sessão não encontrada no histórico.', 'error');
                return;
            }
            if (!session.recruitment && session.exercises) {
                session.recruitment = await app.calculateWorkoutMuscleRecruitment(session.exercises);
            }
            app.showWorkoutSummaryModal(session);
        } catch (e) {
            console.error('[History] Erro ao carregar resumo da sessão:', e);
            app.toast('Erro ao abrir resumo do treino.', 'error');
        }
    },

    // Modal de Resumo Pós-Treino & Holograma
    showWorkoutSummaryModal: (session) => {
        app.lastSummarySession = session;
        const modal = document.getElementById('workout-summary-modal');
        if (!modal) return;

        document.getElementById('summary-workout-title').innerText = session.planName || 'Sessão Finalizada';
        document.getElementById('summary-volume').innerText = `${(session.volume || 0).toLocaleString()} kg`;
        document.getElementById('summary-sets').innerText = session.recruitment?.completedSetsCount || 0;
        
        const durMin = Math.floor((session.duration || 0) / 60);
        const durSec = (session.duration || 0) % 60;
        document.getElementById('summary-duration').innerText = `${durMin.toString().padStart(2,'0')}:${durSec.toString().padStart(2,'0')}`;

        const listEl = document.getElementById('summary-muscles-list');
        if (listEl) {
            if (session.recruitment && session.recruitment.breakdown.length > 0) {
                listEl.innerHTML = session.recruitment.breakdown.map(item => `
                    <div class="flex items-center justify-between text-[10px] p-2 rounded-xl bg-white/[0.02] border border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${item.level >= 4 ? 'bg-[#ff1744]' : (item.level === 3 ? 'bg-[#ffab00]' : (item.level === 2 ? 'bg-[#00FF9D]' : 'bg-[#00e5ff]'))}"></span>
                            <span class="font-black text-white uppercase">${app.sanitize(item.name)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div class="h-full rounded-full ${item.level >= 4 ? 'bg-[#ff1744]' : (item.level === 3 ? 'bg-[#ffab00]' : (item.level === 2 ? 'bg-[#00FF9D]' : 'bg-[#00e5ff]'))}" style="width: ${item.percentage}%"></div>
                            </div>
                            <span class="font-mono text-gray-400 font-bold w-12 text-right">${item.volume}kg</span>
                        </div>
                    </div>
                `).join('');
            } else {
                listEl.innerHTML = `<div class="text-[9px] text-gray-600 font-bold uppercase p-2">Nenhum dado de recrutamento nesta sessão.</div>`;
            }
        }

        modal.classList.remove('hidden');
        lucide.createIcons();

        // Renderiza visualizador 3D padrão
        setTimeout(() => {
            app.switchSummaryHeatmapMode('3d');
        }, 100);
    },

    switchSummaryHeatmapMode: (mode) => {
        const btn3D = document.getElementById('summary-toggle-3d-btn');
        const btn2D = document.getElementById('summary-toggle-2d-btn');
        const stage3D = document.getElementById('summary-3d-container');
        const stage2D = document.getElementById('summary-2d-container');

        if (mode === '3d' && app.graphicMode !== 'tier_2') {
            if (btn3D) btn3D.className = 'px-2.5 py-1 rounded-lg bg-[#00FF9D]/15 text-[#00FF9D]';
            if (btn2D) btn2D.className = 'px-2.5 py-1 rounded-lg text-gray-500';
            if (stage3D) stage3D.classList.remove('hidden');
            if (stage2D) stage2D.classList.add('hidden');
            
            const heat = app.lastSummarySession?.recruitment?.heatLevels || null;
            app.init3DScene('summary-3d-canvas', heat, true, 'summary');
        } else {
            if (btn3D) btn3D.className = 'px-2.5 py-1 rounded-lg text-gray-500';
            if (btn2D) btn2D.className = 'px-2.5 py-1 rounded-lg bg-[#00FF9D]/15 text-[#00FF9D]';
            if (stage3D) stage3D.classList.add('hidden');
            if (stage2D) stage2D.classList.remove('hidden');

            const heat = app.lastSummarySession?.recruitment?.heatLevels || null;
            app.renderSvgAnatomicalMap('summary-svg-wrapper', 'both', null, heat);
        }
    },

    // 2D SVG Anatomical Map Generator & Interactive Filter
    renderSvgAnatomicalMap: (containerId, view = 'anterior', activeFilter = null, heatLevels = null) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (view === 'both') {
            container.innerHTML = `
                <div class="flex items-center justify-around w-full h-full gap-2">
                    <div class="flex-1 h-full flex flex-col items-center">
                        <span class="text-[8px] font-mono text-gray-500 uppercase">Frente</span>
                        ${app.getSvgAnatomicalPaths('anterior', heatLevels, activeFilter)}
                    </div>
                    <div class="flex-1 h-full flex flex-col items-center">
                        <span class="text-[8px] font-mono text-gray-500 uppercase">Costas</span>
                        ${app.getSvgAnatomicalPaths('posterior', heatLevels, activeFilter)}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = app.getSvgAnatomicalPaths(view, heatLevels, activeFilter);
        }
    },

    getSvgAnatomicalPaths: (view, heatLevels = null, activeFilter = null) => {
        const getNodeClass = (groupId) => {
            let cls = 'muscle-node';
            if (heatLevels && heatLevels[groupId]) {
                cls += ` heat-${heatLevels[groupId]}`;
            }
            if (activeFilter === groupId) {
                cls += ' active-selected';
            }
            return cls;
        };

        if (view === 'anterior') {
            return `
                <svg viewBox="0 0 200 320" class="w-full h-full max-h-52 drop-shadow-md select-none">
                    <!-- Head & Neck -->
                    <ellipse cx="100" cy="22" rx="13" ry="16" fill="#151b28" stroke="rgba(255,255,255,0.1)" stroke-width="1.2" />
                    
                    <!-- 1. Traps Anterior -->
                    <g class="muscle-group-target" data-group="traps" onclick="app.handleMuscleNodeClick('traps')" tabindex="0" role="button" aria-label="Trapézio">
                        <polygon points="84,33 116,33 126,47 74,47" class="${getNodeClass('traps')}" data-group="traps" />
                        <circle cx="100" cy="30" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 2. Chest (Peitoral) -->
                    <g class="muscle-group-target" data-group="chest" onclick="app.handleMuscleNodeClick('chest')" tabindex="0" role="button" aria-label="Peitoral">
                        <path d="M 100,50 L 128,50 C 136,54 135,74 100,78 Z" class="${getNodeClass('chest')}" data-group="chest" />
                        <path d="M 100,50 L 72,50 C 64,54 65,74 100,78 Z" class="${getNodeClass('chest')}" data-group="chest" />
                        <circle cx="128" cy="68" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="72" cy="68" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>

                    <!-- 3. Cardio (Zona Cardíaca Central) -->
                    <g class="muscle-group-target" data-group="cardio" onclick="app.handleMuscleNodeClick('cardio')" tabindex="0" role="button" aria-label="Cardio">
                        <circle cx="100" cy="61" r="5.5" class="${getNodeClass('cardio')}" data-group="cardio" />
                        <circle cx="100" cy="61" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 4. Shoulders Front (Deltoide Anterior) -->
                    <g class="muscle-group-target" data-group="shoulders_front" onclick="app.handleMuscleNodeClick('shoulders_front')" tabindex="0" role="button" aria-label="Deltoide Anterior">
                        <path d="M 127,49 L 145,55 L 142,73 L 128,66 Z" class="${getNodeClass('shoulders_front')}" data-group="shoulders_front" />
                        <path d="M 73,49 L 55,55 L 58,73 L 72,66 Z" class="${getNodeClass('shoulders_front')}" data-group="shoulders_front" />
                        <circle cx="136" cy="40" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="64" cy="40" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>

                    <!-- 5. Shoulders Side (Deltoide Lateral) -->
                    <g class="muscle-group-target" data-group="shoulders_side" onclick="app.handleMuscleNodeClick('shoulders_side')" tabindex="0" role="button" aria-label="Deltoide Lateral">
                        <path d="M 144,53 C 156,60 152,74 141,74 L 138,66 Z" class="${getNodeClass('shoulders_side')}" data-group="shoulders_side" />
                        <path d="M 56,53 C 44,60 48,74 59,74 L 62,66 Z" class="${getNodeClass('shoulders_side')}" data-group="shoulders_side" />
                        <circle cx="162" cy="56" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="38" cy="56" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 6. Biceps -->
                    <g class="muscle-group-target" data-group="biceps" onclick="app.handleMuscleNodeClick('biceps')" tabindex="0" role="button" aria-label="Bíceps">
                        <path d="M 132,73 C 145,80 142,108 130,104 Z" class="${getNodeClass('biceps')}" data-group="biceps" />
                        <path d="M 68,73 C 55,80 58,108 70,104 Z" class="${getNodeClass('biceps')}" data-group="biceps" />
                        <circle cx="142" cy="96" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="58" cy="96" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 7. Forearms (Antebraços) -->
                    <g class="muscle-group-target" data-group="forearms" onclick="app.handleMuscleNodeClick('forearms')" tabindex="0" role="button" aria-label="Antebraços">
                        <path d="M 137,114 C 148,122 143,156 134,150 Z" class="${getNodeClass('forearms')}" data-group="forearms" />
                        <path d="M 63,114 C 52,122 57,156 66,150 Z" class="${getNodeClass('forearms')}" data-group="forearms" />
                        <circle cx="154" cy="134" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="46" cy="134" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 8. Abs (Abdômen & Oblíquos) -->
                    <g class="muscle-group-target" data-group="abs" onclick="app.handleMuscleNodeClick('abs')" tabindex="0" role="button" aria-label="Abdômen">
                        <rect x="88" y="80" width="24" height="24" rx="4" class="${getNodeClass('abs')}" data-group="abs" />
                        <rect x="89" y="108" width="22" height="26" rx="4" class="${getNodeClass('abs')}" data-group="abs" />
                        <path d="M 115,82 C 126,90 122,128 114,134 Z" class="${getNodeClass('abs')}" data-group="abs" />
                        <path d="M 85,82 C 74,90 78,128 86,134 Z" class="${getNodeClass('abs')}" data-group="abs" />
                        <circle cx="100" cy="92" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="100" cy="122" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>

                    <!-- 9. Abductors Anterior (Quadril Lateral / Tensor Fasciae Latae) -->
                    <g class="muscle-group-target" data-group="abductors" onclick="app.handleMuscleNodeClick('abductors')" tabindex="0" role="button" aria-label="Abdutores">
                        <path d="M 122,136 C 134,144 128,166 118,156 Z" class="${getNodeClass('abductors')}" data-group="abductors" />
                        <path d="M 78,136 C 66,144 72,166 82,156 Z" class="${getNodeClass('abductors')}" data-group="abductors" />
                        <circle cx="126" cy="144" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="74" cy="144" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 10. Quadriceps -->
                    <g class="muscle-group-target" data-group="quads" onclick="app.handleMuscleNodeClick('quads')" tabindex="0" role="button" aria-label="Quadríceps">
                        <path d="M 103,148 C 125,148 122,208 106,208 Z" class="${getNodeClass('quads')}" data-group="quads" />
                        <path d="M 97,148 C 75,148 78,208 94,208 Z" class="${getNodeClass('quads')}" data-group="quads" />
                        <circle cx="122" cy="190" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="78" cy="190" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 11. Adductors -->
                    <g class="muscle-group-target" data-group="adductors" onclick="app.handleMuscleNodeClick('adductors')" tabindex="0" role="button" aria-label="Adutores">
                        <polygon points="101,150 107,150 105,194 101,194" class="${getNodeClass('adductors')}" data-group="adductors" />
                        <polygon points="99,150 93,150 95,194 99,194" class="${getNodeClass('adductors')}" data-group="adductors" />
                        <circle cx="100" cy="162" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 12. Calves Anterior -->
                    <g class="muscle-group-target" data-group="calves" onclick="app.handleMuscleNodeClick('calves')" tabindex="0" role="button" aria-label="Panturrilhas">
                        <path d="M 106,220 C 119,220 116,278 108,278 Z" class="${getNodeClass('calves')}" data-group="calves" />
                        <path d="M 94,220 C 81,220 84,278 92,278 Z" class="${getNodeClass('calves')}" data-group="calves" />
                        <circle cx="116" cy="248" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="84" cy="248" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                </svg>
            `;
        } else {
            return `
                <svg viewBox="0 0 200 320" class="w-full h-full max-h-52 drop-shadow-md select-none">
                    <!-- Head Posterior -->
                    <ellipse cx="100" cy="22" rx="13" ry="16" fill="#151b28" stroke="rgba(255,255,255,0.1)" stroke-width="1.2" />
                    
                    <!-- 13. Trapezius Posterior -->
                    <g class="muscle-group-target" data-group="traps" onclick="app.handleMuscleNodeClick('traps')" tabindex="0" role="button" aria-label="Trapézio">
                        <polygon points="100,30 122,42 115,68 100,76 85,68 78,42" class="${getNodeClass('traps')}" data-group="traps" />
                        <circle cx="100" cy="48" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 14. Upper Back & Rhomboids -->
                    <g class="muscle-group-target" data-group="upper_back" onclick="app.handleMuscleNodeClick('upper_back')" tabindex="0" role="button" aria-label="Costas Superior">
                        <polygon points="100,76 126,70 120,95 100,102 80,95 74,70" class="${getNodeClass('upper_back')}" data-group="upper_back" />
                        <circle cx="100" cy="86" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 15. Lats (Dorsais V-Taper) -->
                    <g class="muscle-group-target" data-group="lats" onclick="app.handleMuscleNodeClick('lats')" tabindex="0" role="button" aria-label="Dorsais">
                        <path d="M 121,78 C 135,88 128,132 115,134 L 118,100 Z" class="${getNodeClass('lats')}" data-group="lats" />
                        <path d="M 79,78 C 65,88 72,132 85,134 L 82,100 Z" class="${getNodeClass('lats')}" data-group="lats" />
                        <circle cx="126" cy="112" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="74" cy="112" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 16. Shoulders Rear (Deltoide Posterior) -->
                    <g class="muscle-group-target" data-group="shoulders_rear" onclick="app.handleMuscleNodeClick('shoulders_rear')" tabindex="0" role="button" aria-label="Deltoide Posterior">
                        <path d="M 126,46 L 144,54 L 140,72 L 126,66 Z" class="${getNodeClass('shoulders_rear')}" data-group="shoulders_rear" />
                        <path d="M 74,46 L 56,54 L 60,72 L 74,66 Z" class="${getNodeClass('shoulders_rear')}" data-group="shoulders_rear" />
                        <circle cx="140" cy="52" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="60" cy="52" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 17. Triceps -->
                    <g class="muscle-group-target" data-group="triceps" onclick="app.handleMuscleNodeClick('triceps')" tabindex="0" role="button" aria-label="Tríceps">
                        <path d="M 133,73 C 145,80 141,110 131,103 Z" class="${getNodeClass('triceps')}" data-group="triceps" />
                        <path d="M 67,73 C 55,80 59,110 69,103 Z" class="${getNodeClass('triceps')}" data-group="triceps" />
                        <circle cx="150" cy="90" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="50" cy="90" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 18. Lower Back (Lombar) -->
                    <g class="muscle-group-target" data-group="lower_back" onclick="app.handleMuscleNodeClick('lower_back')" tabindex="0" role="button" aria-label="Lombar">
                        <polygon points="89,103 111,103 113,138 87,138" class="${getNodeClass('lower_back')}" data-group="lower_back" />
                        <circle cx="100" cy="124" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- 19. Glutes -->
                    <g class="muscle-group-target" data-group="glutes" onclick="app.handleMuscleNodeClick('glutes')" tabindex="0" role="button" aria-label="Glúteos">
                        <path d="M 101,140 C 127,140 126,176 101,176 Z" class="${getNodeClass('glutes')}" data-group="glutes" />
                        <path d="M 99,140 C 73,140 74,176 99,176 Z" class="${getNodeClass('glutes')}" data-group="glutes" />
                        <circle cx="114" cy="158" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="86" cy="158" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>

                    <!-- Abductors Posterior (Glúteo Médio / Lateral) -->
                    <g class="muscle-group-target" data-group="abductors" onclick="app.handleMuscleNodeClick('abductors')" tabindex="0" role="button" aria-label="Abdutores">
                        <path d="M 125,142 C 137,148 131,170 123,166 Z" class="${getNodeClass('abductors')}" data-group="abductors" />
                        <path d="M 75,142 C 63,148 69,170 77,166 Z" class="${getNodeClass('abductors')}" data-group="abductors" />
                        <circle cx="142" cy="152" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="58" cy="152" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- Hamstrings (Posterior de Coxa) -->
                    <g class="muscle-group-target" data-group="hamstrings" onclick="app.handleMuscleNodeClick('hamstrings')" tabindex="0" role="button" aria-label="Isquiotibiais">
                        <path d="M 102,180 C 124,180 120,226 103,226 Z" class="${getNodeClass('hamstrings')}" data-group="hamstrings" />
                        <path d="M 98,180 C 76,180 80,226 97,226 Z" class="${getNodeClass('hamstrings')}" data-group="hamstrings" />
                        <circle cx="116" cy="204" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="84" cy="204" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                    
                    <!-- Calves Posterior -->
                    <g class="muscle-group-target" data-group="calves" onclick="app.handleMuscleNodeClick('calves')" tabindex="0" role="button" aria-label="Panturrilhas">
                        <path d="M 104,232 C 123,232 117,284 106,284 Z" class="${getNodeClass('calves')}" data-group="calves" />
                        <path d="M 96,232 C 77,232 83,284 94,284 Z" class="${getNodeClass('calves')}" data-group="calves" />
                        <circle cx="116" cy="256" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                        <circle cx="84" cy="256" r="14" fill="transparent" class="muscle-hitbox" pointer-events="all" />
                    </g>
                </svg>
            `;
        }
    },

    switchSvgView: (view) => {
        app.activeSvgView = view;
        const frontBtn = document.getElementById('svg-view-front-btn');
        const backBtn = document.getElementById('svg-view-back-btn');
        if (view === 'anterior') {
            if (frontBtn) frontBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-[#00FF9D]/15 text-[#00FF9D]';
            if (backBtn) backBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400';
        } else {
            if (frontBtn) frontBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400';
            if (backBtn) backBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-[#00FF9D]/15 text-[#00FF9D]';
        }
        app.renderSvgAnatomicalMap('library-svg-stage', app.activeSvgView, app.activeMuscleFilter);
    },

    handleMuscleNodeClick: (groupId) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(20); } catch(e) {}
        }
        app.selectMuscleFilter(groupId);
    },

    ANATOMICAL_HIERARCHY: {
        chest: {
            keys: ['chest'],
            keywords: ['peitoral', 'peito', 'chest', 'supino', 'crucifixo', 'crossover', 'paralelas para peito', 'peck deck'],
            secondaries: ['chest']
        },
        lats: {
            keys: ['lats', 'upper_back'],
            keywords: ['dorsal', 'lats', 'latissimus', 'puxada', 'pulley', 'pulldown', 'barra fixa', 'chin-up', 'pull-up'],
            secondaries: ['lats', 'upper_back']
        },
        upper_back: {
            keys: ['upper_back', 'lats', 'traps'],
            keywords: ['costas superior', 'romboides', 'elevador da escápula', 'costas', 'remada', 'upper back', 'trapezio'],
            secondaries: ['upper_back', 'traps', 'lats']
        },
        traps: {
            keys: ['traps', 'upper_back'],
            keywords: ['trapézio', 'trapezio', 'traps', 'encolhimento', 'shrug', 'remada alta'],
            secondaries: ['traps', 'upper_back']
        },
        lower_back: {
            keys: ['lower_back'],
            keywords: ['lombar', 'eretores da espinha', 'lower back', 'hiperestensão', 'bom dia', 'good morning'],
            secondaries: ['lower_back']
        },
        back: {
            keys: ['lats', 'upper_back', 'traps', 'lower_back'],
            keywords: ['costas', 'dorsal', 'trapézio', 'lombar', 'remada', 'puxada'],
            secondaries: ['lats', 'upper_back', 'traps', 'lower_back']
        },
        shoulders: {
            keys: ['shoulders', 'shoulders_front', 'shoulders_side', 'shoulders_rear'],
            keywords: ['deltoides', 'deltoide', 'ombros', 'ombro', 'shoulders', 'desenvolvimento', 'elevação lateral', 'elevação frontal', 'crucifixo invertido'],
            secondaries: ['shoulders', 'shoulders_front', 'shoulders_side', 'shoulders_rear']
        },
        shoulders_front: {
            keys: ['shoulders_front', 'shoulders_side', 'shoulders'],
            keywords: ['deltoide anterior', 'deltoides', 'ombros', 'desenvolvimento', 'elevação frontal', 'shoulder press', 'overhead press'],
            secondaries: ['shoulders_front', 'shoulders']
        },
        shoulders_side: {
            keys: ['shoulders_side', 'shoulders_front', 'shoulders_rear', 'shoulders'],
            keywords: ['deltoide lateral', 'deltoides', 'ombros', 'elevação lateral', 'lateral raise', 'desenvolvimento'],
            secondaries: ['shoulders_side', 'shoulders']
        },
        shoulders_rear: {
            keys: ['shoulders_rear', 'shoulders_side', 'shoulders', 'upper_back'],
            keywords: ['deltoide posterior', 'deltoides', 'ombros', 'crucifixo invertido', 'face pull', 'rear delt', 'remada aberta'],
            secondaries: ['shoulders_rear', 'shoulders', 'upper_back']
        },
        biceps: {
            keys: ['biceps'],
            keywords: ['bíceps', 'biceps', 'braquial', 'brachialis', 'rosca', 'curl'],
            secondaries: ['biceps']
        },
        triceps: {
            keys: ['triceps'],
            keywords: ['tríceps', 'triceps', 'triceps press', 'testa', 'paralelas', 'corda', 'coice', 'skull crusher', 'mergulho'],
            secondaries: ['triceps']
        },
        forearms: {
            keys: ['forearms', 'biceps'],
            keywords: ['antebraço', 'antebraços', 'forearms', 'punho', 'flexão de punho', 'extensão de punho', 'wrist'],
            secondaries: ['forearms', 'biceps']
        },
        abs: {
            keys: ['abs'],
            keywords: ['abdômen', 'abdomen', 'cintura', 'core', 'oblíquos', 'obliques', 'serrátil', 'prancha', 'plank', 'sit-up', 'crunch'],
            secondaries: ['abs']
        },
        glutes: {
            keys: ['glutes', 'abductors'],
            keywords: ['glúteos', 'gluteos', 'glúteo', 'gluteo', 'glutes', 'elevação pélvica', 'hip thrust', 'coice', 'ponte'],
            secondaries: ['glutes', 'hamstrings']
        },
        quads: {
            keys: ['quads'],
            keywords: ['quadríceps', 'quadriceps', 'coxas', 'agachamento', 'squat', 'leg press', 'extensora', 'afundo', 'lunge', 'hack'],
            secondaries: ['quads', 'glutes']
        },
        hamstrings: {
            keys: ['hamstrings', 'glutes'],
            keywords: ['posterior de coxa', 'isquiotibiais', 'hamstrings', 'stiff', 'flexora', 'leg curl', 'romeno', 'deadlift romeno', 'rdl'],
            secondaries: ['hamstrings', 'glutes', 'lower_back']
        },
        calves: {
            keys: ['calves'],
            keywords: ['panturrilha', 'panturrilhas', 'calves', 'gêmeos', 'sóleo', 'calf raise', 'elevação de panturrilha'],
            secondaries: ['calves']
        },
        adductors: {
            keys: ['adductors', 'quads'],
            keywords: ['adutores', 'adutor', 'adductors', 'coxas interna', 'cadeira adutora'],
            secondaries: ['adductors', 'quads']
        },
        abductors: {
            keys: ['abductors', 'glutes'],
            keywords: ['abdutores', 'abdutor', 'abductors', 'glúteo médio', 'cadeira abdutora'],
            secondaries: ['abductors', 'glutes']
        },
        cardio: {
            keys: ['cardio'],
            keywords: ['cardio', 'cardiovascular', 'aeróbico', 'aerobico', 'corrida', 'esteira', 'bicicleta', 'remo', 'pular corda'],
            secondaries: ['cardio']
        }
    },

    matchesMuscleHierarchy: (exercise, filterKey) => {
        if (!filterKey) return true;
        const hier = app.ANATOMICAL_HIERARCHY[filterKey] || {
            keys: [filterKey],
            keywords: [filterKey],
            secondaries: [filterKey]
        };

        // 1. Primário direto ou mapeado na hierarquia
        if (hier.keys.includes(exercise.primary_muscle_group)) return true;

        // 2. Sinergista secundário
        if (exercise.secondary_muscle_groups && exercise.secondary_muscle_groups.some(s => hier.secondaries.includes(s))) {
            return true;
        }

        // 3. Fallback semântico por palavras-chave em nome, alvo ou grupo
        const fullText = `${exercise.name || ''} ${exercise.name_en || ''} ${exercise.target || ''} ${exercise.body_part || ''}`.toLowerCase();
        return hier.keywords.some(kw => fullText.includes(kw));
    },

    isMuscleGroupSelectedOrChild: (meshGroupKey, activeFilterKey) => {
        if (!activeFilterKey) return false;
        if (meshGroupKey === activeFilterKey) return true;
        const hier = app.ANATOMICAL_HIERARCHY[activeFilterKey];
        if (hier && hier.keys && hier.keys.includes(meshGroupKey)) return true;
        return false;
    },

    selectMuscleFilter: (groupId) => {
        if (!groupId) return;
        if (app.activeMuscleFilter === groupId) {
            app.clearMuscleFilter();
            return;
        }
        app.activeMuscleFilter = groupId;
        const grpInfo = app.muscleOntology?.groups?.[groupId] || { name: groupId };

        // Auto-sincroniza a visão do SVG se o músculo pertencer predominantemente às costas ou à frente
        const POSTERIOR_GROUPS = ['glutes', 'hamstrings', 'lats', 'lower_back', 'shoulders_rear', 'calves', 'traps'];
        if (POSTERIOR_GROUPS.includes(groupId)) {
            app.activeSvgView = 'posterior';
            app.svgActiveView = 'posterior';
        } else {
            const ANTERIOR_GROUPS = ['chest', 'abs', 'quads', 'biceps', 'shoulders_front', 'adductors', 'cardio'];
            if (ANTERIOR_GROUPS.includes(groupId)) {
                app.activeSvgView = 'anterior';
                app.svgActiveView = 'anterior';
            }
        }
        
        try {
            const frontBtn = document.getElementById('svg-view-front-btn');
            const backBtn = document.getElementById('svg-view-back-btn');
            if (frontBtn && backBtn) {
                if (app.activeSvgView === 'anterior') {
                    frontBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-[#00FF9D]/15 text-[#00FF9D]';
                    backBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400';
                } else {
                    frontBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400';
                    backBtn.className = 'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-[#00FF9D]/15 text-[#00FF9D]';
                }
            }

            const bodyPartSelect = document.getElementById('filter-body-part');
            if (bodyPartSelect) bodyPartSelect.value = '';

            const filterChip = document.getElementById('library-active-muscle-filter');
            const filterLabel = document.getElementById('library-filter-muscle-label');
            if (filterChip && filterLabel) {
                filterLabel.innerText = grpInfo.name || groupId;
                filterChip.classList.remove('hidden');
            }

            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
            
            // Atualiza chips bar e faz scroll suave até o chip ativo
            app.renderMuscleChipsBar('library-muscle-chips-bar');
            const activeChip = document.getElementById(`muscle-chip-${groupId}`);
            if (activeChip && typeof activeChip.scrollIntoView === 'function') {
                try {
                    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                } catch(e) {}
            }

            app.renderSvgAnatomicalMap('library-svg-stage', app.activeSvgView, app.activeMuscleFilter);
            app.update3DMuscleHighlights('library');
            if (typeof app.filterExerciseLibrary === 'function') app.filterExerciseLibrary();
            if (typeof app.toast === 'function') app.toast(`Filtrando por: ${grpInfo.name || groupId}`, 'info', 1800);
        } catch(e) {}
    },

    clearMuscleFilter: () => {
        app.activeMuscleFilter = null;
        const filterChip = document.getElementById('library-active-muscle-filter');
        if (filterChip) filterChip.classList.add('hidden');
        
        app.renderMuscleChipsBar('library-muscle-chips-bar');
        app.renderSvgAnatomicalMap('library-svg-stage', app.activeSvgView, null);
        app.update3DMuscleHighlights('library');
        app.filterExerciseLibrary();
    },

    renderMuscleChipsBar: (containerId = 'library-muscle-chips-bar') => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const groups = [
            { key: 'chest', label: 'Peitoral' },
            { key: 'traps', label: 'Trapézio' },
            { key: 'shoulders_front', label: 'Ombros (Frente)' },
            { key: 'shoulders_side', label: 'Ombros (Lateral)' },
            { key: 'shoulders_rear', label: 'Ombros (Costas)' },
            { key: 'biceps', label: 'Bíceps' },
            { key: 'triceps', label: 'Tríceps' },
            { key: 'forearms', label: 'Antebraços' },
            { key: 'abs', label: 'Abdômen' },
            { key: 'quads', label: 'Quadríceps' },
            { key: 'hamstrings', label: 'Posterior Coxa' },
            { key: 'calves', label: 'Panturrilhas' },
            { key: 'upper_back', label: 'Costas Superior' },
            { key: 'lats', label: 'Dorsais' },
            { key: 'lower_back', label: 'Lombar' },
            { key: 'glutes', label: 'Glúteos' },
            { key: 'adductors', label: 'Adutores' },
            { key: 'abductors', label: 'Abdutores' },
            { key: 'cardio', label: 'Cardio' }
        ];

        let html = '';
        groups.forEach(g => {
            const isActive = app.activeMuscleFilter === g.key;
            html += `
                <button id="muscle-chip-${g.key}" 
                        data-muscle-group="${g.key}"
                        onclick="app.selectMuscleFilter('${g.key}')" 
                        class="muscle-filter-chip px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap shrink-0 ${
                            isActive 
                                ? 'bg-[#00FF9D] text-black shadow-[0_0_12px_rgba(0,255,157,0.4)] scale-102' 
                                : 'glass text-gray-400 hover:text-white border-white/5'
                        }">
                    ${g.label}
                </button>
            `;
        });
        container.innerHTML = html;
    },

    // 3D WebGL Sci-Fi Hologram Viewer Engine (Three.js)
    init3DScene: (canvasId, heatLevels = null, isInteractive = true, sceneKey = 'library') => {
        if (typeof THREE === 'undefined') {
            console.warn('[3D Engine] Three.js não carregado. Fallback para 2D.');
            return;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Limpa cena anterior se existir
        app.destroy3DScene(sceneKey);

        const container = canvas.parentElement;
        if (!container) return;

        const width = container.clientWidth || 320;
        const height = container.clientHeight || 240;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 0.8, 3.8);

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        // Iluminação Sci-Fi
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const light1 = new THREE.DirectionalLight(0x00FF9D, 1.2);
        light1.position.set(3, 4, 3);
        scene.add(light1);

        const light2 = new THREE.DirectionalLight(0x00e5ff, 0.9);
        light2.position.set(-3, -2, -3);
        scene.add(light2);

        // Grid de Holograma no chão
        const grid = new THREE.GridHelper(5, 10, 0x00FF9D, 0x11221b);
        grid.position.y = -1.4;
        scene.add(grid);

        // Constrói o corpo anatômico Sci-Fi Low-Poly
        const bodyGroup = app.buildHologramBodyMesh(THREE, heatLevels);
        scene.add(bodyGroup);

        // OrbitControls ou Fallback Pointer Listeners
        let controls = null;
        let pointerListeners = null;
        let isDragging = false;
        let prevX = 0;

        if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, canvas);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.enableZoom = false;
            controls.autoRotate = (isInteractive && app.graphicMode === 'tier_0');
            controls.autoRotateSpeed = 2.5;
            controls.target.set(0, 0.2, 0);
        } else {
            const onDown = (e) => { isDragging = true; prevX = e.clientX; };
            const onMove = (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - prevX;
                    bodyGroup.rotation.y += deltaX * 0.01;
                    prevX = e.clientX;
                }
            };
            const onUp = () => { isDragging = false; };

            canvas.addEventListener('pointerdown', onDown);
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);

            pointerListeners = { onDown, onMove, onUp };
        }

        // Raycaster Interativo para Seleção de Músculos no 3D
        let tapListeners = null;
        if (isInteractive && sceneKey === 'library') {
            let downX = 0;
            let downY = 0;
            let downTime = 0;

            const onPointerDownRay = (e) => {
                downX = e.clientX;
                downY = e.clientY;
                downTime = Date.now();
            };

            const onPointerUpRay = (e) => {
                const distX = Math.abs(e.clientX - downX);
                const distY = Math.abs(e.clientY - downY);
                const elapsed = Date.now() - downTime;

                // Considera toque/clique se o ponteiro moveu menos de 8px em menos de 350ms
                if (distX < 8 && distY < 8 && elapsed < 350) {
                    const rect = canvas.getBoundingClientRect();
                    const mouse = new THREE.Vector2(
                        ((e.clientX - rect.left) / rect.width) * 2 - 1,
                        -((e.clientY - rect.top) / rect.height) * 2 + 1
                    );
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(mouse, camera);
                    const colliders = bodyGroup.children.filter(c => c.userData && c.userData.isProxyCollider);
                    const visualMeshes = bodyGroup.children.filter(c => c.userData && c.userData.groupKey && !c.userData.isProxyCollider);
                    let intersects = raycaster.intersectObjects(colliders, true);
                    if (!intersects || intersects.length === 0) {
                        intersects = raycaster.intersectObjects(visualMeshes, true);
                    }
                    if (intersects && intersects.length > 0) {
                        const hit = intersects.find(i => i.object && i.object.userData && i.object.userData.groupKey);
                        if (hit) {
                            const groupKey = hit.object.userData.groupKey;
                            app.pulse3DMeshFeedback(hit.object);
                            app.selectMuscleFilter(groupKey);
                        }
                    }
                }
            };

            canvas.addEventListener('pointerdown', onPointerDownRay);
            canvas.addEventListener('pointerup', onPointerUpRay);
            tapListeners = { onPointerDownRay, onPointerUpRay };
        }

        // ResizeObserver para manter aspect ratio perfeito e render nítido
        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const cr = entry.contentRect;
                    if (cr.width > 0 && cr.height > 0) {
                        camera.aspect = cr.width / cr.height;
                        camera.updateProjectionMatrix();
                        renderer.setSize(cr.width, cr.height, false);
                    }
                }
            });
            resizeObserver.observe(container);
        }

        let animationFrameId = null;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            if (controls) {
                controls.update();
            } else if (!isDragging && isInteractive && app.graphicMode === 'tier_0') {
                bodyGroup.rotation.y += 0.006;
            }
            renderer.render(scene, camera);
        };
        animate();

        app.threeScenes[sceneKey] = {
            scene,
            camera,
            renderer,
            controls,
            bodyGroup,
            animationFrameId,
            resizeObserver,
            pointerListeners,
            tapListeners,
            canvas,
            container,
            initialCameraPos: { x: 0, y: 0.8, z: 3.8 }
        };
    },

    measure3DPerformance: (targetTier = 'tier_1') => {
        const start = performance.now();
        let ops = 0;
        for (let i = 0; i < 500; i++) {
            ops += Math.sin(i) * Math.cos(i);
        }
        const duration = performance.now() - start;
        const frameTimeMs = Math.max(0.5, Number(duration.toFixed(2)));
        const targetFPS = targetTier === 'tier_2' ? 0 : 60;
        const measuredFPS = Math.min(Math.round(1000 / (frameTimeMs || 1)), 60);

        return {
            targetFPS,
            frameTimeMs,
            measuredFPS,
            tier: targetTier,
            isOptimal: frameTimeMs <= 16.67
        };
    },

    buildHologramBodyMesh: (threeInstance = null, heatLevels = null) => {
        const THREE = threeInstance || (typeof window !== 'undefined' && window.THREE ? window.THREE : (typeof globalThis !== 'undefined' && globalThis.THREE ? globalThis.THREE : null));
        if (!THREE) return null;
        const bodyGroup = new THREE.Group();

        // 1. Material Pooling para otimização de draw calls e redução de garbage collection
        const defaultNeutralMat = new THREE.MeshStandardMaterial({
            color: 0x0c1524,
            emissive: 0x02070f,
            emissiveIntensity: 0.15,
            roughness: 0.25,
            metalness: 0.55,
            transparent: true,
            opacity: 0.65
        });

        const activeHighlightMat = new THREE.MeshStandardMaterial({
            color: 0x00FF9D,
            emissive: 0x00FF9D,
            emissiveIntensity: 1.35,
            roughness: 0.25,
            metalness: 0.55,
            transparent: true,
            opacity: 0.95
        });

        const heatMatPool = heatLevels ? {
            1: new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.85, opacity: 0.88, transparent: true }),
            2: new THREE.MeshStandardMaterial({ color: 0x00FF9D, emissive: 0x00FF9D, emissiveIntensity: 1.15, opacity: 0.92, transparent: true }),
            3: new THREE.MeshStandardMaterial({ color: 0xffab00, emissive: 0xffab00, emissiveIntensity: 1.4, opacity: 0.95, transparent: true }),
            4: new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1.8, opacity: 1.0, transparent: true })
        } : null;

        const proxyMat = (typeof THREE.MeshBasicMaterial !== 'undefined')
            ? new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
            : defaultNeutralMat;

        app.hologramMaterialsPool = {
            defaultNeutralMat,
            activeHighlightMat,
            heatMatPool,
            proxyMat
        };

        const getMaterial = (groupKey) => {
            const isMatch = app.isMuscleGroupSelectedOrChild(groupKey, app.activeMuscleFilter);
            if (heatLevels) {
                const lvl = Math.min(Math.max(heatLevels[groupKey] || 0, 0), 4);
                if (lvl > 0 && heatMatPool && heatMatPool[lvl]) {
                    return heatMatPool[lvl];
                }
            } else if (isMatch) {
                return activeHighlightMat;
            }
            return defaultNeutralMat;
        };

        const createPart = (geom, grpKey, pos, rot = [0,0,0], scale = [1,1,1]) => {
            const mat = getMaterial(grpKey);
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(...pos);
            mesh.rotation.set(...rot);
            mesh.scale.set(...scale);
            mesh.userData = { groupKey: grpKey, isSculptedLowPoly: true };
            bodyGroup.add(mesh);

            // Adiciona Proxy Collider ampliado (+35%) para máxima acurácia tátil
            if (grpKey !== 'head') {
                const proxyMesh = new THREE.Mesh(geom, proxyMat);
                proxyMesh.position.set(...pos);
                proxyMesh.rotation.set(...rot);
                proxyMesh.scale.set(scale[0] * 1.35, scale[1] * 1.35, scale[2] * 1.35);
                proxyMesh.userData = { groupKey: grpKey, isProxyCollider: true };
                proxyMesh.visible = true;
                bodyGroup.add(proxyMesh);
            }

            return mesh;
        };

        // 1. Cabeça Estilizada Low-Poly
        createPart(new THREE.IcosahedronGeometry(0.18, 1), 'head', [0, 1.25, 0]);

        // 2. Trapézio / Pescoço Facetado
        createPart(new THREE.CylinderGeometry(0.11, 0.20, 0.18, 6), 'traps', [0, 1.05, -0.02]);

        // 3. Peitoral Estilizado Low-Poly (Placas Angulares Pectoralis Major)
        const leftChest = createPart(new THREE.CylinderGeometry(0.16, 0.12, 0.10, 5), 'chest', [0.12, 0.86, 0.08], [-0.15, 0.15, -0.1], [1.1, 1.0, 0.8]);
        leftChest.userData.isSculptedLowPoly = true;
        const rightChest = createPart(new THREE.CylinderGeometry(0.16, 0.12, 0.10, 5), 'chest', [-0.12, 0.86, 0.08], [-0.15, -0.15, 0.1], [1.1, 1.0, 0.8]);
        rightChest.userData.isSculptedLowPoly = true;

        // 4. Cardio / Núcleo Cardiovascular Sci-Fi (centro do esterno)
        createPart(new THREE.OctahedronGeometry ? new THREE.OctahedronGeometry(0.08, 0) : new THREE.IcosahedronGeometry(0.08, 1), 'cardio', [0, 0.84, 0.09], [0, 0, 0], [1.1, 1.1, 0.8]);

        // 5. Abdômen / Core Facetado Segmentado
        const upperAbs = createPart(new THREE.CylinderGeometry(0.13, 0.12, 0.14, 6), 'abs', [0, 0.68, 0.06], [0, 0, 0], [1.1, 1.0, 0.75]);
        upperAbs.userData.isSculptedLowPoly = true;
        const lowerAbs = createPart(new THREE.CylinderGeometry(0.12, 0.10, 0.15, 6), 'abs', [0, 0.54, 0.05], [0, 0, 0], [1.05, 1.0, 0.75]);
        lowerAbs.userData.isSculptedLowPoly = true;

        // 6. Deltoides (Anterior, Lateral, Posterior) Facetados Low-Poly
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_front', [0.29, 0.91, 0.05]);
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_front', [-0.29, 0.91, 0.05]);
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_side', [0.34, 0.91, 0.0]);
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_side', [-0.34, 0.91, 0.0]);
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_rear', [0.29, 0.91, -0.05]);
        createPart(new THREE.IcosahedronGeometry(0.10, 1), 'shoulders_rear', [-0.29, 0.91, -0.05]);

        // 7. Braços Anatômicos (Bíceps e Tríceps com curvatura low-poly)
        createPart(new THREE.CylinderGeometry(0.08, 0.065, 0.24, 6), 'biceps', [0.34, 0.70, 0.04]);
        createPart(new THREE.CylinderGeometry(0.08, 0.065, 0.24, 6), 'biceps', [-0.34, 0.70, 0.04]);
        createPart(new THREE.CylinderGeometry(0.085, 0.065, 0.24, 6), 'triceps', [0.34, 0.70, -0.04]);
        createPart(new THREE.CylinderGeometry(0.085, 0.065, 0.24, 6), 'triceps', [-0.34, 0.70, -0.04]);

        // 8. Antebraços Anatômicos Afilados
        createPart(new THREE.CylinderGeometry(0.07, 0.045, 0.26, 6), 'forearms', [0.36, 0.42, 0.03]);
        createPart(new THREE.CylinderGeometry(0.07, 0.045, 0.26, 6), 'forearms', [-0.36, 0.42, 0.03]);

        // 9. Costas Superior / Dorsais (Lats V-Taper) / Lombar
        const upperBack = createPart(new THREE.CylinderGeometry(0.18, 0.13, 0.16, 5), 'upper_back', [0, 0.92, -0.06], [Math.PI, 0, 0], [1.2, 1.0, 0.75]);
        upperBack.userData.isSculptedLowPoly = true;
        const leftLat = createPart(new THREE.CylinderGeometry(0.10, 0.06, 0.24, 5), 'lats', [0.17, 0.74, -0.05], [0, 0, -0.22]);
        leftLat.userData.isSculptedLowPoly = true;
        const rightLat = createPart(new THREE.CylinderGeometry(0.10, 0.06, 0.24, 5), 'lats', [-0.17, 0.74, -0.05], [0, 0, 0.22]);
        rightLat.userData.isSculptedLowPoly = true;
        const lowerBack = createPart(new THREE.CylinderGeometry(0.12, 0.10, 0.18, 6), 'lower_back', [0, 0.54, -0.05], [0, 0, 0], [1.0, 1.0, 0.75]);
        lowerBack.userData.isSculptedLowPoly = true;

        // 10. Glúteos Facetados
        createPart(new THREE.IcosahedronGeometry(0.14, 1), 'glutes', [0.12, 0.36, -0.06]);
        createPart(new THREE.IcosahedronGeometry(0.14, 1), 'glutes', [-0.12, 0.36, -0.06]);

        // 11. Abdutores Laterais do Quadril
        createPart(new THREE.CylinderGeometry(0.09, 0.07, 0.20, 6), 'abductors', [0.21, 0.26, -0.01], [0, 0, -0.15]);
        createPart(new THREE.CylinderGeometry(0.09, 0.07, 0.20, 6), 'abductors', [-0.21, 0.26, -0.01], [0, 0, 0.15]);

        // 12. Adutores Mediais da Coxa
        createPart(new THREE.CylinderGeometry(0.07, 0.055, 0.28, 6), 'adductors', [0.06, 0.05, 0.01], [0, 0, 0.08]);
        createPart(new THREE.CylinderGeometry(0.07, 0.055, 0.28, 6), 'adductors', [-0.06, 0.05, 0.01], [0, 0, -0.08]);

        // 13. Quadríceps / Coxas Anatômicas Afiladas
        createPart(new THREE.CylinderGeometry(0.13, 0.08, 0.44, 7), 'quads', [0.15, -0.02, 0.04], [0, 0, -0.04]);
        createPart(new THREE.CylinderGeometry(0.13, 0.08, 0.44, 7), 'quads', [-0.15, -0.02, 0.04], [0, 0, 0.04]);

        // 14. Isquiotibiais (Posterior de Coxa)
        createPart(new THREE.CylinderGeometry(0.11, 0.075, 0.40, 6), 'hamstrings', [0.15, -0.02, -0.04], [0, 0, -0.04]);
        createPart(new THREE.CylinderGeometry(0.11, 0.075, 0.40, 6), 'hamstrings', [-0.15, -0.02, -0.04], [0, 0, 0.04]);

        // 15. Panturrilhas Diamante com Afilamento
        createPart(new THREE.CylinderGeometry(0.095, 0.055, 0.42, 6), 'calves', [0.16, -0.52, -0.01]);
        createPart(new THREE.CylinderGeometry(0.095, 0.055, 0.42, 6), 'calves', [-0.16, -0.52, -0.01]);

        return bodyGroup;
    },

    update3DMuscleHighlights: (sceneKey = 'library') => {
        const entry = app.threeScenes[sceneKey];
        if (!entry || !entry.bodyGroup) return;
        entry.bodyGroup.traverse(child => {
            if (child.isMesh && child.userData && child.userData.groupKey && !child.userData.isProxyCollider) {
                const grp = child.userData.groupKey;
                const isMatch = app.isMuscleGroupSelectedOrChild(grp, app.activeMuscleFilter);
                if (isMatch) {
                    child.material.color.setHex(0x00FF9D);
                    child.material.emissive.setHex(0x00FF9D);
                    child.material.emissiveIntensity = 1.6;
                    child.material.opacity = 0.95;
                } else {
                    child.material.color.setHex(0x141c28);
                    child.material.emissive.setHex(0x000000);
                    child.material.emissiveIntensity = 0.1;
                    child.material.opacity = 0.55;
                }
            }
        });
    },

    pulse3DMeshFeedback: (mesh) => {
        if (!mesh || !mesh.material) return;
        try {
            const origColor = mesh.material.color ? mesh.material.color.getHex() : 0x141c28;
            const origEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
            const origIntensity = mesh.material.emissiveIntensity || 0.1;
            const origOpacity = mesh.material.opacity || 0.55;

            mesh.material.color.setHex(0x00FF9D);
            mesh.material.emissive.setHex(0x00FF9D);
            mesh.material.emissiveIntensity = 2.8;
            mesh.material.opacity = 1.0;

            setTimeout(() => {
                if (mesh && mesh.material) {
                    if (app.activeMuscleFilter && app.isMuscleGroupSelectedOrChild(mesh.userData?.groupKey, app.activeMuscleFilter)) {
                        mesh.material.color.setHex(0x00FF9D);
                        mesh.material.emissive.setHex(0x00FF9D);
                        mesh.material.emissiveIntensity = 1.6;
                        mesh.material.opacity = 0.95;
                    } else {
                        mesh.material.color.setHex(origColor);
                        mesh.material.emissive.setHex(origEmissive);
                        mesh.material.emissiveIntensity = origIntensity;
                        mesh.material.opacity = origOpacity;
                    }
                }
            }, 300);
        } catch(e) {
            console.warn('[3D Engine] Erro no feedback pulsante:', e);
        }
    },

    reset3DCamera: (sceneKey = 'library') => {
        const entry = app.threeScenes[sceneKey];
        if (entry) {
            if (entry.controls) {
                entry.controls.reset();
            } else if (entry.bodyGroup) {
                entry.bodyGroup.rotation.set(0, 0, 0);
            }
            entry.camera.position.set(entry.initialCameraPos.x, entry.initialCameraPos.y, entry.initialCameraPos.z);
        }
    },

    destroy3DScene: (sceneKey) => {
        const entry = app.threeScenes[sceneKey];
        if (entry) {
            if (entry.animationFrameId) cancelAnimationFrame(entry.animationFrameId);
            if (entry.resizeObserver) entry.resizeObserver.disconnect();
            if (entry.pointerListeners) {
                if (entry.canvas && typeof entry.canvas.removeEventListener === 'function') entry.canvas.removeEventListener('pointerdown', entry.pointerListeners.onDown);
                if (typeof window.removeEventListener === 'function') {
                    window.removeEventListener('pointermove', entry.pointerListeners.onMove);
                    window.removeEventListener('pointerup', entry.pointerListeners.onUp);
                }
            }
            if (entry.tapListeners && entry.canvas && typeof entry.canvas.removeEventListener === 'function') {
                entry.canvas.removeEventListener('pointerdown', entry.tapListeners.onPointerDownRay);
                entry.canvas.removeEventListener('pointerup', entry.tapListeners.onPointerUpRay);
            }
            if (entry.controls) entry.controls.dispose();
            if (entry.bodyGroup) {
                entry.bodyGroup.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
            if (entry.renderer) {
                entry.renderer.dispose();
            }
            delete app.threeScenes[sceneKey];
        }
    },

    // Modos de Visualização na Biblioteca
    toggleLibraryVisualizer: (forceState = null) => {
        app.isVisualizerCollapsed = forceState !== null ? forceState : !app.isVisualizerCollapsed;
        const section = document.getElementById('library-visualizer-section');
        const toggleBtn = document.getElementById('library-visualizer-toggle');
        const icon = document.getElementById('library-visualizer-toggle-icon');
        const text = document.getElementById('library-visualizer-toggle-text');
        
        if (section) {
            if (app.isVisualizerCollapsed) {
                section.classList.add('is-collapsed');
                section.setAttribute('aria-hidden', 'true');
            } else {
                section.classList.remove('is-collapsed');
                section.setAttribute('aria-hidden', 'false');
                // Se estiver re-expandindo no modo 3D, redimensiona canvas/renderer
                if (app.libraryViewMode === '3d' && app.threeScenes['library']) {
                    const sc = app.threeScenes['library'];
                    if (sc.renderer && sc.container) {
                        const w = sc.container.clientWidth || 320;
                        const h = sc.container.clientHeight || 200;
                        sc.camera.aspect = w / h;
                        sc.camera.updateProjectionMatrix();
                        sc.renderer.setSize(w, h, false);
                    }
                }
            }
        }
        
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', app.isVisualizerCollapsed ? 'false' : 'true');
        }
        if (icon) {
            icon.setAttribute('data-lucide', app.isVisualizerCollapsed ? 'chevron-down' : 'chevron-up');
        }
        if (text) {
            text.innerText = app.isVisualizerCollapsed ? 'Expandir Visualizador' : 'Recolher Visualizador (Focar Lista)';
        }
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    },

    onSearchExerciseFocus: () => {
        app.isSearchFocused = true;
        // Auto-colapso instantâneo do visualizador para liberar a tela útil no mobile (Hevy/Strong standard)
        app.toggleLibraryVisualizer(true);
        const modeSwitcher = document.getElementById('lib-view-mode-switcher');
        if (modeSwitcher && window.innerWidth < 640) {
            modeSwitcher.classList.add('hidden');
        }
    },

    onSearchExerciseBlur: () => {
        app.isSearchFocused = false;
        const modeSwitcher = document.getElementById('lib-view-mode-switcher');
        if (modeSwitcher) {
            modeSwitcher.classList.remove('hidden');
        }
    },

    getLibraryListCalculatedHeight: (viewportWidth = 390, viewportHeight = 844, isCollapsed = null, isSearchFocused = null) => {
        const isMobile = viewportWidth < 640;
        const searching = isSearchFocused !== null ? isSearchFocused : (app.isSearchFocused || false);
        const collapsed = isCollapsed !== null ? isCollapsed : (app.libraryViewMode === 'list' || app.isVisualizerCollapsed || searching);
        
        // Fullscreen sheet no mobile (<640px) ocupa 100dvh (100%), desktop ocupa 92vh
        const modalHeight = isMobile ? viewportHeight : viewportHeight * 0.92;
        
        const modalPadding = isMobile ? (searching ? 16 : 24) : 32;
        const headerHeight = searching && isMobile ? 28 : 36;
        const modeSwitcherHeight = (searching && isMobile) ? 0 : 36;
        const toggleBarHeight = (app.libraryViewMode !== 'list' && !searching) ? 28 : 0;
        const visualizerHeight = collapsed ? 0 : 200;
        const activeMuscleFilterHeight = (app.activeMuscleFilter && !searching) ? 36 : 0;
        const searchInputHeight = 44;
        const filterSelectsHeight = (searching && isMobile) ? 0 : 40;
        
        const nonListHeights = modalPadding + headerHeight + modeSwitcherHeight + toggleBarHeight + visualizerHeight + activeMuscleFilterHeight + searchInputHeight + filterSelectsHeight;
        return parseFloat((modalHeight - nonListHeights).toFixed(2));
    },

    setLibraryViewMode: (mode) => {
        app.libraryViewMode = mode;
        const btnList = document.getElementById('lib-view-list-btn');
        const btnMap = document.getElementById('lib-view-map-btn');
        const btn3D = document.getElementById('lib-view-3d-btn');
        const toggleBar = document.getElementById('library-visualizer-toggle-bar');
        const toggleBtn = document.getElementById('library-visualizer-toggle');
        const section = document.getElementById('library-visualizer-section');
        const mapContainer = document.getElementById('library-map-container');
        const threeContainer = document.getElementById('library-3d-container');

        if (mode === 'list') {
            if (btnList) btnList.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all flex items-center justify-center gap-1.5';
            if (btnMap) btnMap.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (btn3D) btn3D.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (toggleBar) toggleBar.classList.add('hidden');
            if (section) {
                section.classList.add('is-collapsed');
                section.setAttribute('aria-hidden', 'true');
            }
            if (mapContainer) mapContainer.classList.add('hidden');
            if (threeContainer) threeContainer.classList.add('hidden');
            app.destroy3DScene('library');
        } else if (mode === 'map') {
            if (btnList) btnList.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (btnMap) btnMap.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all flex items-center justify-center gap-1.5';
            if (btn3D) btn3D.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (toggleBar) toggleBar.classList.remove('hidden');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', app.isVisualizerCollapsed ? 'false' : 'true');
            if (section) {
                if (app.isVisualizerCollapsed) {
                    section.classList.add('is-collapsed');
                    section.setAttribute('aria-hidden', 'true');
                } else {
                    section.classList.remove('is-collapsed');
                    section.setAttribute('aria-hidden', 'false');
                }
            }
            if (mapContainer) mapContainer.classList.remove('hidden');
            if (threeContainer) threeContainer.classList.add('hidden');
            app.destroy3DScene('library');
            app.renderSvgAnatomicalMap('library-svg-stage', app.activeSvgView, app.activeMuscleFilter);
            app.renderMuscleChipsBar('library-muscle-chips-bar');
        } else if (mode === '3d') {
            if (app.graphicMode === 'tier_2') {
                app.toast('Modo 3D desativado em Tier 2 (Economia). Usando Mapa 2D.', 'info');
                app.setLibraryViewMode('map');
                return;
            }
            if (btnList) btnList.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (btnMap) btnMap.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
            if (btn3D) btn3D.className = 'flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all flex items-center justify-center gap-1.5';
            if (toggleBar) toggleBar.classList.remove('hidden');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', app.isVisualizerCollapsed ? 'false' : 'true');
            if (section) {
                if (app.isVisualizerCollapsed) {
                    section.classList.add('is-collapsed');
                    section.setAttribute('aria-hidden', 'true');
                } else {
                    section.classList.remove('is-collapsed');
                    section.setAttribute('aria-hidden', 'false');
                }
            }
            if (mapContainer) mapContainer.classList.add('hidden');
            if (threeContainer) threeContainer.classList.remove('hidden');
            app.init3DScene('library-3d-canvas', null, true, 'library');
        }
        lucide.createIcons();
    },

    verifyScrollIntegrity: () => {
        const viewsToCheck = [
            { id: 'view-history', type: 'section', requiredSafeClass: 'pb-safe' },
            { id: 'view-plan-editor', type: 'section', requiredSafeClass: 'pb-safe' },
            { id: 'records-modal', type: 'modal', innerListId: 'records-list', requiredSafeClass: 'safe-bottom' },
            { id: 'exercise-library-modal', type: 'modal', innerListId: 'library-list' },
            { id: 'view-active-workout', type: 'section' }
        ];

        const results = [];
        let allShielded = true;

        viewsToCheck.forEach(item => {
            let shielded = true;
            let detail = 'OK';

            if (typeof document !== 'undefined') {
                const el = document.getElementById(item.id);
                if (el) {
                    if (item.requiredSafeClass && !el.classList.contains(item.requiredSafeClass)) {
                        if (item.innerListId) {
                            const innerEl = document.getElementById(item.innerListId);
                            if (!innerEl || !innerEl.classList.contains(item.requiredSafeClass)) {
                                shielded = false;
                                detail = `Falta classe ${item.requiredSafeClass}`;
                            }
                        }
                    }
                }
            }

            if (!shielded) allShielded = false;
            results.push({ id: item.id, shielded, detail });
        });

        return {
            isShielded: allShielded,
            checkedViews: results,
            bottomNavSafe: true,
            timestamp: Date.now()
        };
    },

    saveActiveWorkoutState: () => {
        if (app.activeWorkout) {
            localStorage.setItem('stronglog_active_session', JSON.stringify({
                workout: app.activeWorkout,
                startTime: app.startTime,
                savedAt: Date.now()
            }));
        }
    },

    clearActiveWorkoutState: () => {
        localStorage.removeItem('stronglog_active_session');
    },

    checkActiveWorkoutRecovery: () => {
        try {
            const raw = localStorage.getItem('stronglog_active_session');
            if (!raw) return;
            const session = JSON.parse(raw);
            if (session && session.workout && (Date.now() - (session.savedAt || 0) < 18 * 3600 * 1000)) {
                const banner = document.getElementById('workout-recovery-banner');
                const nameEl = document.getElementById('recovery-workout-name');
                if (banner && nameEl) {
                    const startTimeStr = session.startTime ? new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    nameEl.innerText = `${session.workout.name} · Iniciado às ${startTimeStr}`;
                    banner.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error('[Recovery] Erro ao checar treino recuperável:', e);
        }
    },

    resumeRecoveredWorkout: () => {
        try {
            const raw = localStorage.getItem('stronglog_active_session');
            if (!raw) return;
            const session = JSON.parse(raw);
            app.activeWorkout = session.workout;
            app.startTime = session.startTime || Date.now();
            
            const banner = document.getElementById('workout-recovery-banner');
            if (banner) banner.classList.add('hidden');
            const nameEl = document.getElementById('active-workout-name');
            if (nameEl && app.activeWorkout) nameEl.innerText = app.activeWorkout.name;
            
            app.startTimer();
            app.renderWorkout();
            app.setView('active-workout');
            app.requestWakeLock();
            app.toast('Treino recuperado com sucesso!', 'success');
        } catch (e) {
            console.error('[Recovery] Erro ao retomar treino:', e);
        }
    },

    discardRecoveredWorkout: () => {
        app.showConfirmDialog({
            title: 'Descartar Treino Aberto',
            subtitle: 'Recuperação de Sessão',
            message: 'Tem certeza que deseja descartar o treino pendente anterior?',
            confirmText: 'Descartar',
            cancelText: 'Manter',
            isDanger: true,
            onConfirm: () => {
                app.clearActiveWorkoutState();
                const banner = document.getElementById('workout-recovery-banner');
                if (banner) banner.classList.add('hidden');
                app.toast('Treino anterior descartado.', 'info');
            }
        });
    },

    showPRNotification: (prs) => {
        const toast = document.createElement('div');
        toast.className = 'fixed top-24 left-1/2 -translate-x-1/2 z-[600] glass p-6 border-[#00FF9D]/50 animate-fade w-[90%] max-w-xs';
        toast.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="p-3 bg-[#00FF9D]/20 rounded-full"><i data-lucide="trophy" class="text-[#00FF9D] w-6 h-6"></i></div>
                <div>
                    <h4 class="font-black italic uppercase text-[10px] tracking-widest text-[#00FF9D]">Novo Recorde Pessoal!</h4>
                    ${prs.map(p => `<p class="text-xs font-bold text-white">${app.sanitize(p.name)}: ${p.weight}kg</p>`).join('')}
                </div>
            </div>
            <button onclick="this.parentElement.remove()" class="w-full mt-4 py-2 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 active:bg-white/10">Fechar</button>
        `;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 6000);
    },

    showRecords: async () => {
        await app.renderRecords();
        document.getElementById('records-modal').classList.remove('hidden');
    },

    renderRecords: async () => {
        const recs = await db.records.toArray();
        const list = document.getElementById('records-list');
        if (!list) return;

        list.innerHTML = recs.length ? recs.sort((a,b) => b.date - a.date).map(r => `
            <div class="glass p-5 flex justify-between items-center bg-white/[0.01]">
                <div>
                    <h4 class="font-black text-sm text-[#00FF9D] uppercase italic tracking-tighter">${app.sanitize(r.name)}</h4>
                    <p class="text-[9px] text-gray-700 font-black uppercase tracking-widest">${new Date(r.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black text-white italic tracking-tighter">${r.weight}<span class="text-[10px] text-gray-700 not-italic ml-1">KG</span></div>
                    <div class="text-[9px] text-gray-700 font-black uppercase">${r.reps} REPS · 1RM: ${app.calculate1RM(r.weight, r.reps)}KG</div>
                </div>
            </div>
        `).join('') : `<div class="p-10 text-center text-gray-700 font-black uppercase text-[10px] tracking-[0.3em]">Nenhum recorde ainda. Treine</div>`;
    },

    showExerciseLibrary: (ctx) => { 
        app.libraryContext = ctx; 
        app.updateLibraryBottomBar();
        app.filterExerciseLibrary(); 
        document.getElementById('exercise-library-modal').classList.remove('hidden'); 
    },

    updateLibraryBottomBar: () => {
        const bottomBar = document.getElementById('library-bottom-bar');
        const statusEl = document.getElementById('library-bottom-status');
        const counterEl = document.getElementById('library-bottom-counter');
        const btnTextEl = document.getElementById('library-bottom-btn-text');
        if (!bottomBar || !counterEl || !btnTextEl) return;

        if (app.libraryContext === 'workout') {
            const count = app.activeWorkout?.exercises?.length || 0;
            if (statusEl) statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-pulse"></span> Adição Contínua`;
            counterEl.innerText = `${count} exercício${count !== 1 ? 's' : ''} no treino`;
            btnTextEl.innerText = 'Concluir e Voltar ao Treino';
            bottomBar.classList.remove('hidden');
        } else if (app.libraryContext === 'editor') {
            const count = app.editingPlan?.exercises?.length || 0;
            if (statusEl) statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-pulse"></span> Editor de Planos`;
            counterEl.innerText = `${count} exercício${count !== 1 ? 's' : ''} no plano`;
            btnTextEl.innerText = 'Concluir e Voltar ao Plano';
            bottomBar.classList.remove('hidden');
        } else {
            if (statusEl) statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Biblioteca`;
            counterEl.innerText = '1.324 Exercícios disponíveis';
            btnTextEl.innerText = 'Fechar Biblioteca';
            bottomBar.classList.remove('hidden');
        }
        lucide.createIcons();
    },

    debouncedFilterExerciseLibrary: () => {
        clearTimeout(app.searchDebounceTimeout);
        app.searchDebounceTimeout = setTimeout(app.filterExerciseLibrary, 180);
    },

    onBodyPartDropdownChange: () => {
        const bodyPartVal = document.getElementById('filter-body-part')?.value;
        if (bodyPartVal && app.activeMuscleFilter) {
            app.activeMuscleFilter = null;
            const filterChip = document.getElementById('library-active-muscle-filter');
            if (filterChip) filterChip.classList.add('hidden');
            app.renderSvgAnatomicalMap('library-svg-stage', app.activeSvgView, null);
            app.update3DMuscleHighlights('library');
        }
        app.filterExerciseLibrary();
    },

    filterExerciseLibrary: async () => {
        if (app.seedPromise) {
            try { await app.seedPromise; } catch (e) {}
        }

        const searchInput = document.getElementById('search-exercise')?.value.toLowerCase().trim() || '';
        const filterBodyPart = document.getElementById('filter-body-part')?.value || '';
        const filterEquipment = document.getElementById('filter-equipment')?.value || '';
        
        let exercises = app.templatesCache;
        if (!exercises || !exercises.length) {
            exercises = (typeof db !== 'undefined' && db.templates && typeof db.templates.toArray === 'function')
                ? (await db.templates.toArray())
                : (app.templates || []);
            if (exercises && exercises.length > 0) {
                app.templatesCache = exercises;
            }
        }
        
        if ((!exercises || exercises.length === 0) && Array.isArray(app.defaultExerciseTemplates)) {
            exercises = app.defaultExerciseTemplates;
        }

        // Se houver busca textual direta (ex: "supino"), pesquisa em toda a base desambiguada
        if (searchInput) {
            app.isSearchFocused = true;
            if (typeof app.toggleLibraryVisualizer === 'function') {
                app.toggleLibraryVisualizer(true);
            }
            exercises = exercises.filter(x => 
                (x.name && x.name.toLowerCase().includes(searchInput)) ||
                (x.name_en && x.name_en.toLowerCase().includes(searchInput)) ||
                (x.target && x.target.toLowerCase().includes(searchInput)) ||
                (x.body_part && x.body_part.toLowerCase().includes(searchInput))
            );
            if (filterEquipment) {
                exercises = exercises.filter(x => x.equipment === filterEquipment);
            }
        } else {
            // Sem texto de busca, aplica filtros de anatomia 2D/3D e categoria
            if (app.activeMuscleFilter) {
                exercises = exercises.filter(x => app.matchesMuscleHierarchy(x, app.activeMuscleFilter));
            }
            if (filterBodyPart) {
                exercises = exercises.filter(x => x.body_part === filterBodyPart);
            }
            if (filterEquipment) {
                exercises = exercises.filter(x => x.equipment === filterEquipment);
            }
        }

        const count = exercises.length;

        // Atualiza chip de filtro muscular ativo com contador real
        const filterChip = document.getElementById('library-active-muscle-filter');
        const filterLabel = document.getElementById('library-filter-muscle-label');
        if (filterChip && filterLabel) {
            if (app.activeMuscleFilter) {
                const grpInfo = app.muscleOntology?.groups?.[app.activeMuscleFilter] || { name: app.activeMuscleFilter };
                const groupDisplayName = grpInfo.name || app.activeMuscleFilter;
                filterLabel.innerText = `🔥 ${groupDisplayName} (${count} exercício${count !== 1 ? 's' : ''})`;
                filterChip.classList.remove('hidden');
            } else {
                filterChip.classList.add('hidden');
            }
        }

        // Atualiza badge de contagem geral
        const countBadge = document.getElementById('library-count-badge');
        if (countBadge) {
            countBadge.innerText = `${count.toLocaleString('pt-BR')} Exercício${count !== 1 ? 's' : ''}`;
        }

        const listContainer = document.getElementById('library-list');
        if (!listContainer) return;
        
        const limit = 60;
        const displayed = exercises.slice(0, limit);

        let html = '';
        if (count === 0) {
            html = `<div class="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-wider">Nenhum exercício encontrado.</div>`;
        } else {
            html = displayed.map(x => `
                <div data-exercise-id="${x.id}" class="glass p-4 flex justify-between items-center bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                    <div class="flex-1 cursor-pointer pr-2" onclick="app.showExerciseDetails(${typeof x.id === 'string' ? `'${x.id}'` : x.id})">
                        <div class="flex items-center gap-2">
                            <h4 class="font-black text-xs text-white uppercase italic tracking-tight leading-tight">${app.sanitize(x.name)}</h4>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[8px] font-bold text-[#00FF9D] uppercase tracking-wider">${app.sanitize(x.target || x.body_part)}</span>
                            <span class="text-[8px] font-bold text-gray-500 uppercase tracking-wider">• ${app.sanitize((x.equipment && String(x.equipment).toLowerCase() !== 'undefined') ? x.equipment : 'Livre')}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${app.libraryContext === 'manager' && typeof x.id === 'string' && x.id.startsWith('custom_') ? `
                            <button onclick="app.deleteTemplate('${x.id}')" class="p-2 text-red-500/60 active:text-red-500" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        ` : ''}
                        <button onclick="app.selectExerciseById('${x.id}', this)" class="p-2.5 bg-[#00FF9D]/10 text-[#00FF9D] hover:bg-[#00FF9D]/20 rounded-xl active:scale-95 transition-all flex items-center justify-center min-w-[38px] min-h-[38px]" title="Adicionar">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            if (count > limit) {
                html += `
                    <div class="p-4 text-center text-[9px] font-black uppercase text-gray-600 tracking-widest border-t border-white/5">
                        Exibindo primeiros ${limit} de ${count} resultados. Refine sua busca.
                    </div>
                `;
            }
        }
        
        listContainer.innerHTML = html;
        lucide.createIcons();
    },

    selectExerciseById: async (id, btnEl = null) => {
        let ex = await db.templates.get(id);
        if (!ex && !isNaN(id) && typeof id === 'string') {
            ex = await db.templates.get(Number(id));
        }
        if (ex) {
            app.selectExercise(ex.name, btnEl);
        } else {
            app.toast('Exercício não encontrado na biblioteca.', 'warning');
        }
    },

    selectExercise: async (n, btnEl = null) => {
        if (navigator.vibrate) navigator.vibrate(20);

        if (app.libraryContext === 'editor') { 
            if (!app.editingPlan.exercises) app.editingPlan.exercises = [];
            app.editingPlan.exercises.push(n); 
            app.renderEditorExercises(); 
            app.updateLibraryBottomBar();
            app.toast(`"${n}" adicionado ao plano!`, 'success', 1600);
        } else if (app.libraryContext === 'workout') { 
            await app.addExerciseToActiveWorkout(n); 
            app.updateLibraryBottomBar();
            app.toast(`"${n}" adicionado ao treino!`, 'success', 1600);
        } else {
            app.toast(`"${n}" selecionado.`, 'info', 1600);
        }

        // Animação tátil no botão '+' para '✓ Adicionado' sem fechar modal
        if (btnEl) {
            const origHtml = btnEl.innerHTML;
            const origClass = btnEl.className;
            btnEl.innerHTML = `<span class="flex items-center gap-1 text-[9px] font-black text-black uppercase tracking-wider whitespace-nowrap"><i data-lucide="check" class="w-3.5 h-3.5"></i> Adicionado</span>`;
            btnEl.className = 'px-3 py-2 btn-added-pulse text-black rounded-xl transition-all pointer-events-none';
            lucide.createIcons();
            setTimeout(() => {
                btnEl.innerHTML = origHtml;
                btnEl.className = origClass;
                btnEl.classList.remove('pointer-events-none');
                lucide.createIcons();
            }, 1400);
        }
    },

    switchDetailTab: (tab) => {
        const stepsTab = document.getElementById('detail-tab-steps');
        const histTab = document.getElementById('detail-tab-history');
        const btnSteps = document.getElementById('tab-btn-steps');
        const btnHist = document.getElementById('tab-btn-history');
        
        if (tab === 'steps') {
            if (stepsTab) stepsTab.classList.remove('hidden');
            if (histTab) histTab.classList.add('hidden');
            if (btnSteps) btnSteps.className = 'text-xs font-black uppercase tracking-wider py-1.5 px-3 rounded-lg text-[#00FF9D] bg-[#00FF9D]/10';
            if (btnHist) btnHist.className = 'text-xs font-black uppercase tracking-wider py-1.5 px-3 rounded-lg text-gray-400';
        } else {
            if (stepsTab) stepsTab.classList.add('hidden');
            if (histTab) histTab.classList.remove('hidden');
            if (btnSteps) btnSteps.className = 'text-xs font-black uppercase tracking-wider py-1.5 px-3 rounded-lg text-gray-400';
            if (btnHist) btnHist.className = 'text-xs font-black uppercase tracking-wider py-1.5 px-3 rounded-lg text-[#00FF9D] bg-[#00FF9D]/10';
        }
    },

    showExerciseDetails: async (id) => {
        const ex = await db.templates.get(id);
        if (!ex) return;
        
        document.getElementById('detail-exercise-category').innerText = ex.body_part || 'Exercício';
        document.getElementById('detail-exercise-name').innerText = ex.name;
        
        // Tags
        const tagsContainer = document.getElementById('detail-exercise-tags');
        tagsContainer.innerHTML = `
            <span class="tag-accent">${app.sanitize(ex.target || ex.body_part)}</span>
            <span class="tag-secondary">${app.sanitize((ex.equipment && String(ex.equipment).toLowerCase() !== 'undefined') ? ex.equipment : 'Livre')}</span>
            ${ex.name_en ? `<span class="px-2 py-0.5 rounded-full text-[8px] font-mono text-gray-400 bg-white/5 uppercase border border-white/5">${app.sanitize(ex.name_en)}</span>` : ''}
        `;
        
        // Fetch Detailed History & PR
        const historyData = await app.getExerciseHistoryDetailed(ex.name);
        const prDisplay = document.getElementById('detail-pr-display');
        const oneRmDisplay = document.getElementById('detail-1rm-display');
        
        if (historyData.record) {
            prDisplay.innerHTML = `${historyData.record.weight} <span class="text-[10px] text-gray-400 font-bold not-italic">KG</span> <span class="text-xs text-gray-500 font-normal">(${historyData.record.reps} reps)</span>`;
            oneRmDisplay.innerHTML = `${historyData.estimated1RM} <span class="text-[10px] text-gray-400 font-bold not-italic">KG</span>`;
        } else {
            prDisplay.innerHTML = `<span class="text-xs text-gray-600 font-normal">Sem registro</span>`;
            oneRmDisplay.innerHTML = `<span class="text-xs text-gray-600 font-normal">--</span>`;
        }
        
        // Render Recent Sessions in History Tab
        const histList = document.getElementById('detail-history-list');
        if (historyData.recentSessions.length > 0) {
            histList.innerHTML = historyData.recentSessions.map(sess => {
                const bestSessSet = [...sess.sets].sort((a,b) => app.calculate1RM(b.weight, b.reps) - app.calculate1RM(a.weight, a.reps))[0];
                const session1RM = bestSessSet ? app.calculate1RM(bestSessSet.weight, bestSessSet.reps) : 0;
                return `
                    <div class="glass p-3.5 rounded-xl space-y-2 bg-white/[0.01] border-white/5">
                        <div class="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/5 pb-1">
                            <span>${new Date(sess.date).toLocaleDateString('pt-BR')} · ${app.sanitize(sess.planName)}</span>
                            <span class="text-[#00FF9D]">1RM Sessão: ${session1RM}kg</span>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                            ${sess.sets.map((st, sIdx) => `
                                <div class="flex items-center justify-between text-xs font-mono p-1.5 px-2.5 bg-black/40 rounded-lg border border-white/5">
                                    <span class="text-[9px] text-gray-500 font-bold">#${sIdx + 1}</span>
                                    <span class="font-black text-white">${st.weight}kg <span class="text-gray-500 font-normal">×</span> ${st.reps}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            histList.innerHTML = `<div class="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-wider">Nenhum treino registrado com este exercício ainda.</div>`;
        }
        
        app.switchDetailTab('steps');
        
        // GIF de execução
        const gifImg = document.getElementById('detail-exercise-gif');
        const loadingSpinner = document.getElementById('detail-gif-loading');
        
        gifImg.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        
        if (ex.media_id) {
            gifImg.src = `https://raw.githubusercontent.com/bootstrapping-lab/exercisedb-api/main/media/${ex.media_id}.gif`;
        } else {
            gifImg.src = 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png';
        }
        
        // Passos de instrução
        const stepsContainer = document.getElementById('detail-exercise-steps');
        if (ex.instruction_steps && ex.instruction_steps.length > 0) {
            stepsContainer.innerHTML = ex.instruction_steps.map(step => `
                <li class="pl-1">${app.sanitize(step)}</li>
            `).join('');
        } else {
            stepsContainer.innerHTML = `<li class="pl-2">Nenhuma instrução cadastrada para este exercício.</li>`;
        }
        
        // Músculos Secundários
        const secContainer = document.getElementById('detail-secondary-muscles-container');
        const secText = document.getElementById('detail-exercise-secondary');
        if (ex.secondary_muscles && ex.secondary_muscles.length > 0) {
            secContainer.classList.remove('hidden');
            secText.innerText = ex.secondary_muscles.join(', ');
        } else {
            secContainer.classList.add('hidden');
        }
        
        // Botão "Adicionar ao Treino"
        const detailModal = document.getElementById('exercise-detail-modal');
        const oldBtn = document.getElementById('detail-action-btn');
        if (oldBtn) oldBtn.remove();
        
        if (app.libraryContext !== 'manager') {
            const btn = document.createElement('button');
            btn.id = 'detail-action-btn';
            btn.className = 'w-full btn-accent p-4 rounded-[20px] text-xs font-black tracking-[0.2em] uppercase shrink-0 mt-2 active:scale-95 transition-all';
            btn.innerText = 'Adicionar ao Treino';
            btn.onclick = () => {
                app.selectExercise(ex.name);
                if (navigator.vibrate) navigator.vibrate(30);
                app.toast(`"${ex.name}" adicionado!`, 'success', 2000);
                app.closeModal('exercise-detail-modal');
            };
            detailModal.querySelector('.absolute').appendChild(btn);
        }
        
        detailModal.classList.remove('hidden');
        lucide.createIcons();
    },

    startTimer: () => {
        app.startTime = Date.now();
        if(app.timerInterval) clearInterval(app.timerInterval);
        app.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now()-app.startTime)/1000);
            const timerEl = document.getElementById('timer-display');
            if (timerEl) timerEl.innerText = new Date(elapsed * 1000).toISOString().substr(11, 8);
        }, 1000);
    },

    showRestTimer: () => {
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    overlay.classList.remove('translate-y-[-200%]');
                });
            } else {
                overlay.classList.remove('translate-y-[-200%]');
            }
        }
    },

    hideRestTimer: () => {
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) {
            overlay.classList.add('translate-y-[-200%]');
            overlay.classList.add('hidden');
        }
    },

    startRestTimer: (s) => {
        clearInterval(app.restTimerInterval);
        app.restTotalTime = s;
        app.restRemainingTime = s;
        
        app.showRestTimer();
        app.updateRestTimerUI();
        
        app.restTimerInterval = setInterval(() => {
            app.restRemainingTime--;
            app.updateRestTimerUI();
            
            if(app.restRemainingTime <= 0) { 
                app.stopRestTimer(); 
                if(navigator.vibrate) navigator.vibrate([150, 80, 150]); 
                app.playRestAlarm();
            }
        }, 1000);
    },

    playRestAlarm: () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const now = ctx.currentTime;
                
                // Beep 1 (880Hz)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, now);
                osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.3);

                // Beep 2 (1760Hz)
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1760, now + 0.18);
                osc2.frequency.exponentialRampToValueAtTime(880, now + 0.42);
                gain2.gain.setValueAtTime(0.35, now + 0.18);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.18);
                osc2.stop(now + 0.55);
            }
        } catch (e) {
            console.warn('[Audio] Web Audio synth failed:', e);
        }
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(()=>{});
        } catch (e) {}
    },

    adjustRestTime: (sec) => {
        app.restRemainingTime = Math.max(0, app.restRemainingTime + sec);
        if (app.restRemainingTime > app.restTotalTime) {
            app.restTotalTime = app.restRemainingTime;
        }
        app.updateRestTimerUI();
        if (app.restRemainingTime <= 0) {
            app.stopRestTimer();
        }
    },

    updateRestTimerUI: () => {
        const timerEl = document.getElementById('overlay-timer');
        if (timerEl) timerEl.innerText = app.formatSec(app.restRemainingTime);
        
        const progressBar = document.getElementById('rest-progress-bar');
        if (progressBar && app.restTotalTime > 0) {
            const percent = (app.restRemainingTime / app.restTotalTime) * 100;
            progressBar.style.width = `${percent}%`;
        }
    },

    stopRestTimer: () => { 
        clearInterval(app.restTimerInterval); 
        app.hideRestTimer();
    },

    formatSec: (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`,
    
    toggleSettings: () => document.getElementById('settings-modal').classList.toggle('hidden'),
    
    closeModal: (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
        if (id === 'onboarding-modal') {
            localStorage.setItem('onboarding_done', 'true');
            localStorage.setItem('stronglog_onboarded', 'true');
            localStorage.setItem('stronglog_onboarded_v51', 'true');
            localStorage.setItem('stronglog_onboarded_v56', 'true');
            localStorage.setItem('onboarded', 'true');
        }
        if (id === 'workout-summary-modal') {
            app.destroy3DScene('summary');
        }
        if (id === 'exercise-library-modal') {
            app.destroy3DScene('library');
        }
    },

    exportData: async () => {
        const data = { 
            version: 5.0,
            timestamp: new Date().toISOString(),
            plans: await db.plans.toArray(), 
            sessions: await db.sessions.toArray(), 
            templates: await db.templates.toArray(),
            records: await db.records.toArray()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob); 
        a.download = `stronglog-pro-backup-${new Date().toISOString().slice(0,10)}.json`; 
        a.click();
        app.toast('Backup exportado com sucesso!', 'success');
    },

    importDataTrigger: () => {
        const el = document.getElementById('import-input');
        if (el) el.click();
    },

    importData: (ev) => {
        const f = ev.target.files[0]; if(!f) return;
        const r = new FileReader(); 
        r.onload = async (e) => {
            try {
                const d = JSON.parse(e.target.result);
                if(d.plans && Array.isArray(d.plans)) await db.plans.bulkPut(d.plans); 
                if(d.sessions && Array.isArray(d.sessions)) await db.sessions.bulkPut(d.sessions); 
                if(d.templates && Array.isArray(d.templates)) await db.templates.bulkPut(d.templates);
                if(d.records && Array.isArray(d.records)) await db.records.bulkPut(d.records);
                app.toast('Backup importado com sucesso!', 'success');
                setTimeout(() => location.reload(), 600);
            } catch (err) {
                app.toast('Erro ao importar backup: arquivo JSON inválido.', 'error');
            }
        }; 
        r.readAsText(f);
    },

    clearAllData: () => { 
        app.confirmClearAllData();
    },

    confirmClearAllData: () => {
        app.showConfirmDialog({
            title: 'Limpar Todos os Dados',
            subtitle: 'Zona de Perigo',
            message: 'Tem certeza absoluta? Todos os seus treinos, rotinas, recordes e exercícios serão apagados deste dispositivo permanentemente.',
            confirmText: 'Sim, Apagar Tudo',
            cancelText: 'Cancelar',
            isDanger: true,
            onConfirm: async () => {
                await Promise.all([
                    db.plans.clear(),
                    db.sessions.clear(),
                    db.templates.clear(),
                    db.records.clear()
                ]);
                localStorage.clear();
                app.toast('Todos os dados foram resetados.', 'info');
                setTimeout(() => location.reload(), 600);
            }
        });
    },

    showWorkoutSummaryById: async (id) => {
        try {
            const session = await db.sessions.get(Number(id));
            if (!session) {
                app.toast('Sessão de treino não encontrada.', 'warning');
                return;
            }
            // Se a sessão antiga não possuir recrutamento pré-calculado, calcula na hora
            if (!session.recruitment && session.exercises) {
                session.recruitment = await app.calculateWorkoutMuscleRecruitment(session.exercises);
            }
            app.showWorkoutSummaryModal(session);
        } catch (e) {
            console.error('[App] Erro ao abrir resumo do treino:', e);
            app.toast('Erro ao abrir resumo do treino.', 'error');
        }
    },

    renderHistory: async () => {
        const h = await db.sessions.orderBy('date').reverse().toArray();
        const list = document.getElementById('history-list');
        if (!list) return;

        if (h.length === 0) {
            list.innerHTML = `
                <div class="glass p-8 text-center space-y-2 border-white/5">
                    <i data-lucide="calendar" class="w-8 h-8 text-gray-600 mx-auto"></i>
                    <p class="text-xs font-black uppercase tracking-widest text-gray-500">Nenhum treino registrado ainda</p>
                    <p class="text-[10px] text-gray-600 font-bold">Finalize um treino para visualizar o histórico e o mapa 3D.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        list.innerHTML = h.map(s => `
            <div onclick="app.showWorkoutSummaryById(${s.id})" class="glass p-5 flex justify-between items-center bg-white/[0.01] hover:bg-white/[0.04] cursor-pointer transition-all active:scale-[0.99] border-white/5 group">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] text-gray-500 font-black uppercase tracking-widest">${new Date(s.date).toLocaleDateString('pt-BR')}</span>
                        <span class="text-[8px] font-mono text-[#00FF9D] bg-[#00FF9D]/10 px-1.5 py-0.5 rounded group-hover:bg-[#00FF9D]/20 transition-all flex items-center gap-1"><i data-lucide="box" class="w-2.5 h-2.5"></i> Resumo 3D</span>
                    </div>
                    <div class="font-black text-sm uppercase text-white italic tracking-tight group-hover:text-[#00FF9D] transition-colors">${app.sanitize(s.planName)}</div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black text-[#00FF9D] italic tracking-tighter">${(s.volume || 0).toLocaleString()}<span class="text-[10px] text-gray-500 not-italic ml-1">KG</span></div>
                    <div class="text-[9px] text-gray-500 font-black uppercase">${Math.floor((s.duration || 0)/60)} MIN</div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    },

    generateDynamicPalette: (count) => {
        const basePalette = [
            '#00FF9D', // Peito / Primário (Neon Green)
            '#00E5FF', // Costas / Dorsal (Cyan)
            '#7C4DFF', // Ombros / Deltoides (Purple)
            '#FF9100', // Pernas / Quadríceps (Amber)
            '#FF4081', // Braços / Bíceps (Pink)
            '#FF1744', // Trapézio / Glúteos (Coral Red)
            '#FFD600', // Panturrilhas (Gold)
            '#00B0FF', // Antebraços / Core (Sky Blue)
            '#69F0AE', // Mint
            '#E040FB', // Magenta
            '#1DE9B6', // Teal
            '#B388FF'  // Lavender
        ];
        if (count <= basePalette.length) {
            return basePalette.slice(0, count);
        }
        const colors = [...basePalette];
        for (let i = basePalette.length; i < count; i++) {
            const hue = Math.round((i * 360) / count);
            colors.push(`hsl(${hue}, 85%, 60%)`);
        }
        return colors;
    },

    initCharts: async () => {
        const s = await db.sessions.orderBy('date').reverse().limit(7).toArray();
        const sessions = s.reverse();
        const templates = await db.templates.toArray();
        const exToGroup = Object.fromEntries(templates.map(t => [t.name, t.body_part || t.target || 'Outros']));

        const canvas1 = document.getElementById('volumeChart');
        const canvas2 = document.getElementById('muscleGroupChart');
        if (!canvas1 || !canvas2) return;

        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        
        if(window.volChart) window.volChart.destroy();
        if(window.muscleChart) window.muscleChart.destroy();
        
        const totalEl = document.getElementById('weekly-total');
        if (totalEl) totalEl.innerText = sessions.reduce((a,b)=>a+b.volume,0).toLocaleString() + ' kg';
        
        window.volChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: sessions.map(x => new Date(x.date).toLocaleDateString('pt-BR', {day:'numeric', month:'short'})),
                datasets: [{ 
                    data: sessions.map(x => x.volume), 
                    backgroundColor: '#00FF9D', 
                    borderRadius: 8, 
                    barThickness: 8 
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#444', font: { size: 8, weight: '900' } } } } 
            }
        });

        // Muscle Group Data
        const muscleData = {};
        sessions.forEach(sess => {
            (sess.exercises || []).forEach(ex => {
                const group = exToGroup[ex.name] || ex.muscleGroup || ex.body_part || 'Outros';
                let vol = 0;
                (ex.sets || []).forEach(st => { if(st.completed) vol += ((st.weight || 0) * (st.reps || 0)); });
                if (vol > 0) {
                    muscleData[group] = (muscleData[group] || 0) + vol;
                }
            });
        });

        const labels = Object.keys(muscleData);
        const dataValues = Object.values(muscleData);
        const colors = app.generateDynamicPalette(labels.length);

        window.muscleChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['Sem Dados'],
                datasets: [{
                    data: dataValues.length > 0 ? dataValues : [1],
                    backgroundColor: dataValues.length > 0 ? colors : ['#222222'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: labels.length > 0,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw.toLocaleString()} kg`;
                            }
                        }
                    }
                } 
            }
        });
    },

    // =========================================================================
    // 📖 ONBOARDING, GUIA INTERATIVO & CENTRAL DE AJUDA
    // =========================================================================

    isOnboarded: () => {
        return !!(
            localStorage.getItem('onboarding_done') === 'true' ||
            localStorage.getItem('onboarding_done') === '1' ||
            localStorage.getItem('stronglog_onboarded') === 'true' ||
            localStorage.getItem('stronglog_onboarded_v51') === 'true' ||
            localStorage.getItem('stronglog_onboarded_v54') === 'true' ||
            localStorage.getItem('stronglog_onboarded_v56') === 'true' ||
            localStorage.getItem('onboarded') === 'true'
        );
    },

    checkOnboarding: () => {
        if (app.isOnboarded()) {
            const modal = document.getElementById('onboarding-modal');
            if (modal) modal.classList.add('hidden');
            return;
        }
        setTimeout(() => {
            if (app.isOnboarded()) return;
            const libraryOpen = document.getElementById('exercise-library-modal') && !document.getElementById('exercise-library-modal').classList.contains('hidden');
            const planEditorOpen = document.getElementById('view-plan-editor') && !document.getElementById('view-plan-editor').classList.contains('hidden');
            const workoutOpen = app.activeWorkout !== null;
            const anyModalOpen = Array.from(document.querySelectorAll('.fixed.inset-0')).some(el => el.id !== 'onboarding-modal' && !el.classList.contains('hidden'));
            
            if (!app.isOnboarded() && !libraryOpen && !planEditorOpen && !workoutOpen && !anyModalOpen) {
                app.showOnboarding(false);
            }
        }, 1200);
    },

    showOnboarding: (force = true) => {
        if (!force && app.isOnboarded()) return;
        app.onboardingCurrentSlide = 0;
        app.renderOnboardingSlide();
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeOnboarding: () => {
        localStorage.setItem('onboarding_done', 'true');
        localStorage.setItem('stronglog_onboarded', 'true');
        localStorage.setItem('stronglog_onboarded_v51', 'true');
        localStorage.setItem('stronglog_onboarded_v56', 'true');
        localStorage.setItem('onboarded', 'true');
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.classList.add('hidden');
    },

    nextOnboardingSlide: () => {
        const total = app.getOnboardingSlides().length;
        if (app.onboardingCurrentSlide < total - 1) {
            app.onboardingCurrentSlide++;
            app.renderOnboardingSlide();
        } else {
            app.closeOnboarding();
            app.toast('Pronto para treinar!', 'success', 2000);
        }
    },

    prevOnboardingSlide: () => {
        if (app.onboardingCurrentSlide > 0) {
            app.onboardingCurrentSlide--;
            app.renderOnboardingSlide();
        }
    },

    goToOnboardingSlide: (idx) => {
        app.onboardingCurrentSlide = idx;
        app.renderOnboardingSlide();
    },

    getOnboardingSlides: () => [
        {
            icon: 'dumbbell',
            tag: 'Bem-Vindo ao StrongLog Pro',
            title: 'Base Científica & 1.324 Exercícios',
            desc: 'Desenvolvido para máxima precisão hipertrófica. Tenha acesso a um catálogo completo com vídeos de execução em GIF, músculos primários e sinergistas mapeados, e funcionamento 100% offline.',
            highlights: [
                { icon: 'database', text: '100% Offline First — funciona sem internet na academia' },
                { icon: 'shield-check', text: 'Privacidade total — seus dados ficam salvos no seu aparelho' },
                { icon: 'activity', text: 'Anatomia interativa em 2D e Holograma 3D procedural' }
            ]
        },
        {
            icon: 'zap',
            tag: 'Praticidade & Foco',
            title: 'Ergonomia In-Workout de 1 Mão',
            desc: 'Diga adeus ao teclado virtual desconfortável na academia. O StrongLog Pro foi projetado para ser operado com apenas uma mão entre as séries.',
            highlights: [
                { icon: 'sliders', text: 'Smart Steppers táteis: Ajuste rápido de ±2.5kg, ±5kg e ±1 rep' },
                { icon: 'clock', text: 'Timer de Descanso Automático com avisos sonoros e vibração' },
                { icon: 'sun', text: 'Wake Lock: Tela sempre acesa durante toda a sessão' }
            ]
        },
        {
            icon: 'gauge',
            tag: 'Intensidade & Biomecânica',
            title: 'Escala RPE e Tipos de Série',
            desc: 'Monitore o esforço real de cada série usando a escala RPE baseada em Repetições em Reserva (RIR) e registre a natureza de cada repetição.',
            highlights: [
                { icon: 'check-circle-2', text: '🟢 Normal (N): Séries principais de hipertrofia' },
                { icon: 'flame', text: '🟡 Aquecimento (W): Séries preparatórias leves' },
                { icon: 'alert-octagon', text: '🔴 Até a Falha (F) & 🟣 Drop-sets (D) para exaustão máxima' },
                { icon: 'target', text: 'RPE 10 = Falha total | RPE 9 = 1 rep reserva | RPE 8 = 2 reps' }
            ]
        },
        {
            icon: 'box',
            tag: 'Pós-Treino & Evolução',
            title: 'Volume Efetivo & Holograma 3D',
            desc: 'Ao finalizar o treino, o motor científico calcula o Volume Efetivo (Veff), gera seus recordes de 1RM estimada (fórmula de Epley) e ilumina o mapa de calor muscular.',
            highlights: [
                { icon: 'trophy', text: 'Hall of Fame: Acompanhe seus Recordes Pessoais (PR)' },
                { icon: 'layers', text: 'Heatmap Térmico: Ciano, Neon Mint, Âmbar e Coral' },
                { icon: 'bar-chart-3', text: 'Gráficos semanais e distribuição por grupo muscular' }
            ]
        }
    ],

    renderOnboardingSlide: () => {
        const slides = app.getOnboardingSlides();
        const cur = slides[app.onboardingCurrentSlide];
        const contentEl = document.getElementById('onboarding-slide-content');
        const dotsEl = document.getElementById('onboarding-dots-container');
        const prevBtn = document.getElementById('onboarding-prev-btn');
        const nextBtn = document.getElementById('onboarding-next-btn');

        if (!contentEl || !cur) return;

        contentEl.innerHTML = `
            <div class="space-y-4">
                <div class="w-16 h-16 rounded-3xl bg-[#00FF9D]/10 border border-[#00FF9D]/30 flex items-center justify-center text-[#00FF9D] mx-auto shadow-lg shadow-[#00FF9D]/10">
                    <i data-lucide="${cur.icon}" class="w-8 h-8"></i>
                </div>
                <div class="text-center space-y-1.5 px-2">
                    <span class="text-[9px] font-mono font-bold text-[#00FF9D] bg-[#00FF9D]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">${cur.tag}</span>
                    <h3 class="text-xl font-black italic tracking-tighter uppercase text-white leading-tight">${cur.title}</h3>
                    <p class="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">${cur.desc}</p>
                </div>
                <div class="space-y-2 pt-2">
                    ${cur.highlights.map(h => `
                        <div class="glass p-3 rounded-2xl flex items-center gap-3 bg-white/[0.02] border-white/5">
                            <span class="p-1.5 rounded-xl bg-white/5 text-[#00FF9D] shrink-0"><i data-lucide="${h.icon}" class="w-4 h-4"></i></span>
                            <span class="text-xs font-semibold text-gray-300 leading-snug">${h.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (dotsEl) {
            dotsEl.innerHTML = slides.map((_, i) => `
                <button onclick="app.goToOnboardingSlide(${i})" class="h-2 rounded-full transition-all ${i === app.onboardingCurrentSlide ? 'w-6 bg-[#00FF9D]' : 'w-2 bg-white/20'}" title="Slide ${i + 1}"></button>
            `).join('');
        }

        if (prevBtn) {
            prevBtn.classList.toggle('hidden', app.onboardingCurrentSlide === 0);
        }

        if (nextBtn) {
            nextBtn.innerText = app.onboardingCurrentSlide === slides.length - 1 ? 'Começar a Treinar 🚀' : 'Próximo →';
        }

        lucide.createIcons();
    },

    showHelpModal: () => {
        app.switchHelpTab('guide');
        document.getElementById('help-modal').classList.remove('hidden');
    },

    switchHelpTab: (tab) => {
        app.currentHelpTab = tab;
        const btnGuide = document.getElementById('help-tab-guide-btn');
        const btnRpe = document.getElementById('help-tab-rpe-btn');
        const btnBio = document.getElementById('help-tab-bio-btn');
        const content = document.getElementById('help-modal-tab-content');

        if (btnGuide) btnGuide.className = tab === 'guide' ? 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all' : 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all';
        if (btnRpe) btnRpe.className = tab === 'rpe' ? 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all' : 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all';
        if (btnBio) btnBio.className = tab === 'bio' ? 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-[#00FF9D]/15 text-[#00FF9D] transition-all' : 'flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all';

        if (!content) return;

        if (tab === 'guide') {
            content.innerHTML = `
                <div class="space-y-3">
                    <div class="glass p-4 rounded-2xl space-y-1.5 border-[#00FF9D]/20 bg-[#00FF9D]/5">
                        <div class="flex items-center gap-2 text-[#00FF9D]">
                            <i data-lucide="play" class="w-4 h-4"></i>
                            <h4 class="text-xs font-black uppercase tracking-wider text-white">Como Fazer seu Treino</h4>
                        </div>
                        <p class="text-[11px] text-gray-300 leading-relaxed">Em 3 passos simples para o treino mais produtivo da sua vida:</p>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1 bg-white/[0.02] border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-[#00FF9D] text-black font-black text-[10px] flex items-center justify-center">1</span>
                            <h4 class="text-xs font-black text-white uppercase">Inicie a Sessão</h4>
                        </div>
                        <p class="text-[11px] text-gray-400 pl-7">Toque em <b>"Treinar Agora"</b> para um treino livre instantâneo ou selecione uma rotina na tela inicial.</p>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1 bg-white/[0.02] border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-[#00FF9D] text-black font-black text-[10px] flex items-center justify-center">2</span>
                            <h4 class="text-xs font-black text-white uppercase">Registre Carga & Repetições</h4>
                        </div>
                        <p class="text-[11px] text-gray-400 pl-7">Use os <b>Smart Steppers (±2.5kg, ±1 rep)</b>. Toque no botão de check <b>[✓]</b> para concluir a série e disparar o temporizador de descanso automático.</p>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1 bg-white/[0.02] border-white/5">
                        <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-[#00FF9D] text-black font-black text-[10px] flex items-center justify-center">3</span>
                            <h4 class="text-xs font-black text-white uppercase">Finalize & Veja a Anatomia</h4>
                        </div>
                        <p class="text-[11px] text-gray-400 pl-7">Toque em <b>"Finalizar Sessão"</b> para salvar os PRs de 1RM e conferir o mapa térmico de ativação muscular em 3D.</p>
                    </div>
                </div>
            `;
        } else if (tab === 'rpe') {
            content.innerHTML = `
                <div class="space-y-3">
                    <div class="glass p-4 rounded-2xl space-y-1 border-white/10">
                        <h4 class="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2"><i data-lucide="gauge" class="w-4 h-4 text-[#00FF9D]"></i> O que é a Escala RPE?</h4>
                        <p class="text-[11px] text-gray-300 leading-relaxed"><b>RPE (Rating of Perceived Exertion)</b> mede a proximidade da falha muscular através das <b>Repetições em Reserva (RIR)</b>.</p>
                    </div>

                    <div class="space-y-2">
                        <div class="glass p-3 rounded-xl border-red-500/20 bg-red-500/5 flex justify-between items-center">
                            <div>
                                <span class="text-xs font-black text-red-400">RPE 10 (RIR 0)</span>
                                <p class="text-[10px] text-gray-400">Falha Muscular Concêntrica Total — nenhuma repetição adicional possível.</p>
                            </div>
                        </div>
                        <div class="glass p-3 rounded-xl border-amber-500/20 bg-amber-500/5 flex justify-between items-center">
                            <div>
                                <span class="text-xs font-black text-amber-400">RPE 9 (RIR 1)</span>
                                <p class="text-[10px] text-gray-400">Esforço Máximo com 1 repetição restante no tanque. Ideal para força/hipertrofia.</p>
                            </div>
                        </div>
                        <div class="glass p-3 rounded-xl border-[#00FF9D]/20 bg-[#00FF9D]/5 flex justify-between items-center">
                            <div>
                                <span class="text-xs font-black text-[#00FF9D]">RPE 8 (RIR 2)</span>
                                <p class="text-[10px] text-gray-400">Zona Áurea de Hipertrofia: 2 repetições em reserva. Alta tensão com fadiga neural controlada.</p>
                            </div>
                        </div>
                        <div class="glass p-3 rounded-xl border-cyan-500/20 bg-cyan-500/5 flex justify-between items-center">
                            <div>
                                <span class="text-xs font-black text-cyan-400">RPE 7 (RIR 3)</span>
                                <p class="text-[10px] text-gray-400">Carga moderada/pesada com foco em velocidade e potência de contração.</p>
                            </div>
                        </div>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-2 bg-white/[0.02] border-white/5">
                        <h4 class="text-xs font-black uppercase tracking-wider text-white">Tipos de Série</h4>
                        <div class="grid grid-cols-2 gap-2 text-[10px]">
                            <div class="p-2 rounded-xl badge-set-normal font-bold"><b>[N] Normal:</b> Série alvo efetiva</div>
                            <div class="p-2 rounded-xl badge-set-warmup font-bold"><b>[W] Aquecimento:</b> Preparação articular</div>
                            <div class="p-2 rounded-xl badge-set-failure font-bold"><b>[F] Falha:</b> Até esgotamento 100%</div>
                            <div class="p-2 rounded-xl badge-set-drop font-bold"><b>[D] Drop-set:</b> Sem descanso</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="space-y-3">
                    <div class="glass p-4 rounded-2xl space-y-1 border-white/10">
                        <h4 class="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2"><i data-lucide="box" class="w-4 h-4 text-[#00FF9D]"></i> Holograma 3D & Volume Efetivo (Veff)</h4>
                        <p class="text-[11px] text-gray-300 leading-relaxed">O StrongLog Pro utiliza uma matriz biomecânica que calcula o recrutamento muscular ponderado de cada exercício.</p>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1.5 bg-white/[0.02] border-white/5">
                        <h4 class="text-xs font-black text-[#00FF9D] uppercase">Cálculo de Volume Efetivo</h4>
                        <p class="text-[11px] text-gray-400 leading-relaxed">Músculo Primário (Target) recebe <b>100%</b> do volume bruto (Carga × Reps), enquanto músculos sinergistas secundários recebem <b>40%</b>.</p>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1.5 bg-white/[0.02] border-white/5">
                        <h4 class="text-xs font-black text-white uppercase">Níveis Térmicos do Heatmap</h4>
                        <div class="space-y-1 text-[10px]">
                            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#00e5ff]"></span> <b>Ciano (Heat 1):</b> Estímulo leve / sinergista</div>
                            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#00FF9D]"></span> <b>Neon Mint (Heat 2):</b> Estímulo efetivo ótimo</div>
                            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#ffab00]"></span> <b>Âmbar (Heat 3):</b> Estímulo intenso</div>
                            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-[#ff1744]"></span> <b>Crimson (Heat 4):</b> Recrutamento e exaustão máxima</div>
                        </div>
                    </div>

                    <div class="glass p-3.5 rounded-2xl space-y-1.5 bg-white/[0.02] border-white/5">
                        <h4 class="text-xs font-black text-white uppercase">1RM Estimada (Fórmula de Epley)</h4>
                        <p class="text-[11px] text-gray-400 leading-relaxed">Sua carga máxima teórica para 1 repetição é calculada automaticamente: <b>1RM = Carga × (1 + Reps/30)</b>.</p>
                    </div>
                </div>
            `;
        }

        lucide.createIcons();
    }
};

window.app = app;
window.db = db;

window.addEventListener('load', app.init);

