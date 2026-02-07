import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranscriptSegment, TranslatedSegment } from '@/types';

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Transcreve áudio e retorna segmentos com timestamps
 */
export async function transcribeAudio(
    apiKey: string,
    audioBlob: Blob,
    onProgress?: (message: string) => void
): Promise<TranscriptSegment[]> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    onProgress?.('Convertendo áudio para base64...');

    // Converter blob para base64
    const base64Audio = await blobToBase64(audioBlob);
    const audioData = base64Audio.split(',')[1]; // Remove data:audio/mpeg;base64,

    onProgress?.('Enviando para Gemini API...');

    const prompt = `Transcreva este áudio e retorne APENAS um JSON array válido.

ESTRUTURA REQUERIDA:
- id: string 
- start: number (segundos, obrigatório, > 0)
- end: number (segundos, obrigatório, > start)  
- text: string (texto transcrito)

IMPORTANTE:
- "end" DEVE ser maior que "start" (duração mínima 0.5s)
- Não retorne segmentos com duração 0
- Use aspas duplas escapadas (\\") para aspas dentro do texto
- Remova quebras de linha do texto
- Use espaços ao invés de tabs
- Retorne JSON puro sem markdown

EXEMPLO:
[
  {"id": "1", "start": 0.0, "end": 3.5, "text": "texto aqui"},
  {"id": "2", "start": 3.5, "end": 7.2, "text": "mais texto"}
]`;

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: 'audio/mpeg',
                data: audioData,
            },
        },
        { text: prompt },
    ]);

    const response = result.response.text();
    onProgress?.('Processando resposta...');

    // Extrair JSON da resposta (remove markdown se houver)
    let jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error('Resposta Gemini:', response);
        throw new Error('Não foi possível extrair transcrição da resposta');
    }

    let jsonText = jsonMatch[0];

    // Tentar fazer parse com tratamento de erros
    try {
        const segments: TranscriptSegment[] = JSON.parse(jsonText);

        // Validar estrutura
        if (!Array.isArray(segments) || segments.length === 0) {
            throw new Error('Resposta inválida: não é um array ou está vazio');
        }

        // Validar e corrigir segmentos (REMOVE inválidos em vez de falhar tudo)
        const validSegments = segments
            .filter(seg => {
                // Verificar campos obrigatórios
                if (!seg.id || typeof seg.start !== 'number' || typeof seg.end !== 'number' || !seg.text) return false;

                // Verificar consistência temporal
                if (seg.end <= seg.start) return false; // Duração negativa ou zero
                if ((seg.end - seg.start) < 0.1) return false; // Duração muito curta (< 100ms)

                return true;
            })
            .sort((a, b) => a.start - b.start); // Garantir ordem cronológica

        // CORREÇÃO DE SOBREPOSIÇÃO (Post-processing)
        // Se um segmento começar antes do anterior terminar, ajustamos o 'end' do anterior.
        for (let i = 0; i < validSegments.length - 1; i++) {
            const current = validSegments[i];
            const next = validSegments[i + 1];

            if (current.end > next.start) {
                console.warn(`Ajustando sobreposição: Segmento ${current.id} (termina ${current.end}) sobrepõe ${next.id} (começa ${next.start})`);
                current.end = next.start; // Limita o fim do atual ao início do próximo

                // Se isso deixaria o segmento muito curto, talvez devêssemos fundir ou ajustar o próximo?
                // Para V1, apenas clamp é seguro para evitar visual "amontoado".
                if (current.end - current.start < 0.1) {
                    // Caso extremo: segmento ficou minúsculo. 
                    // Vamos apenas aceitar o ajuste ou mover o próximo pra frente?
                    // Mover o próximo pra frente é perigoso (desincroniza audio real).
                    // Melhor encurtar o atual.
                }
            }
        }

        if (validSegments.length === 0) {
            throw new Error('Nenhum segmento válido encontrado após validação');
        }

        return validSegments;
    } catch (parseError: any) {
        console.error('Erro ao fazer parse do JSON:', parseError.message);

        // Tentar limpar o JSON de forma agressiva
        try {
            // 1. Remove caracteres de controle (0x00-0x1F) exceto os permitidos em JSON se escapados, 
            // mas aqui queremos remover os LITERAIS que quebram o parse.
            // Substitui newlines/tabs literais por espaço simples
            const cleanedJson = jsonText
                .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
                    // Preservar, talvez? Não, JSON não permite unescaped control chars.
                    // Vamos substituir por espaço se for whitespace-like, ou vazio.
                    if (char === '\n' || char === '\r' || char === '\t') return ' ';
                    return '';
                });

            const segments: TranscriptSegment[] = JSON.parse(cleanedJson);
            console.log('✅ Parse bem-sucedido após limpeza agressiva');
            return segments;
        } catch (secondError) {
            console.error('❌ Parse falhou mesmo após limpeza');
            console.error('JSON Problemático:', jsonText.substring(0, 200) + '...');
            throw new Error(`JSON inválido do Gemini: ${parseError.message}. O modelo retornou caracteres inválidos.`);
        }
    }
}

/**
 * Detecta o idioma do áudio
 */
export async function detectLanguage(
    apiKey: string,
    sampleText: string
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Detecte o idioma deste texto e retorne APENAS o código do idioma (ex: en, es, fr, pt, etc).
Texto: "${sampleText}"

Retorne apenas o código do idioma, sem nenhuma explicação.`;

    const result = await model.generateContent(prompt);
    const language = result.response.text().trim().toLowerCase();

    return language;
}

/**
 * Traduz TODOS os segmentos de uma vez com análise de contexto e limitação de caracteres
 */
export async function translateIsochronic(
    apiKey: string,
    segments: TranscriptSegment[],
    targetLanguage: string = 'pt-br',
    onProgress?: (message: string) => void
): Promise<TranslatedSegment[]> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    onProgress?.('Analisando contexto e contagem EXATA de caracteres...');

    // PASSO 1: Contar caracteres e permitir margem
    const segmentsData = segments.map(seg => {
        const duration = seg.end - seg.start;
        const exactCharCount = seg.text.length;

        // Detect CJK (Chinese, Japanese, Korean)
        const isAsian = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(seg.text);

        // Configuration:
        // - Asian: Allow 3x-4x expansion because 1 char != 1 char in latin
        // - Others: Strict limit as requested (voltar a restrição) -> 1.0x - 1.1x
        const maxCharCount = isAsian
            ? Math.floor(exactCharCount * 4) + 10
            : Math.floor(exactCharCount * 1.1) + 2;

        return {
            id: seg.id,
            text: seg.text,
            exactCharCount,
            duration: duration.toFixed(2),
            maxCharCount
        };
    });

    // Calcular totais para contexto
    const totalOriginalChars = segmentsData.reduce((sum, seg) => sum + seg.exactCharCount, 0);
    const totalDuration = segments[segments.length - 1].end;

    // PASSO 2: Construir prompt SIMPLES e DIRETO
    const prompt = `Traduza os seguintes segmentos para ${targetLanguage}.

SEGMENTOS:
${JSON.stringify(segmentsData, null, 2)}

REGRAS:
1. Leia TODOS os segmentos para entender o contexto completo
2. Cada tradução DEVE ter NO MÁXIMO o número de caracteres de "maxCharCount" e NO MINIMO o número de caracteres: "maxCharCount" - 5 
3. Mantenha coerência entre segmentos
4. Use linguagem natural em ${targetLanguage}

FORMATO DE RESPOSTA (apenas o JSON):
[
  {"id": "1", "translatedText": "tradução aqui"},
  {"id": "2", "translatedText": "tradução aqui"}
]`;

    onProgress?.('Enviando para Gemini API...');

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    onProgress?.('Processando traduções...');

    // Extrair JSON da resposta
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error('Não foi possível extrair traduções da resposta');
    }

    const translations: Array<{ id: string; translatedText: string }> = JSON.parse(jsonMatch[0]);

    // PASSO 3: Validar e combinar traduções
    const translatedSegments: TranslatedSegment[] = segments.map(segment => {
        const exactCharCount = segment.text.length; // Contagem EXATA do original
        const translation = translations.find(t => t.id === segment.id);

        if (!translation) {
            throw new Error(`Tradução não encontrada para segmento ${segment.id}`);
        }

        // Validar comprimento (aviso se exceder o EXATO)
        const actualCharCount = translation.translatedText.length;

        if (actualCharCount > exactCharCount) {
            console.warn(
                `⚠️ Segmento ${segment.id}: tradução (${actualCharCount} chars) excede original EXATO (${exactCharCount} chars)`
            );
        }

        return {
            ...segment,
            translatedText: translation.translatedText,
            targetCharCount: exactCharCount, // Usa contagem EXATA como alvo
            actualCharCount,
        };
    });

    onProgress?.('Traduções concluídas!');

    return translatedSegments;
}

/**
 * Reescreve o texto para se ajustar melhor à duração alvo
 * Se audioDuration > targetDuration (speed > 1), precisamos encurtar o texto.
 * Se audioDuration < targetDuration (speed < 1), precisamos alongar o texto.
 */
export async function rewriteTextForDuration(
    apiKey: string,
    currentText: string,
    currentDuration: number,
    targetDuration: number,
    currentSpeed: number,
    targetSpeed: number = 1.0
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Se targetSpeed for 1.2, queremos que o texto seja encurtado para caber em (targetDuration / 1.2)
    // Basicamente, forçamos o texto a ser menor para que o audio precise ser acelerado (speed > 1).

    // Comparação correta:
    // Se o currentSpeed > targetSpeed, precisamos encurtar mais.
    // Se o currentSpeed < targetSpeed, precisamos alongar (ou encurtar menos).

    // Vamos simplificar: O objetivo é que o NOVO texto, quando falado na velocidade normal,
    // tenha uma duração aproximada de "targetDuration * targetSpeed" (se speed fosse < 1) ???
    // NÃO.
    // Speed = AudioDuration / TargetDuration.
    // Queremos que o Speed final seja aprox targetSpeed.
    // Logo, AudioDurationFinal ~= TargetDuration * targetSpeed.

    // Ex: TargetDuration = 10s. TargetSpeed = 1.2x.
    // AudioDurationFinal deve ser 12s. (Assim 12 / 10 = 1.2x).

    // Então, ao estimar caracteres:
    // currentChars gera currentDuration.
    // targetChars deve gerar (TargetDuration * targetSpeed).

    // Proporção: targetChars = (TargetDuration * targetSpeed) * (currentChars / currentDuration)

    // Ajuste grosseiro
    const charsPerSecond = currentDuration > 0 ? (currentText.length / currentDuration) : 15;
    const idealDuration = targetDuration * targetSpeed;
    const targetChars = Math.round(idealDuration * charsPerSecond);

    const action = targetChars < currentText.length ? 'ENCURTAR' : 'ALONGAR';

    const prompt = `Reescreva o seguinte texto para dublagem.
    
    Texto Original: "${currentText}"
    
    Duração Atual do Áudio: ${currentDuration.toFixed(2)}s
    Duração Alvo do Slot: ${targetDuration.toFixed(2)}s
    Velocidade Atual: ${currentSpeed.toFixed(2)}x
    
    OBJETIVO: O texto deve ser reescrito para que, ao ser falado, gere um áudio de aproximadamente ${idealDuration.toFixed(2)}s.
    Isso resultará em uma velocidade de aceleração de ~${targetSpeed.toFixed(2)}x quando ajustado para o slot de ${targetDuration.toFixed(2)}s.
    
    AÇÃO: ${action} o texto.
    Meta aproximada de caracteres: ${targetChars} (Original: ${currentText.length})
    
    REGRAS:
    1. Mantenha o MESMO significado e contexto.
    2. Seja natural para fala.
    3. ${action === 'ENCURTAR' ? 'Seja mais conciso, corte palavras menos importantes.' : 'Seja mais descritivo, use sinônimos ou conectivos para preencher o tempo.'}
    4. Retorne APENAS o novo texto, sem aspas, sem explicações.`;

    try {
        const result = await model.generateContent(prompt);
        const newText = result.response.text().trim();
        // Remove aspas se o modelo colocou
        return newText.replace(/^["']|["']$/g, '');
    } catch (error) {
        console.error('Erro no rewriteTextForDuration:', error);
        return currentText; // Fallback para original
    }
}

/**
 * Envia um prompt de chat para o Gemini (para o Assistente de Tradução)
 */
export async function chatWithAi(apiKey: string, prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

/**
 * Converte Blob para base64
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

