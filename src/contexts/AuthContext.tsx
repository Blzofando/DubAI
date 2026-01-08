'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Skip if Firebase is not properly initialized
        if (!auth || !auth.app) {
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setUser(user);
                setLoading(false);
            });

            return unsubscribe;
        } catch (error) {
            console.error('Auth state change error:', error);
            setLoading(false);
        }
    }, []);

    const signUp = async (email: string, password: string) => {
        if (!auth || !auth.app) {
            throw new Error('Firebase não configurado. Configure suas chaves de API.');
        }
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            throw new Error(error.message || 'Erro ao criar conta');
        }
    };

    const signIn = async (email: string, password: string) => {
        if (!auth || !auth.app) {
            throw new Error('Firebase não configurado. Configure suas chaves de API.');
        }
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                throw new Error('Email ou senha incorretos');
            }
            throw new Error(error.message || 'Erro ao fazer login');
        }
    };

    const signInWithGoogle = async () => {
        if (!auth || !auth.app) {
            throw new Error('Firebase não configurado. Configure suas chaves de API.');
        }
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            throw new Error(error.message || 'Erro ao fazer login com Google');
        }
    };

    const signOut = async () => {
        if (!auth || !auth.app) {
            throw new Error('Firebase não configurado.');
        }
        try {
            await firebaseSignOut(auth);
        } catch (error: any) {
            throw new Error(error.message || 'Erro ao sair');
        }
    };

    const value = {
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
