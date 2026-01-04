const { EdgeTTS } = require('node-edge-tts');
const { readFile, unlink } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');

async function testNewSanitization() {
    const testText = "A primeira coisa que a garota renasceu fez foi gastar sessenta mil para alugar um lugar pequeno, velho e caindo aos pedaços.";

    console.log('=== TEST 1: Less Aggressive Sanitization ===');
    console.log('Original:', testText);

    const safeText = testText
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/['"]/g, '"')
        .trim();

    console.log('Sanitized:', safeText);
    console.log('Same?', testText === safeText);

    const tts = new EdgeTTS({
        voice: 'pt-BR-AntonioNeural',
        lang: 'pt-BR',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    const tempFile = join(tmpdir(), `test-new-${Date.now()}.mp3`);

    await tts.ttsPromise(safeText, tempFile);

    const stats = await require('fs/promises').stat(tempFile);
    console.log('File size:', stats.size, 'bytes (should be ~31KB for full audio)');

    await unlink(tempFile);
    console.log('Success!');
}

testNewSanitization().catch(console.error);
