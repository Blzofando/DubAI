import OpenAI from 'openai';
import type { TranscriptSegment } from '@/types';

export async function transcribeWithWhisper(
    apiKey: string,
    audioBlob: Blob,
    onProgress?: (message: string) => void
): Promise<TranscriptSegment[]> {
    if (!apiKey) throw new Error('API Key da OpenAI não fornecida');

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Client-side usage
    });

    onProgress?.('Enviando áudio para Whisper API...');

    // Convert Blob to File (Whisper API requires File object with name)
    const file = new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' });

    try {
        const response = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'] // Request segment timestamps
        });

        onProgress?.('Processando resposta do Whisper...');

        let segments: TranscriptSegment[] = [];

        // Map response to our internal format
        if (response.segments) {
            segments = response.segments.map((seg: any, index: number) => ({
                id: `raw_${index}`,
                start: seg.start,
                end: seg.end,
                text: seg.text.trim(),
                speaker: 'Speaker'
            }));
        } else {
            segments = [{
                id: 'raw_0',
                start: 0,
                end: response.duration || 0,
                text: response.text,
                speaker: 'Speaker'
            }];
        }

        // Post-processing: Combine segments into full sentences
        return combineSegmentsIntoSentences(segments);

    } catch (error: any) {
        console.error('Whisper API Error:', error);
        throw new Error(`Erro na transcrição Whisper: ${error.message}`);
    }
}

/**
 * Combines small segments into full sentences based on punctuation.
 */
function combineSegmentsIntoSentences(segments: TranscriptSegment[]): TranscriptSegment[] {
    const combined: TranscriptSegment[] = [];
    let currentGroup: TranscriptSegment[] = [];

    segments.forEach((seg, index) => {
        currentGroup.push(seg);

        const text = seg.text.trim();
        const hasEndPunctuation = /[.!?]$/.test(text);

        // Check if next segment is far way (pause > 1s) - force break to keep sync
        const nextSeg = segments[index + 1];
        const isBigPause = nextSeg && (nextSeg.start - seg.end > 1.5);

        // Merge if we have punctuation OR a big pause OR it's the last segment
        if (hasEndPunctuation || isBigPause || index === segments.length - 1) {

            // Create merged segment
            const mergedText = currentGroup.map(s => s.text.trim()).join(' ');
            const start = currentGroup[0].start;
            const end = currentGroup[currentGroup.length - 1].end;

            combined.push({
                id: `seg_${combined.length}`,
                start,
                end,
                text: mergedText,
                speaker: currentGroup[0].speaker // Keep first speaker
            });

            currentGroup = [];
        }
    });

    return combined;
}
