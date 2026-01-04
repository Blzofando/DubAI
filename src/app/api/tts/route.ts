import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const { text, voice } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // temp file path
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

        // Aggressive sanitization to prevent CLI issues (truncation)
        // 1. Remove newlines/tabs
        // 2. Remove emojis and uncommon symbols that might choke the shell or edge-tts
        // 3. Escape double quotes
        const safeText = text
            .replace(/[\r\n\t]+/g, ' ') // Flatten
            // eslint-disable-next-line no-control-regex
            .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F\.,!\?;:()\- ]/g, '') // Keep only Latin, basic accents, and punctuation. Removes emojis/weird symbols.
            .replace(/"/g, '\\"')
            .trim();

        if (!safeText) {
            return NextResponse.json({ error: 'Text empty after sanitization' }, { status: 400 });
        }

        const voiceArg = voice || 'pt-BR-AntonioNeural';

        const command = `edge-tts --text "${safeText}" --voice "${voiceArg}" --write-media "${tempFile}"`;

        console.log('Executing TTS command:', command);
        await execPromise(command);

        if (!fs.existsSync(tempFile)) {
            throw new Error('Output file not created');
        }

        const audioBuffer = fs.readFileSync(tempFile);

        // Cleanup
        fs.unlinkSync(tempFile);

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
            },
        });

    } catch (error: any) {
        console.error('TTS Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
