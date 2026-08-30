// scripts/test_rf02_svg_map_redesign.js
// Teste TDD Estrito para RF02-v5.4: Redesenho do Mapa 2D SVG e Acessibilidade Dual (Chips + SVG)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: RF02-v5.4 - Acessibilidade Dual 2D & Chips Rápidos');
console.log('================================================================\n');

const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');

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

// Setup do ambiente mock robusto
const mockStorage = {};
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
};

let vibrationCount = 0;
Object.defineProperty(global, 'navigator', {
    value: {
        serviceWorker: {
            register: () => Promise.resolve({ addEventListener: () => {} }),
            addEventListener: () => {}
        },
        vibrate: (pattern) => { vibrationCount++; return true; }
    },
    configurable: true
});

global.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
const domElements = {};
const mockElement = (id = '') => {
    const el = {
        id: id,
        value: '',
        innerHTML: '',
        innerText: '',
        classList: {
            classes: new Set(),
            add: function(...c) { c.forEach(item => this.classes.add(item)); },
            remove: function(...c) { c.forEach(item => this.classes.delete(item)); },
            toggle: function(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); },
            contains: function(c) { return this.classes.has(c); }
        },
        style: {},
        appendChild: () => {},
        setAttribute: () => {},
        scrollIntoView: () => {}
    };
    if (id) domElements[id] = el;
    return el;
};

global.document = {
    createElement: (tag) => mockElement(),
    getElementById: (id) => domElements[id] || mockElement(id),
    querySelector: (sel) => null,
    querySelectorAll: (sel) => []
};

let loadedApp = null;
try {
    const scriptCode = `
        function Dexie() { 
            this.version = () => ({ stores: () => ({}) }); 
            this.templates = { toArray: async () => [] }; 
        }
        const lucide = { createIcons: () => {} };
        ${appJs}
        return app;
    `;
    loadedApp = new Function(scriptCode)();
} catch (e) {
    throw new Error('Falha ao instanciar app: ' + e.message);
}

const REQUIRED_19_GROUPS = [
    'chest',
    'traps',
    'shoulders_front',
    'shoulders_side',
    'shoulders_rear',
    'biceps',
    'triceps',
    'forearms',
    'abs',
    'quads',
    'hamstrings',
    'calves',
    'upper_back',
    'lats',
    'lower_back',
    'glutes',
    'adductors',
    'abductors',
    'cardio'
];

// TESTE 1: Presença de todos os 19 grupos musculares no SVG (Anterior + Posterior)
it('O Mapa 2D SVG deve conter elementos interativos para todos os 19 grupos musculares', () => {
    const anteriorSvg = loadedApp.getSvgAnatomicalPaths('anterior', null, null);
    const posteriorSvg = loadedApp.getSvgAnatomicalPaths('posterior', null, null);
    const combinedSvg = anteriorSvg + '\n' + posteriorSvg;

    const missingGroups = [];
    REQUIRED_19_GROUPS.forEach(grp => {
        const hasGroup = combinedSvg.includes(`data-group="${grp}"`) || combinedSvg.includes(`handleMuscleNodeClick('${grp}')`);
        if (!hasGroup) missingGroups.push(grp);
    });

    assert(
        missingGroups.length === 0,
        `Grupos ausentes no SVG 2D: ${missingGroups.join(', ')}`
    );
});

// TESTE 1B: Substituição de <polygon>/<rect> por <path d="..."> orgânicos (v6.0)
it('O Mapa 2D SVG deve utilizar <path d=...> orgânicos com curvatura anatômica para os 19 grupos e banir <polygon>/<rect> na anatomia muscular', () => {
    const anteriorSvg = loadedApp.getSvgAnatomicalPaths('anterior', null, null);
    const posteriorSvg = loadedApp.getSvgAnatomicalPaths('posterior', null, null);
    const combinedSvg = anteriorSvg + '\n' + posteriorSvg;

    assert(!combinedSvg.includes('<polygon'), 'Mapa 2D SVG ainda contém <polygon> rudimentares');
    assert(!combinedSvg.match(/<rect[^>]*data-group/i), 'Mapa 2D SVG ainda contém <rect> rudimentares na anatomia muscular');
    assert(combinedSvg.includes('<path') && combinedSvg.includes('data-group="chest"'), 'Mapa 2D SVG deve usar <path> com curvatura anatômica orgânica');
});

// TESTE 2: Hitboxes táteis circulares restritos (r=14) sem colisões/sobreposições entre grupos
it('Cada alvo muscular no SVG deve possuir hitbox circular restrito (r=14) sem colisões entre grupos', () => {
    const anteriorSvg = loadedApp.getSvgAnatomicalPaths('anterior', null, null);
    const posteriorSvg = loadedApp.getSvgAnatomicalPaths('posterior', null, null);
    const combinedSvg = anteriorSvg + '\n' + posteriorSvg;

    assert(
        !combinedSvg.includes('width="44"') && !combinedSvg.match(/<rect[^>]*muscle-hitbox/i),
        'Ainda existem rects cegos de 44x44 colidentes no SVG anatômico'
    );
    assert(
        combinedSvg.includes('circle') && combinedSvg.includes('muscle-hitbox') && combinedSvg.includes('r="14"'),
        'Hitboxes circulares restritos r=14 não encontrados no SVG'
    );

    // Validação matemática de não-sobreposição: distância mínima entre centros de grupos distintos >= 2*r (28)
    const extractCircles = (svg) => {
        const regex = /<g[^>]*data-group="([^"]+)"[^>]*>[\s\S]*?<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="14"/g;
        const circles = [];
        let match;
        while ((match = regex.exec(svg)) !== null) {
            circles.push({ group: match[1], cx: parseFloat(match[2]), cy: parseFloat(match[3]) });
        }
        return circles;
    };

    ['anterior', 'posterior'].forEach(view => {
        const circles = extractCircles(loadedApp.getSvgAnatomicalPaths(view, null, null));
        assert(circles.length > 0, `Nenhum círculo de hitbox detectado em ${view}`);
        for (let i = 0; i < circles.length; i++) {
            for (let j = i + 1; j < circles.length; j++) {
                if (circles[i].group === circles[j].group) continue;
                const dist = Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy);
                assert(
                    dist >= 27.9,
                    `Sobreposição detectada em ${view} entre ${circles[i].group} e ${circles[j].group} - dist=${dist.toFixed(1)} < 28`
                );
            }
        }
    });
});

// TESTE 3: Feedback tátil imediato (haptic feedback) ao clicar em um nó
it('handleMuscleNodeClick deve acionar vibração tátil (navigator.vibrate)', () => {
    vibrationCount = 0;
    loadedApp.handleMuscleNodeClick('chest');
    assert(vibrationCount > 0, 'navigator.vibrate não foi acionado em handleMuscleNodeClick');
    assert(loadedApp.activeMuscleFilter === 'chest', 'Filtro ativo não foi definido para chest');
    loadedApp.clearMuscleFilter();
});

// TESTE 4: Simulação de toque/seleção para cada um dos 19 grupos
it('Tap simulado deve selecionar com sucesso cada um dos 19 grupos musculares', () => {
    REQUIRED_19_GROUPS.forEach(grp => {
        loadedApp.clearMuscleFilter();
        loadedApp.handleMuscleNodeClick(grp);
        assert(
            loadedApp.activeMuscleFilter === grp,
            `Falha ao selecionar grupo muscular '${grp}' via tap simulado`
        );
        
        const svgWithFilter = loadedApp.getSvgAnatomicalPaths('anterior', null, grp) + 
                             loadedApp.getSvgAnatomicalPaths('posterior', null, grp);
        assert(
            svgWithFilter.includes('active-selected') && svgWithFilter.includes(`data-group="${grp}"`),
            `Elemento do grupo '${grp}' não recebeu realce ativo no SVG`
        );
    });
    loadedApp.clearMuscleFilter();
});

// TESTE 5: Consistência de estado activeSvgView e limpeza de cena 3D ao fechar modais
it('Estado activeSvgView deve ser consistente e closeModal deve destruir cena 3D library', () => {
    assert(loadedApp.activeSvgView === 'anterior', 'app.activeSvgView deve ser inicializado como anterior');
    
    let destroyedScene = null;
    const origDestroy = loadedApp.destroy3DScene;
    loadedApp.destroy3DScene = (key) => { destroyedScene = key; };

    loadedApp.closeModal('exercise-library-modal');
    assert(destroyedScene === 'library', 'closeModal deve chamar destroy3DScene("library") ao fechar exercise-library-modal');
    
    loadedApp.destroy3DScene = origDestroy;
});

// TESTE 6: [RF02-v5.4] HTML deve conter container para a barra de chips anatômicos rápidos
it('HTML deve conter elemento #library-muscle-chips-bar para acesso rápido aos 19 grupos', () => {
    assert(
        html.includes('id="library-muscle-chips-bar"'),
        'Elemento #library-muscle-chips-bar não encontrado em index.html'
    );
});

// TESTE 7: [RF02-v5.4] app.js deve renderizar chips para todos os 19 grupos anatômicos
it('app.renderMuscleChipsBar deve renderizar botões/chips para todos os 19 grupos', () => {
    assert(
        typeof loadedApp.renderMuscleChipsBar === 'function',
        'Método app.renderMuscleChipsBar não encontrado'
    );
    const container = mockElement('library-muscle-chips-bar');
    domElements['library-muscle-chips-bar'] = container;
    loadedApp.renderMuscleChipsBar('library-muscle-chips-bar');
    
    REQUIRED_19_GROUPS.forEach(grp => {
        assert(
            container.innerHTML.includes(`data-muscle-group="${grp}"`) || container.innerHTML.includes(`app.selectMuscleFilter('${grp}')`),
            `Chip para o grupo '${grp}' não foi renderizado em #library-muscle-chips-bar`
        );
    });
});

// TESTE 8: [RF02-v5.4] Seleção via chip deve selecionar todos os 19 grupos, acionar vibração e sincronizar SVG
it('Seleção de qualquer um dos 19 grupos via chip deve acionar vibração, atualizar filtro e visão SVG', () => {
    REQUIRED_19_GROUPS.forEach(grp => {
        vibrationCount = 0;
        loadedApp.selectMuscleFilter(grp);
        assert(loadedApp.activeMuscleFilter === grp, `activeMuscleFilter não foi atualizado para ${grp}`);
        assert(vibrationCount > 0, `Vibração não foi acionada ao selecionar o chip ${grp}`);

        // Grupos posteriores devem automaticamente comutar activeSvgView para 'posterior'
        const POSTERIOR_GROUPS = ['glutes', 'hamstrings', 'lats', 'lower_back', 'shoulders_rear'];
        if (POSTERIOR_GROUPS.includes(grp)) {
            assert(loadedApp.activeSvgView === 'posterior', `Grupo posterior ${grp} deveria comutar activeSvgView para posterior`);
        }
    });
    loadedApp.clearMuscleFilter();
});

// TESTE 9: [RF02-Refatoração] Isolamento visual anatômico no SVG (active-selected no selecionado e dimmed-node nos neutros)
it('getSvgAnatomicalPaths deve isolar visualmente o grupo ativo com active-selected e aplicar dimmed-node nos demais grupos', () => {
    const svgFiltered = loadedApp.getSvgAnatomicalPaths('anterior', null, 'chest');
    
    // O peitoral deve ter classe active-selected
    assert(
        svgFiltered.includes('active-selected') && svgFiltered.includes('data-group="chest"'),
        'Grupo selecionado deve receber classe active-selected'
    );

    // Grupos não selecionados no mesmo SVG devem receber dimmed-node
    assert(
        svgFiltered.includes('dimmed-node') && svgFiltered.includes('data-group="quads"'),
        'Grupos não selecionados devem receber classe dimmed-node para isolamento visual'
    );
});

// TESTE 10: [RF02-Refatoração] Zoom no Mapa 2D SVG (wheel / pinch / zoom controls)
it('app.zoomSvg e app.resetSvgZoom devem permitir zoom 2D delimitando escala entre 1.0x e 2.5x', () => {
    assert(typeof loadedApp.zoomSvg === 'function', 'app.zoomSvg deve existir');
    assert(typeof loadedApp.resetSvgZoom === 'function', 'app.resetSvgZoom deve existir');

    loadedApp.svgZoomScale = 1.0;
    
    // Zoom in (+0.25)
    loadedApp.zoomSvg(0.25);
    assert(loadedApp.svgZoomScale > 1.0, `svgZoomScale deveria aumentar após zoom in, obtido: ${loadedApp.svgZoomScale}`);

    // Limite máximo 2.5x
    loadedApp.zoomSvg(5.0);
    assert(loadedApp.svgZoomScale <= 2.5, `svgZoomScale excedeu limite máximo 2.5, obtido: ${loadedApp.svgZoomScale}`);

    // Limite mínimo 1.0x
    loadedApp.zoomSvg(-10.0);
    assert(loadedApp.svgZoomScale >= 1.0, `svgZoomScale caiu abaixo do limite mínimo 1.0, obtido: ${loadedApp.svgZoomScale}`);

    // Reset de zoom
    loadedApp.zoomSvg(0.5);
    loadedApp.resetSvgZoom();
    assert.strictEqual(loadedApp.svgZoomScale, 1.0, 'resetSvgZoom deve restaurar escala para 1.0');
});

// TESTE 11: [RF02-Refatoração] Animação Sci-Fi Neon Mint no styles.css
it('styles.css deve conter animação de pulso/glow neon mint para nós musculares selecionados (.active-selected)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf-8');
    assert(
        css.includes('.muscle-node.active-selected') || css.includes('.active-selected'),
        'Regra .active-selected não encontrada em styles.css'
    );
    assert(
        css.includes('#00FF9D') || css.includes('rgba(0, 255, 157'),
        'Neon mint (#00FF9D) não encontrado para realce de nós musculares no styles.css'
    );
    assert(
        css.includes('dimmed-node') || css.includes('.muscle-node.dimmed'),
        'Regra de atenuação/isolamento (.dimmed-node) não encontrada em styles.css'
    );
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF02: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);

