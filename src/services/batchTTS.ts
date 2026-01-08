import { generateSpeech } from './tts';
import type { TranslatedSegment, AudioSegment } from '@/types';

interface BatchOptions {
    batchSize?: number;           // Default: 10
    delayBetweenBatches?: number; // Default: 500ms
}

/**
 * Utility function to split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get audio duration from blob
 */
function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = reject;
        audio.src = URL.createObjectURL(audioBlob);
    });
}

/**
 * Generate speech for multiple segments in parallel batches
 * 
 * @param segments - Array of translated segments
 * @param voice - Voice ID for TTS
 * @param options - Batch processing options
 * @param onProgress - Optional progress callback (current, total)
 * @returns Array of audio segments with generated speech
 */
export async function generateSpeechBatch(
    segments: TranslatedSegment[],
    voice: string,
    options: BatchOptions = {},
    onProgress?: (current: number, total: number, message: string) => void
): Promise<AudioSegment[]> {
    const {
        batchSize = 10,
        delayBetweenBatches = 500
    } = options;

    const batches = chunkArray(segments, batchSize);
    const results: AudioSegment[] = [];

    onProgress?.(0, segments.length, `Iniciando processamento de ${segments.length} segmentos...`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        const totalBatches = batches.length;

        onProgress?.(
            results.length,
            segments.length,
            `Processando batch ${batchNumber}/${totalBatches} (${batch.length} segmentos paralelos)...`
        );

        try {
            // Process all segments in this batch in parallel
            const batchPromises = batch.map(async (seg) => {
                try {
                    // Generate TTS audio
                    const audioBlob = await generateSpeech(seg.translatedText, voice);

                    // Get actual duration
                    const actualDuration = await getAudioDuration(audioBlob);

                    const targetDuration = seg.end - seg.start;
                    const needsAdjustment = Math.abs(actualDuration - targetDuration) > 0.2;

                    return {
                        id: seg.id,
                        audioBlob,
                        duration: actualDuration,
                        targetDuration,
                        startTime: seg.start,
                        needsStretch: needsAdjustment
                    };
                } catch (error: any) {
                    console.error(`Error generating TTS for segment ${seg.id}:`, error);
                    // Return null for failed segments so we can filter them out
                    return null;
                }
            });

            // Wait for all segments in this batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Filter out failed segments and add successful ones
            const successfulResults = batchResults.filter((r): r is AudioSegment => r !== null);
            results.push(...successfulResults);

            // Log failed segments
            const failedCount = batchResults.length - successfulResults.length;
            if (failedCount > 0) {
                console.warn(`${failedCount} segment(s) failed in batch ${batchNumber}`);
            }

            // Update progress after batch
            onProgress?.(
                results.length,
                segments.length,
                `Batch ${batchNumber}/${totalBatches} concluído (${successfulResults.length}/${batch.length} sucessos)`
            );

            // Delay between batches (except after last batch)
            if (batchIndex < batches.length - 1) {
                await delay(delayBetweenBatches);
            }
        } catch (error: any) {
            console.error(`Error processing batch ${batchNumber}:`, error);

            // If an entire batch fails, we continue with the next one
            onProgress?.(
                results.length,
                segments.length,
                `⚠️ Batch ${batchNumber} falhou, continuando...`
            );
        }
    }

    onProgress?.(results.length, segments.length, `✅ Processamento completo! ${results.length}/${segments.length} segmentos gerados`);

    return results;
}

/**
 * Estimate processing time for batch TTS
 */
export function estimateBatchProcessingTime(
    segmentCount: number,
    batchSize: number = 10,
    avgTTSTime: number = 2000, // ms
    delayBetweenBatches: number = 500 // ms
): number {
    const batchCount = Math.ceil(segmentCount / batchSize);
    const processingTime = batchCount * avgTTSTime;
    const delayTime = (batchCount - 1) * delayBetweenBatches;
    return processingTime + delayTime;
}
