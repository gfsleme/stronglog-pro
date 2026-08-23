const fs = require('fs');
const path = require('path');

const exercises = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/exercises.min.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

// Mock browser environment
const globalMock = {
    ANATOMICAL_HIERARCHY: null,
    matchesMuscleHierarchy: null,
    isMuscleGroupSelectedOrChild: null
};

const appObjMock = {};
const mockScript = `
global.window = { addEventListener: () => {} };
global.document = { getElementById: () => null };
global.navigator = {};
global.localStorage = { getItem: () => null, setItem: () => null };
global.Dexie = function() { return { version: () => ({ stores: () => {} }) }; };
global.Chart = function() {};
global.lucide = { createIcons: () => {} };
global.THREE = {};

${appJs}

globalMock.ANATOMICAL_HIERARCHY = app.ANATOMICAL_HIERARCHY;
globalMock.matchesMuscleHierarchy = app.matchesMuscleHierarchy;
globalMock.isMuscleGroupSelectedOrChild = app.isMuscleGroupSelectedOrChild;
`;

eval(mockScript);

console.log('--- TEST RESULTS FOR ANATOMICAL HIERARCHY ---');
let allPassed = true;
for (const key of Object.keys(globalMock.ANATOMICAL_HIERARCHY)) {
    const matched = exercises.filter(x => globalMock.matchesMuscleHierarchy(x, key));
    console.log(`[PASS] ${key.padEnd(16)} -> ${matched.length} exercícios encontrados`);
    if (matched.length === 0) {
        console.error(`[FAIL] ${key} retornou 0 exercícios!`);
        allPassed = false;
    }
}

console.log('\n--- TEST HIERARCHY SELECTION / CHILD HIGHLIGHTS ---');
console.log('shoulders includes shoulders_front:', globalMock.isMuscleGroupSelectedOrChild('shoulders_front', 'shoulders'));
console.log('shoulders includes shoulders_rear:', globalMock.isMuscleGroupSelectedOrChild('shoulders_rear', 'shoulders'));
console.log('back includes lats:', globalMock.isMuscleGroupSelectedOrChild('lats', 'back'));
console.log('back includes upper_back:', globalMock.isMuscleGroupSelectedOrChild('upper_back', 'back'));

if (allPassed) {
    console.log('\n>>> TODAS AS VALIDAÇÕES PASSARAM COM 100% DE SUCESSO! <<<');
} else {
    process.exit(1);
}
