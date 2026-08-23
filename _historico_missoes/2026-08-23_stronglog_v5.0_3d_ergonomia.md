# 📋 Task Plan — StrongLog 3D Pro: Ergonomia In-Workout, Ontologia e Anatomia 3D (v5.0)

## 🎯 Visão da Missão
Transformar o **StrongLog Pro** em uma plataforma de treino inovadora, combinando:
1. **Ergonomia In-Workout de 1 Mão**: Smart Steppers táteis, banimento do teclado virtual do SO no treino ativo, Wake Lock API (tela sempre acesa) e registro preditivo em 1 toque.
2. **Ontologia Muscular & Heatmap de Fadiga**: Mapeamento dos 1.324 exercícios para 32 nós canônicos bilaterais (primários e sinergistas), cálculo de volume efetivo e curva de recuperação temporal ($e^{-\lambda t}$).
3. **Mapa Anatômico 2D/3D Interativo**: Mapa SVG vetorial ultrarrápido para seleção de grupos e filtros in-workout + Visualizador 3D WebGL Sci-Fi (Three.js) com iluminação por calor no pós-treino e na biblioteca.
4. **Device Tiering & Blindagem**: Otimização para 60 FPS em qualquer smartphone, controle de perda de contexto WebGL e modo de economia de bateria.

---

## 🏗️ Fases de Execução

### Fase 1: Ergonomia In-Workout & Smart Steppers (Atlas)
- [x] Implementar Smart Steppers táteis (`±2.5kg`, `±5kg`, `±1 rep`, `±5 reps`) e pad numérico inline.
- [x] Implementar Wake Lock API (`navigator.wakeLock`) com ativação automática no treino.
- [x] Implementar Auto-Fill preditivo com botão primário gigante de 1-toque e feedback háptico.
- [x] Validação ergonômica em viewport mobile (40% inferiores).

### Fase 2: Ontologia Muscular & Motor de Heatmap (Vortex)
- [x] Criar script `scripts/generate_muscle_ontology.py` para mapear 1.324 exercícios para 32 nós anatômicos.
- [x] Gerar base de ontologia estruturada e integrar no app.
- [x] Implementar cálculo matemático de volume efetivo ($V_{\text{eff}}$), percentual de fadiga e decaimento temporal.

### Fase 3: Mapa Anatômico 2D Interativo & Visualizador 3D com Heatmap (Atlas + Vortex)
- [x] Desenvolver Mapa Anatômico Vetorial SVG (Frontal + Dorsal) com nós musculares interativos para filtros rápidos.
- [x] Desenvolver Visualizador 3D WebGL (Three.js Low-Poly Sci-Fi) com nós musculares coloridos dinamicamente por shader.
- [x] Desenvolver tela/modal de Resumo Pós-Treino com o Holograma 3D iluminado pelos músculos trabalhados.

### Fase 4: Device Tiering, QA E2E & Sincronização (Sentinel + Argos)
- [x] Implementar seletor de Hardware Tiering e modo de economia de bateria nos Ajustes.
- [x] Testes E2E automatizados via Chrome DevTools MCP.
- [x] Sincronização Obsidian Vault (`60-daily`, `10-projects`), notas do Canvas e documentação.
- [x] Commit convencional e deploy no GitHub Pages.
