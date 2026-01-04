try {
    const { EdgeTTSClient } = require('edge-tts-client');
    const client = new EdgeTTSClient();
    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
} catch (e) {
    console.log('Error instantiating or inspecting:', e.message);
}
