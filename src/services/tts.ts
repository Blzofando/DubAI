import type { TranslatedSegment, AudioSegment } from '@/types';
import { generateSpeechClient, getAudioDuration } from './ttsClient';

/**
 * Generate speech using client-side WebSocket (bypasses Vercel IP blocking)
 */
export async function generateSpeech(
    text: string,
    voice: string = 'pt-BR-AntonioNeural'
): Promise<Blob> {
    return generateSpeechClient(text, voice);
}

/**
 * Processa fila de segmentos com geração TTS sequencial
 */
export async function processQueue(
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
            // Gerar TTS via client-side WebSocket
            const audioBlob = await generateSpeech(segment.translatedText, voice);

            // Calcular duração real do áudio gerado
            const duration = await getAudioDuration(audioBlob);
            const targetDuration = segment.end - segment.start;

            const audioSegment: AudioSegment = {
                id: segment.id,
                audioBlob,
                startTime: segment.start,
                duration,
                targetDuration,
                needsStretch: Math.abs(duration - targetDuration) > 0.2,
            };

            audioSegments.push(audioSegment);
            onSegmentComplete?.(audioSegment);

            // Pequeno delay para evitar sobrecarga
            if (i < segments.length - 1) {
                await delay(300);
            }
        } catch (error) {
            console.error(`Erro ao gerar áudio para segmento ${segment.id}:`, error);
            throw error;
        }
    }

    return audioSegments;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
