# 🔁 Handover — StrongLog Pro

> Atualizado em: 2026-08-31 21:40 | Por: Antigravity IDE (Pair Programming) & Mission Control v4.2

## Estado atual do projeto
O **StrongLog Pro v7.0 (Arquitetura Integral Astro 7+, Content Layer API, BaseLayout & Modularização Total de Componentes)** está 100% implementado, testado e validado.

O sistema consolidou uma importante evolução em relação às versões anteriores:
- **v6.0**: Three.js com modelo 3D GLB ultraleve (<250KB), GLTFLoader local UMD, SVG orgânico 2D e anti-lockout TDD.
- **v7.0 (Entrega Atual)**:
  - **Astro Docs MCP & Configuração Global**: Integração do MCP `astro-docs` em `~/.gemini/config/mcp_config.json`.
  - **Content Layer API (`src/content.config.ts`)**: Tipagem estrita com Zod para o catálogo de 1.324 exercícios (`exercises.min.json`) e ontologia de 19 grupos musculares (`muscle_ontology.json`).
  - **BaseLayout Centralizado (`src/layouts/Layout.astro`)**: Eliminação de duplicações de `<head>`, metadados PWA, CSP e CSS.
  - **Decomposição Modular de Componentes**: Decomposição do `index.astro` (de 685 para 55 linhas), distribuído em `src/components/ui/`, `src/components/layout/`, `src/components/views/` e `src/components/modals/`.
  - **Path Aliases TypeScript**: Configuração do `tsconfig.json` com `@components/*`, `@layouts/*`, `@data/*` e `@assets/*`.
  - **Status dos Testes**: **100% PASS, 0 FAIL** em todos os scripts da suíte (`npm run build`: OK em 1.7s, `verify_9_items`: 9/9, `run_e2e_qa_suite`: 24/24, `test_rf01`: 13/13, `test_rf02`: 12/12, `test_rf_overlays`: 8/8, `test_rf_residual`: 6/6, `test_exercise_picker_flow`: 10/10).

---

## O que foi feito recentemente (v7.0)
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

