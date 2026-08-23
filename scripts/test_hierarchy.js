const fs = require('fs');
const path = require('path');

const exercises = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/exercises.min.json'), 'utf8'));

const ANATOMICAL_HIERARCHY = {
    chest: {
        keys: ['chest'],
        keywords: ['peitoral', 'peito', 'chest', 'supino', 'crucifixo', 'crossover', 'paralelas para peito'],
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
};

console.log('Testing each muscle key:');
Object.keys(ANATOMICAL_HIERARCHY).forEach(k => {
    const hier = ANATOMICAL_HIERARCHY[k];
    const res = exercises.filter(x => {
        if (hier.keys.includes(x.primary_muscle_group)) return true;
        if (x.secondary_muscle_groups && x.secondary_muscle_groups.some(s => hier.secondaries.includes(s))) return true;
        const fullText = (x.name + ' ' + (x.name_en || '') + ' ' + (x.target || '') + ' ' + (x.body_part || '')).toLowerCase();
        return hier.keywords.some(kw => fullText.includes(kw));
    });
    console.log(`- ${k.padEnd(16)}: ${res.length} exercises`);
});
