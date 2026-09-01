// scripts/test_rf01_3d_harmonization.js
// Teste TDD Estrito para RF01-v5.4: Three.js de ponta com 19 grupos, proxy colliders e material pooling
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD TEST: RF01-v5.4 - Three.js de Ponta, Colliders & Pooling');
console.log('================================================================\n');

const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf-8');

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

// 1. Verificação de Arquitetura GLB Ultraleve (<250KB) & GLTFLoader Local (v6.0)
it('Deve utilizar modelo GLB local ultraleve (<250KB) em src/assets/models/human_body_sci_fi.glb', () => {
    const glbPath = path.join(__dirname, '../src/assets/models/human_body_sci_fi.glb');
    assert(fs.existsSync(glbPath), 'Arquivo GLB src/assets/models/human_body_sci_fi.glb não encontrado');
    const stats = fs.statSync(glbPath);
    assert(stats.size > 0 && stats.size < 250 * 1024, `Tamanho do GLB deve ser < 250KB, obtido: ${(stats.size / 1024).toFixed(1)}KB`);
});

it('GLTFLoader.js deve ser vendored localmente em src/vendor/three/ e cacheado no sw.js e index.html', () => {
    const loaderPath = path.join(__dirname, '../src/vendor/three/GLTFLoader.js');
    assert(fs.existsSync(loaderPath), 'src/vendor/three/GLTFLoader.js não encontrado');
    const indexHtml = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf-8');
    const swJs = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf-8');
    assert(indexHtml.includes('vendor/three/GLTFLoader.js'), 'index.html deve incluir vendor/three/GLTFLoader.js');
    assert(swJs.includes('GLTFLoader.js'), 'sw.js deve cachear GLTFLoader.js para suporte 100% offline');
    assert(swJs.includes('human_body_sci_fi.glb'), 'sw.js deve cachear human_body_sci_fi.glb');
});

it('buildHologramBodyMesh / loadHologramGLB deve implementar fallback defensivo (timeout 2.5s) e flag isSceneAlive', () => {
    assert(appJs.includes('GLTFLoader') || appJs.includes('loadHologramGLB'), 'app.js deve suportar carregamento via GLTFLoader');
    assert(appJs.includes('isSceneAlive'), 'app.js deve verificar isSceneAlive para evitar memory leaks/FOUC se modal fechar antes do load');
    assert(appJs.includes('2500') || appJs.includes('timeout'), 'app.js deve implementar timeout defensivo (2.5s) com fallback');
});

// 2. Mock do Three.js para execução no Node.js
class MockVector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class MockEuler {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class MockObject3D {
    constructor() {
        this.position = new MockVector3();
        this.rotation = new MockEuler();
        this.scale = new MockVector3(1, 1, 1);
        this.children = [];
        this.userData = {};
        this.visible = true;
    }
    add(child) { this.children.push(child); }
    traverse(cb) {
        cb(this);
        this.children.forEach(c => {
            if (c.traverse) c.traverse(cb);
            else cb(c);
        });
    }
}
class MockGroup extends MockObject3D {}
class MockMesh extends MockObject3D {
    constructor(geometry, material) {
        super();
        this.isMesh = true;
        this.geometry = geometry;
        this.material = material;
    }
}
class MockGeometry {
    constructor(type, params) {
        this.type = type;
        this.params = params;
    }
}
class MockMaterial {
    constructor(opts = {}) {
        Object.assign(this, opts);
    }
}

const mockTHREE = {
    Group: MockGroup,
    Mesh: MockMesh,
    MeshStandardMaterial: class extends MockMaterial {},
    MeshPhysicalMaterial: class extends MockMaterial {},
    MeshBasicMaterial: class extends MockMaterial {},
    BoxGeometry: class extends MockGeometry { constructor(...args) { super('BoxGeometry', args); } },
    CylinderGeometry: class extends MockGeometry { constructor(...args) { super('CylinderGeometry', args); } },
    ConeGeometry: class extends MockGeometry { constructor(...args) { super('ConeGeometry', args); } },
    SphereGeometry: class extends MockGeometry { constructor(...args) { super('SphereGeometry', args); } },
    IcosahedronGeometry: class extends MockGeometry { constructor(...args) { super('IcosahedronGeometry', args); } },
    DodecahedronGeometry: class extends MockGeometry { constructor(...args) { super('DodecahedronGeometry', args); } },
    OctahedronGeometry: class extends MockGeometry { constructor(...args) { super('OctahedronGeometry', args); } },
    RingGeometry: class extends MockGeometry { constructor(...args) { super('RingGeometry', args); } },
    BufferGeometry: class extends MockGeometry { constructor(...args) { super('BufferGeometry', args); } },
    Vector2: class { constructor(x,y){this.x=x;this.y=y;} },
    Vector3: MockVector3,
    Color: class { constructor(c){this.hex=c;} },
    GLTFLoader: class {
        constructor() {}
        load(url, onLoad, onProgress, onError) {
            const group = new MockGroup();
            const REQUIRED_19 = [
                'chest', 'traps', 'shoulders_front', 'shoulders_side', 'shoulders_rear',
                'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'calves',
                'upper_back', 'lats', 'lower_back', 'glutes', 'adductors', 'abductors', 'cardio'
            ];
            REQUIRED_19.forEach(name => {
                const m = new MockMesh(new MockGeometry('BufferGeometry'), new MockMaterial({ emissive: 0x00FF9D }));
                m.name = name;
                m.userData = { groupKey: name };
                group.add(m);
            });
            if (onLoad) setTimeout(() => onLoad({ scene: group }), 10);
        }
    }
};

// Execução no contexto do app
const mockStorage = { stronglog_graphic_mode: 'tier_1' };
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
};
global.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
global.navigator = { 
    serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {} }), addEventListener: () => {} } 
};
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
        function Dexie() { this.version = () => ({ stores: () => ({}) }); this.templates = { toArray: async () => [] }; }
        const lucide = { createIcons: () => {} };
        ${appJs}
        return app;
    `;
    loadedApp = new Function(scriptCode)();
} catch (e) {
    throw new Error('Falha ao instanciar app: ' + e.message);
}

// 3. Teste de silhueta anatômica e eliminação de caixas brutas no peitoral
it('buildHologramBodyMesh deve gerar silhueta anatômica estilizada sem BoxGeometry quadrada bruta no peitoral', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    assert(bodyMesh && bodyMesh.children.length >= 16, 'Modelo 3D deve conter pelo menos 16 partes anatômicas');
    
    // Procura partes do peitoral
    const chestParts = bodyMesh.children.filter(m => m.userData && m.userData.groupKey === 'chest' && !m.userData.isProxyCollider);
    assert(chestParts.length >= 2, 'Peitoral deve ter no mínimo 2 partes visuais (esquerda e direita)');
    
    chestParts.forEach(p => {
        assert(
            p.geometry.type !== 'BoxGeometry' || p.userData.isSculptedLowPoly === true,
            'Peitoral ainda usa BoxGeometry cúbica primitiva sem escultura anatômica low-poly'
        );
    });
});

// 4. Teste de realce emissivo Sci-Fi e paleta Neon Mint
it('Materiais do 3D devem aplicar realce emissivo Sci-Fi Neon Mint #00FF9D para grupos selecionados', () => {
    loadedApp.activeMuscleFilter = 'chest';
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const chestMesh = bodyMesh.children.find(m => m.userData && m.userData.groupKey === 'chest' && !m.userData.isProxyCollider);
    assert(chestMesh, 'Mesh do peitoral não encontrada');
    assert(chestMesh.material, 'Material da mesh não encontrado');
    
    assert(
        chestMesh.material.emissive === 0x00FF9D,
        `Cor emissiva esperada 0x00FF9D, recebido: ${chestMesh.material.emissive}`
    );
    assert(
        chestMesh.material.emissiveIntensity >= 1.0,
        `Intensidade emissiva Sci-Fi deve ser >= 1.0, recebido: ${chestMesh.material.emissiveIntensity}`
    );
    loadedApp.activeMuscleFilter = null;
});

// 5. Teste de taxa de atualização (60 FPS) e benchmarking em Tier 1
it('app.js deve fornecer renderização a 60 FPS em Tier 1 com função de benchmarking de performance', () => {
    assert(typeof loadedApp.measure3DPerformance === 'function', 'app.measure3DPerformance deve existir');
    const perfReport = loadedApp.measure3DPerformance('tier_1');
    assert(perfReport && perfReport.targetFPS >= 60, `Target FPS em Tier 1 deve ser >= 60, obtido: ${perfReport?.targetFPS}`);
    assert(perfReport.frameTimeMs <= 16.67, `Tempo médio de frame deve ser <= 16.67ms (60 FPS), obtido: ${perfReport?.frameTimeMs}ms`);
});

// 6. [RF01-v5.4] Cobertura de todos os 19 grupos musculares no 3D
it('buildHologramBodyMesh deve cobrir todos os 19 grupos musculares da ontologia (incluindo adutores, abdutores e cardio)', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const groupsIn3D = new Set();
    bodyMesh.children.forEach(m => {
        if (m.userData && m.userData.groupKey) {
            groupsIn3D.add(m.userData.groupKey);
        }
    });

    const REQUIRED_19 = [
        'chest', 'traps', 'shoulders_front', 'shoulders_side', 'shoulders_rear',
        'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'calves',
        'upper_back', 'lats', 'lower_back', 'glutes', 'adductors', 'abductors', 'cardio'
    ];

    const missing = REQUIRED_19.filter(g => !groupsIn3D.has(g));
    assert(missing.length === 0, `Grupos ausentes no modelo 3D: ${missing.join(', ')}`);
});

// 7. [RF01-v5.4] Proxy colliders ampliados para os 19 grupos
it('buildHologramBodyMesh deve conter proxy colliders ampliados para seleção tátil precisa no mobile', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const proxyColliders = bodyMesh.children.filter(m => m.userData && m.userData.isProxyCollider === true);
    assert(proxyColliders.length >= 19, `Esperados >= 19 proxy colliders ampliados, encontrados: ${proxyColliders.length}`);
    
    // Cada proxy collider deve referenciar um groupKey válido
    proxyColliders.forEach(pc => {
        assert(pc.userData.groupKey, 'Proxy collider deve possuir userData.groupKey');
        assert(pc.scale.x >= 1.05 && pc.scale.y >= 1.05, 'Proxy collider deve possuir escala ampliada em relação à malha base');
    });
});

// 8. [RF01-v5.4] Otimização de draw calls e material pooling
it('buildHologramBodyMesh deve utilizar material pooling para evitar re-instanciação de materiais', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const visualMeshes = bodyMesh.children.filter(m => m.userData && !m.userData.isProxyCollider);
    const uniqueMaterials = new Set(visualMeshes.map(m => m.material));
    // Sem pooling, cada mesh teria um material novo (>20 materiais). Com pooling, materiais não selecionados compartilham a mesma instância
    assert(uniqueMaterials.size <= 5, `Material pooling falhou: ${uniqueMaterials.size} materiais únicos encontrados em estado neutro (máximo esperado <= 5)`);
});

// 9. [RF01-Refatoração] Toggle Visão Anterior / Posterior no 3D (órbita de câmera única sem dupla inversão)
it('app.rotate3DToView deve alternar visão 3D orbitando câmera para anterior (z > 0) e posterior (z < 0) sem dupla inversão', () => {
    assert(typeof loadedApp.rotate3DToView === 'function', 'app.rotate3DToView deve existir');
    const bodyGroup = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const cam = { position: new MockVector3(0, 0.8, 3.8), aspect: 1.5, updateProjectionMatrix: () => {} };
    loadedApp.threeScenes['library'] = {
        bodyGroup,
        camera: cam,
        controls: null,
        materialsPool: bodyGroup.userData?.materialsPool,
        initialCameraPos: { x: 0, y: 0.8, z: 3.8 }
    };
    loadedApp.threeScenes['library'].materialsPool = bodyGroup.userData?.materialsPool;

    loadedApp.rotate3DToView('posterior', 'library');
    assert(cam.position.z < 0, `Esperado câmera em z negativo para visão posterior, obtido: ${cam.position.z}`);
    assert(Math.abs(bodyGroup.rotation.y) < 0.05, `Modelo deve manter rotação neutra (sem dupla inversão), obtido: ${bodyGroup.rotation.y}`);

    loadedApp.rotate3DToView('anterior', 'library');
    assert(cam.position.z > 0, `Esperado câmera em z positivo para visão anterior, obtido: ${cam.position.z}`);
    assert(Math.abs(bodyGroup.rotation.y) < 0.05, `Modelo deve manter rotação neutra, obtido: ${bodyGroup.rotation.y}`);
});

// 10. [RF01-Refatoração] Zoom no 3D (wheel / pinch / zoom controls)
it('app.zoom3D deve permitir zoom in/out suave delimitando entre distâncias seguras (1.5 a 6.0)', () => {
    assert(typeof loadedApp.zoom3D === 'function', 'app.zoom3D deve existir');
    const cam = { position: new MockVector3(0, 0.8, 3.8) };
    loadedApp.threeScenes['library'] = {
        camera: cam,
        controls: { minDistance: 1.5, maxDistance: 6.0 },
        initialCameraPos: { x: 0, y: 0.8, z: 3.8 }
    };

    // Zoom in (aproximar -> diminui z)
    loadedApp.zoom3D(-0.5, 'library');
    assert(cam.position.z < 3.8, `Esperado position.z < 3.8 após zoom in, obtido: ${cam.position.z}`);

    // Zoom out (afastar -> aumenta z)
    loadedApp.zoom3D(1.0, 'library');
    assert(cam.position.z > 3.3, `Esperado position.z aumentar após zoom out, obtido: ${cam.position.z}`);

    // Delimitação máxima
    loadedApp.zoom3D(10.0, 'library');
    assert(cam.position.z <= 6.0, `Camera position.z excedeu limite máximo 6.0, obtido: ${cam.position.z}`);

    // Delimitação mínima
    loadedApp.zoom3D(-20.0, 'library');
    assert(cam.position.z >= 1.5, `Camera position.z caiu abaixo do limite mínimo 1.5, obtido: ${cam.position.z}`);
});

// 11. [RF01-Refatoração] Isolamento Visual e Highlight do Músculo Selecionado
it('update3DMuscleHighlights deve isolar o músculo selecionado com Neon Mint #00FF9D e atenuar músculos neutros', () => {
    const bodyGroup = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    loadedApp.threeScenes['library'] = {
        bodyGroup,
        camera: { position: new MockVector3(0, 0.8, 3.8) },
        materialsPool: bodyGroup.userData?.materialsPool,
        initialCameraPos: { x: 0, y: 0.8, z: 3.8 }
    };
    loadedApp.threeScenes['library'].materialsPool = bodyGroup.userData?.materialsPool;

    loadedApp.activeMuscleFilter = 'chest';
    loadedApp.update3DMuscleHighlights('library');

    const chestMesh = bodyGroup.children.find(m => m.userData && m.userData.groupKey === 'chest' && !m.userData.isProxyCollider);
    const quadsMesh = bodyGroup.children.find(m => m.userData && m.userData.groupKey === 'quads' && !m.userData.isProxyCollider);

    assert(chestMesh, 'Peitoral deve existir no bodyGroup');
    assert(quadsMesh, 'Quadríceps deve existir no bodyGroup');

    // Músculo ativo isolado
    const emHex = Number(chestMesh.material.emissive?.hex !== undefined ? chestMesh.material.emissive.hex : chestMesh.material.emissive);
    assert.strictEqual(emHex, 0x00FF9D, 'Músculo ativo deve ter emissive 0x00FF9D');
    assert(chestMesh.material.emissiveIntensity >= 1.5, 'Intensidade emissiva do selecionado deve ser >= 1.5');
    assert(chestMesh.material.opacity >= 0.9, 'Opacidade do músculo ativo deve ser >= 0.9');

    // Músculo não selecionado atenuado (isolamento visual anti-slop)
    assert(quadsMesh.material.opacity <= 0.45, `Músculo neutro deve ser atenuado (opacity <= 0.45), obtido: ${quadsMesh.material.opacity}`);
    assert(quadsMesh.material.emissiveIntensity <= 0.15, 'Músculo neutro deve ter emissiveIntensity <= 0.15');

    loadedApp.activeMuscleFilter = null;
});

// 12. [RF01-Refatoração] Sincronização e Auto-rotação Frontal/Dorsal
it('app.selectMuscleFilter deve sincronizar visão 3D auto-rotacionando câmera para visão dorsal em grupos posteriores e frontal em anteriores', () => {
    const bodyGroup = loadedApp.buildHologramBodyMesh(mockTHREE, null);
    const cam = { position: new MockVector3(0, 0.8, 3.8), aspect: 1.5, updateProjectionMatrix: () => {} };
    loadedApp.threeScenes['library'] = {
        bodyGroup,
        camera: cam,
        materialsPool: bodyGroup.userData?.materialsPool,
        initialCameraPos: { x: 0, y: 0.8, z: 3.8 }
    };
    loadedApp.threeScenes['library'].materialsPool = bodyGroup.userData?.materialsPool;

    // Grupo posterior (lats)
    loadedApp.selectMuscleFilter('lats');
    assert(cam.position.z < 0, `Seleção de lats deveria posicionar câmera na visão posterior (z < 0), obtido: ${cam.position.z}`);
    assert(Math.abs(bodyGroup.rotation.y) < 0.05, `Modelo deve manter rotação neutra, obtido: ${bodyGroup.rotation.y}`);

    // Grupo anterior (chest)
    loadedApp.selectMuscleFilter('chest');
    assert(cam.position.z > 0, `Seleção de chest deveria posicionar câmera na visão anterior (z > 0), obtido: ${cam.position.z}`);
    assert(Math.abs(bodyGroup.rotation.y) < 0.05, `Modelo deve manter rotação neutra, obtido: ${bodyGroup.rotation.y}`);

    // Sentinel MAJOR #4: Isolamento de materialsPool por cena
    assert(loadedApp.threeScenes['library'].materialsPool, 'threeScenes deve possuir materialsPool isolado por cena');

    loadedApp.clearMuscleFilter();
});

// 13. [RF01-v7.0] Podium circular holográfico com THREE.RingGeometry na base
it('buildHologramBodyMesh / init3DScene deve instanciar podium circular holográfico com RingGeometry', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null, 'library');
    const podiumMesh = bodyMesh.children.find(m => m.geometry && m.geometry.type === 'RingGeometry' || (m.userData && m.userData.isPodium));
    assert(podiumMesh, 'Podium holográfico com THREE.RingGeometry não encontrado no bodyMesh/cena 3D');
    assert(podiumMesh.position.y <= -1.2, `Podium deve estar posicionado na base dos pés (y <= -1.2), obtido: ${podiumMesh.position.y}`);
});

// 14. [RF01-v7.0] Fibras musculares base com grafite/titânio 0x0e1520
it('buildHologramBodyMesh deve utilizar fibras neutras em grafite/titânio 0x0e1520', () => {
    const bodyMesh = loadedApp.buildHologramBodyMesh(mockTHREE, null, 'library');
    const pool = loadedApp.threeScenes['library']?.materialsPool || bodyMesh.userData?.materialsPool;
    assert(pool && pool.defaultNeutralMat, 'Materials pool deve conter defaultNeutralMat');
    const colorHex = pool.defaultNeutralMat.color?.hex !== undefined ? pool.defaultNeutralMat.color.hex : pool.defaultNeutralMat.color;
    assert.strictEqual(colorHex, 0x0e1520, `Cor base de fibras neutras deve ser grafite/titânio 0x0e1520, obtido: 0x${colorHex ? colorHex.toString(16) : '0'}`);
});

// 15. [RF01-v7.0] HUD Flutuante de Telemetria sobreposto ao canvas
it('app.update3DHUD deve atualizar telemetria de ativação dual-mode (100% biblioteca vs % volume treino)', () => {
    assert(typeof loadedApp.update3DHUD === 'function', 'app.update3DHUD deve existir');
    const hudContainer = mockElement('library-3d-hud');
    domElements['library-3d-hud'] = hudContainer;
    
    // Modo Biblioteca: ativação 100% no grupo selecionado
    loadedApp.activeMuscleFilter = 'chest';
    loadedApp.update3DHUD('library', 'library');
    assert(hudContainer.innerHTML.includes('100%') || hudContainer.innerText.includes('100%'), 'HUD no modo biblioteca deve exibir 100% de ativação para grupo primário');
    assert(hudContainer.innerHTML.includes('Peitoral') || hudContainer.innerHTML.includes('chest'), 'HUD deve exibir nome do grupo muscular');

    // Modo Treino / Resumo: calcula % volume efetivo
    const summaryHud = mockElement('summary-3d-hud');
    domElements['summary-3d-hud'] = summaryHud;
    loadedApp.activeWorkout = {
        exercises: [
            { primary_muscle_group: 'chest', sets: [{ weight: 100, reps: 10, completed: true }] },
            { primary_muscle_group: 'back', sets: [{ weight: 100, reps: 10, completed: true }] }
        ]
    };
    loadedApp.update3DHUD('summary', 'workout');
    assert(summaryHud.innerHTML.includes('50%') || summaryHud.innerText.includes('50%'), 'HUD no modo treino deve calcular % do volume efetivo da sessão (50%)');
    
    loadedApp.activeWorkout = null;
    loadedApp.activeMuscleFilter = null;
});

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RF01: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);

