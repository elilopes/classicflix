import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Helper to safely get env vars
const getEnv = (key: string) => {
    try {
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
const SUPABASE_ANON_KEY = getEnv('SUPABASE_KEY') || "sb_publishable_RlRo90yTFcbRMecuoIdXUQ_LX2Z_yz1";

// Singleton promise to hold the client
let supabasePromise: Promise<SupabaseClient | null> | null = null;

// --- MOCK CLIENT (Offline/Fallback Mode) ---
const createMockClient = (): any => {
    console.warn("⚠️ USING MOCK SUPABASE CLIENT (Offline/Fallback Mode)");
    
    const mockQueryBuilder = {
        select: () => mockQueryBuilder,
        insert: () => Promise.resolve({ error: { message: "Offline Mode: Cannot insert" } }),
        update: () => mockQueryBuilder,
        upsert: () => Promise.resolve({ error: { message: "Offline Mode: Cannot upsert" } }),
        delete: () => Promise.resolve({ error: { message: "Offline Mode: Cannot delete" } }),
        eq: () => mockQueryBuilder,
        limit: () => Promise.resolve({ data: [], error: null }),
        range: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: { message: "Offline" } }),
        order: () => mockQueryBuilder,
        then: (resolve: any) => resolve({ data: [], error: null }) 
    };

    return {
        from: (table: string) => mockQueryBuilder,
        auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
            signInWithPassword: async () => ({ data: { user: null }, error: { message: "Offline Mode: Service Unavailable" } }),
            signUp: async () => ({ data: { user: null }, error: { message: "Offline Mode: Service Unavailable" } }),
            signOut: async () => ({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        }
    };
};

/**
 * Initializes and returns the Supabase Client connection.
 */
export const getSupabase = (): Promise<SupabaseClient | null> => {
    if (supabasePromise) return supabasePromise;

    supabasePromise = (async () => {
        try {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                return createMockClient();
            }
            return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (e) {
            console.error("CRITICAL: Failed to initialize Supabase. Falling back to Mock.", e);
            return createMockClient();
        }
    })();

    return supabasePromise;
};

// --- AUTHENTICATION SERVICES ---

export const signInUser = async (email: string, password: string) => {
    try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Client init failure");
        return sb.auth.signInWithPassword({ email, password });
    } catch(e) {
        return { data: { user: null }, error: { message: "Service Unavailable (Offline)" } };
    }
};

export const signUpUser = async (email: string, password: string) => {
    try {
        const sb = await getSupabase();
        if (!sb) throw new Error("Client init failure");
        return sb.auth.signUp({ email, password });
    } catch(e) {
        return { data: { user: null }, error: { message: "Service Unavailable (Offline)" } };
    }
};

export const signOutUser = async () => {
    try {
        const sb = await getSupabase();
        if (sb) await sb.auth.signOut();
    } catch(e) {}
};

export const subscribeToAuthChanges = async (callback: (user: User | null) => void) => {
    try {
        const sb = await getSupabase();
        if (!sb) {
            callback(null);
            return () => {};
        }

        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            callback(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    } catch(e) {
        callback(null);
        return () => {};
    }
};

export const getCurrentUser = async () => {
    try {
        const sb = await getSupabase();
        if (!sb) return null;
        const { data: { user } } = await sb.auth.getUser();
        return user;
    } catch(e) { return null; }
};