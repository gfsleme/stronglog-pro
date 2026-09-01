# 🧠 MISSION CONTROL — StrongLog Pro (AGENTS.md v4.2)
> Diretrizes operacionais para todos os agentes de IA (Antigravity, Claude Code, Codex, Maestri Canvas) atuando no **StrongLog Pro**.
> Última atualização: 2026-08-30

---

## 📌 1. Visão Geral & Stack Técnica

- **Projeto**: StrongLog Pro — PWA de Musculação & Biomecânica Científica Offline-First.
- **Repositório**: `c:\Users\Gabriel\OneDrive\Desktop\Projetos Python\StrongLog`
- **Stack**:
  - **Framework & Build**: Astro (^7.2) com suporte a SSR/SSG, ilhas de componentes e comandos `npm run dev` / `npm run build`.
  - **Estrutura & UI**: Astro Components (`src/pages/`, `src/layouts/`), HTML5 Semântico, CSS Vanilla (`src/styles.css`), Tailwind CSS.
  - **Lógica & Estado**: JavaScript Vanilla modular (`src/app.js`), IndexedDB via `Dexie.js`.
  - **Gráficos & Visualização**: Three.js (r128) + `OrbitControls.js` + `GLTFLoader.js`, Chart.js.
  - **PWA & Cache**: Service Worker (`src/sw.js`), Manifest (`src/manifest.json`), 100% funcional offline.
  - **Test Runner**: Node.js test runner via `npm test` (`scripts/verify_9_items.js` + `scripts/run_e2e_qa_suite.js`).
- **Idioma Padrão**: Responder sempre em **Português (BR)** (código e logs técnicos em inglês/técnico).

---

## 🛠️ 2. Localização das Skills do Sistema

Se você precisa de diretrizes aprofundadas sobre design, testes ou debugging, as skills do ecossistema estão disponíveis em:
- **Skills Globais**: `C:\Users\Gabriel\.gemini\config\skills/`
- **Skills Chave para o StrongLog**:
  - `hallmark` (`C:\Users\Gabriel\.gemini\config\skills\hallmark\SKILL.md`): Design anti-AI-slop, UI tátil moderna, paletas ricas em contraste dark mode e micro-animações.
  - `test-driven-development` (`C:\Users\Gabriel\.gemini\config\plugins\superpowers\skills\test-driven-development\SKILL.md`): The Iron Law — escrever o teste antes da implementação.
  - `systematic-debugging` (`C:\Users\Gabriel\.gemini\config\plugins\superpowers\skills\systematic-debugging\SKILL.md`): Depuração por hipóteses falseáveis.
  - `memory-protocol` (`C:\Users\Gabriel\.gemini\config\skills\memory-protocol\SKILL.md`): Sincronização em 3 Camadas (Canvas + Obsidian em `C:\Users\Gabriel\vault\` + NotebookLM Pro).

---

## 🚨 3. REGRA CRÍTICA DE ENGENHARIA: EVOLUÇÃO DE TESTES (Anti-Lockout)

> [!CAUTION]
> **OS TESTES EXISTEM PARA PROTEGER REQUISITOS, NÃO PARA BLOQUEAR A EVOLUÇÃO DO PRODUTO.**

Nas versões anteriores do StrongLog, a equipe de agentes caiu em um loop infinito de refatoração porque testes unitários legados (como `scripts/test_rf01_3d_harmonization.js` e `scripts/test_rf02_svg_map_redesign.js`) continham asserções que amarravam o código a primitivas antigas (ex: `assert(!hasExternal3DFile)` proibindo arquivos 3D ou asserções forçando cilindros procedurais).

### Protocolo Obrigatório de Evolução de Testes:
1. **Nunca Reverter o Produto para Agradar Teste Legado**: Se o Gabriel ou o Maestro solicitar uma nova capacidade técnica (ex: carregar modelo GLB ultraleve no Three.js ou usar caminhos vetoriais orgânicos SVG), **o Forge e o Sentinel DEVEM atualizar as asserções do teste primeiro**.
2. **Atualização Red-Green de Teste**:
   - Passo 1: Ajuste o teste em `scripts/` para esperar a *nova* arquitetura (ex: esperar GLTFLoader e suporte a GLB local com fallback defensivo).
   - Passo 2: Execute o teste e confirme a falha (*Red*).
   - Passo 3: Implemente o código da funcionalidade no `src/app.js` ou `src/index.html` (*Green*).
   - Passo 4: Sentinel audita o teste e o código.
3. **Proibido "Mudar Apenas Cores para Passar em Testes"**: Se uma tarefa pedir mudança de modelo anatômico, alterar apenas cores de glow `#00FF9D` ou CSS para manter testes legados verdes será considerado **falha grave de entrega**.

---

## 👥 4. Papéis da Equipe no Canvas do Maestri

1. **🔨 Forge (Codificador / Implementer)**:
   - Implementa código aplicando TDD estrito.
   - Tem autonomia e dever de atualizar os arquivos de teste em `scripts/` quando a arquitetura evoluir.
2. **🛡️ Sentinel (Code Reviewer)**:
   - Audita diffs de código e testes.
   - Deve assegurar que o Forge atualizou os testes de forma robusta e não apenas contornou validações.
3. **👁️ Specter (Visual QA / DevPortal)**:
   - Inspeciona visualmente no navegador ou DevPortal.
   - Exige evidência visual de que o modelo realmente mudou e não é o mesmo de antes.
4. **🧭 Compass (Scope Guardian)**:
   - Compara a entrega final com o bloco `[StrongLog]-Requisitos` do Gabriel.
5. **📜 Chronicler (Memory Archivist)**:
   - Atualiza `NOTES_NEXT_SESSION.md`, `progress.md` e o Obsidian Vault (`10-projects/stronglog/` e `60-daily/`).

---

## 🧪 5. Comandos Canônicos de Teste e Verificação

Ao executar tarefas, utilize os seguintes comandos no terminal:

```bash
# 1. Testes de Validação 3D (Three.js, GLB, Câmera e Pooling)
node scripts/test_rf01_3d_harmonization.js

# 2. Testes de Validação 2D (Mapa SVG, nós musculares e haptics)
node scripts/test_rf02_svg_map_redesign.js

# 3. Auditoria dos 9 itens críticos de acessibilidade (WCAG 2.2 e estabilidade)
node scripts/verify_9_items.js

# 4. Suíte E2E Completa
node scripts/run_e2e_qa_suite.js
```

---

## 🧬 6. Ontologia Muscular Oficial (19 Grupos)

Todo modelo (2D ou 3D) deve mapear estritamente estes 19 identificadores:
- **Tronco Superior**: `chest` (Peitoral), `lats` (Dorsais), `upper_back` (Costas Superior/Romboides), `traps` (Trapézio), `lower_back` (Lombar).
- **Ombros**: `shoulders_front` (Deltoide Anterior), `shoulders_side` (Deltoide Lateral), `shoulders_rear` (Deltoide Posterior).
- **Braços**: `biceps` (Bíceps), `triceps` (Tríceps), `forearms` (Antebraços).
- **Core / Centro**: `abs` (Abdômen/Oblíquos), `cardio` (Cardiovascular/Centro).
- **Membros Inferiores**: `glutes` (Glúteos), `quads` (Quadríceps), `hamstrings` (Posterior de Coxa), `calves` (Panturrilhas), `adductors` (Adutores), `abductors` (Abdutores).

---

## 🚀 7. Regras do Projeto Astro

- **Consulte o Astro Docs MCP**: Sempre consulte o MCP `astro-docs` antes de utilizar ou modificar APIs do Astro.
- **Zero Frameworks Desnecessários**: Não adicione React ou outra biblioteca de UI sem justificar previamente.
- **Componentes Astro Estáticos**: Prefira componentes Astro (`.astro`) para conteúdo e casca estrutural estática.
- **Hidratação Sob Demanda**: Use hidratação client-side apenas quando houver interatividade real de negócio.
- **Layout Centralizado**: Reutilize o layout principal (`src/layouts/Layout.astro`) em todas as páginas.
- **Sem Duplicação de SEO**: Não duplique metadados SEO, tags de `<head>` ou manifesto PWA.
- **Verificação Contínua**: Execute `npm run check` e `npm run build` após quaisquer alterações relevantes de componentes ou rotas.
- **Governança de Dependências**: Não altere nem instale dependências sem explicar claramente o motivo técnico.

