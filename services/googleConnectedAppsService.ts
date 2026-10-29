/**
 * Google Connected Apps Platform Integration Service
 * References: https://developers.google.com/connected-apps
 * Model Context Protocol (MCP) Bridge
 */

import { getOAuth21Session, saveOAuth21Session } from './oauth21Service';
import { MCP_TOOLS } from './mcpService';

export interface GoogleConnectedAppConfig {
    appId: string;
    appName: string;
    description: string;
    developerEmail: string;
    connectedSince?: string;
    scopes: string[];
    mcpEndpoint: string;
    status: 'connected' | 'disconnected' | 'configuring';
    enabledTools: string[];
}

const CONNECTED_APP_KEY = 'classicflix_google_connected_app';

export const DEFAULT_CONNECTED_APP_CONFIG: GoogleConnectedAppConfig = {
    appId: 'classicflix-mcp-agent-app',
    appName: 'ClassicFlix - Google Connected Apps Platform',
    description: 'Conecta o ecossistema Google Connected Apps e agentes IA com ferramentas de pesquisa em domínio público (Archive.org, Commons, IMDb, TMDB).',
    developerEmail: 'liclopes@gmail.com',
    scopes: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/cloud-platform'
    ],
    mcpEndpoint: typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp',
    status: 'connected',
    enabledTools: [
        'find_movie_video_source',
        'search_and_save_movie_banner',
        'lookup_movie_identifiers',
        'get_public_domain_catalog'
    ]
};

export const getGoogleConnectedAppConfig = (): GoogleConnectedAppConfig => {
    if (typeof window === 'undefined') return DEFAULT_CONNECTED_APP_CONFIG;
    const raw = localStorage.getItem(CONNECTED_APP_KEY);
    if (!raw) return DEFAULT_CONNECTED_APP_CONFIG;
    try {
        return { ...DEFAULT_CONNECTED_APP_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_CONNECTED_APP_CONFIG;
    }
};

export const updateGoogleConnectedAppConfig = (updates: Partial<GoogleConnectedAppConfig>): GoogleConnectedAppConfig => {
    const current = getGoogleConnectedAppConfig();
    const updated = { ...current, ...updates };
    if (typeof window !== 'undefined') {
        localStorage.setItem(CONNECTED_APP_KEY, JSON.stringify(updated));
    }
    return updated;
};

export const testGoogleConnectedAppStatus = async (): Promise<{
    success: boolean;
    mcpReady: boolean;
    oauth21Ready: boolean;
    toolsCount: number;
    message: string;
}> => {
    const session = getOAuth21Session();
    const toolsCount = MCP_TOOLS.length;

    // Verify MCP tools readiness
    const mcpReady = toolsCount >= 4;
    const oauth21Ready = Boolean(session.isAuthenticated || session.accessToken);

    return {
        success: mcpReady,
        mcpReady,
        oauth21Ready,
        toolsCount,
        message: oauth21Ready 
            ? `Google Connected Apps ativo! ${toolsCount} ferramentas MCP prontas para execução sob OAuth 2.1.`
            : `MCP pronto (${toolsCount} ferramentas). Autenticação OAuth 2.1 com Google recomendada para sincronização completa.`
    };
};
