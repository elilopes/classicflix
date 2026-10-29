/**
 * Model Context Protocol (MCP) Server & Client Implementation
 * Protocol Version: 2024-11-05
 * Spec: JSON-RPC 2.0 over HTTP or in-process
 */

import { findAndSaveMovieVideoSource, fetchMovieIdentifiers, SearchVideoResult } from './videoSourceService';
import { findAndSaveMovieBannerOrPoster, BannerSearchResult } from './bannerService';
import { Movie } from '../types';
import { getSupabase } from './bd';

export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description?: string;
            enum?: string[];
        }>;
        required?: string[];
    };
}

export interface McpResourceDefinition {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

export interface McpServerCapabilities {
    tools: {
        listChanged?: boolean;
    };
    resources: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: Record<string, any>;
}

export interface McpJsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}

export interface McpJsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// Registered MCP Tools
export const MCP_TOOLS: McpToolDefinition[] = [
    {
        name: 'find_movie_video_source',
        description: 'Pesquisa se o filme existe no Internet Archive (Archive.org) ou Wikimedia Commons usando APIs oficiais e Wikidata IDs (Archive ID P724/P1170, IMDb ID P345, TMDB IDs P4985/P272, Commons P10). Extrai o link direto de streaming de vídeo e salva no banco de dados para vincular ao botão play.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título do filme' },
                originalTitle: { type: 'string', description: 'Título original do filme' },
                year: { type: 'number', description: 'Ano de lançamento da obra' },
                wikidataId: { type: 'string', description: 'Identificador QID do Wikidata (ex: Q12345)' },
                archiveId: { type: 'string', description: 'Identificador do Internet Archive (se conhecido)' },
                imdbId: { type: 'string', description: 'Identificador do IMDb (ex: tt0012345)' }
            },
            required: ['title']
        }
    },
    {
        name: 'search_and_save_movie_banner',
        description: 'Pesquisa imagem de poster ou banner nos repositórios Archive.org, Wikimedia Commons, IMDb (OMDb) e TMDB via APIs. Realiza o download para a pasta local banner e atualiza o registro do filme no banco de dados.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título do filme' },
                year: { type: 'number', description: 'Ano do filme' },
                wikidataId: { type: 'string', description: 'QID do Wikidata' },
                imdbId: { type: 'string', description: 'IMDb ID' },
                tmdbId: { type: 'string', description: 'TMDB ID' },
                archiveId: { type: 'string', description: 'Archive.org Item ID' }
            },
            required: ['title']
        }
    },
    {
        name: 'lookup_movie_identifiers',
        description: 'Consulta o grafo de conhecimento Wikidata via SPARQL para resolver múltiplos identificadores externos (Internet Archive ID, IMDb ID, TMDB Movie ID, TMDB Production Company ID, Wikimedia Commons video e YouTube).',
        inputSchema: {
            type: 'object',
            properties: {
                qid: { type: 'string', description: 'Identificador QID do Wikidata (ex: Q13084)' }
            },
            required: ['qid']
        }
    },
    {
        name: 'get_public_domain_catalog',
        description: 'Lista produções de domínio público do catálogo com status de disponibilidade de vídeo e banners salvos.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Limite de filmes a retornar (padrão 20)' },
                hasVideoOnly: { type: 'string', description: 'Filtrar apenas filmes com vídeo ativo (true/false)' }
            }
        }
    }
];

// Registered MCP Resources
export const MCP_RESOURCES: McpResourceDefinition[] = [
    {
        uri: 'classicflix://catalog/movies',
        name: 'Public Domain Movies Catalog',
        description: 'Acervo de produções cinematográficas em domínio público com identificadores e links diretos',
        mimeType: 'application/json'
    },
    {
        uri: 'classicflix://assets/banners',
        name: 'Banner Directory Manifest',
        description: 'Diretório e manifestos de posters e banners baixados localmente',
        mimeType: 'application/json'
    }
];

/**
 * Executes a tool invocation complying with MCP Specification
 */
export const executeMcpTool = async (
    toolName: string, 
    args: Record<string, any>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> => {
    try {
        switch (toolName) {
            case 'find_movie_video_source': {
                const dummyMovie: Movie = {
                    id: args.movieId || `mcp-${Date.now()}`,
                    title: args.title,
                    originalTitle: args.originalTitle || args.title,
                    description: '',
                    genres: [],
                    year: Number(args.year) || 0,
                    language: 'en',
                    hasSubtitles: false,
                    posterUrl: '',
                    videoUrl: null,
                    rating: '',
                    duration: '',
                    director: '',
                    type: 'Movie',
                    wikidataId: args.wikidataId,
                    identifiers: {
                        archiveId: args.archiveId,
                        imdbId: args.imdbId
                    }
                };
                const result: SearchVideoResult = await findAndSaveMovieVideoSource(dummyMovie);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }],
                    isError: !result.success
                };
            }

            case 'search_and_save_movie_banner': {
                const dummyMovie: Movie = {
                    id: args.movieId || `mcp-banner-${Date.now()}`,
                    title: args.title,
                    originalTitle: args.title,
                    description: '',
                    genres: [],
                    year: Number(args.year) || 0,
                    language: 'en',
                    hasSubtitles: false,
                    posterUrl: '',
                    videoUrl: null,
                    rating: '',
                    duration: '',
                    director: '',
                    type: 'Movie',
                    wikidataId: args.wikidataId,
                    identifiers: {
                        archiveId: args.archiveId,
                        imdbId: args.imdbId,
                        tmdbId: args.tmdbId
                    }
                };
                const result: BannerSearchResult = await findAndSaveMovieBannerOrPoster(dummyMovie);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }],
                    isError: !result.success
                };
            }

            case 'lookup_movie_identifiers': {
                const qid = args.qid;
                if (!qid) {
                    throw new Error("Parâmetro 'qid' é obrigatório (ex: Q13084).");
                }
                const ids = await fetchMovieIdentifiers(qid);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ qid, identifiers: ids }, null, 2)
                    }]
                };
            }

            case 'get_public_domain_catalog': {
                const supabase = await getSupabase();
                let movies: any[] = [];
                if (supabase) {
                    const query = supabase.from('movies').select('id, title, wikidataid, year, director, videourl, posterurl').limit(args.limit || 20);
                    const { data } = await query;
                    movies = data || [];
                }
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ count: movies.length, movies }, null, 2)
                    }]
                };
            }

            default:
                throw new Error(`MCP Tool '${toolName}' not found in registry.`);
        }
    } catch (err: any) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({ error: err.message || 'Tool execution failed' }, null, 2)
            }],
            isError: true
        };
    }
};

/**
 * Handles incoming JSON-RPC 2.0 MCP requests
 */
export const handleMcpJsonRpcRequest = async (request: McpJsonRpcRequest): Promise<McpJsonRpcResponse> => {
    const { id, method, params } = request;

    switch (method) {
        case 'initialize':
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false },
                        resources: { subscribe: false, listChanged: false }
                    },
                    serverInfo: {
                        name: 'classicflix-mcp-server',
                        version: '1.0.0'
                    }
                }
            };

        case 'tools/list':
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    tools: MCP_TOOLS
                }
            };

        case 'tools/call':
            if (!params || !params.name) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32602, message: 'Invalid params: missing tool name' }
                };
            }
            const executionResult = await executeMcpTool(params.name, params.arguments || {});
            return {
                jsonrpc: '2.0',
                id,
                result: executionResult
            };

        case 'resources/list':
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    resources: MCP_RESOURCES
                }
            };

        case 'ping':
            return {
                jsonrpc: '2.0',
                id,
                result: { status: 'ok', timestamp: Date.now() }
            };

        default:
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method '${method}' not found` }
            };
    }
};
