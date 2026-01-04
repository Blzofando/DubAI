import OpenAI from 'openai';
import type { TranscriptSegment } from '@/types';

/**
 * Transcreve áudio usando OpenAI Whisper API com timestamps precisos
 * Muito mais preciso que Gemini para timestamps de segmentos
 */
export async function transcribeWithWhisper(
    apiKey: string,
    audioBlob: Blob,
    onProgress?: (message: string) => void
): Promise<TranscriptSegment[]> {
    try {
        onProgress?.('Conectando com Whisper API...');

        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
        });

        // Converter Blob para File (Whisper API requer File)
        const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

        onProgress?.('Processando transcrição (isso pode levar alguns segundos)...');

        // Usar Whisper com timestamps de segmento
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json', // Necessário para timestamps
            timestamp_granularities: ['segment'], // Timestamps por segmento
        });

        onProgress?.('Processando segmentos...');

        // Verificar se temos segmentos
        if (!transcription.segments || transcription.segments.length === 0) {
            throw new Error('Whisper não retornou segmentos. Tente um áudio diferente.');
        }

        // Converter formato Whisper para nosso formato
        const segments: TranscriptSegment[] = transcription.segments.map((seg, index) => ({
            id: `seg-${index + 1}`,
            start: seg.start,
            end: seg.end,
            text: seg.text.trim(),
        }));

        // Validar segmentos
        const validSegments = segments.filter(seg => {
            // Garantir tempos válidos
            if (seg.end <= seg.start) return false;
            if (seg.end - seg.start < 0.1) return false; // Mínimo 100ms
            if (!seg.text || seg.text.length === 0) return false;
            return true;
        });

        if (validSegments.length === 0) {
            throw new Error('Nenhum segmento válido encontrado na transcrição.');
        }

        // MERGE: Combinar fragmentos em frases completas
        const mergedSegments = mergeIntoSentences(validSegments);

        onProgress?.(`✅ ${mergedSegments.length} frases transcritas com precisão!`);

        return mergedSegments;

    } catch (error: any) {
        console.error('Erro Whisper API:', error);

        if (error.status === 401) {
            throw new Error('API Key OpenAI inválida. Verifique sua chave nas configurações.');
        }

        if (error.code === 'invalid_file_format') {
            throw new Error('Formato de áudio não suportado. Use MP3, WAV ou M4A.');
        }

        throw new Error(`Erro Whisper: ${error.message || 'Erro desconhecido'}`);
    }
}

/**
 * Detecta idioma do áudio usando Whisper
 */
export async function detectLanguageWithWhisper(
    apiKey: string,
    audioBlob: Blob
): Promise<string> {
    try {
        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
        });

        const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json',
        });

        // Whisper retorna código ISO do idioma detectado
        return transcription.language || 'en';

    } catch (error: any) {
        console.error('Erro ao detectar idioma:', error);
        return 'en'; // Fallback
    }
}

/**
 * Mescla segmentos pequenos em frases completas baseado em pontuação
 * Isso evita pausas estranhas no meio de frases
 */
function mergeIntoSentences(segments: TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) return [];

    const merged: TranscriptSegment[] = [];
    let currentSentence: TranscriptSegment | null = null;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (!currentSentence) {
            // Inicia uma nova frase
            currentSentence = { ...seg };
        } else {
            // Adiciona à frase atual
            currentSentence.text += ' ' + seg.text;
            currentSentence.end = seg.end;
        }

        // Verifica se a frase termina com pontuação final
        const endsWithPunctuation = /[.!?;:]$/.test(currentSentence.text.trim());
        const isLastSegment = i === segments.length - 1;

        // Ou se a próxima frase começar com maiúscula (indica nova frase)
        const nextStartsCapital = i < segments.length - 1 &&
            /^[A-ZÀ-Ú]/.test(segments[i + 1].text.trim());

        // Finaliza a frase se:
        // 1. Termina com pontuação
        // 2. É o último segmento
        // 3. Próximo começa com maiúscula E duração atual > 3s (evita quebras muito pequenas)
        const shouldFinalize = endsWithPunctuation ||
            isLastSegment ||
            (nextStartsCapital && (currentSentence.end - currentSentence.start) > 3);

        if (shouldFinalize) {
            merged.push({
                ...currentSentence,
                id: `seg-${merged.length + 1}`,
            });
            currentSentence = null;
        }
    }

    // Se sobrou alguma frase incompleta, adiciona
    if (currentSentence) {
        merged.push({
            ...currentSentence,
            id: `seg-${merged.length + 1}`,
        });
    }

    return merged;
}
