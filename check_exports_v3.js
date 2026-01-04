try {
    const lib = require('node-edge-tts');
    console.log('Keys:', Object.keys(lib));
    if (lib.EdgeTTS) {
        console.log('EdgeTTS found');
    }
} catch (e) {
    console.error('Error:', e.message);
}
