import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';

export function useAudioPlayback(selectedSegmentId: string | null = null) {
    const { sourceFile, transcriptSegments, audioSegments, translatedSegments } = useApp();

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Mute States
    const [isOriginalMuted, setIsOriginalMuted] = useState(false);
    const [isDubbingMuted, setIsDubbingMuted] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null); // Master volume for Dubbing
    const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
    const rafRef = useRef<number | null>(null);

    // Initialize Video Source
    useEffect(() => {
        if (videoRef.current && sourceFile) {
            const url = URL.createObjectURL(sourceFile);
            videoRef.current.src = url;
            videoRef.current.onloadedmetadata = () => {
                setDuration(videoRef.current?.duration || 0);
            };
            return () => URL.revokeObjectURL(url);
        }
    }, [sourceFile]);

    // Initialize Audio Context on user interaction (Play)
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create Master Gain (Volume Control) for Dubbing
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.connect(audioContextRef.current.destination);
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    // Mute Logic Effect
    useEffect(() => {
        // Original Video Mute
        if (videoRef.current) {
            videoRef.current.muted = isOriginalMuted;
        }

        // Dubbing Mute (via GainNode)
        if (gainNodeRef.current && audioContextRef.current) {
            // Smooth transition to avoid clicks
            const targetGain = isDubbingMuted ? 0 : 1;
            gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
            gainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.1);
        }
    }, [isOriginalMuted, isDubbingMuted]);

    const stopAllScheduledAudio = () => {
        scheduledNodesRef.current.forEach(node => {
            try { node.stop(); } catch (e) { /* ignore if already stopped */ }
        });
        scheduledNodesRef.current = [];
    };

    const scheduleSegments = async (startTime: number) => {
        if (!audioContextRef.current || !gainNodeRef.current) return;
        const ctx = audioContextRef.current;
        const mainGain = gainNodeRef.current;

        // Clear previous
        stopAllScheduledAudio();

        // 1. Determine Playback Range (Normal vs Solo)
        let playEndTime = Infinity;

        // Find selected segment logic
        let soloSegment = null;
        if (selectedSegmentId) {
            soloSegment = audioSegments.find(s => s.id === selectedSegmentId);
            if (soloSegment) {
                // If cursor is BEFORE segment, wait. If AFTER, don't play? 
                // Or play from cursor, but STOP at segment end.
                playEndTime = soloSegment.startTime + soloSegment.duration;
            }
        }

        // If in Solo Mode, do we mute original video?
        // User said: "original... touch only that block". 
        // Ideally we mute video if it's not the original block? 
        // Or we just rely on the fact that "Solo" usually implies isolation.
        // For simplicity V1: Just constrain the stop time.

        for (const seg of audioSegments) {
            // In Solo Mode, skip other segments
            if (selectedSegmentId && seg.id !== selectedSegmentId) continue;

            const segStart = seg.startTime;
            const segEnd = segStart + seg.duration;

            // If segment is in the future relative to cursor
            if (segEnd > startTime) {
                let whenToPlay = 0; // relative to AudioContext.currentTime
                let offsetInBlob = 0;
                let durationToPlay = seg.duration;

                if (segStart >= startTime) {
                    // Future segment
                    whenToPlay = segStart - startTime;
                    offsetInBlob = 0;
                } else {
                    // Overlapping segment
                    whenToPlay = 0; // Play immediately
                    offsetInBlob = startTime - segStart;
                    durationToPlay = seg.duration - offsetInBlob;
                }

                // Construct duration to play logic
                // Note: We don't pass duration to start() as it cuts audio incorrectly
                // The audio will play naturally until segment ends or is stopped

                try {
                    const arrayBuffer = await seg.audioBlob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(mainGain);

                    const absStartTime = ctx.currentTime + whenToPlay;
                    // Play from offsetInBlob, but let it play naturally (don't cut duration)
                    source.start(absStartTime, offsetInBlob);

                    scheduledNodesRef.current.push(source);
                } catch (e) {
                    console.error("Error scheduling segment", e);
                }
            }
        }
    };

    const togglePlay = async () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            // Pause
            videoRef.current.pause();
            stopAllScheduledAudio();
            setIsPlaying(false);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        } else {
            // Play
            initAudioContext();

            // Sync Video
            videoRef.current.play();

            // Sync Audio Segments
            await scheduleSegments(videoRef.current.currentTime);

            setIsPlaying(true);

            // Update UI loop
            const loop = () => {
                if (videoRef.current) {
                    setCurrentTime(videoRef.current.currentTime);
                }
                rafRef.current = requestAnimationFrame(loop);
            };
            loop();
        }
    };

    const seek = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);

            if (isPlaying) {
                stopAllScheduledAudio();
                scheduleSegments(time);
            }
        }
    };

    return {
        videoRef,
        isPlaying,
        currentTime,
        duration,
        togglePlay,
        seek,
        isOriginalMuted,
        setIsOriginalMuted,
        isDubbingMuted,
        setIsDubbingMuted
    };
}
