# 🔁 Handover — StrongLog Pro

> Atualizado em: 2026-08-30 16:10 | Por: Chronicler (Memory Archivist) & Equipe Maestri (Maestro, Forge, Sentinel, Specter, Compass, Searcher)

## Estado atual do projeto
O **StrongLog Pro v6.0 (Refatoração Anatômica: Modelo 3D GLB Ultraleve, GLTFLoader Local, SVG Orgânico & Anti-Lockout TDD)** está 100% implementado, testado e validado.

O sistema consolidou uma importante evolução em relação às versões anteriores:
- **v5.4**: Three.js com proxy colliders invisíveis, chips de grupos musculares, fullscreen sheet 100dvh com auto-colapso e fallbacks defensivos.
- **v5.5**: Service Worker resiliente com desacoplamento de CDNs e navegação `network-first`.
- **v5.6**: Blindagem global de overlays com `.hidden` explícito, onboarding com flag multi-key e fechamento correto de rotinas.
- **v5.7**: Acessibilidade WCAG 2.2 com hitboxes de 44px (`.touch-target-44`), `min-h-[100dvh]`, correção de contraste, `role="timer"` e `aria-live="polite"`.
- **v6.0 (Entrega Atual)**:
  - **Asset 3D GLB Ultraleve**: Substituição da silhueta procedural por modelo humanoide glTF 2.0 binário (`src/assets/models/human_body_sci_fi.glb`, 166.72 KB < 250KB) contendo os 19 sub-meshes nomeados rigorosamente pela ontologia oficial.
  - **Vendor Local do GLTFLoader**: `src/vendor/three/GLTFLoader.js` (Three.js r128 UMD/global, 96.5KB) incluído no repositório, carregado em `src/index.html` e cacheado em `src/sw.js` (100% offline-first).
  - **Fallback Defensivo & Anti-Leak GPU**: `app.loadHologramGLB` com timeout de 2.5s (2500ms), fallback transparente para silhueta paramétrica e flag `isSceneAlive` na cena Three.js para abortar inserção de meshes caso o modal seja fechado antes do carregamento.
  - **Materiais Sci-Fi & Pooling Isolado**: Pooling de materiais encapsulado por cena (`app.threeScenes[sceneKey].materialsPool`), realce emissivo Neon Mint `#00FF9D` (`emissiveIntensity: 1.8`) e heatmap térmico de 4 níveis com descarte seguro (`.dispose()`) em `app.destroy3DScene`.
  - **Mapa 2D SVG Orgânico**: Substituição de `<polygon>` e `<rect>` por `<path d="...">` com curvaturas anatômicas reais (frente e costas) para os 19 grupos musculares, com classes `.active-selected`, `.dimmed-node` e `.heat-[1-4]`.
  - **Preservação de Hitboxes Táteis**: Ancoragem dos centros de toque (`cx`/`cy`) com distância mínima $\ge 28\text{px}$ entre grupos adjacentes (zero colisão), hitboxes `.touch-target-44` e vibração tátil `navigator.vibrate(20)`.
  - **Evolução de Testes (Anti-Lockout)**: Atualização das asserções de `test_rf01_3d_harmonization.js`, `test_rf02_svg_map_redesign.js`, `test_rf05_fallback_and_cache.js`, `test_rf_overlays_v56.js` e `run_e2e_qa_suite.js` para validar a nova arquitetura sem bloqueio.
  - **Status dos Testes**: **100% PASS, 0 FAIL** em todos os scripts da suíte (`test_rf01`: 13/13, `test_rf02`: 12/12, `verify_9_items`: 9/9, `run_e2e_qa_suite`: 24/24, `test_rf_overlays_v56`: 8/8, `test_rf_residual_v56`: 6/6, `test_exercise_picker_flow`: 10/10, `test_rf03`: 8/8, `test_rf04`: 9/9).

---

## O que foi feito recentemente (v6.0)
* **Asset 3D GLB & Loader Local**:
  - Script autônomo `scripts/generate_human_body_glb.py` gerando binário glTF 2.0 padrão com posições, normais e índices para os 19 grupos musculares.
  - Integração do `THREE.GLTFLoader` local em `src/vendor/three/GLTFLoader.js` e cache Service Worker `stronglog-pro-v6.0`.
  - Mecanismo defensivo com timeout de 2.5s e verificação de `sc.isSceneAlive` antes de anexar sub-meshes à cena.
* **Mapa 2D SVG Orgânico**:
  - Remoção de polígonos e retângulos toscos nos nós musculares.
  - Curvas de Bézier cúbicas suaves mapeadas para traps, abs, adutores, dorsal e lombar.
  - Hitboxes circulares restritas de raio $r=14$ preservadas com centros matematicamente calculados para distância $\ge 28\text{px}$.
* **Harmonização & Estabilidade de Cena**:
  - `rotate3DToView` orbital sem dupla inversão (órbita apenas na câmera, $z = \pm r$).
  - Descarte seguro do `materialsPool` isolado por cena Three.js ao invocar `destroy3DScene`.

---

## ⏳ Pendências & Roadmap Futuro (Prioridade Decrescente)

### 🟢 P1 — Próximo Ciclo (Polish & Análise)
1. **Histórico de Treinos com Gráficos Miniaturizados (Sparklines P2-Searcher)**:
   - Exibir pequenas curvas de evolução de carga diretamente no card de cada exercício no histórico.
2. **Visualizador de Recuperação Semanal (Heatmap de Fadiga $e^{-\lambda t}$)**:
   - Exibir mapa de calor dos últimos 7 dias na aba de Histórico baseado na atenuação metabólica.

### 🟡 P2 — Médio Prazo (Recursos Avançados)
1. **Exportação Tabular em CSV / Excel**:
   - Exportação completa do histórico de treinos e métricas de volume para planilhas.
2. **Giroscópio no Modelo 3D (`DeviceOrientation`)**:
   - Reação sutil do holograma 3D à inclinação física do smartphone na mão do usuário.

---

## 🔴 Armadilhas e Alertas Técnicos
* **GLTFLoader UMD vs ES Module**: O script em `src/vendor/three/GLTFLoader.js` é a versão standalone compatível com Three.js r128 global (`window.THREE.GLTFLoader`). Não importar como módulo ES em `app.js` sem empacotador.
* **Tamanho do GLB**: O binário `human_body_sci_fi.glb` deve permanecer estritamente abaixo de 250KB para garantir download instantâneo e tempo de parsing Three.js $< 50\text{ms}$ no mobile.
* **Overlays e Modais**: NUNCA ocultar overlays usando apenas transformações CSS (`translate-y-[-100%]`, `opacity: 0`). Eles continuam ocupando a árvore de acessibilidade e interceptam eventos de ponteiro/toque. Sempre aplicar a classe `.hidden` com `display: none !important`.
* **Onboarding Multi-Flag**: O teste de onboarding checa múltiplas chaves no `localStorage` (`onboarding_done`, `stronglog_onboarded_v5`, `stronglog_onboarded`). Nunca confiar em uma única chave sem fallback.
* **Ciclo de Vida Three.js**: Sempre garantir que `app.destroy3DScene('library')` seja executado no fechamento do modal da biblioteca para cancelar o `requestAnimationFrame` e liberar a GPU.

---

## 🧩 Contexto Técnico & Deploy
* **Deploy Host**: `https://gfsleme.github.io/stronglog-pro/`
* **Repositório Git**: `C:\Users\Gabriel\OneDrive\Desktop\Projetos Python\StrongLog`
* **Versão Ativa**: v6.0 • Suíte TDD: 100% Aprovados (0 FAIL) + 9/9 Auditoria Sentinel/Specter

