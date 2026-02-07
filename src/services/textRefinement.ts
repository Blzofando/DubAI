
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

interface RefinementParams {
    text: string;
    currentSpeed: number; // The speed factor that was achieved (e.g. 1.0 or 1.6)
    targetSpeedMin: number; // 1.1
    targetSpeedMax: number; // 1.5
    apiKey: string;
    provider: 'gemini' | 'openai';
}

/**
 * Refines the text to be longer or shorter based on the speed deviation.
 * Goal: The resulting audio, when fitted to the original duration, should require a speedup between 1.1x and 1.5x.
 */
export async function refineTextWithAI({
    text,
    currentSpeed,
    targetSpeedMin,
    targetSpeedMax,
    apiKey,
    provider
}: RefinementParams): Promise<string> {

    // Logic:
    // If currentSpeed < 1.1 (e.g. 1.0), it means the text is too short / audio is too slow.
    // We need to INCREASE the text length so that it takes longer to say, enforcing a higher speedup to fit.
    // If currentSpeed > 1.5 (e.g. 1.8), it means the text is too long / audio is too fast.
    // We need to DECREASE the text length.

    let direction = '';
    let instruction = '';

    if (currentSpeed < targetSpeedMin) {
        direction = 'EXPAND';
        instruction = `The current text is too short. Please rewrite it to be LONGER (add details, adjectives, or slightly more verbose phrasing) so it takes more time to read, while keeping the exact same meaning. Target: increase length by roughly 20-30%.`;
    } else if (currentSpeed > targetSpeedMax) {
        direction = 'CONDENSE';
        instruction = `The current text is too long and causes the dubbing to be too fast. Please rewrite it to be SHORTER (remove filler words, simplify phrasing) so it fits better, while keeping the exact same meaning. Target: decrease length by roughly 20-30%.`;
    } else {
        return text; // Should not happen if called correctly
    }

    const prompt = `
You are a professional dubbing script editor.
Current Text: "${text}"
Problem: ${direction} needed.
Instruction: ${instruction}

Output ONLY the rewritten text, nothing else. Do not use quotes around the output unless they are part of the text.
    `;

    try {
        let refinedText = '';

        if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            refinedText = result.response.text();
        } else {
            const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o-mini", // Fast and capable enough
            });
            refinedText = completion.choices[0].message.content || "";
        }

        return refinedText.trim();

    } catch (error) {
        console.error('Error refining text:', error);
        return text; // Fallback to original
    }
}
