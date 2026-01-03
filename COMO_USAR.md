# Como Usar o DubAI-PRO 🎬

## Passo a Passo Completo

### 1️⃣ Configurar API Keys (Uma Vez Só)

1. **Abra o aplicativo** em `http://localhost:3001`
2. **Cole sua Gemini API Key** no primeiro campo
   - Obtenha em: https://makersuite.google.com/app/apikey
3. **Cole sua OpenAI API Key** no segundo campo
   - Obtenha em: https://platform.openai.com/api-keys
4. **Clique em "Salvar"** ✅
   - As chaves ficam salvas no cache do navegador
   - Você NÃO precisa digitar novamente nas próximas vezes

### 2️⃣ Fazer Upload do Arquivo

- **Arraste** um arquivo MP4 ou MP3
- **Ou clique** para selecionar manualmente
- Suporta: vídeos e áudios em qualquer idioma

### 3️⃣ Escolher a Voz (Opcional)

Selecione uma das 7 vozes disponíveis:
- **Nova** (padrão) - Voz feminina natural
- **Alloy** - Voz neutra versátil
- **Echo** - Voz masculina clara
- **Fable** - Voz narrativa britânica
- **Onyx** - Voz masculina profunda
- **Shimmer** - Voz feminina suave
- **Coral** - Voz feminina calorosa

### 4️⃣ Iniciar o Processo

Clique em **"Iniciar Dublagem"**

#### Etapa 1: Transcrição (~30-60s)
- Extrai o áudio do vídeo
- Gemini transcreve com timestamps
- Detecta o idioma automaticamente

#### Etapa 2: Tradução (~10-30s)
- **TODOS os segmentos são traduzidos DE UMA VEZ** (mais rápido!)
- Tradução isocrônica: adapta o comprimento para sincronizar
- Meta: 16 caracteres por segundo de áudio

### 5️⃣ REVISAR E EDITAR (IMPORTANTE!)

Após a tradução, o processo **PAUSA automaticamente** e mostra:

✅ **Tradução concluída! Revise e clique em "Continuar para Dublagem"**

Agora você pode:
- **Revisar** todas as traduções
- **Editar** qualquer segmento clicando no ícone de edição ✏️
- **Ajustar** o texto para melhorar a sincronização
- Ver a contagem de caracteres (verde = bom, vermelho = muito longo)

### 6️⃣ Continuar para Dublagem

Quando estiver satisfeito com as traduções:

Clique no botão verde pulsante **"Continuar para Dublagem"**

#### Etapa 3: Dublagem (~1-2min)
- Gera áudio TTS com OpenAI para cada segmento
- Processa em fila (500ms de delay entre requisições)
- Usa a voz selecionada

#### Etapa 4: Montagem (~30-60s)
- Remove silêncios do início e fim
- Ajusta velocidade (time-stretch) se necessário
- Monta áudio final com timing perfeito

### 7️⃣ Baixar o Resultado

Clique em **"Baixar Áudio Dublado"** 🎉

O arquivo MP3 contém **APENAS a voz dublada** sincronizada!

---

## ⚠️ Solução de Problemas

### "Connection error" ou "API Key inválida"

**Problema**: Erro ao gerar áudio com OpenAI

**Soluções**:
1. Verifique se sua OpenAI API Key está correta
2. Confirme que tem créditos na conta OpenAI
3. Teste a chave em: https://platform.openai.com/playground
4. Re-cole a chave e clique em "Salvar" novamente

### Tradução muito longa ou curta

**Problema**: Texto não cabe no tempo do segmento

**Solução**:
1. Clique no ícone de edição ✏️
2. Ajuste manualmente o texto
3. Mantenha próximo ao número sugerido de caracteres
4. Clique em "Salvar"

### Áudio final está cortado

**Problema**: FFmpeg pode ter problemas com arquivos muito grandes

**Solução**:
1. Use arquivos menores que 50MB
2. Ou converta o vídeo para MP3 antes de fazer upload

---

## 💡 Dicas para Melhores Resultados

✅ **Use áudio limpo** - Menos ruído de fundo = melhor transcrição
✅ **Fala articulada** - Gemini funciona melhor com fala clara
✅ **Revise as traduções** - Pequenos ajustes fazem grande diferença
✅ **Teste vozes diferentes** - Cada uma tem personalidade única
✅ **Arquivos menores** - Processar até 5 minutos por vez é ideal

---

## 🚀 Recursos Únicos

### ⚡ Tradução em Lote
- **Antes**: 1 requisição por segmento (lento)
- **Agora**: 1 requisição para TODOS os segmentos (rápido!)

### ⏸️ Confirmação Manual
- O processo **PAUSA** após tradução
- Você **REVISA** e **EDITA** antes de dublar
- **CONTINUA** quando quiser

### 🎯 Sincronização Inteligente
- Calcula 16 caracteres por segundo
- IA adapta tradução para caber no tempo
- Time-stretch preserva o tom da voz

### 💾 Cache de API Keys
- Salva automaticamente no navegador
- Nunca pede novamente
- Totalmente offline (localStorage)

---

## 📊 Custos Estimados

### Gemini API
- **Transcrição**: ~$0.002 por minuto
- **Tradução**: ~$0.001 por minuto
- **Total Gemini**: ~$0.003/min

### OpenAI API
- **TTS**: ~$0.015 por 1000 caracteres
- Um vídeo de 5min tem ~4800 chars = ~$0.07

**Total para 5min de vídeo**: ~$0.10 USD

---

## 🎓 Fluxo Completo Resumido

```
1. Configure API Keys (uma vez)
   ↓
2. Upload MP4/MP3
   ↓
3. Selecione voz (opcional)
   ↓
4. Clique "Iniciar Dublagem"
   ↓
5. Aguarde transcrição + tradução
   ↓
6. 🛑 REVISE E EDITE as traduções
   ↓
7. Clique "Continuar para Dublagem"
   ↓
8. Aguarde dublagem + montagem
   ↓
9. Baixe o áudio dublado! 🎉
```

---

## 🔗 Links Úteis

- **Gemini API**: https://makersuite.google.com/app/apikey
- **OpenAI API**: https://platform.openai.com/api-keys
- **Repositório**: [Seu GitHub aqui]
- **Documentação Técnica**: Ver `walkthrough.md`

---

**Desenvolvido com ❤️ usando Next.js, Gemini, OpenAI, e FFmpeg**
