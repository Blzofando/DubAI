'use client';

import React from 'react';

interface SegmentBlockProps {
    id: string;
    text: string;
    start: number;
    duration: number;
    zoom: number;
    onDragStart: (id: string, startX: number) => void;

    // New Props for selection
    isSelected?: boolean;
    onClick?: (e?: React.MouseEvent) => void;
    isOriginal?: boolean;

    // Resize Props
    onResizeStart?: (id: string, direction: 'left' | 'right', startX: number) => void;
    speed?: number;
    onApplySpeedAdjustment?: (id: string) => void;
    wasManuallyResized?: boolean;
}

export default function SegmentBlock({ id, text, start, duration, zoom, onDragStart, isSelected, onClick, isOriginal, onResizeStart, speed = 1.0, onApplySpeedAdjustment, wasManuallyResized }: SegmentBlockProps) {
    const left = start * zoom;
    const width = duration * zoom;

    return (
        <div
            className={`absolute top-1 bottom-1 border rounded-md overflow-hidden transition-colors shadow-sm group select-none ${isSelected
                ? 'bg-primary-500 border-primary-300 ring-2 ring-primary-400 z-10'
                : isOriginal
                    ? 'bg-blue-600/60 border-blue-400/50 hover:bg-blue-500/70' // Original Styling
                    : 'bg-accent-600/90 border-accent-400 hover:bg-accent-500' // Dubbing Styling
                }`}
            style={{ left: `${left}px`, width: `${width}px` }}
            // Only body is draggable for move
            onMouseDown={(e) => {
                // If target is handle, don't drag move
                if ((e.target as HTMLElement).classList.contains('cursor-w-resize') || (e.target as HTMLElement).classList.contains('cursor-e-resize')) return;

                e.stopPropagation();
                onDragStart(id, e.clientX);
            }}
            onClick={(e) => {
                e.stopPropagation(); // Stop prop so timeline doesn't seek
                onClick?.(e);
            }}
        >
            {/* Content */}
            <div className="px-2 py-1 text-[10px] text-white font-medium select-none flex justify-between items-center h-full gap-1">
                <span className="truncate flex-1">{text}</span>

                {/* Speed Badge */}
                <span className={`text-[9px] px-1 rounded font-mono ${speed !== 1 ? 'bg-yellow-400 text-black font-bold' : 'bg-black/30'}`}>
                    {speed.toFixed(2)}x
                </span>

                {/* Fit Audio Button - Shows when speed != 1.0 AND was manually resized */}
                {!isOriginal && speed !== 1.0 && onApplySpeedAdjustment && wasManuallyResized && (
                    <button
                        className="text-[9px] bg-primary-500 hover:bg-primary-600 text-white px-1.5 py-0.5 rounded font-bold transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            onApplySpeedAdjustment?.(id);
                        }}
                        title="Ajustar velocidade do áudio"
                    >
                        ⚡
                    </button>
                )}
            </div>

            {/* Resize Handles */}
            {/* Left Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize z-20 hover:bg-white/20 transition-colors"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart?.(id, 'left', e.clientX);
                }}
            />
            {/* Right Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize z-20 hover:bg-white/20 transition-colors"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart?.(id, 'right', e.clientX);
                }}
            />
        </div>
    );
}
