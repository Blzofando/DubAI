try {
    const lib = require('edge-tts-client');
    console.log('Exports:', Object.keys(lib));
} catch (e) {
    console.error('Error:', e.message);
}
