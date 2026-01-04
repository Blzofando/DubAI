const { EdgeTTS } = require('node-edge-tts');

async function test() {
    const tts = new EdgeTTS({
        voice: 'pt-BR-AntonioNeural',
        lang: 'pt-BR',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tts)));
    console.log('Testing ttsPromise with 2 args...');

    try {
        // Try with output path as second arg
        const result = await tts.ttsPromise('Teste', './test-output.mp3');
        console.log('Success with file path!', typeof result);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test();
