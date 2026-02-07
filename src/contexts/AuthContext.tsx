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
    signInAsGuest: () => Promise<void>;
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

        // Safety timeout: If Firebase takes too long (e.g. network blocked), 
        // release the loading state so user can use Guest Mode.
        const safetyTimeout = setTimeout(() => {
            console.warn('Firebase auth timed out - releasing UI for offline mode');
            setLoading(false);
        }, 2000);

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                clearTimeout(safetyTimeout);
                setUser(user);
                setLoading(false);
            });

            return () => {
                clearTimeout(safetyTimeout);
                unsubscribe();
            };
        } catch (error) {
            console.error('Auth state change error:', error);
            clearTimeout(safetyTimeout);
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

    const signInAsGuest = async () => {
        setLoading(true);
        // Create a dummy user object for guest
        const guestUser: any = {
            uid: `guest-${Date.now()}`,
            email: 'guest@offline.local',
            displayName: 'Convidado (Offline)',
            emailVerified: true,
            isAnonymous: true,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => { },
            getIdToken: async () => 'guest-token',
            getIdTokenResult: async () => ({ token: 'guest-token' } as any),
            reload: async () => { },
            toJSON: () => ({})
        };
        setUser(guestUser);
        setLoading(false);
    };

    const signOut = async () => {
        if (user?.isAnonymous && user.email === 'guest@offline.local') {
            setUser(null);
            return;
        }

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
        signInAsGuest,
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
