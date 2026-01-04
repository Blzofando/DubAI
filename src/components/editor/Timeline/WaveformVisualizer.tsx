'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WaveformVisualizerProps {
    audioUrl: string | null;
    zoom: number; // pixels per second
    height?: number;
    className?: string;
}

export default function WaveformVisualizer({ audioUrl, zoom, height = 64, className = '' }: WaveformVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Decode Audio
    useEffect(() => {
        if (!audioUrl) return;

        let active = true;
        const fetchAndDecode = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                // Decode - this can be slow for large files
                const decoded = await audioContext.decodeAudioData(arrayBuffer);
                if (active) {
                    setAudioBuffer(decoded);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error decoding waveform", err);
                if (active) {
                    setError("Failed to load waveform");
                    setIsLoading(false);
                }
            }
        };

        fetchAndDecode();

        return () => { active = false; };
    }, [audioUrl]);

    // 2. Draw Waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate dimensions
        const duration = audioBuffer.duration;
        const totalWidth = duration * zoom;

        // Handle canvas size limits (browser dependent, usually ~32k pixels)
        // If wider than limit, we might need multiple canvases or virtualization.
        // For V1, let's limit simply or assume reasonable zoom/duration.
        // Or better: Just render the visible part? 
        // Component assumes "scrollable" container parent handles the viewport.
        // If we want to render the WHOLE thing, it might crash canvas.
        // Let's assume standard behavior for now: dynamic width.

        const MAX_CANVAS_WIDTH = 32000;
        if (totalWidth > MAX_CANVAS_WIDTH) {
            // Fallback or simplified logic needed
            console.warn("Waveform too wide for single canvas");
        }

        canvas.width = Math.min(totalWidth, MAX_CANVAS_WIDTH);
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Styling
        ctx.fillStyle = '#4f46e5'; // Primary-600 like
        ctx.globalAlpha = 0.5;

        // Sampling Logic
        const data = audioBuffer.getChannelData(0); // Left channel
        const step = Math.ceil(data.length / canvas.width);
        const amp = height / 2;

        ctx.beginPath();
        for (let i = 0; i < canvas.width; i++) {
            let min = 1.0;
            let max = -1.0;

            // Optimization: check min/max in the chunk
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }

            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

    }, [audioBuffer, zoom, height]);

    if (isLoading) return <div className="text-[10px] text-gray-500 p-2">Loading Waveform...</div>;
    if (error) return <div className="text-[10px] text-red-500 p-2">Waveform Error</div>;

    return (
        <canvas
            ref={canvasRef}
            className={`pointer-events-none ${className}`}
            style={{ width: audioBuffer ? Math.min(audioBuffer.duration * zoom, 32000) : 0 }}
        />
    );
}
