// scripts/test_rf01_3d_harmonization.js
// Teste TDD Estrito para RF01: Harmonização do Modelo 3D Low-Poly
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TDD RED-TEST: RF01 - Harmonização do Modelo 3D Low-Poly');
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

// 1. Verificação de Código e Restrições de Peso (<300KB)
it('Não deve carregar arquivos 3D externos pesados (.gltf, .glb, .obj) no buildHologramBodyMesh', () => {
    const hasExternal3DFile = /\.(glb|gltf|obj)(['"`?#]|$)/i.test(appJs);
    assert(!hasExternal3DFile, 'Detectada referência a assets 3D externos pesados (.glb/.gltf/.obj)');
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
    }
    add(child) { this.children.push(child); }
}
class MockGroup extends MockObject3D {}
class MockMesh extends MockObject3D {
    constructor(geometry, material) {
        super();
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
    BoxGeometry: class extends MockGeometry { constructor(...args) { super('BoxGeometry', args); } },
    CylinderGeometry: class extends MockGeometry { constructor(...args) { super('CylinderGeometry', args); } },
    ConeGeometry: class extends MockGeometry { constructor(...args) { super('ConeGeometry', args); } },
    SphereGeometry: class extends MockGeometry { constructor(...args) { super('SphereGeometry', args); } },
    IcosahedronGeometry: class extends MockGeometry { constructor(...args) { super('IcosahedronGeometry', args); } },
    DodecahedronGeometry: class extends MockGeometry { constructor(...args) { super('DodecahedronGeometry', args); } },
    BufferGeometry: class extends MockGeometry { constructor(...args) { super('BufferGeometry', args); } },
    Vector2: class { constructor(x,y){this.x=x;this.y=y;} },
    Vector3: MockVector3,
    Color: class { constructor(c){this.hex=c;} }
};

// Execução no contexto do app
const mockStorage = { stronglog_graphic_mode: 'tier_1' };
global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
};
global.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
global.navigator = { serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {} }) } };
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
};

let loadedApp = null;
try {
    const scriptCode = `
        const Dexie = function() { return { version: () => ({ stores: () => {} }) }; };
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
    const chestParts = bodyMesh.children.filter(m => m.userData && m.userData.groupKey === 'chest');
    assert(chestParts.length >= 2, 'Peitoral deve ter no mínimo 2 partes (esquerda e direita)');
    
    // O peitoral não deve ser um simples BoxGeometry sem tratamento anatômico
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
    const chestMesh = bodyMesh.children.find(m => m.userData && m.userData.groupKey === 'chest');
    assert(chestMesh, 'Mesh do peitoral não encontrada');
    assert(chestMesh.material, 'Material da mesh não encontrado');
    
    // Emissivo deve ser Neon Mint 0x00FF9D ou similar brilhante
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

console.log('\n----------------------------------------------------------------');
console.log(`RESULTADO RED-STAGE: ${passed} PASS / ${failed} FAIL`);
console.log('----------------------------------------------------------------\n');
process.exit(failed > 0 ? 1 : 0);
