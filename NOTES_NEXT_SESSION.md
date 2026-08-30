# 🔁 Handover — StrongLog Pro

> Atualizado em: 2026-08-30 12:30 | Por: Chronicler (Memory Archivist) & Equipe Maestri (Maestro, Forge, Sentinel, Specter, Compass)

## Estado atual do projeto
O **StrongLog Pro v5.6 (Hotfix Crítico de Overlays, Resiliência do Service Worker & Homologação de Percurso Completo)** está 100% concluído, testado e publicado em produção no GitHub Pages (`https://gfsleme.github.io/stronglog-pro/`).

O sistema passou por três ciclos intensivos de evolução e correção técnica após a v5.3:
- **v5.4 (Commit `cef0206`)**: Three.js com 34 proxy colliders invisíveis (`scale: 1.35`) e pooling de materiais; barra de chips anatômicos rápidos (`#library-muscle-chips-bar`) para os 19 grupos; biblioteca fullscreen sheet `100dvh` com auto-colapso ao buscar; eliminação de strings `UNDEFINED` no treino ativo (60/60 testes PASS).
- **v5.5 (Commit `333c5db`)**: Diagnóstico e resolução da falha silenciosa do Service Worker. O `cache.addAll` atômico derrubava a instalação por CDNs externas, prendendo celulares no cache velho da v5.2 ("botões e layouts desconfigurados"). Corrigido com cache unitário de assets locais, CDNs em best-effort paralelo e navegação `network-first` com fallback offline.
- **v5.6 (Commit `7046fd4`)**: Resolução definitiva dos modais fantasmas que bloqueavam o app. `#onboarding-modal` (z-500) com `.hidden` explícito no HTML + flag multi-key no `localStorage` + bloqueio de reabertura com outros modais ativos; `#rest-timer-overlay` (z-200) com `.hidden` real quando inativo (eliminando toques bloqueados pelo translate); todos os 11 modais padronizados com `.hidden { display: none !important; }`; `savePlan` fecha editor e volta ao dashboard; busca da biblioteca restaurada (61 default / 46 'supino').
- **Status dos Testes**: **78/78 testes automatizados aprovados (100% GREEN)**, com zero regressões.
- **Validação E2E Empírica**: Percurso humano-simulado completo validado pelo Maestro via Chrome DevTools Protocol (CDP 390x844): *boot limpo $\rightarrow$ nova rotina $\rightarrow$ biblioteca $\rightarrow$ busca textual $\rightarrow$ seleção múltipla $\rightarrow$ salvar rotina $\rightarrow$ ajustes*, confirmando zero overlays residuais e zero erros no console.

---

## O que foi feito recentemente (v5.4 a v5.6)
* **v5.4 (UX & Biomecânica)**:
  - 34 proxy colliders invisíveis no Three.js garantindo toques precisos no modelo 3D sem desvios de Raycasting.
  - Barra de chips anatômicos com rolagem horizontal e sincronização tripla (Chip $\leftrightarrow$ 2D SVG $\leftrightarrow$ 3D Three.js $\leftrightarrow$ Lista).
  - Modal da biblioteca em `100dvh` (< 640px) com auto-colapso do visualizador ao focar no campo de busca ($\ge 85\%$ de área útil).
  - Fallbacks defensivos para `baseWeight` (`Livre`) e `restSeconds` (`90s`), eliminando `UNDEFINED`.
* **v5.5 (Infraestrutura PWA & Resiliência de Deploy)**:
  - Desacoplamento da instalação do Service Worker: CDNs externas não mais bloqueiam ou derrubam a ativação do cache local.
  - Estratégia de navegação alterada para `network-first` garantindo que novas versões cheguem de imediato aos dispositivos móveis.
* **v5.6 (Blindagem de Overlays & Fluxo Gabriel)**:
  - Eliminação de z-index bleed e overlays invisíveis no DOM (`onboarding-modal` e `rest-timer-overlay`).
  - Auditoria estrita em todos os 11 modais e overlays do app com classe `.hidden` nativa e CSS reforçado.
  - Correção do fluxo de criação e persistência de rotinas no Dashboard via `savePlan`.
  - Homologação via suíte TDD dedicada `scripts/test_rf_overlays_v56.js` (8/8 PASS).

---

## ⏳ Pendências & Roadmap Futuro (Prioridade Decrescente)

### 🟢 P1 — Próximo Ciclo (Refinamentos de Polish)
1. **Histórico de Treinos com Gráficos Miniaturizados (Sparklines)**:
   - Exibir pequenas curvas de evolução de carga diretamente no card de cada exercício no histórico.
2. **Visualizador de Recuperação Semanal**:
   - Exibir mapa de calor dos últimos 7 dias na aba de Histórico baseado na atenuação metabólica ($e^{-\lambda t}$).

### 🟡 P2 — Médio Prazo (Recursos Avançados)
1. **Exportação Tabular em CSV / Excel**:
   - Exportação completa do histórico de treinos e métricas de volume para planilhas.
2. **Giroscópio no Modelo 3D (`DeviceOrientation`)**:
   - Reação sutil do holograma 3D à inclinação física do smartphone na mão do usuário.

---

## 🔴 Armadilhas e Alertas Técnicos
* **Cache do Service Worker (`stronglog-pro-v5.6`)**: Se o usuário relatar comportamento antigo após deploys futuros, instruí-lo a fechar a aba do PWA e reabrir. O Service Worker v5.5/v5.6 agora força `skipWaiting` e `clients.claim`, mas navegadores mobile exigem um ciclo de restart para limpar instâncias background.
* **Overlays e Modais**: NUNCA ocultar overlays usando apenas transformações CSS (`translate-y-[-100%]`, `opacity: 0`). Eles continuam ocupando a árvore de acessibilidade e interceptam eventos de ponteiro/toque se o `pointer-events: none` falhar. Sempre aplicar a classe `.hidden` com `display: none !important`.
* **Onboarding Multi-Flag**: O teste de onboarding checa múltiplas chaves no `localStorage` (`onboarding_done`, `stronglog_onboarded_v5`, `stronglog_onboarded`). Nunca confiar em uma única chave sem fallback.
* **Ciclo de Vida Three.js**: Sempre garantir que `app.destroy3DScene('library')` seja executado no fechamento do modal da biblioteca para cancelar o `requestAnimationFrame` e liberar a GPU.
* **Line-Endings (CRLF vs LF)**: Verificar `git diff` antes de commitar para evitar ruídos de quebra de linha.

---

## 🧩 Contexto Técnico & Deploy
* **Deploy Host**: `https://gfsleme.github.io/stronglog-pro/`
* **Repositório Git**: `C:\Users\Gabriel\OneDrive\Desktop\Projetos Python\StrongLog`
* **Versão Ativa**: v5.6 • Cache Service Worker: `stronglog-pro-v5.6`
* **Bateria de Testes**: 78/78 Aprovados (Suíte Integrada + RF01 a RF05 + Hotfix v5.6)
