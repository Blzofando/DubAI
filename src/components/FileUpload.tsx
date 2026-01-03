'use client';

import React, { useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Upload, FileAudio, FileVideo, X } from 'lucide-react';

export default function FileUpload() {
    const { sourceFile, setSourceFile, stage } = useApp();
    const [dragActive, setDragActive] = React.useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    }, []);

    const handleFile = (file: File) => {
        const validTypes = ['video/mp4', 'audio/mpeg', 'audio/mp3'];
        const validExtensions = ['.mp4', '.mp3'];

        const isValidType = validTypes.includes(file.type) ||
            validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (isValidType) {
            setSourceFile(file);
        } else {
            alert('Por favor, selecione um arquivo MP4 ou MP3');
        }
    };

    const removeFile = () => {
        setSourceFile(null);
    };

    const isDisabled = stage !== 'idle';

    if (sourceFile) {
        const isVideo = sourceFile.type.includes('video') || sourceFile.name.endsWith('.mp4');
        const Icon = isVideo ? FileVideo : FileAudio;
        const sizeInMB = (sourceFile.size / (1024 * 1024)).toFixed(2);

        return (
            <div className="bg-white dark:bg-gray-900 border-2 border-primary-300 dark:border-primary-700 rounded-2xl p-6 shadow-lg transition-colors duration-300">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-xl">
                        <Icon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{sourceFile.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{sizeInMB} MB</p>
                    </div>
                    {!isDisabled && (
                        <button
                            onClick={removeFile}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-red-500 dark:text-red-400" />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative border-3 border-dashed rounded-2xl p-12 transition-all duration-300 ${dragActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-gray-800'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                type="file"
                accept=".mp4,.mp3,video/mp4,audio/mpeg"
                onChange={handleChange}
                disabled={isDisabled}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />

            <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
                <div className="p-4 bg-primary-100 dark:bg-primary-900/30 rounded-2xl">
                    <Upload className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                </div>

                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                        Arraste seu arquivo aqui
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        ou clique para selecionar
                    </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                        <FileVideo className="w-4 h-4" />
                        MP4
                    </div>
                    <div className="flex items-center gap-2">
                        <FileAudio className="w-4 h-4" />
                        MP3
                    </div>
                </div>
            </div>
        </div>
    );
}
