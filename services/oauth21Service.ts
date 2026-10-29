/**
 * OAuth 2.1 Specification Implementation with PKCE (Proof Key for Code Exchange - RFC 7636)
 * Supports Google Identity & Connected Apps Platform
 */

export interface OAuth21Config {
    clientId: string;
    authEndpoint: string;
    tokenEndpoint: string;
    redirectUri: string;
    scopes: string[];
}

export interface OAuth21Session {
    isAuthenticated: boolean;
    accessToken: string | null;
    idToken: string | null;
    expiresAt: number | null;
    userProfile: {
        email?: string;
        name?: string;
        picture?: string;
        sub?: string;
    } | null;
    codeVerifier?: string;
    state?: string;
    connectedAppStatus: 'connected' | 'disconnected' | 'pending';
}

const STORAGE_KEY = 'classicflix_oauth21_session';
const VERIFIER_KEY = 'classicflix_oauth21_pkce_verifier';
const STATE_KEY = 'classicflix_oauth21_state';

// Google OAuth 2.1 Default Configuration
export const DEFAULT_OAUTH21_CONFIG: OAuth21Config = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '18401513977-connected-apps.apps.googleusercontent.com',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/oauth2/callback` : '',
    scopes: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
};

/**
 * Generates high-entropy cryptographic random string for PKCE code_verifier
 */
export const generateCodeVerifier = (length: number = 64): string => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += charset[randomValues[i] % charset.length];
        }
    } else {
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
    }
    return result;
};

/**
 * Computes S256 code_challenge from code_verifier via Web Crypto API SHA-256
 */
export const generateCodeChallenge = async (verifier: string): Promise<string> => {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
        // Fallback Base64 string for non-subtle environments
        return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    
    // Base64URL encode without padding
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

/**
 * Generates random state parameter for CSRF protection
 */
export const generateState = (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Initiates OAuth 2.1 PKCE Authorization Code flow with Google Connected Apps Platform
 */
export const initiateOAuth21Login = async (config: Partial<OAuth21Config> = {}): Promise<string> => {
    const fullConfig: OAuth21Config = { ...DEFAULT_OAUTH21_CONFIG, ...config };
    
    // 1. Generate code_verifier and code_challenge (PKCE requirement in OAuth 2.1)
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // 2. Persist verifier and state in localStorage / sessionStorage
    if (typeof window !== 'undefined') {
        sessionStorage.setItem(VERIFIER_KEY, codeVerifier);
        sessionStorage.setItem(STATE_KEY, state);
    }

    // 3. Construct OAuth 2.1 authorization URL
    const params = new URLSearchParams({
        client_id: fullConfig.clientId,
        redirect_uri: fullConfig.redirectUri,
        response_type: 'code',
        scope: fullConfig.scopes.join(' '),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
        access_type: 'offline',
        prompt: 'consent'
    });

    return `${fullConfig.authEndpoint}?${params.toString()}`;
};

/**
 * Retrieves the stored OAuth 2.1 session
 */
export const getOAuth21Session = (): OAuth21Session => {
    if (typeof window === 'undefined') {
        return { isAuthenticated: false, accessToken: null, idToken: null, expiresAt: null, userProfile: null, connectedAppStatus: 'disconnected' };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return { isAuthenticated: false, accessToken: null, idToken: null, expiresAt: null, userProfile: null, connectedAppStatus: 'disconnected' };
    }
    try {
        return JSON.parse(raw);
    } catch {
        return { isAuthenticated: false, accessToken: null, idToken: null, expiresAt: null, userProfile: null, connectedAppStatus: 'disconnected' };
    }
};

/**
 * Saves or updates OAuth 2.1 session
 */
export const saveOAuth21Session = (session: Partial<OAuth21Session>): OAuth21Session => {
    const current = getOAuth21Session();
    const updated: OAuth21Session = { ...current, ...session };
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
};

/**
 * Logs out / disconnects OAuth 2.1 session
 */
export const clearOAuth21Session = (): void => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
    }
};

/**
 * Mock authorization for demo/sandbox environments when Google Client ID is unconfigured or in preview
 */
export const authorizeOAuth21Demo = (userEmail: string = 'liclopes@gmail.com'): OAuth21Session => {
    const demoSession: OAuth21Session = {
        isAuthenticated: true,
        accessToken: `mcp_oauth21_${Date.now()}_tok_${Math.random().toString(36).substring(2)}`,
        idToken: `id_tok_${Date.now()}`,
        expiresAt: Date.now() + 3600 * 1000 * 24, // 24 hours
        userProfile: {
            email: userEmail,
            name: userEmail.split('@')[0],
            sub: 'google-oauth21-user-123'
        },
        connectedAppStatus: 'connected'
    };
    return saveOAuth21Session(demoSession);
};
