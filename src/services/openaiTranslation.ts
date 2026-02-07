import OpenAI from 'openai';
import type { TranscriptSegment, TranslatedSegment } from '@/types';

/**
 * Traduz segmentos usando OpenAI (GPT-4o-mini ou GPT-4o)
 */
export async function translateWithOpenAI(
    apiKey: string,
    segments: TranscriptSegment[],
    targetLanguage: string = 'pt-br',
    onProgress?: (message: string) => void
): Promise<TranslatedSegment[]> {
    const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
    });

    onProgress?.('Preparando segmentos para OpenAI...');

    // Preparar dados simplificados para o prompt
    const segmentsData = segments.map(seg => {
        // Detect CJK (Chinese, Japanese, Korean)
        const isAsian = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(seg.text);

        // Configuration:
        // - Asian: One char can be a whole word/sentence -> Allow 3x expansion
        // - Others: Strict limit as requested by user -> 1.0x + small buffer for punctuation
        const maxLength = isAsian
            ? Math.floor(seg.text.length * 4) + 10
            : Math.floor(seg.text.length * 1.1) + 2;

        return {
            id: seg.id,
            text: seg.text,
            maxLength
        };
    });

    const prompt = `Translate the following subtitles to "${targetLanguage}".
    
RULES:
1. Maintain the exact same JSON structure.
2. The "translatedText" should try to fit within "maxLength" chars, BUT priority is meaning and natural flow.
3. It's OK to exceed maxLength slightly if necessary for grammar.
4. Output ONLY a valid JSON array.

INPUT:
${JSON.stringify(segmentsData, null, 2)}

OUTPUT FORMAT:
{
  "translations": [
    {
        "id": "...",
        "translatedText": "..."
    }
  ]
}`;

    onProgress?.('Enviando para OpenAI...');

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using high quality model for translation
            messages: [
                { role: "system", content: "You are a professional subtitle translator/dubber." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error('Resposta vazia da OpenAI');

        onProgress?.('Processando resposta...');

        // OpenAI json_object mode requires parsing
        // Note: Sometimes it might return { "translations": [...] } or just [...]
        const parsed = JSON.parse(content);
        const translations = Array.isArray(parsed) ? parsed : (parsed.translations || parsed.segments || Object.values(parsed)[0]);

        if (!Array.isArray(translations)) {
            console.error('Resposta OpenAI inesperada:', parsed);
            throw new Error('Formato de resposta inválido da OpenAI');
        }

        // Merge back
        const result: TranslatedSegment[] = segments.map(original => {
            const trans = translations.find((t: any) => t.id === original.id);
            if (!trans) throw new Error(`Tradução faltando para segmento ${original.id}`);

            return {
                ...original,
                translatedText: trans.translatedText,
                targetCharCount: original.text.length,
                actualCharCount: trans.translatedText.length,
            };
        });

        return result;

    } catch (error: any) {
        console.error('OpenAI Translation Error:', error);
        throw new Error(`Erro na tradução OpenAI: ${error.message}`);
    }
}
