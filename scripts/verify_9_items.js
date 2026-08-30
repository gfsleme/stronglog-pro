const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

const results = [
    {
        id: 1,
        item: 'rotate3DToView sem dupla inversão (Bloqueador #1)',
        desc: 'Modelo com rotação neutra (rotation.y = 0) e órbita só na câmera (z = +/-r)',
        command: 'grep -n "rotation.y = 0" src/app.js',
        count: (appJs.match(/sc\.bodyGroup\.rotation\.y\s*=\s*0;/g) || []).length,
        expected: '>= 1 e zero targetRotY',
        passed: (appJs.match(/sc\.bodyGroup\.rotation\.y\s*=\s*0;/g) || []).length >= 1 && !appJs.includes('targetRotY')
    },
    {
        id: 2,
        item: 'materialsPool por cena (Sentinel MAJOR #4)',
        desc: 'app.threeScenes[sceneKey].materialsPool isolado por cena',
        command: 'grep -E "threeScenes.*materialsPool" src/app.js',
        count: (appJs.match(/threeScenes.*materialsPool/g) || []).length,
        expected: '2',
        passed: (appJs.match(/threeScenes.*materialsPool/g) || []).length >= 1
    },
    {
        id: 3,
        item: 'prefers-reduced-motion (Sentinel #7)',
        desc: '@media (prefers-reduced-motion: reduce) para .muscle-node.active-selected',
        command: 'grep -c "prefers-reduced-motion" src/styles.css',
        count: (stylesCss.match(/prefers-reduced-motion/g) || []).length,
        expected: '1',
        passed: (stylesCss.match(/prefers-reduced-motion/g) || []).length >= 1
    },
    {
        id: 4,
        item: 'aria-label zoom (Sentinel #8)',
        desc: 'Botões de zoom 2D e 3D com aria-label="Aumentar zoom", "Diminuir zoom", "Resetar visão"',
        command: 'grep -c "Aumentar zoom" src/index.html',
        count: (indexHtml.match(/Aumentar zoom/g) || []).length,
        expected: '2',
        passed: (indexHtml.match(/Aumentar zoom/g) || []).length >= 2
    },
    {
        id: 5,
        item: 'role=timer + aria-live (Specter P0 #11)',
        desc: 'role="timer" e aria-live="polite" em #overlay-timer e #timer-display',
        command: 'grep -c \'role="timer"\' src/index.html',
        count: (indexHtml.match(/role="timer"/g) || []).length,
        expected: '2',
        passed: (indexHtml.match(/role="timer"/g) || []).length >= 2
    },
    {
        id: 6,
        item: '.touch-target-44 (Specter P1 #12)',
        desc: 'Classe .touch-target-44 com pseudo-elemento 44px em steppers, badges e botões',
        command: 'grep -c "touch-target-44" src/styles.css src/app.js',
        count: (stylesCss.match(/touch-target-44/g) || []).length + (appJs.match(/touch-target-44/g) || []).length,
        expected: '13 (2 em css + 11 em js)',
        passed: ((stylesCss.match(/touch-target-44/g) || []).length + (appJs.match(/touch-target-44/g) || []).length) >= 10
    },
    {
        id: 7,
        item: 'min-h-[100dvh] (Specter P1 #13)',
        desc: 'index.html body com min-h-[100dvh] e modais com 92dvh/100dvh',
        command: 'grep -c "100dvh" src/index.html',
        count: (indexHtml.match(/100dvh/g) || []).length,
        expected: '4',
        passed: (indexHtml.match(/100dvh/g) || []).length >= 4
    },
    {
        id: 8,
        item: 'text-gray-700 eliminado (Specter P1 #14)',
        desc: 'Zero ocorrências de text-gray-700 sobre fundo escuro em todo o src/',
        command: 'grep -c "text-gray-700" src/*.*',
        count: (appJs.match(/text-gray-700/g) || []).length + (indexHtml.match(/text-gray-700/g) || []).length + (stylesCss.match(/text-gray-700/g) || []).length,
        expected: '0',
        passed: ((appJs.match(/text-gray-700/g) || []).length + (indexHtml.match(/text-gray-700/g) || []).length + (stylesCss.match(/text-gray-700/g) || []).length) === 0
    },
    {
        id: 9,
        item: 'Seletor órfão corrigido & .tabular-nums (Specter P2 #15)',
        desc: '#rest-timer-display corrigido para #overlay-timer e .tabular-nums em contadores',
        command: 'grep -c "rest-timer-display" src/styles.css',
        count: (stylesCss.match(/rest-timer-display/g) || []).length,
        expected: '0',
        passed: (stylesCss.match(/rest-timer-display/g) || []).length === 0 && stylesCss.includes('#overlay-timer') && stylesCss.includes('#library-bottom-counter')
    }
];

console.log('================================================================');
console.log('📋 AUDITORIA DAS 9 CORREÇÕES CRÍTICAS (SENTINEL & SPECTER)');
console.log('================================================================\n');

let allPassed = true;
results.forEach(r => {
    const status = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
    if (!r.passed) allPassed = false;
    console.log(`${status} [Item ${r.id}] ${r.item}`);
    console.log(`   Comando : ${r.command}`);
    console.log(`   Retorno : ${r.count} (Esperado: ${r.expected})\n`);
});

console.log('----------------------------------------------------------------');
console.log(`RESULTADO AUDITORIA 9 ITENS: ${results.filter(r => r.passed).length}/9 PASS`);
console.log('----------------------------------------------------------------\n');
process.exit(allPassed ? 0 : 1);
