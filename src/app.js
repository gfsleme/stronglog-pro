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
                        console.log('[App] Nova versão detectada!');
                        document.getElementById('update-toast').classList.remove('hidden');
                    }
                });
            });
        }).catch(err => console.error('[App] Erro ao registrar SW:', err));
    });
}

const db = new Dexie("StrongLog_v4_Pro");
db.version(1).stores({ 
    plans: '++id, name', 
    sessions: '++id, planName, date', 
    templates: '++id, name, muscleGroup' 
});

const app = {
    activeWorkout: null, 
    timerInterval: null, 
    startTime: null, 
    restTimerInterval: null, 
    editingPlan: null, 
    libraryContext: null,
    exerciseTemplates: [
        { name: 'Supino Reto (Barra)', muscleGroup: 'Peito' }, 
        { name: 'Supino Inclinado (Halter)', muscleGroup: 'Peito' },
        { name: 'Puxada Aberta', muscleGroup: 'Costas' }, 
        { name: 'Remada Unilateral', muscleGroup: 'Costas' },
        { name: 'Agachamento Livre', muscleGroup: 'Pernas' }, 
        { name: 'Leg Press 45', muscleGroup: 'Pernas' },
        { name: 'Desenvolvimento Militar', muscleGroup: 'Ombros' }, 
        { name: 'Elevação Lateral', muscleGroup: 'Ombros' },
        { name: 'Rosca Martelo', muscleGroup: 'Bíceps' }, 
        { name: 'Tríceps Testa', muscleGroup: 'Tríceps' }
    ],

    init: async () => {
        app.updateDate();
        await app.seedTemplates();
        await app.renderPlans();
        await app.renderHistory();
        app.initCharts();
        lucide.createIcons();
    },

    // Security: Sanitization
    sanitize: (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    updateDate: () => {
        const el = document.getElementById('current-date');
        if (el) el.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    },

    seedTemplates: async () => {
        const count = await db.templates.count();
        if (count === 0) await db.templates.bulkAdd(app.exerciseTemplates);
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
        lucide.createIcons();
    },

    showCustomExerciseForm: () => {
        const name = prompt('Nome do Exercício:');
        const group = prompt('Grupo Muscular (Peito, Costas, etc):');
        if(name && group) app.saveCustomExercise(name, group);
    },

    saveCustomExercise: async (name, muscleGroup) => {
        await db.templates.add({ name: app.sanitize(name), muscleGroup: app.sanitize(muscleGroup) });
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
                    <p class="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] mt-1">${p.exercises.length} EXERCÍCIOS</p>
                </div>
                <button onclick="app.showPlanEditor(${p.id})" class="p-3 glass text-gray-500 active:text-[#00ff41]"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
            </div>
        `).join('') : `<div class="glass p-12 text-center text-gray-700 font-black uppercase text-[10px] tracking-[0.3em]">Nenhuma rotina ativa</div>`;
        lucide.createIcons();
    },

    showPlanEditor: async (id = null) => {
        app.editingPlan = id ? await db.plans.get(id) : { name: '', exercises: [] };
        document.getElementById('plan-editor-title').innerText = id ? 'Ajustar Rotina' : 'Criar Rotina';
        document.getElementById('plan-name-input').value = app.editingPlan.name;
        app.renderEditorExercises();
        app.setView('plan-editor');
    },

    renderEditorExercises: () => {
        const list = document.getElementById('selected-exercises-list');
        if (!list) return;

        list.innerHTML = app.editingPlan.exercises.map((ex, i) => `
            <div class="glass p-5 flex justify-between items-center animate-fade bg-white/[0.01]">
                <span class="font-black text-xs uppercase tracking-tight text-gray-300">${app.sanitize(ex)}</span>
                <button onclick="app.editingPlan.exercises.splice(${i},1); app.renderEditorExercises()" class="text-red-500/40 p-1"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    },

    savePlan: async () => {
        const name = document.getElementById('plan-name-input').value;
        if (!name || !app.editingPlan.exercises.length) return;
        app.editingPlan.name = name;
        await db.plans.put(app.editingPlan);
        app.setView('dashboard');
        app.renderPlans();
    },

    startWorkout: async (planId) => {
        const plan = await db.plans.get(planId);
        const workoutExercises = [];
        for(let name of plan.exercises) {
            const lastData = await app.getExerciseHistory(name);
            workoutExercises.push({
                name: name, 
                restTime: 90,
                historyPreview: lastData ? `${lastData.weight}kg x ${lastData.reps}` : 'Novo Desafio',
                sets: [{ 
                    weight: lastData ? lastData.weight : 0, 
                    reps: lastData ? lastData.reps : 0, 
                    completed: false, 
                    type: 'Normal', 
                    rpe: '' 
                }]
            });
        }
        app.activeWorkout = { ...plan, startTime: Date.now(), exercises: workoutExercises };
        document.getElementById('active-workout-name').innerText = plan.name;
        app.renderWorkout();
        app.setView('active-workout');
        app.startTimer();
    },

    getExerciseHistory: async (exName) => {
        const sessions = await db.sessions.orderBy('date').reverse().toArray();
        for(let s of sessions) {
            const ex = s.exercises.find(e => e.name === exName);
            if(ex) {
                const best = [...ex.sets].filter(x => x.completed).sort((a,b) => (b.weight*b.reps) - (a.weight*a.reps))[0];
                if(best) return best;
            }
        }
        return null;
    },

    renderWorkout: () => {
        const list = document.getElementById('exercise-list');
        if (!list) return;

        list.innerHTML = app.activeWorkout.exercises.map((ex, exIdx) => `
            <div class="glass p-6 space-y-5 animate-fade">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-black text-[#00ff41] uppercase tracking-tighter text-lg italic leading-tight">${app.sanitize(ex.name)}</h4>
                        <div class="flex items-center gap-2 mt-1">
                            <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Base: ${ex.historyPreview}</div>
                            <div class="text-[9px] font-black text-[#00ff41]/40 uppercase tracking-widest cursor-pointer" onclick="app.setRest(${exIdx})">Descanso: ${ex.restTime}s</div>
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
        <div class="flex items-center gap-3 ${s.completed ? 'opacity-20 grayscale' : ''} transition-all">
            <button onclick="app.cycleSetType(${exI},${sI})" class="w-10 h-10 flex items-center justify-center glass text-[10px] font-black text-[#00ff41] uppercase italic">${s.type[0]}</button>
            <div class="flex-1 grid grid-cols-3 gap-2 h-12">
                <div class="flex items-center glass px-1"><input onchange="app.updateSet(${exI},${sI},'weight',this.value)" type="number" inputmode="decimal" value="${s.weight}" class="w-full text-center text-sm font-black focus:outline-none text-white"></div>
                <div class="flex items-center glass px-1"><input onchange="app.updateSet(${exI},${sI},'reps',this.value)" type="number" inputmode="numeric" value="${s.reps}" class="w-full text-center text-sm font-black focus:outline-none text-white"></div>
                <div class="flex items-center glass px-1 bg-white/[0.01]"><input onchange="app.updateSet(${exI},${sI},'rpe',this.value)" type="number" inputmode="numeric" value="${s.rpe}" class="w-full text-center text-[10px] font-black text-gray-600 focus:outline-none" placeholder="RPE"></div>
            </div>
            <button onclick="app.toggleSet(${exI},${sI})" class="p-3.5 glass ${s.completed ? 'bg-[#00ff41]/20 border-[#00ff41]' : 'active:scale-90'}">
                <i data-lucide="check" class="w-5 h-5 ${s.completed ? 'text-[#00ff41]' : 'text-gray-800'}"></i>
            </button>
        </div>
    `,

    setRest: (idx) => {
        const t = prompt('Descanso (segundos):', app.activeWorkout.exercises[idx].restTime);
        if(t) app.activeWorkout.exercises[idx].restTime = parseInt(t);
        app.renderWorkout();
    },

    updateSet: (exI, sI, f, v) => { app.activeWorkout.exercises[exI].sets[sI][f] = parseFloat(v) || v; },
    
    cycleSetType: (exI, sI) => { 
        const types = ['Normal', 'Warmup', 'Failure', 'Drop'];
        const cur = app.activeWorkout.exercises[exI].sets[sI].type;
        app.activeWorkout.exercises[exI].sets[sI].type = types[(types.indexOf(cur) + 1) % types.length];
        app.renderWorkout();
    },

    toggleSet: (exI, sI) => {
        const s = app.activeWorkout.exercises[exI].sets[sI];
        s.completed = !s.completed;
        if(s.completed) { 
            app.startRestTimer(app.activeWorkout.exercises[exI].restTime); 
            if(navigator.vibrate) navigator.vibrate(40); // Haptic feedback
        }
        app.renderWorkout();
    },

    addSetToWorkout: (exI) => { 
        const sets = app.activeWorkout.exercises[exI].sets;
        sets.push({...sets[sets.length-1], completed: false}); 
        app.renderWorkout(); 
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
    },

    removeExerciseFromWorkout: (i) => { if(confirm('Remover?')) { app.activeWorkout.exercises.splice(i,1); app.renderWorkout(); } },
    
    cancelWorkout: () => { if(confirm('Descartar treino?')) { clearInterval(app.timerInterval); app.activeWorkout = null; app.setView('dashboard'); } },
    
    finishWorkout: async () => {
        clearInterval(app.timerInterval);
        let vol = 0;
        app.activeWorkout.exercises.forEach(e => e.sets.forEach(s => { if(s.completed) vol += (s.weight * s.reps); }));
        await db.sessions.add({ 
            planName: app.activeWorkout.name, 
            date: new Date(), 
            duration: Math.floor((Date.now()-app.startTime)/1000), 
            volume: vol, 
            exercises: app.activeWorkout.exercises 
        });
        app.activeWorkout = null; 
        app.setView('dashboard'); 
        app.renderHistory(); 
        app.initCharts();
    },

    showExerciseLibrary: (ctx) => { 
        app.libraryContext = ctx; 
        app.filterExerciseLibrary(); 
        document.getElementById('exercise-library-modal').classList.remove('hidden'); 
    },

    filterExerciseLibrary: async () => {
        const s = document.getElementById('search-exercise').value.toLowerCase();
        const t = await db.templates.toArray();
        const groups = {};
        t.filter(x => x.name.toLowerCase().includes(s)).forEach(x => {
            if(!groups[x.muscleGroup]) groups[x.muscleGroup] = [];
            groups[x.muscleGroup].push(x);
        });
        document.getElementById('library-list').innerHTML = Object.keys(groups).sort().map(g => `
            <div class="pt-6 pb-2 text-[10px] font-black text-gray-700 uppercase tracking-[0.4em] ml-2">${g}</div>
            ${groups[g].map(x => `
                <div class="w-full glass p-5 flex justify-between items-center bg-white/[0.01]">
                    <div class="flex-1 cursor-pointer" onclick="app.selectExercise('${x.name}')">
                        <div class="font-black text-sm uppercase tracking-tight text-white">${app.sanitize(x.name)}</div>
                    </div>
                    ${app.libraryContext === 'manager' ? `<button onclick="app.deleteTemplate(${x.id})" class="p-2 text-red-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : `<i data-lucide="plus" class="w-4 h-4 text-gray-800"></i>`}
                </div>
            `).join('')}
        `).join('');
        lucide.createIcons();
    },

    selectExercise: (n) => {
        if(app.libraryContext === 'editor') { app.editingPlan.exercises.push(n); app.renderEditorExercises(); }
        else if(app.libraryContext === 'workout') { app.addExerciseToActiveWorkout(n); }
        app.closeModal('exercise-library-modal');
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
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) overlay.classList.remove('translate-x-[200%]');
        let rem = s;
        app.restTimerInterval = setInterval(() => {
            rem--;
            const timerEl = document.getElementById('overlay-timer');
            if (timerEl) timerEl.innerText = app.formatSec(rem);
            if(rem <= 0) { 
                app.stopRestTimer(); 
                if(navigator.vibrate) navigator.vibrate([150, 80, 150]); 
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(()=>{});
            }
        }, 1000);
    },

    stopRestTimer: () => { 
        clearInterval(app.restTimerInterval); 
        const overlay = document.getElementById('rest-timer-overlay');
        if (overlay) overlay.classList.add('translate-x-[200%]'); 
    },

    formatSec: (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`,
    
    toggleSettings: () => document.getElementById('settings-modal').classList.toggle('hidden'),
    
    closeModal: (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    exportData: async () => {
        const data = { 
            plans: await db.plans.toArray(), 
            sessions: await db.sessions.toArray(), 
            templates: await db.templates.toArray() 
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob); 
        a.download = `stronglog-pro-backup.json`; 
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
            const d = JSON.parse(e.target.result);
            if(d.plans) await db.plans.bulkPut(d.plans); 
            if(d.sessions) await db.sessions.bulkPut(d.sessions); 
            if(d.templates) await db.templates.bulkPut(d.templates);
            location.reload();
        }; 
        r.readAsText(f);
    },

    clearAllData: async () => { 
        if(confirm('Apagar tudo? Isso deletará todos os seus treinos e planos permanentemente.')) { 
            await db.delete(); 
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
                    <div class="text-xl font-black text-[#00ff41] italic tracking-tighter">${s.volume.toLocaleString()}<span class="text-[10px] text-gray-700 not-italic ml-1">KG</span></div>
                    <div class="text-[9px] text-gray-700 font-black uppercase">${Math.floor(s.duration/60)} MIN</div>
                </div>
            </div>
        `).join('');
    },

    initCharts: async () => {
        const s = await db.sessions.orderBy('date').reverse().limit(7).toArray();
        const sessions = s.reverse();
        const canvas = document.getElementById('volumeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if(window.myChart) window.myChart.destroy();
        
        const totalEl = document.getElementById('weekly-total');
        if (totalEl) totalEl.innerText = sessions.reduce((a,b)=>a+b.volume,0).toLocaleString() + ' kg';
        
        window.myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sessions.map(x => new Date(x.date).toLocaleDateString('pt-BR', {day:'numeric', month:'short'})),
                datasets: [{ 
                    data: sessions.map(x => x.volume), 
                    backgroundColor: '#00ff41', 
                    borderRadius: 12, 
                    barThickness: 10 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { display: false }, 
                    x: { 
                        grid: { display: false }, 
                        ticks: { color: '#444', font: { size: 8, weight: '900' } } 
                    } 
                } 
            }
        });
    }
};

window.addEventListener('load', app.init);
