# 🔁 Handover — StrongLog Pro

> Atualizado em: 2026-08-30 14:50 | Por: Chronicler (Memory Archivist) & Equipe Maestri (Maestro, Forge, Sentinel, Specter, Compass, Searcher)

## Estado atual do projeto
O **StrongLog Pro v5.7 (Remap Anatômico 2D/3D Refeito, Animações por Músculo, Acessibilidade WCAG 2.2 & Agente Searcher)** está 100% implementado, testado e validado.

O sistema consolidou uma importante evolução em relação às versões anteriores:
- **v5.4**: Three.js com proxy colliders invisíveis, chips de grupos musculares, fullscreen sheet 100dvh com auto-colapso e fallbacks defensivos.
- **v5.5**: Service Worker resiliente com desacoplamento de CDNs e navegação `network-first`.
- **v5.6**: Blindagem global de overlays com `.hidden` explícito, onboarding com flag multi-key e fechamento correto de rotinas.
- **v5.7 (Entrega Atual)**:
  - Remap 2D/3D refeito do zero com animações de pulso/glow por músculo (`.active-selected`).
  - Visão anterior/posterior 3D orbital sem dupla inversão de rotação (`app.rotate3DToView`).
  - Controles táteis de zoom dedicados para o Mapa SVG (1.0x–2.5x) e visualizador Three.js (1.5–6.0).
  - Acessibilidade WCAG 2.2 com hitboxes de 44px (`.touch-target-44`), `min-h-[100dvh]`, correção rigorosa de contraste (remoção de `text-gray-700`), `role="timer"` e `aria-live="polite"`.
  - Conexão do novo agente consultivo **Searcher** ao canvas Maestri com benchmarking competitivo e relatório P1/P2/P3 consolidado em [[RESEARCH_BENCHMARK_SEARCHER]].
- **Status dos Testes**: **68/68 assertions automatizadas verdes via Node.js** (RF01 a RF05 + Picker Flow + Overlays v5.6 + Testes Residuais) e **9/9 itens críticos auditados com sucesso** via `scripts/verify_9_items.js`. Zero regressões.

---

## O que foi feito recentemente (v5.7)
* **Visualizador Anatômico & Biomecânica**:
  - Remap do zero dos alvos anatômicos com feedback pulsante Neon Mint (`#00FF9D`) e atenuação visual precisa dos grupos inativos.
  - Câmera 3D orbital corrigida alternando entre vista anterior e posterior sem inversão dupla de eixos.
  - Ferramentas de zoom tátil integradas ao Mapa 2D SVG e ao modelo tridimensional Three.js.
  - Identidade visual Tactical Sci-Fi preservada com fundo grafite profundo (`#070B11`) e bordas hairline de 1px.
* **Acessibilidade Móvel & Padrões WCAG 2.2**:
  - Hitboxes de no mínimo 44x44px (`.touch-target-44`) aplicadas a botões e nós SVG, compensando fadiga motora e suor nas mãos.
  - Altura dinâmica em `100dvh` para evitar sobreposição de controles pelas barras de navegação de navegadores móveis.
  - Eliminação de classes de baixo contraste (`text-gray-700`), garantindo contraste AAA no dark mode.
  - Atributos `role="timer"` e `aria-live="polite"` nos cronômetros de descanso.
* **Inteligência de Mercado & Canvas Maestri**:
  - Integração do agente consultivo **Searcher** no canvas, gerando análise comparativa (Hevy, Strong, RP) e matriz de recomendações P1/P2/P3.

---

## ⏳ Pendências & Roadmap Futuro (Prioridade Decrescente)

### 🟢 P1 — Próximo Ciclo (Isolamento de Recursos & Polish)
1. **Isolamento de `materialsPool` Three.js por Cena**:
   - Mudar de `app.hologramMaterialsPool` global para `app.threeScenes[sceneKey].materialsPool` em `src/app.js:2462/2470`.
   - Evitar que o `destroy3DScene` de uma cena descarte materiais de outra cena ativa.
2. **Histórico de Treinos com Gráficos Miniaturizados (Sparklines P2-Searcher)**:
   - Exibir pequenas curvas de evolução de carga diretamente no card de cada exercício no histórico.
3. **Visualizador de Recuperação Semanal (Heatmap de Fadiga $e^{-\lambda t}$)**:
   - Exibir mapa de calor dos últimos 7 dias na aba de Histórico baseado na atenuação metabólica.

### 🟡 P2 — Médio Prazo (Recursos Avançados)
1. **Exportação Tabular em CSV / Excel**:
   - Exportação completa do histórico de treinos e métricas de volume para planilhas.
2. **Giroscópio no Modelo 3D (`DeviceOrientation`)**:
   - Reação sutil do holograma 3D à inclinação física do smartphone na mão do usuário.

---

## 🔴 Armadilhas e Alertas Técnicos
* **⚠️ Risco Residual — `materialsPool` Global (app.js:2462/2470 e 2596)**:
  O repositório de materiais Three.js ainda é armazenado globalmente em `app.hologramMaterialsPool`. Ao invocar `app.destroy3DScene(sceneKey)` (`app.js:2751-2763`), os materiais dos meshes filhos são descartados via `.dispose()`. Nas próximas iterações, instanciar pools independentes por chave de cena (`app.threeScenes[sceneKey].materialsPool`) para garantir encapsulamento completo de recursos GPU.
* **Overlays e Modais**: NUNCA ocultar overlays usando apenas transformações CSS (`translate-y-[-100%]`, `opacity: 0`). Eles continuam ocupando a árvore de acessibilidade e interceptam eventos de ponteiro/toque. Sempre aplicar a classe `.hidden` com `display: none !important`.
* **Onboarding Multi-Flag**: O teste de onboarding checa múltiplas chaves no `localStorage` (`onboarding_done`, `stronglog_onboarded_v5`, `stronglog_onboarded`). Nunca confiar em uma única chave sem fallback.
* **Ciclo de Vida Three.js**: Sempre garantir que `app.destroy3DScene('library')` seja executado no fechamento do modal da biblioteca para cancelar o `requestAnimationFrame` e liberar a GPU.

---

## 🧩 Contexto Técnico & Deploy
* **Deploy Host**: `https://gfsleme.github.io/stronglog-pro/`
* **Repositório Git**: `C:\Users\Gabriel\OneDrive\Desktop\Projetos Python\StrongLog`
* **Versão Ativa**: v5.7 • Suíte TDD: 68/68 Aprovados (100% GREEN) + 9/9 Auditoria Sentinel/Specter
