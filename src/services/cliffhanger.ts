
import { TranscriptSegment, TranslatedSegment, DubbingPart } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

interface SplitPoint {
    time: number;
    cliffhangerText: string;
    contextText: string;
}

/**
 * Processa a lógica de divisão e cliffhanger do Douyin
 */
export async function processDouyinSplits(
    segments: TranslatedSegment[],
    totalDuration: number,
    apiKeys: { gemini: string; openai: string }
): Promise<DubbingPart[]> {

    // 1. Determinar número de partes
    const numParts = totalDuration > 360 ? 3 : 2; // > 6 min = 3 partes, senão 2

    console.log(`Douyin Logic: Video duration ${totalDuration}s -> Splitting into ${numParts} parts`);

    // 2. Calcular pontos ideais de corte
    const targetSplitTime = totalDuration / numParts;
    // Part 1 end ~ targetSplitTime
    // Part 2 end ~ targetSplitTime * 2 (if 3 parts)

    const parts: DubbingPart[] = [];
    let currentStart = 0;

    try {
        // Vamos usar Gemini para analisar o texto e achar o melhor ponto de corte
        // criando suspense

        // Find segment index near targetSplitTime
        let splitIndex1 = segments.findIndex(s => s.end > targetSplitTime);
        if (splitIndex1 === -1) splitIndex1 = Math.floor(segments.length / 2);

        // Adjust split to be end of a sentence if possible
        // For simplicity, we stick to the segment boundary for now, but asking AI to rewrite

        // Context window for AI: 5 segments before and 2 after
        const contextStart = Math.max(0, splitIndex1 - 5);
        const contextEnd = Math.min(segments.length - 1, splitIndex1 + 2);

        const contextSegments = segments.slice(contextStart, contextEnd + 1);
        const contextText = contextSegments.map((s, i) => `[${i}] ${s.translatedText}`).join('\n');

        // Prompt AI to generate cliffhanger
        // Se falhar, usa lógica fallback simples
        let cliffhangerModification = await generateCliffhangerAI(
            contextText,
            apiKeys.gemini || apiKeys.openai,
            !!apiKeys.gemini ? 'gemini' : 'openai'
        );

        // Apply modification
        // A IA retorna: { originalIndexRelative, newEndText, newStartText }
        // originalIndexRelative é relativo ao nosso slice contextSegments

        let splitSegmentIndex = splitIndex1; // Default fallback

        if (cliffhangerModification) {
            const relativeIdx = cliffhangerModification.index;
            if (relativeIdx >= 0 && relativeIdx < contextSegments.length) {
                splitSegmentIndex = contextStart + relativeIdx;

                // Modify the segment at split point (End of Part 1)
                const seg1 = segments[splitSegmentIndex];

                // Create a copy for Part 1 modified
                const seg1Modified = { ...seg1, translatedText: cliffhangerModification.cliffhangerText };

                // Create a copy for Part 2 modified (context)
                // Actually, the requirement says:
                // "Início da Parte 2: Reutilize o mesmo bloco original... (ex: 'Eles olharam para o céu até que um meteoro caiu')"
                // So Part 2 starts with the ORIGINAL text of this segment.
                // AND Part 2 Start Time should be slightly before Part 1 End Time?
                // "O timecode de Início da Parte 2 deve ser ligeiramente anterior ao Final da Parte 1"

                // Logic:
                // Part 1 Segments: 0 to splitSegmentIndex (modified)
                // Part 2 Segments: splitSegmentIndex (original) to END

                // Construction Part 1
                const part1Segments = [
                    ...segments.slice(0, splitSegmentIndex),
                    seg1Modified
                ];

                parts.push({
                    index: 1,
                    start: 0,
                    end: seg1.end,
                    segments: part1Segments
                });

                // Construction Part 2 (Start)
                currentStart = seg1.start; // Overlap!

                if (numParts === 2) {
                    const part2Segments = segments.slice(splitSegmentIndex);
                    // Adjust first segment of part 2? No, keep original as requested.

                    parts.push({
                        index: 2,
                        start: currentStart,
                        end: totalDuration,
                        segments: part2Segments
                    });
                } else {
                    // Logic for 3 parts (Handle Part 2 -> 3 split similarly)
                    // For MVP simplicity, let's just split Part 2 in half without AI cliffhanger for now,
                    // or request AI again.
                    // Let's implement Part 2->3 split simply by duration for now to save tokens/latency,
                    // or repeat logic if robust.

                    const remainingDuration = totalDuration - currentStart;
                    const splitTime2 = currentStart + (remainingDuration / 2);

                    let splitIndex2 = segments.findIndex(s => s.end > splitTime2);
                    if (splitIndex2 <= splitSegmentIndex) splitIndex2 = splitSegmentIndex + Math.floor((segments.length - splitSegmentIndex) / 2);

                    const part2Segments = segments.slice(splitSegmentIndex, splitIndex2 + 1);
                    const part3Segments = segments.slice(splitIndex2 + 1);

                    parts.push({
                        index: 2,
                        start: currentStart,
                        end: segments[splitIndex2].end,
                        segments: part2Segments
                    });

                    parts.push({
                        index: 3,
                        start: segments[splitIndex2 + 1].start,
                        end: totalDuration,
                        segments: part3Segments
                    });
                }

            } else {
                throw new Error("Invalid AI index");
            }
        } else {
            console.warn("AI Cliffhanger failed, using simple split");
            fallbackSplit(segments, numParts, totalDuration, parts);
        }

    } catch (e) {
        console.error("Error in AI Split:", e);
        fallbackSplit(segments, numParts, totalDuration, parts);
    }

    return parts;
}

function fallbackSplit(segments: TranslatedSegment[], numParts: number, totalDuration: number, parts: DubbingPart[]) {
    const splitTime = totalDuration / numParts;
    let splitIdx = segments.findIndex(s => s.end > splitTime);
    if (splitIdx === -1) splitIdx = Math.floor(segments.length / numParts);

    // Part 1
    parts.push({
        index: 1,
        start: 0,
        end: segments[splitIdx].end,
        segments: segments.slice(0, splitIdx + 1)
    });

    // Part 2 (Overlap last segment)
    const overlapIdx = splitIdx;

    if (numParts === 2) {
        parts.push({
            index: 2,
            start: segments[overlapIdx].start, // Overlap
            end: totalDuration,
            segments: segments.slice(overlapIdx)
        });
    } else {
        // 3 parts fallback
        const splitTime2 = splitTime * 2;
        let splitIdx2 = segments.findIndex(s => s.end > splitTime2);

        parts.push({
            index: 2,
            start: segments[overlapIdx].start,
            end: segments[splitIdx2].end,
            segments: segments.slice(overlapIdx, splitIdx2 + 1)
        });

        parts.push({
            index: 3,
            start: segments[splitIdx2].start, // Overlap again? Or simple? Let's overlap simple
            end: totalDuration,
            segments: segments.slice(splitIdx2) // From end of p2
        });
    }
}

async function generateCliffhangerAI(
    contextText: string,
    apiKey: string,
    provider: 'gemini' | 'openai'
): Promise<{ index: number, cliffhangerText: string } | null> {

    const prompt = `
Analyzing this transcript segment series (format: [index] text), identify the best point to split Part 1 creating a cliffhanger (suspense).
Context:
${contextText}

Task:
1. Select one segment index (from the provided list) that works best as a cliffhanger ending.
2. Rewrite that segment's text to end with suspense (e.g., "until...", "waiting for...", "mas então...").
3. Return JSON: { "index": number, "cliffhangerText": "rewritten text" }
    `;

    try {
        let responseText = "";

        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        } else {
            const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-3.5-turbo",
            });
            responseText = completion.choices[0].message.content || "";
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error("AI Generation error:", e);
    }

    return null;
}
