# DubAI-PRO

Aplicação profissional de dublagem automática de vídeos/áudios usando IA.

## Tecnologias

- **Next.js 15** com TypeScript
- **Tailwind CSS** para estilização
- **FFmpeg.wasm** para processamento de áudio
- **Google Gemini API** (gemini-2.0-flash-exp) para transcrição e tradução
- **OpenAI API** (gpt-4o-mini-tts) para síntese de voz
- **Lucide React** para ícones
ffmpeg -i 11.mp3 -filter:a "atempo=0.9" output.mp3

## Funcionalidades

### ✅ 4 Etapas do Pipeline

1. **Transcrição** - Extrai áudio e transcreve com Gemini (detecção automática de idioma)
2. **Tradução Isocrônica** - Traduz para PT-BR com sincronização labial (16 chars/segundo)
3. **Dublagem** - Gera áudio TTS com OpenAI (fila sequencial para evitar quota)
4. **Montagem** - Remove silêncios, ajusta velocidade (time-stretch) e monta áudio final

### 🎯 Características Principais

- **Gerenciamento de API Keys via UI** - Sem variáveis de ambiente, salvas no localStorage
- **Suporte MP4 e MP3** - Upload drag-and-drop com validação
- **Editor de Tradução** - Segmentos editáveis com contagem de caracteres
- **Seleção de Voz** - 7 vozes OpenAI disponíveis (alloy, echo, fable, onyx, nova, shimmer, coral)
- **Áudio Final Limpo** - Contém APENAS a voz dublada sincronizada
- **Time-Stretch Inteligente** - Ajusta velocidade sem alterar pitch usando filtro atempo

## Instalação

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

Acesse em: `http://localhost:3000`

## Como Usar

1. **Configure as API Keys** - Insira suas chaves Gemini e OpenAI no painel superior
2. **Faça Upload** - Arraste um arquivo MP4 ou MP3
3. **Selecione a Voz** - Escolha entre 7 vozes disponíveis
4. **Inicie o Processo** - Clique em "Iniciar Dublagem"
5. **Edite Traduções** - (Opcional) Ajuste os textos traduzidos
6. **Baixe o Resultado** - Download do áudio dublado em MP3

## Estrutura do Projeto

```
DubAI-PRO/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout raiz com contexto
│   │   ├── page.tsx            # Página principal com pipeline
│   │   └── globals.css         # Estilos globais
│   ├── components/
│   │   ├── ApiKeyInput.tsx     # Input de API keys com cache
│   │   ├── FileUpload.tsx      # Upload drag-and-drop
│   │   ├── ProgressIndicator.tsx
│   │   ├── VoiceSelector.tsx   # Seleção de voz
│   │   ├── TranslationEditor.tsx
│   │   └── DownloadButton.tsx
│   ├── contexts/
│   │   └── AppContext.tsx      # Estado global + localStorage
│   ├── services/
│   │   ├── ffmpeg.ts           # FFmpeg.wasm wrapper
│   │   ├── gemini.ts           # Gemini API integração
│   │   └── openai.ts           # OpenAI TTS integração
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

## Notas Técnicas

### FFmpeg Filters Utilizados

- `silenceremove` - Remove silêncio do início e fim (preserva pausas internas)
- `atempo` - Ajusta velocidade sem alterar pitch (0.5x - 2.0x)
- `adelay` - Posiciona segmentos de áudio no tempo correto
- `amix` - Mescla múltiplos streams de áudio

### Persistência de Dados

As API keys são salvas em `localStorage` com as seguintes chaves:
- `dubai_gemini_key`
- `dubai_openai_key`
- `dubai_selected_voice`

### CORS Headers

Next.js configurado com headers CORS para suporte ao SharedArrayBuffer (requerido pelo FFmpeg.wasm):
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Licença

MIT
