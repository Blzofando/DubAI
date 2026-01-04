'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Volume2, VolumeX } from 'lucide-react';
import SegmentBlock from './SegmentBlock';
import WaveformVisualizer from './WaveformVisualizer';

interface TimelineContainerProps {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    selectedSegmentId: string | null;
    onSelectSegment: (id: string | null) => void;
    // Mute Mute
    isTotalOriginalMuted: boolean;
    onToggleMuteOriginal: () => void;
    isTotalDubbingMuted: boolean;
    onToggleMuteDubbing: () => void;
}

export default function TimelineContainer({
    currentTime,
    duration,
    onSeek,
    selectedSegmentId,
    onSelectSegment,
    isTotalOriginalMuted,
    onToggleMuteOriginal,
    isTotalDubbingMuted,
    onToggleMuteDubbing
}: TimelineContainerProps) {
    const { translatedSegments, setTranslatedSegments, updateAudioSegmentTiming, transcriptSegments, applySpeedAdjustment } = useApp();
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(50); // pixels per second

    // Drag State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<number>(0);
    const dragStartClientX = useRef<number>(0);
    const dragOriginalStart = useRef<number>(0);

    const { sourceFile } = useApp();
    const audioUrl = React.useMemo(() => {
        return sourceFile ? URL.createObjectURL(sourceFile) : null;
    }, [sourceFile]);

    // If duration not passed (still loading), fallback to calculated
    const totalDuration = duration || Math.max(60, ...(translatedSegments.map(s => s.end + 5) || [60]));

    const handleDragStart = (id: string, startX: number) => {
        const seg = translatedSegments.find(s => s.id === id);
        if (!seg) return;

        setDraggingId(id);
        dragStartClientX.current = startX;
        dragOriginalStart.current = seg.start;
        setDragOffset(0);
    };

    // Seek on Click in Ruler/Empty Space
    const handleTimelineClick = (e: React.MouseEvent) => {
        // Prevent seek if dragging or clicking buttons
        if (draggingId || (e.target as HTMLElement).closest('button, .segment-block')) return;

        // Deselect if clicking empty space
        onSelectSegment(null);

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Calculate relative X inside scrollable area
            // We need to account for scrollLeft
            const scrollLeft = containerRef.current.scrollLeft;
            const clickX = e.clientX - rect.left + scrollLeft;

            const time = Math.max(0, clickX / zoom);
            onSeek(time);
        }
    };

    // Resizing State
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null);
    const [resizeStartClientX, setResizeStartClientX] = useState(0);
    const [resizeOriginalStart, setResizeOriginalStart] = useState(0);
    const [resizeOriginalDuration, setResizeOriginalDuration] = useState(0);
    const [resizeDelta, setResizeDelta] = useState(0);

    const handleResizeStart = (id: string, direction: 'left' | 'right', startX: number) => {
        const seg = translatedSegments.find(s => s.id === id);
        if (!seg) return;
        setResizingId(id);
        setResizeDirection(direction);
        setResizeStartClientX(startX);
        setResizeOriginalStart(seg.start);
        setResizeOriginalDuration(seg.end - seg.start);
        setResizeDelta(0);
    };

    // ... handleDragStart ...

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingId) {
                const deltaPx = e.clientX - dragStartClientX.current;
                const deltaSec = deltaPx / zoom;
                setDragOffset(deltaSec);
            }
            if (resizingId) {
                const deltaPx = e.clientX - resizeStartClientX;
                const deltaSec = deltaPx / zoom;
                setResizeDelta(deltaSec);
            }
        };

        const handleMouseUp = () => {
            if (resizingId) {
                // Determine new start/end
                const segIdx = translatedSegments.findIndex(s => s.id === resizingId);
                if (segIdx === -1) {
                    setResizingId(null);
                    return;
                }
                const seg = translatedSegments[segIdx];
                let newStart = seg.start;
                let newEnd = seg.end;

                if (resizeDirection === 'left') {
                    // Start moves, END stays fixed.
                    // Duration changes.
                    newStart = Math.min(resizeOriginalStart + resizeDelta, seg.end - 0.2); // Min duration 0.2s
                    newStart = Math.max(0, newStart);
                } else {
                    // Start fixed, End moves.
                    newEnd = Math.max(resizeOriginalStart + 0.2, resizeOriginalStart + resizeOriginalDuration + resizeDelta);
                }

                // Commit to state
                const newSegments = [...translatedSegments];
                newSegments[segIdx] = { ...seg, start: newStart, end: newEnd, wasManuallyResized: true };
                setTranslatedSegments(newSegments);

                // Update Context Timing for Audio Sync
                updateAudioSegmentTiming(resizingId, newStart);

                // We should also update DURATION logic for speed? 
                // Since 'updateAudioSegmentTiming' currently only takes ID and Start.
                // Speed calculation happens in useAudioPlayback based on segment duration vs audio buffer duration.
                // So simply changing start/end in translatedSegments IS enough for the hook to re-calc speed!

                setResizingId(null);
                setResizeDirection(null);
                setResizeDelta(0);
            }

            if (draggingId) {
                // ... (existing drag commit logic) ...
                // Commit changes
                const newSegments = translatedSegments.map(s => {
                    if (s.id === draggingId) {
                        const newStart = Math.max(0, dragOriginalStart.current + dragOffset);
                        const duration = s.end - s.start;

                        updateAudioSegmentTiming(s.id, newStart);
                        return { ...s, start: newStart, end: newStart + duration };
                    }
                    return s;
                });

                newSegments.sort((a, b) => a.start - b.start);
                setTranslatedSegments(newSegments);
                setDraggingId(null);
                setDragOffset(0);
            }
        };

        if (draggingId || resizingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, dragOffset, resizingId, resizeDelta, resizeDirection, resizeStartClientX, resizeOriginalStart, resizeOriginalDuration, zoom, translatedSegments, setTranslatedSegments]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-900 border-t border-gray-800 select-none">
            {/* Toolbar / Time Header */}
            <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                <span className="text-xs text-gray-400">Total: {totalDuration.toFixed(0)}s</span>
                <div className="flex gap-2">
                    <button onClick={() => setZoom(z => Math.max(10, z - 10))} className="text-xs text-gray-400 hover:text-white">-</button>
                    <span className="text-xs text-gray-400">{zoom}px/s</span>
                    <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="text-xs text-gray-400 hover:text-white">+</button>
                </div>
            </div>

            {/* Scrollable Area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-pointer"
                onClick={handleTimelineClick}
            >
                <div style={{ width: `${totalDuration * zoom}px`, minWidth: '100%' }} className="h-full relative">

                    {/* Ruler */}
                    <div className="h-6 border-b border-gray-700 relative pointer-events-none mb-2">
                        {Array.from({ length: Math.ceil(totalDuration) }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 border-l border-gray-600 text-[10px] text-gray-500 pl-1"
                                style={{ left: `${i * zoom}px` }}
                            >
                                {i % 5 === 0 ? i + 's' : ''}
                            </div>
                        ))}
                    </div>

                    {/* Tracks Area */}
                    <div className="px-2 space-y-4 pointer-events-none">
                        {/* Original Track */}
                        <div className="group relative pointer-events-auto">
                            {/* Track Header (Overlay on left) - Actually we need a sidebar or sticking header? 
                                For now, putting simple Mute button on the track container top-left
                            */}
                            <div className="h-20 bg-gray-800/50 rounded-lg relative overflow-hidden border border-gray-700/50">
                                {/* WAVEFORM BACKGROUND */}
                                <div className="absolute inset-0 z-0 opacity-40">
                                    <WaveformVisualizer
                                        audioUrl={audioUrl}
                                        zoom={zoom}
                                        height={80}
                                    />
                                </div>

                                {transcriptSegments.map(seg => (
                                    <SegmentBlock
                                        key={seg.id}
                                        id={seg.id}
                                        text={seg.text}
                                        start={seg.start}
                                        duration={seg.end - seg.start}
                                        zoom={zoom}
                                        isSelected={selectedSegmentId === seg.id}
                                        isOriginal={true} /* New prop for styling distinction */
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            // Toggle selection logic? Or just select.
                                            // User said: "se eu clica novamente disseleciono" e "direcionada imediatamente para o inicio"
                                            if (selectedSegmentId === seg.id) {
                                                onSelectSegment(null);
                                            } else {
                                                onSelectSegment(seg.id);
                                                onSeek(seg.start); // Seek to start immediately
                                            }
                                        }}
                                        onDragStart={(id, x) => {
                                            // Placeholder for original track drag
                                            // We usually don't want to move original segments easily unless explicitly requested?
                                            // User said "bloco origina pode ser ajustao". So yes.
                                            // We need to handle 'original' type in handleDragStart.
                                            // For now, let's just select it.
                                            onSelectSegment(id);
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Track Controls Overlay */}
                            <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-gray-900 to-transparent flex items-center pl-2 opacity-50 hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                <div className="pointer-events-auto flex gap-2">
                                    <button
                                        onClick={onToggleMuteOriginal}
                                        className={`p-1 rounded ${isTotalOriginalMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                                        title="Mute Original"
                                    >
                                        {isTotalOriginalMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                    </button>
                                    <span className="text-[10px] text-white font-bold drop-shadow-md">Original</span>
                                </div>
                            </div>
                        </div>

                        {/* Dubbing Track */}
                        <div className="group relative pointer-events-auto">
                            <div className="h-24 bg-gray-800/30 rounded-lg relative border border-gray-700/50">
                                {translatedSegments.map(seg => {
                                    const isResizing = resizingId === seg.id;
                                    const isDragging = draggingId === seg.id;
                                    const duration = seg.end - seg.start;

                                    let currentStart = seg.start;
                                    let currentEnd = seg.end;

                                    if (isDragging) {
                                        currentStart = Math.max(0, dragOriginalStart.current + dragOffset);
                                        currentEnd = currentStart + duration;
                                    } else if (isResizing) {
                                        if (resizeDirection === 'left') {
                                            currentStart = Math.max(0, Math.min(resizeOriginalStart + resizeDelta, seg.end - 0.2));
                                        } else {
                                            currentEnd = Math.max(resizeOriginalStart + 0.2, resizeOriginalStart + resizeOriginalDuration + resizeDelta);
                                        }
                                    }

                                    const currentDuration = currentEnd - currentStart;

                                    // Calculate Speed
                                    // Use appliedSpeedFactor if available (from FFmpeg adjustment)
                                    // Otherwise calculate dynamically: AudioDuration / BlockDuration
                                    const audioSeg = useApp().audioSegments.find(s => s.id === seg.id);
                                    let speed = 1.0;
                                    if (audioSeg) {
                                        // Prefer the saved applied speed factor
                                        speed = audioSeg.appliedSpeedFactor || (currentDuration > 0 ? audioSeg.duration / currentDuration : 1.0);
                                    }

                                    return (
                                        <SegmentBlock
                                            key={seg.id}
                                            id={seg.id}
                                            text={seg.translatedText}
                                            start={currentStart}
                                            duration={currentDuration}
                                            zoom={zoom}
                                            isSelected={selectedSegmentId === seg.id}
                                            speed={speed}
                                            onDragStart={(id, x) => {
                                                onSelectSegment(id); // Select on drag too
                                                handleDragStart(id, x);
                                            }}
                                            onResizeStart={handleResizeStart}
                                            onClick={() => {
                                                onSelectSegment(seg.id);
                                                onSeek(currentStart);
                                            }}
                                            onApplySpeedAdjustment={async (id) => {
                                                try {
                                                    await applySpeedAdjustment(id, (msg) => {
                                                        console.log('Speed adjustment:', msg);
                                                        // Could add toast notification here
                                                    });
                                                } catch (error: any) {
                                                    console.error('Failed to apply speed adjustment:', error);
                                                    alert(`Erro: ${error.message}`);
                                                }
                                            }}
                                            wasManuallyResized={seg.wasManuallyResized}
                                        />
                                    );
                                })}
                            </div>

                            {/* Track Controls Overlay */}
                            <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-gray-900 to-transparent flex items-center pl-2 opacity-50 hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                <div className="pointer-events-auto flex gap-2">
                                    <button
                                        onClick={onToggleMuteDubbing}
                                        className={`p-1 rounded ${isTotalDubbingMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                                        title="Mute Dubbing"
                                    >
                                        {isTotalDubbingMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                    </button>
                                    <span className="text-[10px] text-white font-bold drop-shadow-md">Dublagem</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-[1px] bg-white z-20 pointer-events-none transition-transform duration-75 ease-linear"
                        style={{ transform: `translateX(${currentTime * zoom}px)` }}
                    >
                        <div className="absolute -top-1 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
                        <div className="absolute top-0 h-full w-full bg-red-500/50 box-shadow-[0_0_10px_rgba(255,0,0,0.5)]"></div>
                    </div>

                </div>
            </div>
        </div>
    );
}
