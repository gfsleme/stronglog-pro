# 🤖 CLAUDE.md — StrongLog Pro (Diretrizes para Claude Code no Maestri)

Este arquivo governa a atuação do **Claude Code** (como Forge, Sentinel ou Compass) no workspace do StrongLog Pro.

---

## 🎯 Mandato Principal

Você é o engenheiro especialista atuando no **StrongLog Pro**. Seu objetivo é implementar código de alta fidelidade visual, estabilidade biomecânica e conformidade rigorosa com os requisitos do Gabriel no Maestri Canvas.

---

## ⚡ Regras Críticas de Execução

1. **Evolução de Testes Autorizada**:
   - Se uma tarefa demandar um novo modelo 3D (ex: GLTF/GLB) ou um novo mapa 2D (ex: novos paths SVG orgânicos) e um teste legado em `scripts/` falhar por esperar primitivas antigas (ex: `assert(!hasExternal3DFile)` ou coordenadas antigas), **VOCÊ TEM AUTORIZAÇÃO EXPLÍCITA PARA ATUALIZAR O TESTE PRIMEIRO**.
   - Nunca reverta um avanço visual para manter um teste legado obsoleto passando.
   - Aplique TDD: atualize o teste para refletir o novo padrão, veja-o falhar e implemente o código.

2. **Arquitetura Visual 2D & 3D (v6.0)**:
   - **2D SVG (`app.getSvgAnatomicalPaths`)**:
     - Usar `<path d="..." data-group="<grupo>" class="${getNodeClass('<grupo>')}">` com curvatura orgânica real.
     - Preservar hitboxes táteis acessíveis de no mínimo 44x44px (`.touch-target-44`) sem bloquear toques.
     - Mapear os 19 grupos musculares da ontologia (`chest`, `lats`, `quads`, etc.).
   - **3D Three.js (`app.buildHologramBodyMesh` / `app.init3DScene`)**:
     - Carregar modelo GLB local via `THREE.GLTFLoader` (com cache PWA no `src/sw.js`).
     - Manter fallback defensivo se o WebGL ou o arquivo demorar.
     - Aplicar materiais Sci-Fi Neon Mint (`#00FF9D`) e pooling isolado por cena (`app.threeScenes[sceneKey].materialsPool`).
     - Garantir descarte completo de memória (`dispose()`) em `destroy3DScene`.

3. **Padrões de Estilo & Anti-AI-Slop**:
   - Identidade Sci-Fi Tática: Fundo grafite profundo (`#070B11`), realce Neon Mint (`#00FF9D`), bordas de 1px com baixa opacidade (`border-white/10`).
   - Evitar cores genéricas puras (vermelho/azul chapado). Usar badges e gradientes sutis.
   - Preservar acessibilidade WCAG 2.2: contraste alto, zero classes de baixo contraste como `text-gray-700`, `min-h-[100dvh]` para evitar sobreposição em navegadores móveis.

---

## 🧪 Bateria de Testes (Execute antes de aprovar com Sentinel)

```bash
# Teste do 3D Three.js
node scripts/test_rf01_3d_harmonization.js

# Teste do 2D SVG
node scripts/test_rf02_svg_map_redesign.js

# Verificação dos 9 itens críticos
node scripts/verify_9_items.js

# Suíte Completa E2E
node scripts/run_e2e_qa_suite.js
```

---

## 📍 Skills Globais do Workspace
Caso precise consultar diretrizes de design avançado ou debugging:
- Hallmark Design: `C:\Users\Gabriel\.gemini\config\skills\hallmark\SKILL.md`
- Systematic Debugging: `C:\Users\Gabriel\.gemini\config\plugins\superpowers\skills\systematic-debugging\SKILL.md`
- Test Driven Development: `C:\Users\Gabriel\.gemini\config\plugins\superpowers\skills\test-driven-development\SKILL.md`
