// PWA Service Worker Registration with Enhanced Update Logic
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
            console.log('[App] SW registrado com sucesso');
            
            // Verifica atualizações periodicamente
            setInterval(() => { reg.update(); }, 60 * 60 * 1000); // A cada hora

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[App] Nova versão detectada! Forçando skipWaiting...');
                        newWorker.postMessage({ action: 'skipWaiting' });
                    }
                });
            });
        }).catch(err => console.error('[App] Erro ao registrar SW:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log('[App] Service Worker atualizado. Recarregando...');
            window.location.reload();
        }
    });
}

const db = new Dexie("StrongLog_v4_Pro");
db.version(3).stores({ 
    plans: '++id, name', 
    sessions: '++id, planName, date', 
    templates: '++id, name, body_part, equipment, target',
    records: 'name' // Exercise name as key
});

const app = {
    activeWorkout: null, 
    timerInterval: null, 
    startTime: null, 
    restTimerInterval: null, 
    restTotalTime: 0,
    restRemainingTime: 0,
    editingPlan: null, 
    libraryContext: null,
    searchDebounceTimeout: null,
    exerciseTemplates: [
        { name: 'Supino Reto com Barra', muscleGroup: 'Peito' }, 
        { name: 'Supino Inclinado com Halter', muscleGroup: 'Peito' },
        { name: 'Puxada no Pulley Pegada Aberta', muscleGroup: 'Costas' }, 
        { name: 'Remada Curvada com Barra', muscleGroup: 'Costas' },
        { name: 'Agachamento Livre', muscleGroup: 'Pernas' }, 
        { name: 'Leg Press 45', muscleGroup: 'Pernas' },
        { name: 'Desenvolvimento Militar', muscleGroup: 'Ombros' }, 
        { name: 'Elevação Lateral com Halter', muscleGroup: 'Ombros' },
        { name: 'Rosca Martelo com Halter', muscleGroup: 'Braços' }, 
        { name: 'Tríceps Testa com Barra W', muscleGroup: 'Braços' }
    ],

    init: async () => {
        app.updateDate();
        await app.seedTemplates();
        await app.rebuildRecords();
        await app.renderPlans();
        await app.renderHistory();
        app.checkActiveWorkoutRecovery();
        app.initCharts();
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
                const bestSet = (ex.sets || []).filter(x => x.completed).sort((a,b) => b.weight - a.weight)[0];
                if (bestSet) {
                    if (!recs[ex.name] || bestSet.weight > recs[ex.name].weight) {
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

    seedTemplates: async () => {
        try {
            const DATASET_VERSION = 'stronglog_dataset_v4.11';
            const currentVer = localStorage.getItem('stronglog_dataset_version');
            const count = await db.templates.count();
            
            if (currentVer !== DATASET_VERSION || count < 100) {
                console.log('[App] Atualizando base científica de 1.324 exercícios desambiguados...');
                if (count > 0) await db.templates.clear();
                const res = await fetch('./data/exercises.min.json');
                if (!res.ok) throw new Error('Falha ao carregar exercises.min.json');
                const data = await res.json();
                await db.templates.bulkAdd(data);
                localStorage.setItem('stronglog_dataset_version', DATASET_VERSION);
                console.log(`[App] ${data.length} exercícios semeados com sucesso!`);
            }
        } catch (err) {
            console.error('[App] Erro no seed de exercícios:', err);
            const count = await db.templates.count();
            if (count === 0) {
                await db.templates.bulkAdd(app.exerciseTemplates.map(ex => ({
                    name: ex.name,
                    name_en: ex.name,
                    body_part: ex.muscleGroup,
                    equipment: 'Barra/Halter',
                    target: ex.muscleGroup,
                    secondary_muscles: [],
                    media_id: '',
                    instruction_steps: ['Execute o exercício com postura e amplitude adequadas.']
                })));
            }
        }
    },

    setView: (view) => {
        document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
        const el = document.getElementById(`view-${view}`);
        if (el) el.classList.remove('hidden');
        
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.remove('active');
            if(i.dataset.view === view) i.classList.add('active');
        });
        window.scrollTo(0,0);
    },

    showCustomExerciseForm: () => {
        const nameInput = document.getElementById('custom-ex-name');
        if (nameInput) nameInput.value = '';
        document.getElementById('custom-exercise-modal').classList.remove('hidden');
    },

    saveCustomExerciseFromModal: async () => {
        const nameInput = document.getElementById('custom-ex-name').value.trim();
        const groupSelect = document.getElementById('custom-ex-group').value;
        if (!nameInput) return;
        
        await db.templates.add({
            name: app.sanitize(nameInput),
            name_en: nameInput,
            body_part: groupSelect,
            equipment: 'Customizado',
            target: groupSelect,
            secondary_muscles: [],
            media_id: '',
            instruction_steps: ['Exercício adicionado manualmente pelo usuário.']
        });
        
        app.closeModal('custom-exercise-modal');
        app.filterExerciseLibrary();
    },

    deleteTemplate: async (id) => {
        if(confirm('Apagar exercício da biblioteca?')) {
            await db.templates.delete(id);
            app.filterExerciseLibrary();
        }
    },

    showExerciseManager: () => {
        app.libraryContext = 'manager';
        app.showExerciseLibrary('manager');
    },

    renderPlans: async () => {
        const plans = await db.plans.toArray();
        const list = document.getElementById('workout-list');
        if (!list) return;

        list.innerHTML = plans.length ? plans.map(p => `
            <div class="glass p-6 flex justify-between items-center active:scale-[0.98] transition-all animate-fade bg-white/[0.01]">
                <div class="flex-1 cursor-pointer" onclick="app.startWorkout(${p.id})">
                    <h3 class="font-black text-xl tracking-tighter italic uppercase text-white">${app.sanitize(p.name)}</h3>
                    <p class="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] mt-1">${(p.exercises || []).length} EXERCÍCIOS</p>
                </div>
                <button onclick="app.showPlanEditor(${p.id})" class="p-3 glass text-gray-500 active:text-[#00FF9D]"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
            </div>
        `).join('') : `<div class="glass p-12 text-center text-gray-700 font-black uppercase text-[10px] tracking-[0.3em]">Nenhuma rotina ativa</div>`;
        lucide.createIcons();
    },

    showPlanEditor: async (id = null) => {
        app.editingPlan = id ? await db.plans.get(id) : { name: '', exercises: [] };
        document.getElementById('plan-editor-title').innerText = id ? 'Ajustar Rotina' : 'Criar Rotina';
        document.getElementById('plan-name-input').value = app.editingPlan.name || '';
        app.renderEditorExercises();
        app.setView('plan-editor');
    },

    renderEditorExercises: () => {
        const list = document.getElementById('selected-exercises-list');
        if (!list) return;

        list.innerHTML = (app.editingPlan.exercises || []).map((ex, i) => `
            <div class="glass p-5 flex justify-between items-center animate-fade bg-white/[0.01]">
                <span class="font-black text-xs uppercase tracking-tight text-gray-300">${app.sanitize(ex)}</span>
                <button onclick="app.editingPlan.exercises.splice(${i},1); app.renderEditorExercises()" class="text-red-500/40 p-1 active:text-red-500"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    },

    savePlan: async () => {
        const name = document.getElementById('plan-name-input').value.trim();
        if (!name || !app.editingPlan.exercises.length) return;
        app.editingPlan.name = name;
        await db.plans.put(app.editingPlan);
        app.setView('dashboard');
        app.renderPlans();
    },

    calculate1RM: (weight, reps) => {
        const w = parseFloat(weight) || 0;
        const r = parseInt(reps) || 0;
        if (w <= 0) return 0;
        if (r <= 1) return w;
        return Math.round(w * (1 + r / 30));
    },

    getExerciseHistoryDetailed: async (exName) => {
        const record = await db.records.get(exName);
        const sessions = await db.sessions.orderBy('date').reverse().toArray();
        const recent = [];
        
        for (let s of sessions) {
            const match = s.exercises && s.exercises.find(e => e.name === exName);
            if (match) {
                const validSets = (match.sets || []).filter(st => st.completed);
                if (validSets.length > 0) {
                    recent.push({
                        date: s.date,
                        planName: s.planName,
                        sets: validSets
                    });
                    if (recent.length >= 5) break;
                }
            }
        }
        
        let estimated1RM = 0;
        if (record && record.weight && record.reps) {
            estimated1RM = app.calculate1RM(record.weight, record.reps);
        }
        
        return {
            record,
            estimated1RM,
            recentSessions: recent
        };
    },

    startWorkout: async (planId) => {
        const plan = await db.plans.get(planId);
        if(!plan) return;
        
        const workoutExercises = [];
        for(let name of plan.exercises) {
            const lastData = await app.getExerciseHistory(name);
            workoutExercises.push({
                name: name, 
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
        app.renderWorkout();
        app.saveActiveWorkoutState();
        app.setView('active-workout');
        app.startTimer();
    },

    getExerciseHistory: async (exName) => {
        const sessions = await db.sessions.orderBy('date').reverse().toArray();
        for(let s of sessions) {
            const ex = (s.exercises || []).find(e => e.name === exName);
            if(ex) {
                const best = [...(ex.sets || [])].filter(x => x.completed).sort((a,b) => (b.weight*b.reps) - (a.weight*a.reps))[0];
                if(best) return best;
            }
        }
        return null;
    },

    renderWorkout: () => {
        const list = document.getElementById('exercise-list');
        if (!list || !app.activeWorkout) return;

        list.innerHTML = app.activeWorkout.exercises.map((ex, exIdx) => `
            <div class="glass p-6 space-y-5 animate-fade">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-black text-[#00FF9D] uppercase tracking-tighter text-lg italic leading-tight">${app.sanitize(ex.name)}</h4>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Base: ${ex.historyPreview}</div>
                            <div class="text-[9px] font-black text-[#00FF9D]/40 uppercase tracking-widest cursor-pointer" onclick="app.setRest(${exIdx})">Descanso: ${ex.restTime}s</div>
                        </div>
                    </div>
                    <button onclick="app.removeExerciseFromWorkout(${exIdx})" class="p-2 text-gray-800 active:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <div class="space-y-3">${ex.sets.map((s, sIdx) => app.renderSetRow(exIdx, sIdx, s)).join('')}</div>
                <button onclick="app.addSetToWorkout(${exIdx})" class="w-full py-4 bg-white/5 rounded-2xl text-[9px] font-black tracking-[0.3em] text-gray-600 active:bg-white/10 uppercase">+ Add Série</button>
            </div>
        `).join('');
        lucide.createIcons();
    },

    renderSetRow: (exI, sI, s) => `
        <div class="flex items-center gap-2 ${s.completed ? 'opacity-30 grayscale' : ''} transition-all">
            <button onclick="app.cycleSetType(${exI},${sI})" class="w-9 h-9 flex items-center justify-center glass text-[9px] font-black text-[#00FF9D] uppercase italic shrink-0">${s.type[0]}</button>
            <div class="flex-1 grid grid-cols-3 gap-1.5 h-10">
                <div class="flex items-center glass px-1"><input onchange="app.updateSet(${exI},${sI},'weight',this.value)" type="number" inputmode="decimal" value="${s.weight}" class="w-full text-center text-xs font-black focus:outline-none text-white"></div>
                <div class="flex items-center glass px-1"><input onchange="app.updateSet(${exI},${sI},'reps',this.value)" type="number" inputmode="numeric" value="${s.reps}" class="w-full text-center text-xs font-black focus:outline-none text-white"></div>
                <div class="flex items-center glass px-1 bg-white/[0.01]"><input onchange="app.updateSet(${exI},${sI},'rpe',this.value)" type="number" inputmode="numeric" value="${s.rpe}" class="w-full text-center text-[9px] font-black text-gray-600 focus:outline-none" placeholder="RPE"></div>
            </div>
            <button onclick="app.toggleSet(${exI},${sI})" class="p-2.5 glass shrink-0 ${s.completed ? 'bg-[#00FF9D]/20 border-[#00FF9D]' : 'active:scale-90'}">
                <i data-lucide="check" class="w-4 h-4 ${s.completed ? 'text-[#00FF9D]' : 'text-gray-800'}"></i>
            </button>
        </div>
    `,

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

    toggleSet: (exI, sI) => {
        const s = app.activeWorkout.exercises[exI].sets[sI];
        s.completed = !s.completed;
        if(s.completed) { 
            app.startRestTimer(app.activeWorkout.exercises[exI].restTime); 
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
        const lastData = await app.getExerciseHistory(n);
        app.activeWorkout.exercises.push({
            name: n, 
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
        if(confirm('Remover exercício do treino?')) { 
            app.activeWorkout.exercises.splice(i,1); 
            app.renderWorkout(); 
            app.saveActiveWorkoutState();
        } 
    },
    
    cancelWorkout: () => { 
        if(confirm('Descartar treino atual? Todo o progresso desta sessão será perdido.')) { 
            clearInterval(app.timerInterval); 
            app.stopRestTimer(); 
            app.activeWorkout = null; 
            app.clearActiveWorkoutState();
            app.setView('dashboard'); 
        } 
    },
    
    finishWorkout: async () => {
        clearInterval(app.timerInterval);
        app.stopRestTimer();
        let vol = 0;
        const newPRs = [];
        
        for (const ex of app.activeWorkout.exercises) {
            const bestSet = (ex.sets || []).filter(s => s.completed).sort((a,b) => b.weight - a.weight)[0];
            if (bestSet) {
                const existingRecord = await db.records.get(ex.name);
                if (!existingRecord || bestSet.weight > existingRecord.weight) {
                    const recordData = { name: ex.name, weight: bestSet.weight, reps: bestSet.reps, date: new Date() };
                    await db.records.put(recordData);
                    newPRs.push(recordData);
                }
            }
            (ex.sets || []).forEach(s => { if(s.completed) vol += ((s.weight || 0) * (s.reps || 0)); });
        }

        await db.sessions.add({ 
            planName: app.activeWorkout.name, 
            date: new Date(), 
            duration: Math.floor((Date.now()-app.startTime)/1000), 
            volume: vol, 
            exercises: app.activeWorkout.exercises 
        });

        if (newPRs.length > 0) {
            app.showPRNotification(newPRs);
        }

        app.activeWorkout = null; 
        app.clearActiveWorkoutState();
        app.setView('dashboard'); 
        app.renderHistory(); 
        app.initCharts();
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
            
            document.getElementById('workout-recovery-banner').classList.add('hidden');
            document.getElementById('active-workout-name').innerText = app.activeWorkout.name;
            
            app.startTimer();
            app.renderWorkout();
            app.setView('active-workout');
        } catch (e) {
            console.error('[Recovery] Erro ao retomar treino:', e);
        }
    },

    discardRecoveredWorkout: () => {
        app.clearActiveWorkoutState();
        const banner = document.getElementById('workout-recovery-banner');
        if (banner) banner.classList.add('hidden');
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
        app.filterExerciseLibrary(); 
        document.getElementById('exercise-library-modal').classList.remove('hidden'); 
    },

    debouncedFilterExerciseLibrary: () => {
        clearTimeout(app.searchDebounceTimeout);
        app.searchDebounceTimeout = setTimeout(app.filterExerciseLibrary, 180);
    },

    filterExerciseLibrary: async () => {
        const searchInput = document.getElementById('search-exercise').value.toLowerCase().trim();
        const filterBodyPart = document.getElementById('filter-body-part').value;
        const filterEquipment = document.getElementById('filter-equipment').value;
        
        let exercises = await db.templates.toArray();
        
        // Filtros
        if (filterBodyPart) {
            exercises = exercises.filter(x => x.body_part === filterBodyPart);
        }
        if (filterEquipment) {
            exercises = exercises.filter(x => x.equipment === filterEquipment);
        }
        if (searchInput) {
            exercises = exercises.filter(x => 
                (x.name && x.name.toLowerCase().includes(searchInput)) ||
                (x.name_en && x.name_en.toLowerCase().includes(searchInput)) ||
                (x.target && x.target.toLowerCase().includes(searchInput)) ||
                (x.body_part && x.body_part.toLowerCase().includes(searchInput))
            );
        }

        const listContainer = document.getElementById('library-list');
        if (!listContainer) return;
        
        const count = exercises.length;
        const limit = 60;
        const displayed = exercises.slice(0, limit);

        let html = '';
        if (count === 0) {
            html = `<div class="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-wider">Nenhum exercício encontrado.</div>`;
        } else {
            html = displayed.map(x => `
                <div class="glass p-4 flex justify-between items-center bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                    <div class="flex-1 cursor-pointer pr-2" onclick="app.showExerciseDetails(${typeof x.id === 'string' ? `'${x.id}'` : x.id})">
                        <div class="flex items-center gap-2">
                            <h4 class="font-black text-xs text-white uppercase italic tracking-tight leading-tight">${app.sanitize(x.name)}</h4>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[8px] font-bold text-[#00FF9D] uppercase tracking-wider">${app.sanitize(x.target || x.body_part)}</span>
                            <span class="text-[8px] font-bold text-gray-500 uppercase tracking-wider">• ${app.sanitize(x.equipment)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${app.libraryContext === 'manager' && typeof x.id === 'string' && x.id.startsWith('custom_') ? `
                            <button onclick="app.deleteTemplate('${x.id}')" class="p-2 text-red-500/60 active:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        ` : ''}
                        <button onclick="app.selectExercise('${app.sanitize(x.name)}')" class="p-2.5 bg-[#00FF9D]/10 text-[#00FF9D] rounded-xl active:bg-[#00FF9D] active:text-black transition-all">
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

    selectExercise: (n) => {
        if(app.libraryContext === 'editor') { 
            app.editingPlan.exercises.push(n); 
            app.renderEditorExercises(); 
        } else if(app.libraryContext === 'workout') { 
            app.addExerciseToActiveWorkout(n); 
        }
        app.closeModal('exercise-library-modal');
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
            <span class="tag-secondary">${app.sanitize(ex.equipment)}</span>
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
                const bestSessSet = [...sess.sets].sort((a,b) => (b.weight*b.reps) - (a.weight*a.reps))[0];
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
        
        // Default to steps tab
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

    startRestTimer: (s) => {
        clearInterval(app.restTimerInterval);
        app.restTotalTime = s;
        app.restRemainingTime = s;
        
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) {
            overlay.classList.remove('translate-y-[-200%]');
        }
        
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
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) overlay.classList.add('translate-y-[-200%]'); 
    },

    formatSec: (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`,
    
    toggleSettings: () => document.getElementById('settings-modal').classList.toggle('hidden'),
    
    closeModal: (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    exportData: async () => {
        const data = { 
            version: 4.11,
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
                location.reload();
            } catch (err) {
                alert('Erro ao importar backup: arquivo JSON inválido.');
            }
        }; 
        r.readAsText(f);
    },

    clearAllData: async () => { 
        if(confirm('Apagar tudo? Isso deletará todos os seus treinos e planos permanentemente.')) { 
            await db.delete(); 
            localStorage.clear();
            location.reload(); 
        } 
    },

    renderHistory: async () => {
        const h = await db.sessions.orderBy('date').reverse().toArray();
        const list = document.getElementById('history-list');
        if (!list) return;

        list.innerHTML = h.map(s => `
            <div class="glass p-6 flex justify-between items-center bg-white/[0.01]">
                <div class="space-y-1">
                    <div class="text-[9px] text-gray-700 font-black uppercase tracking-widest">${new Date(s.date).toLocaleDateString('pt-BR')}</div>
                    <div class="font-black text-sm uppercase text-white italic">${app.sanitize(s.planName)}</div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black text-[#00FF9D] italic tracking-tighter">${s.volume.toLocaleString()}<span class="text-[10px] text-gray-700 not-italic ml-1">KG</span></div>
                    <div class="text-[9px] text-gray-700 font-black uppercase">${Math.floor(s.duration/60)} MIN</div>
                </div>
            </div>
        `).join('');
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
                const group = exToGroup[ex.name] || 'Outros';
                let vol = 0;
                (ex.sets || []).forEach(st => { if(st.completed) vol += ((st.weight || 0) * (st.reps || 0)); });
                muscleData[group] = (muscleData[group] || 0) + vol;
            });
        });

        window.muscleChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: Object.keys(muscleData),
                datasets: [{
                    data: Object.values(muscleData),
                    backgroundColor: ['#00FF9D', '#00cc33', '#009926', '#00661a', '#333333', '#555555', '#777777'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } } 
            }
        });
    }
};

window.addEventListener('load', app.init);
