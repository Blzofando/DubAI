'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProjects, deleteProject } from '@/services/projectService';
import type { Project } from '@/types/project';
import { useApp } from '@/contexts/AppContext';
import { FolderOpen, Plus, Trash2, LogOut, Clock, Sun, Moon } from 'lucide-react';

interface ProjectListProps {
    onNewProject: () => void;
    onLoadProject: (project: Project) => void;
}

export default function ProjectList({ onNewProject, onLoadProject }: ProjectListProps) {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useApp();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadProjects();
    }, [user]);

    const loadProjects = async () => {
        if (!user) return;

        setLoading(true);
        setError('');
        try {
            const userProjects = await getUserProjects(user.uid);
            setProjects(userProjects);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user || !confirm('Tem certeza que deseja deletar este projeto?')) return;

        try {
            await deleteProject(projectId, user.uid);
            setProjects(projects.filter(p => p.id !== projectId));
        } catch (err: any) {
            alert('Erro ao deletar projeto: ' + err.message);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8 transition-colors duration-300">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Meus Projetos</h1>
                        <p className="text-gray-600 dark:text-gray-400">Bem-vindo, {user?.email}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <LogOut size={20} />
                            Sair
                        </button>
                    </div>
                </div>

                {/* New Project Button */}
                <button
                    onClick={onNewProject}
                    className="w-full mb-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-3 shadow-lg"
                >
                    <Plus size={24} />
                    Novo Projeto
                </button>

                {/* Projects Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                        {error}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20">
                        <FolderOpen size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Nenhum projeto ainda</h3>
                        <p className="text-gray-500 dark:text-gray-400">Clique em "Novo Projeto" para começar</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => onLoadProject(project)}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer group overflow-hidden border border-transparent hover:border-primary-500/30"
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                                            {project.name}
                                        </h3>
                                        <button
                                            onClick={(e) => handleDelete(project.id, e)}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                            title="Deletar projeto"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 truncate">
                                        {project.sourceFileName}
                                    </p>

                                    <div className="flex items-center text-xs text-gray-500">
                                        <Clock size={14} className="mr-1" />
                                        {formatDate(project.updatedAt)}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                            <span>{project.transcriptSegments?.length || 0} segmentos</span>
                                            <span className="font-semibold text-primary-600">Abrir</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
