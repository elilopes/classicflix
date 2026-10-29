
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper para obter variáveis de ambiente
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            const val = import.meta.env[`VITE_${key}`] || import.meta.env[key];
            if (val) return val;
        }
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            return process.env[key];
        }
    } catch (e) { }
    return '';
};

const DEFAULT_PROJECT_URL = 'https://rqtlqqmdldpsrtuviedy.supabase.co';
const SUPABASE_URL = getEnv('SUPABASE_URL') || DEFAULT_PROJECT_URL;
const SUPABASE_ANON_KEY = getEnv('SUPABASE_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM";

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = async (): Promise<SupabaseClient | null> => {
    if (supabaseInstance) return supabaseInstance;
    try {
        supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return supabaseInstance;
    } catch (e) {
        console.error("Erro ao inicializar Supabase:", e);
        return null;
    }
};

/**
 * Realiza o login utilizando o Supabase Auth
 */
export const signInUser = async (email: string, senha: string) => {
    const sb = await getSupabase();
    if (!sb) return { data: { user: null }, error: { message: "Erro de conexão" } };

    const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: senha,
    });

    if (error) return { data: { user: null }, error };
    
    return { data: { user: data.user }, error: null };
};

/**
 * Realiza o cadastro no Supabase Auth e replica na tabela public.users
 */
export const signUpUser = async (email: string, senha: string) => {
    const sb = await getSupabase();
    if (!sb) return { data: { user: null }, error: { message: "Erro de conexão" } };

    // 1. Cria o usuário no Auth
    const { data: authData, error: authError } = await sb.auth.signUp({
        email,
        password: senha,
    });

    if (authError) return { data: { user: null }, error: authError };
    if (!authData.user) return { data: { user: null }, error: { message: "Erro ao criar usuário" } };

    // 2. Insere na sua tabela public.users (opcional se você tiver um Trigger no DB)
    // Nota: Como sua tabela pede 'senha', enviamos, mas o Auth já cuida da segurança.
    const { error: dbError } = await sb.from('users').insert([
        { 
            userid: authData.user.id, 
            email: email, 
            senha: senha 
        }
    ]);

    if (dbError) {
        console.warn("Usuário criado no Auth, mas falha ao inserir na tabela pública:", dbError.message);
    }

    return { data: { user: authData.user }, error: null };
};

/**
 * Realiza cadastro e login utilizando Google OAuth 2 (Google Auth)
 */
export const signInWithGoogle = async () => {
    try {
        const { auth, googleProvider, signInWithPopup } = await import('../firebase');
        const userCred = await signInWithPopup(auth, googleProvider);
        const fbUser = userCred.user;

        const googleUser: any = {
            id: fbUser.uid,
            userid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0],
            photoURL: fbUser.photoURL,
            user_metadata: {
                full_name: fbUser.displayName,
                avatar_url: fbUser.photoURL
            },
            provider: 'google'
        };

        // Sincroniza usuário com o banco public.users
        try {
            const sb = await getSupabase();
            if (sb && fbUser.email) {
                await sb.from('users').upsert({
                    userid: fbUser.uid,
                    email: fbUser.email
                }, { onConflict: 'userid' });
            }
        } catch (dbErr) {
            console.warn("Aviso ao sincronizar usuário Google no banco:", dbErr);
        }

        try {
            localStorage.setItem('classicflix_user', JSON.stringify(googleUser));
        } catch (e) {}

        return { data: { user: googleUser }, error: null };
    } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user')) {
            return { data: { user: null }, error: { message: "Login com Google cancelado (janela fechada pelo usuário)." } };
        }
        console.error("Erro no login com Google OAuth 2:", error);
        return { data: { user: null }, error: { message: error.message || "Erro ao conectar com Google." } };
    }
};

export const signOutUser = async () => {
    const sb = await getSupabase();
    if (sb) {
        try { await sb.auth.signOut(); } catch (e) {}
    }
    try {
        const { auth, signOut } = await import('../firebase');
        await signOut(auth);
    } catch (e) {}
    try {
        localStorage.removeItem('classicflix_user');
    } catch (e) {}
    return { error: null };
};

/**
 * Escuta mudanças reais de autenticação do Supabase e Firebase (Google OAuth)
 */
export const subscribeToAuthChanges = async (callback: (user: any | null) => void) => {
    const sb = await getSupabase();

    // Check stored user first
    try {
        const stored = localStorage.getItem('classicflix_user');
        if (stored) {
            callback(JSON.parse(stored));
        }
    } catch (e) {}

    // Listen to Firebase Auth
    let unsubscribeFirebase: (() => void) | null = null;
    try {
        const { auth, onAuthStateChanged } = await import('../firebase');
        unsubscribeFirebase = onAuthStateChanged(auth, (fbUser) => {
            if (fbUser) {
                const u = {
                    id: fbUser.uid,
                    userid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName || fbUser.email?.split('@')[0],
                    photoURL: fbUser.photoURL,
                    user_metadata: {
                        full_name: fbUser.displayName,
                        avatar_url: fbUser.photoURL
                    },
                    provider: 'google'
                };
                try { localStorage.setItem('classicflix_user', JSON.stringify(u)); } catch (e) {}
                callback(u);
            }
        });
    } catch (e) {}

    // Listen to Supabase Auth
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
            callback(session.user);
        }

        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                callback(session.user);
            } else {
                // If not logged in via Supabase, check if Firebase has user
                import('../firebase').then(({ auth }) => {
                    if (!auth.currentUser) {
                        try { localStorage.removeItem('classicflix_user'); } catch (e) {}
                        callback(null);
                    }
                }).catch(() => {
                    callback(null);
                });
            }
        });

        return () => {
            subscription.unsubscribe();
            if (unsubscribeFirebase) unsubscribeFirebase();
        };
    }

    return () => {
        if (unsubscribeFirebase) unsubscribeFirebase();
    };
};

export const getCurrentUser = async () => {
    const sb = await getSupabase();
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) return session.user;
    }
    try {
        const { auth } = await import('../firebase');
        if (auth.currentUser) {
            return {
                id: auth.currentUser.uid,
                userid: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                photoURL: auth.currentUser.photoURL,
                provider: 'google'
            };
        }
    } catch (e) {}
    try {
        const stored = localStorage.getItem('classicflix_user');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
};
