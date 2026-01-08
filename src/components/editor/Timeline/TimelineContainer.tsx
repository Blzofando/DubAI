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

    // Multi-select props
    selectedIds: Set<string>;
    lastSelectedId: string | null;
    onMultiSelect: (ids: Set<string>, lastSelectedId: string | null) => void;

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
    selectedIds,
    lastSelectedId,
    onMultiSelect,
    isTotalOriginalMuted,
    onToggleMuteOriginal,
    isTotalDubbingMuted,
    onToggleMuteDubbing
}: TimelineContainerProps) {
    const { translatedSegments, setTranslatedSegments, updateAudioSegmentTiming, transcriptSegments, applySpeedAdjustment, addToSpeedQueue, sourceFile, audioSegments } = useApp();
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(50); // pixels per second

    // Drag State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<number>(0);
    const dragStartClientX = useRef<number>(0);
    const dragOriginalStarts = useRef<Map<string, number>>(new Map());
    const hasDraggedRef = useRef(false);

    // Box Selection State
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [boxStart, setBoxStart] = useState<{ x: number, y: number } | null>(null);
    const [boxCurrent, setBoxCurrent] = useState<{ x: number, y: number } | null>(null);

    const audioUrl = React.useMemo(() => {
        return sourceFile ? URL.createObjectURL(sourceFile) : null;
    }, [sourceFile]);

    const totalDuration = duration || Math.max(60, ...(translatedSegments.map(s => s.end + 5) || [60]));

    const setupDrag = (id: string, startX: number, currentSelection: Set<string>) => {
        dragOriginalStarts.current.clear();

        // Ensure the dragged item is included in the moved set logic
        // (Even if state update is pending, we trust currentSelection)
        const idsToMove = new Set(currentSelection);
        if (!idsToMove.has(id)) idsToMove.add(id);

        idsToMove.forEach(mid => {
            const seg = translatedSegments.find(s => s.id === mid);
            if (seg) {
                dragOriginalStarts.current.set(mid, seg.start);
            }
        });

        setDraggingId(id);
        dragStartClientX.current = startX;
        setDragOffset(0);
        hasDraggedRef.current = false;
    };

    const handleDragStart = (e: React.MouseEvent, id: string, startX: number) => {
        let newSelection = new Set(selectedIds);
        let changed = false;

        if (e.ctrlKey || e.metaKey) {
            // Ctrl: Add to selection if not present
            if (!newSelection.has(id)) {
                newSelection.add(id);
                changed = true;
            }
            // If already present, DO NOT Remove. (Click will handle toggle if no drag happens)
        } else if (e.shiftKey) {
            // Shift: Simple Add for drag start
            if (!newSelection.has(id)) {
                newSelection.add(id);
                changed = true;
            }
        } else {
            // No Keys
            if (!newSelection.has(id)) {
                // If dragging unselected, it becomes the only selection
                newSelection = new Set([id]);
                changed = true;
            }
            // If dragging selected, keep selection as is
        }

        if (changed) {
            onMultiSelect(newSelection, id);
        }

        setupDrag(id, startX, newSelection);
    };

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (draggingId || (e.target as HTMLElement).closest('button, .segment-block')) return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const scrollLeft = containerRef.current.scrollLeft;
            const x = e.clientX - rect.left + scrollLeft;
            const time = Math.max(0, x / zoom);
            onSeek(time);

            // Click on empty space deselects all (unless modifier)
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // Check if we just finished a box select? 
                // Box select mouseup happens before click.
                // Ideally if box select happened, we prevented click?
                // But simpler: just deselect.
                onMultiSelect(new Set(), null);
            }
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, .segment-block') || e.button !== 0) return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const y = e.clientY - rect.top;

            setIsBoxSelecting(true);
            setBoxStart({ x, y });
            setBoxCurrent({ x, y });
        }
    };

    // Resizing State
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null);
    const [resizeStartClientX, setResizeStartClientX] = useState(0);
    const [resizeOriginalStart, setResizeOriginalStart] = useState(0);
    const [resizeOriginalDuration, setResizeOriginalDuration] = useState(0);
    const [resizeDelta, setResizeDelta] = useState(0);

    const resizeStateRef = useRef({
        id: null as string | null,
        direction: null as 'left' | 'right' | null,
        originalStart: 0,
        originalDuration: 0,
        delta: 0,
        startClientX: 0
    });

    const handleResizeStart = (id: string, direction: 'left' | 'right', startX: number) => {
        const seg = translatedSegments.find(s => s.id === id);
        if (!seg) return;
        setResizingId(id);
        setResizeDirection(direction);
        setResizeStartClientX(startX);
        setResizeOriginalStart(seg.start);
        setResizeOriginalDuration(seg.end - seg.start);
        setResizeDelta(0);

        resizeStateRef.current = {
            id,
            direction,
            startClientX: startX,
            originalStart: seg.start,
            originalDuration: seg.end - seg.start,
            delta: 0
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingId) {
                const deltaPx = e.clientX - dragStartClientX.current;
                const deltaSec = deltaPx / zoom;
                setDragOffset(deltaSec);

                if (Math.abs(deltaPx) > 5) {
                    hasDraggedRef.current = true;
                }
            }
            if (resizeStateRef.current.id) {
                const deltaPx = e.clientX - resizeStateRef.current.startClientX;
                const deltaSec = deltaPx / zoom;
                setResizeDelta(deltaSec);
                resizeStateRef.current.delta = deltaSec;
            }
        };

        const handleMouseUp = () => {
            if (resizeStateRef.current.id) {
                // ... (Resize logic same as before) ...
                const currentId = resizeStateRef.current.id;
                const currentDirection = resizeStateRef.current.direction;
                const currentOriginalStart = resizeStateRef.current.originalStart;
                const currentOriginalDuration = resizeStateRef.current.originalDuration;
                const currentDelta = resizeStateRef.current.delta;

                const segIdx = translatedSegments.findIndex(s => s.id === currentId);
                if (segIdx !== -1) {
                    const seg = translatedSegments[segIdx];
                    let newStart = seg.start;
                    let newEnd = seg.end;

                    if (currentDirection === 'left') {
                        newStart = Math.min(currentOriginalStart + currentDelta, seg.end - 0.2);
                        newStart = Math.max(0, newStart);
                    } else {
                        newEnd = Math.max(currentOriginalStart + 0.2, currentOriginalStart + currentOriginalDuration + currentDelta);
                    }

                    const newSegments = [...translatedSegments];
                    newSegments[segIdx] = { ...seg, start: newStart, end: newEnd, wasManuallyResized: true };
                    setTranslatedSegments(newSegments);
                    updateAudioSegmentTiming(currentId, newStart);
                    addToSpeedQueue(currentId);
                }
                setResizingId(null);
                setResizeDirection(null);
                setResizeDelta(0);
                resizeStateRef.current.id = null;
            }

            if (draggingId) {
                if (hasDraggedRef.current) {
                    // Apply drag to ALL items in dragOriginalStarts
                    const newSegments = translatedSegments.map(s => {
                        const originalStart = dragOriginalStarts.current.get(s.id);
                        if (originalStart !== undefined) {
                            const newStart = Math.max(0, originalStart + dragOffset);
                            const duration = s.end - s.start;
                            updateAudioSegmentTiming(s.id, newStart);
                            return { ...s, start: newStart, end: newStart + duration };
                        }
                        return s;
                    });

                    newSegments.sort((a, b) => a.start - b.start);
                    setTranslatedSegments(newSegments);
                }

                setDraggingId(null);
                setDragOffset(0);
                dragOriginalStarts.current.clear();
            }
        };

        const handleBoxMouseMove = (e: MouseEvent) => {
            if (isBoxSelecting && boxStart && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                const y = e.clientY - rect.top;
                setBoxCurrent({ x, y });
            }
        };

        const handleBoxMouseUp = (e: MouseEvent) => {
            if (isBoxSelecting && boxStart && boxCurrent && containerRef.current) {
                const startX = Math.min(boxStart.x, boxCurrent.x);
                const endX = Math.max(boxStart.x, boxCurrent.x);
                const width = endX - startX;

                if (width > 5) {
                    const startTime = startX / zoom;
                    const endTime = endX / zoom;
                    const newSelection = new Set<string>();
                    let lastIdCandidate: string | null = null;

                    translatedSegments.forEach(seg => {
                        if (seg.start < endTime && seg.end > startTime) {
                            newSelection.add(seg.id);
                            lastIdCandidate = seg.id;
                        }
                    });
                    onMultiSelect(newSelection, lastIdCandidate);
                } else {
                    // If simple click on background, handleTimelineClick handles deselect
                }
            }
            setIsBoxSelecting(false);
            setBoxStart(null);
            setBoxCurrent(null);
        };

        if (draggingId || resizingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        if (isBoxSelecting) {
            window.addEventListener('mousemove', handleBoxMouseMove);
            window.addEventListener('mouseup', handleBoxMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleBoxMouseMove);
            window.removeEventListener('mouseup', handleBoxMouseUp);
        };
    }, [draggingId, dragOffset, resizingId, isBoxSelecting, boxStart, boxCurrent, zoom, translatedSegments, setTranslatedSegments, addToSpeedQueue, updateAudioSegmentTiming, onMultiSelect, selectedIds]);

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
                className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-pointer scrollbar-hide"
                onMouseDown={handleMouseDown}
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

                    {/* Box Selection Visual - Z-Index 50 to be above segments? */}
                    {isBoxSelecting && boxStart && boxCurrent && (
                        <div
                            className="absolute bg-primary-500/20 border border-primary-500 z-[100] pointer-events-none"
                            style={{
                                left: Math.min(boxStart.x, boxCurrent.x) + 'px',
                                top: 0,
                                width: Math.abs(boxCurrent.x - boxStart.x) + 'px',
                                height: '100%'
                            }}
                        />
                    )}

                    {/* Tracks Area */}
                    <div className="px-2 space-y-4 pointer-events-none">
                        {/* Original Track */}
                        <div className="group relative pointer-events-auto">
                            <div className="h-20 bg-gray-800/50 rounded-lg relative overflow-hidden border border-gray-700/50">
                                {/* WAVEFORM */}
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
                                        isSelected={selectedIds.has(seg.id)}
                                        isOriginal={true}
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            onMultiSelect(new Set([seg.id]), seg.id);
                                            onSeek(seg.start);
                                        }}
                                        onDragStart={(e, id, x) => {
                                            if (!selectedIds.has(id)) onMultiSelect(new Set([id]), id);
                                        }}
                                    />
                                ))}
                            </div>
                            {/* Controls Original */}
                            <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-gray-900 to-transparent flex items-center pl-2 opacity-50 hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                <div className="pointer-events-auto flex gap-2">
                                    <button
                                        onClick={onToggleMuteOriginal}
                                        className={`p-1 rounded ${isTotalOriginalMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}
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
                                    const isDragging = draggingId === seg.id || (draggingId && selectedIds.has(seg.id) && dragOriginalStarts.current.has(seg.id));

                                    const duration = seg.end - seg.start;
                                    let currentStart = seg.start;
                                    let currentEnd = seg.end;

                                    if (isDragging) {
                                        const originalStart = dragOriginalStarts.current.get(seg.id) ?? seg.start;
                                        currentStart = Math.max(0, originalStart + dragOffset);
                                        currentEnd = currentStart + duration;
                                    } else if (isResizing) {
                                        if (resizeDirection === 'left') {
                                            currentStart = Math.max(0, Math.min(resizeOriginalStart + resizeDelta, seg.end - 0.2));
                                        } else {
                                            currentEnd = Math.max(resizeOriginalStart + 0.2, resizeOriginalStart + resizeOriginalDuration + resizeDelta);
                                        }
                                    }

                                    const currentDuration = currentEnd - currentStart;
                                    const audioSeg = audioSegments.find(s => s.id === seg.id);
                                    let speed = 1.0;
                                    if (audioSeg) {
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
                                            isSelected={selectedIds.has(seg.id)}
                                            speed={speed}
                                            onDragStart={handleDragStart}
                                            onResizeStart={handleResizeStart}
                                            onClick={(e) => {
                                                e?.stopPropagation();
                                                if (hasDraggedRef.current) return;

                                                const id = seg.id;
                                                const currentSelected = new Set(selectedIds);

                                                if (e?.ctrlKey || e?.metaKey) {
                                                    // Toggle logic
                                                    if (currentSelected.has(id)) {
                                                        currentSelected.delete(id);
                                                        onMultiSelect(currentSelected, lastSelectedId);
                                                    } else {
                                                        // This case is rare (handled in DragStart), but possible if click was fast?
                                                        currentSelected.add(id);
                                                        onMultiSelect(currentSelected, id);
                                                    }
                                                } else if (e?.shiftKey) {
                                                    if (lastSelectedId) {
                                                        const startIdx = translatedSegments.findIndex(s => s.id === lastSelectedId);
                                                        const endIdx = translatedSegments.findIndex(s => s.id === id);

                                                        if (startIdx !== -1 && endIdx !== -1) {
                                                            const min = Math.min(startIdx, endIdx);
                                                            const max = Math.max(startIdx, endIdx);
                                                            if (!e?.ctrlKey) currentSelected.clear();

                                                            for (let i = min; i <= max; i++) {
                                                                currentSelected.add(translatedSegments[i].id);
                                                            }
                                                            onMultiSelect(currentSelected, id);
                                                        } else {
                                                            onMultiSelect(new Set([id]), id);
                                                            onSeek(currentStart);
                                                        }
                                                    } else {
                                                        // Fallback Shift without anchor -> Single Select (sets anchor)
                                                        onMultiSelect(new Set([id]), id);
                                                        onSeek(currentStart);
                                                    }
                                                } else {
                                                    // Single Select (handled in DragStart mostly, but good for cleanup)
                                                    onMultiSelect(new Set([id]), id);
                                                    onSeek(currentStart);
                                                }
                                            }}
                                            onApplySpeedAdjustment={async (id) => {
                                                try {
                                                    await applySpeedAdjustment(id, (msg) => { console.log(msg); });
                                                } catch (error: any) {
                                                    alert(`Erro: ${error.message}`);
                                                }
                                            }}
                                            wasManuallyResized={seg.wasManuallyResized}
                                        />
                                    );
                                })}
                            </div>
                            {/* Controls Dubbing */}
                            <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-gray-900 to-transparent flex items-center pl-2 opacity-50 hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                <div className="pointer-events-auto flex gap-2">
                                    <button
                                        onClick={onToggleMuteDubbing}
                                        className={`p-1 rounded ${isTotalDubbingMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}
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
