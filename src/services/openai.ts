import OpenAI from 'openai';
import type { AudioSegment, TranslatedSegment } from '@/types';

const TTS_MODEL = 'gpt-4o-mini-tts';

export async function generateSpeech(
    apiKey: string,
    text: string,
    voice: string = 'nova'
): Promise<Blob> {
    try {
        const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true, // Necessário para uso no navegador
        });

        const response = await openai.audio.speech.create({
            model: TTS_MODEL,
            voice: voice as any,
            input: text,
            response_format: 'mp3',
            speed: 1.2,
        });

        // Converter response para blob
        const arrayBuffer = await response.arrayBuffer();
        return new Blob([arrayBuffer], { type: 'audio/mpeg' });
    } catch (error: any) {
        console.error('Erro OpenAI TTS:', error);
        if (error.status === 401) {
            throw new Error('API Key OpenAI inválida. Verifique sua chave nas configurações.');
        }
        throw new Error(`Erro OpenAI: ${error.message || 'Connection error'}`);
    }
}

/**
 * Processa fila de segmentos com geração TTS sequencial
 * Evita quota exceeded processando um por vez
 */
export async function processQueue(
    apiKey: string,
    segments: TranslatedSegment[],
    voice: string,
    onProgress?: (current: number, total: number, segmentId: string) => void,
    onSegmentComplete?: (segment: AudioSegment) => void
): Promise<AudioSegment[]> {
    const audioSegments: AudioSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        onProgress?.(i + 1, segments.length, segment.id);

        try {
            // Gerar TTS
            const audioBlob = await generateSpeech(apiKey, segment.translatedText, voice);

            // Calcular duração real do áudio gerado
            const duration = await getAudioDuration(audioBlob);
            const targetDuration = segment.end - segment.start;

            const audioSegment: AudioSegment = {
                id: segment.id,
                audioBlob,
                startTime: segment.start,
                duration,
                targetDuration,
                needsStretch: Math.abs(duration - targetDuration) > 0.2, // Mais de 200ms de diferença
            };

            audioSegments.push(audioSegment);
            onSegmentComplete?.(audioSegment);

            // Pequeno delay para evitar rate limiting
            if (i < segments.length - 1) {
                await delay(500);
            }
        } catch (error) {
            console.error(`Erro ao gerar áudio para segmento ${segment.id}:`, error);
            throw error;
        }
    }

    return audioSegments;
}

/**
 * Calcula duração de um áudio
 */
function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
        };
        audio.onerror = reject;
        audio.src = URL.createObjectURL(audioBlob);
    });
}

/**
 * Helper para delay
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
