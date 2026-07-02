# StrongLog Pro

PWA premium de rastreamento de treinos de musculação com base científica completa de exercícios, service worker offline, banco de dados local indexado e visual moderno de alto apelo estético.

## 🚀 Arquitetura e Stack
*   **Aparência & Design:** Interface escura moderna com paleta Neon Mint (`#00FF9D`), Glassmorphism refinado, bordas suaves, efeitos de brilho/glow e micro-animações aceleradas por GPU.
*   **Lógica de Dados:** Banco de dados IndexedDB via **Dexie.js** para buscas instantâneas e sem congelamento (lag) de tela.
*   **Base Científica:** Integração do **exercises-dataset** (~1.320+ exercícios catalogados por equipamento, músculo-alvo principal, sinergistas e instruções passo a passo em português).
*   **Conteúdo de Mídia:** Carregamento sob demanda (lazy-loading) de GIFs animados de execução correta diretamente do CDN oficial (`static.exercisedb.dev`).
*   **Ciclo Offline:** PWA completo com Service Worker pré-cacheando recursos e a base de dados de exercícios em formato minificado para funcionamento 100% offline.

---

## 📂 Estrutura do Projeto
```
StrongLog/
├── scripts/
│   └── optimize_dataset.py  # Script de minificação, filtragem e tradução do dataset científico
├── src/
│   ├── data/
│   │   └── exercises.min.json  # Base de exercícios otimizada (~1.84MB)
│   ├── app.js               # Lógica principal, gráficos (Chart.js) e Dexie DB (v3)
│   ├── index.html           # Estrutura visual e modais de biblioteca e detalhes
│   ├── styles.css           # Estilos estéticos de glassmorphism e tags
│   ├── sw.js                # Service Worker com cacheamento estático
│   └── manifest.json        # Manifest de instalação do PWA
├── progress.md              # Histórico de progresso local
└── README.md                # Visão geral e documentação técnica
```

---

## 🛠️ Como Executar Localmente
Para rodar e testar o app em ambiente de desenvolvimento local:

1.  Navegue até a pasta `src/`:
    ```bash
    cd src
    ```
2.  Inicie um servidor HTTP estático (por exemplo, via Python):
    ```bash
    python -m http.server 8080
    ```
3.  Abra seu navegador no endereço:
    `http://localhost:8080`

---

## ⚡ Otimização do Dataset Científico
Caso precise atualizar o dataset de exercícios a partir do repositório original `exercises-dataset`:
1.  Clone o repositório original do dataset.
2.  Ajuste o caminho `INPUT_FILE` no script [optimize_dataset.py](file:///c:/Users/Gabriel/OneDrive/Desktop/Projetos%20Python/StrongLog/scripts/optimize_dataset.py).
3.  Execute o script para regenerar os dados traduzidos e compactados para o PWA:
    ```bash
    python scripts/optimize_dataset.py
    ```
