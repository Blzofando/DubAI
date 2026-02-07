const { EdgeTTS } = require('node-edge-tts');
const path = require('path');

async function testTTSAlt() {
    console.log('[ALT-TEST] Testing node-edge-tts library...');

    const text = "Teste de verificação com biblioteca alternativa.";
    const outputFile = path.join(__dirname, 'test-alt.mp3');

    const tts = new EdgeTTS({
        voice: 'pt-BR-AntonioNeural'
    });

    try {
        console.log('[ALT-TEST] Generating...');
        const start = Date.now();

        await tts.ttsPromise(text, outputFile);

        const duration = Date.now() - start;
        console.log(`[ALT-TEST] Success! Time: ${duration}ms`);
        console.log(`[ALT-TEST] File saved to: ${outputFile}`);
    } catch (e) {
        console.error('[ALT-TEST] Error:', e);
    }
}

testTTSAlt();
