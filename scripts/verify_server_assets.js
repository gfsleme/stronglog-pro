// scripts/verify_server_assets.js
// Validação de Integridade de Rede e Respostas HTTP em http://localhost:8088

const http = require('http');

const endpoints = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/sw.js',
    '/data/muscle_ontology.json',
    '/data/exercises.min.json'
];

async function checkEndpoint(urlPath) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:8088${urlPath}`, (res) => {
            let bodySize = 0;
            res.on('data', chunk => bodySize += chunk.length);
            res.on('end', () => {
                resolve({
                    path: urlPath,
                    status: res.statusCode,
                    size: bodySize,
                    contentType: res.headers['content-type']
                });
            });
        });
        req.on('error', (err) => {
            resolve({ path: urlPath, status: 'ERROR', error: err.message });
        });
    });
}

async function run() {
    console.log('📡 TESTANDO INTEGRIDADE DE ENDPOINTS EM http://localhost:8088\n');
    let allOk = true;
    for (const ep of endpoints) {
        const res = await checkEndpoint(ep);
        if (res.status === 200) {
            console.log(`✅ [200 OK] ${res.path.padEnd(28)} (${res.size.toLocaleString()} bytes) [${res.contentType || 'N/A'}]`);
        } else {
            console.error(`❌ [FAIL] ${res.path} -> Status: ${res.status}`);
            allOk = false;
        }
    }
    console.log('\n================================================================');
    console.log(allOk ? '🎉 TODOS OS RECURSOS E ASSETS SERVIDOS COM SUCESSO (200 OK)!' : '❌ FALHA NA DISPONIBILIDADE DE ASSETS');
    console.log('================================================================');
    if (!allOk) process.exit(1);
}

run();
