# 📱 Guia de Instalação e Atualização do StrongLog Pro

O **StrongLog Pro** é um Progressive Web App (PWA) de alta performance, projetado para funcionar 100% offline diretamente no navegador do seu celular com a mesma experiência de um aplicativo nativo da App Store ou Google Play Store.

---

## 🔗 URL do Aplicativo Publicado
Acesse o aplicativo pelo seu celular no link seguro abaixo:

👉 **[https://gfsleme.github.io/stronglog-pro/](https://gfsleme.github.io/stronglog-pro/)**

---

## 📥 Como Instalar no Celular

### No iOS (iPhone - Safari)
1.  Abra o navegador **Safari** e acesse a URL: **[https://gfsleme.github.io/stronglog-pro/](https://gfsleme.github.io/stronglog-pro/)**.
2.  Toque no ícone de **Compartilhar** (o quadrado com uma seta apontando para cima na barra de navegação inferior).
3.  Role a folha de opções para baixo e toque em **"Adicionar à Tela de Início"** (Add to Home Screen).
4.  Confirme o nome do aplicativo e toque em **Adicionar** no canto superior direito.
5.  O ícone do StrongLog aparecerá na sua tela de início. Abra por ele para ocultar as barras de navegação do browser e ter a experiência de aplicativo nativo.

### No Android (Google Chrome)
1.  Abra o navegador **Google Chrome** e acesse a URL: **[https://gfsleme.github.io/stronglog-pro/](https://gfsleme.github.io/stronglog-pro/)**.
2.  Geralmente, o Chrome exibirá um banner automático no rodapé da página sugerindo *"Adicionar StrongLog à tela inicial"*. Toque nele.
3.  Caso o banner não apareça, toque no **menu de três pontos** no canto superior direito da tela do Chrome.
4.  Selecione a opção **"Instalar aplicativo"** (ou *"Adicionar à tela inicial"*).
5.  Confirme a instalação. O aplicativo estará disponível na gaveta de aplicativos e na sua tela de início.

---

## 🔄 Como Receber Atualizações Automaticamente
O app possui um Service Worker autogerenciável que monitora atualizações do servidor. Toda vez que uma nova rotina, recurso ou melhoria na base de exercícios for implantada:

1.  **Detecção Automática:** Sempre que você abrir o app conectado à internet, o navegador fará uma verificação silenciosa por atualizações.
2.  **Aviso de Nova Versão:** Ao detectar uma nova versão no servidor, o app exibirá uma notificação visual (Toast) no topo da tela do seu celular: 
    *`NOVA VERSÃO DISPONÍVEL [ATUALIZAR]`*
3.  **Atualização Rápida:** Toque no botão **"Atualizar"**. A tela recarregará instantaneamente ativando a nova versão e sincronizando as bases do IndexedDB local com as novas configurações, sem perigo de perda dos seus treinos anteriores ou histórico.
