import { NextRequest, NextResponse } from 'next/server';
import { Communicate } from 'edge-tts-universal';

export const maxDuration = 300;

/**
 * Generates audio using edge-tts-universal (pure Node.js, no Python needed)
 */
async function generateAudio(text: string, voice: string): Promise<Buffer> {
    console.log(`[TTS] Generating audio for: "${text.substring(0, 30)}..." (Voice: ${voice})`);

    const communicate = new Communicate(text, { voice });

    const buffers: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
            buffers.push(chunk.data);
        }
    }

    if (buffers.length === 0) {
        throw new Error('No audio data received from TTS service');
    }

    const finalBuffer = Buffer.concat(buffers);
    console.log(`[TTS] Success. Size: ${finalBuffer.length} bytes`);
    return finalBuffer;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'Teste de áudio do DubAI';
    const voice = searchParams.get('voice') || 'pt-BR-AntonioNeural';

    try {
        const audioData = await generateAudio(text, voice);
        const arrayBuffer = audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
        ) as ArrayBuffer;

        return new NextResponse(arrayBuffer, {
            headers: { 'Content-Type': 'audio/mpeg' }
        });
    } catch (err: any) {
        console.error('[TTS-GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const start = Date.now();

    try {
        const body = await req.json();
        const { text, voice } = body;

        console.log(`[TTS-API] Start request: ${text?.substring(0, 20)}... Voice: ${voice}`);

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const safeText = text
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/['"]/g, '"')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        const voiceArg = voice || 'pt-BR-AntonioNeural';

        const audioData = await generateAudio(safeText, voiceArg);
        const duration = Date.now() - start;

        console.log(`[TTS-API] Success in ${duration}ms. Size: ${audioData.length} bytes.`);

        const arrayBuffer = audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength
        ) as ArrayBuffer;

        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
            },
        });

    } catch (error: any) {
        console.error(`[TTS-API] Error after ${Date.now() - start}ms:`, error);
        return NextResponse.json({
            error: `Falha no TTS: ${error.message}`
        }, { status: 500 });
    }
}
