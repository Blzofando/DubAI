const { EdgeTTS } = require('node-edge-tts');
const { readFile, unlink } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');

async function testTTS() {
    const testText = "A primeira coisa que a garota renasceu fez foi gastar sessenta mil para alugar um lugar pequeno, velho e caindo aos pedaços.";

    console.log('Original text:', testText);

    // Apply sanitization
    const safeText = testText
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F\.,!\?;:()\- ]/g, '')
        .trim();

    console.log('Sanitized text:', safeText);
    console.log('Length before:', testText.length, 'after:', safeText.length);

    const tts = new EdgeTTS({
        voice: 'pt-BR-AntonioNeural',
        lang: 'pt-BR',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    const tempFile = join(tmpdir(), `test-tts-${Date.now()}.mp3`);
    console.log('Generating to:', tempFile);

    await tts.ttsPromise(safeText, tempFile);

    const stats = await require('fs/promises').stat(tempFile);
    console.log('File size:', stats.size, 'bytes');

    const audioBuffer = await readFile(tempFile);
    console.log('Buffer length:', audioBuffer.length);

    await unlink(tempFile);
    console.log('Test complete!');
}

testTTS().catch(console.error);
