try {
    const lib = require('edge-tts');
    console.log('Keys:', Object.keys(lib));
    if (lib.default) {
        console.log('Default keys:', Object.keys(lib.default));
    }
} catch (e) {
    console.error('Error:', e.message);
}
