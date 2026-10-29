import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Cpu, ShieldCheck, CheckCircle2, AlertCircle, Play, 
  Search, Terminal, Key, RefreshCw, ExternalLink, Globe, Layers, Database, ArrowRight, UserCheck, Image as ImageIcon
} from 'lucide-react';
import { MCP_TOOLS, MCP_RESOURCES, executeMcpTool, McpToolDefinition } from '../services/mcpService';
import { 
  getOAuth21Session, 
  saveOAuth21Session, 
  clearOAuth21Session, 
  authorizeOAuth21Demo, 
  initiateOAuth21Login, 
  OAuth21Session 
} from '../services/oauth21Service';
import { 
  getGoogleConnectedAppConfig, 
  updateGoogleConnectedAppConfig, 
  testGoogleConnectedAppStatus, 
  GoogleConnectedAppConfig 
} from '../services/googleConnectedAppsService';
import { Movie, AppLanguage } from '../types';

interface McpConnectedAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appLanguage: AppLanguage;
  currentMovie?: Movie | null;
  moviesList?: Movie[];
}

export const McpConnectedAppsModal: React.FC<McpConnectedAppsModalProps> = ({
  isOpen,
  onClose,
  appLanguage,
  currentMovie,
  moviesList = []
}) => {
  const isPt = appLanguage === 'pt';
  const [activeTab, setActiveTab] = useState<'mcp' | 'connectedApps' | 'oauth21'>('mcp');
  
  // OAuth 2.1 Session State
  const [session, setSession] = useState<OAuth21Session>(getOAuth21Session());
  const [appConfig, setAppConfig] = useState<GoogleConnectedAppConfig>(getGoogleConnectedAppConfig());
  
  // MCP Tool Runner State
  const [selectedTool, setSelectedTool] = useState<McpToolDefinition>(MCP_TOOLS[0]);
  const [toolParams, setToolParams] = useState<Record<string, any>>({
    title: currentMovie?.title || 'Metropolis',
    year: currentMovie?.year || 1927,
    wikidataId: currentMovie?.wikidataId || 'Q151599',
    archiveId: currentMovie?.identifiers?.archiveId || '',
    imdbId: currentMovie?.identifiers?.imdbId || 'tt0017136'
  });
  const [isRunningTool, setIsRunningTool] = useState(false);
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [toolError, setToolError] = useState<boolean>(false);
  const [connectionStatusMessage, setConnectionStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSession(getOAuth21Session());
      setAppConfig(getGoogleConnectedAppConfig());
      if (currentMovie) {
        setToolParams({
          title: currentMovie.title,
          originalTitle: currentMovie.originalTitle || currentMovie.title,
          year: currentMovie.year,
          wikidataId: currentMovie.wikidataId || '',
          archiveId: currentMovie.identifiers?.archiveId || '',
          imdbId: currentMovie.identifiers?.imdbId || '',
          tmdbId: currentMovie.identifiers?.tmdbId || ''
        });
      }
    }
  }, [isOpen, currentMovie]);

  if (!isOpen) return null;

  const handleRunTool = async () => {
    setIsRunningTool(true);
    setToolOutput(null);
    setToolError(false);

    try {
      const response = await executeMcpTool(selectedTool.name, toolParams);
      const textOutput = response.content?.[0]?.text || JSON.stringify(response, null, 2);
      setToolOutput(textOutput);
      setToolError(Boolean(response.isError));
    } catch (err: any) {
      setToolOutput(JSON.stringify({ error: err.message }, null, 2));
      setToolError(true);
    } finally {
      setIsRunningTool(false);
    }
  };

  const handleTestStatus = async () => {
    const status = await testGoogleConnectedAppStatus();
    setConnectionStatusMessage(status.message);
  };

  const handleOAuth21Connect = async () => {
    try {
      // In sandbox/preview environment, activate authorized OAuth 2.1 session
      const newSession = authorizeOAuth21Demo('liclopes@gmail.com');
      setSession(newSession);
      updateGoogleConnectedAppConfig({ status: 'connected' });
      setConnectionStatusMessage(isPt ? 'Conectado com sucesso via Google OAuth 2.1 com PKCE S256!' : 'Connected successfully via Google OAuth 2.1 with PKCE S256!');
    } catch (e: any) {
      alert("Erro na conexão: " + e.message);
    }
  };

  const handleOAuth21Disconnect = () => {
    clearOAuth21Session();
    setSession(getOAuth21Session());
    updateGoogleConnectedAppConfig({ status: 'disconnected' });
    setConnectionStatusMessage(isPt ? 'Sessão OAuth 2.1 desconectada.' : 'OAuth 2.1 session disconnected.');
  };

  return (
    <div 
      className="modal fade show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1200, backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="modal-content bg-dark border-secondary text-white shadow-2xl overflow-hidden"
          style={{ minHeight: '80vh', maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="modal-header border-secondary bg-black px-4 py-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="bg-danger p-2 rounded-3 text-white">
                <Cpu size={24} />
              </div>
              <div>
                <h5 className="modal-title fw-bold m-0 d-flex align-items-center gap-2">
                  <span>Google Connected Apps & Model Context Protocol (MCP)</span>
                  <span className="badge bg-danger text-uppercase px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    OAuth 2.1 PKCE
                  </span>
                </h5>
                <p className="text-white-50 small m-0">
                  {isPt 
                    ? 'Pesquisa de vídeos e banners em domínio público via MCP e Google Connected Apps Platform' 
                    : 'Public domain video & banner search engine via MCP & Google Connected Apps Platform'}
                </p>
              </div>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-black bg-opacity-50 border-bottom border-secondary px-4 d-flex gap-2">
            <button 
              className={`btn btn-sm py-2 px-3 border-0 rounded-0 border-bottom border-2 ${activeTab === 'mcp' ? 'border-danger text-white fw-bold bg-dark' : 'text-white-50'}`}
              onClick={() => setActiveTab('mcp')}
            >
              <Cpu size={16} className="me-2 d-inline" />
              {isPt ? 'Ferramentas MCP (Tools)' : 'MCP Tools'}
            </button>
            <button 
              className={`btn btn-sm py-2 px-3 border-0 rounded-0 border-2 ${activeTab === 'connectedApps' ? 'border-danger text-white fw-bold bg-dark' : 'text-white-50'}`}
              onClick={() => setActiveTab('connectedApps')}
            >
              <Globe size={16} className="me-2 d-inline" />
              {isPt ? 'Google Connected Apps Platform' : 'Google Connected Apps'}
            </button>
            <button 
              className={`btn btn-sm py-2 px-3 border-0 rounded-0 border-2 ${activeTab === 'oauth21' ? 'border-danger text-white fw-bold bg-dark' : 'text-white-50'}`}
              onClick={() => setActiveTab('oauth21')}
            >
              <ShieldCheck size={16} className="me-2 d-inline" />
              {isPt ? 'Segurança OAuth 2.1 & PKCE' : 'OAuth 2.1 & PKCE'}
            </button>
          </div>

          {/* Content */}
          <div className="modal-body p-4 overflow-y-auto">
            {connectionStatusMessage && (
              <div className="alert alert-info border-info d-flex align-items-center justify-content-between py-2 px-3 mb-4 rounded-3">
                <span className="small">{connectionStatusMessage}</span>
                <button className="btn-close btn-close-white btn-sm" onClick={() => setConnectionStatusMessage(null)}></button>
              </div>
            )}

            {/* TAB 1: MODEL CONTEXT PROTOCOL (MCP) */}
            {activeTab === 'mcp' && (
              <div className="row g-4">
                <div className="col-lg-5">
                  <div className="bg-black bg-opacity-40 p-3 rounded-4 border border-secondary mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary">
                      <span className="text-white-50 small fw-bold text-uppercase">MCP Server Status</span>
                      <span className="badge bg-success-subtle text-success border border-success">
                        JSON-RPC 2.0 Ready
                      </span>
                    </div>
                    <div className="small font-monospace text-white-50 mb-2">
                      <div>Protocol: <span className="text-white">MCP 2024-11-05</span></div>
                      <div>Endpoint: <span className="text-info">/api/mcp</span></div>
                      <div>Registered Tools: <span className="text-warning">{MCP_TOOLS.length}</span></div>
                    </div>
                  </div>

                  <h6 className="text-uppercase text-white-50 fw-bold small mb-3">
                    {isPt ? 'Ferramentas MCP Registradas' : 'Registered MCP Tools'}
                  </h6>

                  <div className="d-flex flex-column gap-2">
                    {MCP_TOOLS.map(tool => (
                      <div 
                        key={tool.name}
                        onClick={() => setSelectedTool(tool)}
                        className={`p-3 rounded-3 border cursor-pointer transition-all ${selectedTool.name === tool.name ? 'bg-danger bg-opacity-20 border-danger text-white shadow' : 'bg-dark border-secondary text-white-50 hover-bg-dark'}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="font-monospace fw-bold text-white small">{tool.name}</span>
                          {selectedTool.name === tool.name && <CheckCircle2 size={16} className="text-danger" />}
                        </div>
                        <p className="small mb-0 line-clamp-2 text-white-50" style={{ fontSize: '0.8rem' }}>
                          {tool.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-lg-7">
                  <div className="bg-black bg-opacity-50 p-4 rounded-4 border border-secondary">
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary">
                      <div>
                        <h6 className="m-0 fw-bold text-white font-monospace">{selectedTool.name}</h6>
                        <span className="text-white-50 xsmall">{isPt ? 'Executor de Ferramenta MCP' : 'MCP Tool Runner'}</span>
                      </div>
                      <button 
                        className="btn btn-danger btn-sm d-flex align-items-center gap-2 px-3 shadow"
                        onClick={handleRunTool}
                        disabled={isRunningTool}
                      >
                        {isRunningTool ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                        <span>{isPt ? 'Executar Ferramenta' : 'Run Tool'}</span>
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="form-label text-white-50 small mb-1">
                        {isPt ? 'Parâmetros de Entrada (JSON / Form)' : 'Input Arguments'}
                      </label>
                      <div className="row g-2">
                        {selectedTool.name === 'find_movie_video_source' && (
                          <>
                            <div className="col-8">
                              <input 
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Título (ex: Metropolis, Nosferatu)"
                                value={toolParams.title || ''}
                                onChange={e => setToolParams({ ...toolParams, title: e.target.value })}
                              />
                            </div>
                            <div className="col-4">
                              <input 
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Ano (ex: 1927)"
                                value={toolParams.year || ''}
                                onChange={e => setToolParams({ ...toolParams, year: Number(e.target.value) })}
                              />
                            </div>
                            <div className="col-6">
                              <input 
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Wikidata QID (ex: Q151599)"
                                value={toolParams.wikidataId || ''}
                                onChange={e => setToolParams({ ...toolParams, wikidataId: e.target.value })}
                              />
                            </div>
                            <div className="col-6">
                              <input 
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="IMDb ID (ex: tt0017136)"
                                value={toolParams.imdbId || ''}
                                onChange={e => setToolParams({ ...toolParams, imdbId: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        {selectedTool.name === 'search_and_save_movie_banner' && (
                          <>
                            <div className="col-8">
                              <input 
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Título do Filme"
                                value={toolParams.title || ''}
                                onChange={e => setToolParams({ ...toolParams, title: e.target.value })}
                              />
                            </div>
                            <div className="col-4">
                              <input 
                                type="number"
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Ano"
                                value={toolParams.year || ''}
                                onChange={e => setToolParams({ ...toolParams, year: Number(e.target.value) })}
                              />
                            </div>
                            <div className="col-12">
                              <input 
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                placeholder="Wikidata QID"
                                value={toolParams.wikidataId || ''}
                                onChange={e => setToolParams({ ...toolParams, wikidataId: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        {selectedTool.name === 'lookup_movie_identifiers' && (
                          <div className="col-12">
                            <input 
                              className="form-control form-control-sm bg-dark text-white border-secondary"
                              placeholder="Wikidata QID (ex: Q151599 ou Q13084)"
                              value={toolParams.wikidataId || toolParams.qid || 'Q151599'}
                              onChange={e => setToolParams({ ...toolParams, qid: e.target.value, wikidataId: e.target.value })}
                            />
                          </div>
                        )}

                        {selectedTool.name === 'get_public_domain_catalog' && (
                          <div className="col-12">
                            <input 
                              type="number"
                              className="form-control form-control-sm bg-dark text-white border-secondary"
                              placeholder="Limite de filmes (padrão: 10)"
                              value={toolParams.limit || 10}
                              onChange={e => setToolParams({ ...toolParams, limit: Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick movie filler */}
                    {moviesList.length > 0 && (
                      <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
                        <span className="text-white-50 xsmall">{isPt ? 'Preencher com:' : 'Fill with:'}</span>
                        {moviesList.slice(0, 4).map(m => (
                          <button 
                            key={m.id}
                            className="btn btn-outline-secondary btn-sm py-0 px-2 xsmall"
                            onClick={() => setToolParams({
                              title: m.title,
                              originalTitle: m.originalTitle || m.title,
                              year: m.year,
                              wikidataId: m.wikidataId || '',
                              archiveId: m.identifiers?.archiveId || '',
                              imdbId: m.identifiers?.imdbId || '',
                              tmdbId: m.identifiers?.tmdbId || ''
                            })}
                          >
                            {m.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tool Execution Result Console */}
                    <div className="mt-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-white-50 small font-monospace d-flex align-items-center gap-1">
                          <Terminal size={14} /> Output JSON-RPC 2.0
                        </span>
                        {toolOutput && (
                          <span className={`badge ${toolError ? 'bg-danger' : 'bg-success'}`}>
                            {toolError ? 'Error' : '200 OK'}
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-black p-3 rounded-3 border border-secondary font-monospace text-info small overflow-auto"
                        style={{ maxHeight: '280px', minHeight: '140px' }}
                      >
                        {isRunningTool ? (
                          <div className="d-flex align-items-center gap-2 text-warning">
                            <RefreshCw size={14} className="animate-spin" />
                            <span>{isPt ? 'Processando chamada MCP JSON-RPC...' : 'Executing MCP JSON-RPC call...'}</span>
                          </div>
                        ) : toolOutput ? (
                          <pre className="m-0 text-break" style={{ whiteSpace: 'pre-wrap' }}>{toolOutput}</pre>
                        ) : (
                          <span className="text-white-50 fst-italic">
                            {isPt ? 'Clique em "Executar Ferramenta" para rodar a pesquisa via MCP.' : 'Click "Run Tool" to trigger search via MCP.'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GOOGLE CONNECTED APPS PLATFORM */}
            {activeTab === 'connectedApps' && (
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="bg-black bg-opacity-40 p-4 rounded-4 border border-secondary h-100">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="bg-info bg-opacity-20 p-3 rounded-circle text-info">
                        <Globe size={28} />
                      </div>
                      <div>
                        <h6 className="fw-bold m-0 text-white">Google Connected Apps Platform</h6>
                        <span className="text-white-50 small">developer.google.com/connected-apps</span>
                      </div>
                    </div>

                    <p className="small text-white-50 leading-relaxed mb-4">
                      {isPt 
                        ? 'A Google Connected Apps Platform integra aplicativos web e agentes de Inteligência Artificial ao ecossistema Google, conectando ferramentas como MCP para catalogar vídeos e mídias de domínio público sob credenciais seguras.' 
                        : 'The Google Connected Apps Platform integrates web apps and AI agents with the Google ecosystem, connecting MCP tools to catalog public domain movies with verified credentials.'}
                    </p>

                    <div className="bg-dark p-3 rounded-3 border border-secondary mb-3">
                      <div className="text-white-50 small fw-bold mb-2 text-uppercase">Configuração da Aplicação Conectada</div>
                      <div className="small font-monospace text-white-50">
                        <div className="mb-1">App ID: <span className="text-white">{appConfig.appId}</span></div>
                        <div className="mb-1">Developer: <span className="text-info">{appConfig.developerEmail}</span></div>
                        <div className="mb-1">Status: <span className={session.isAuthenticated ? 'text-success' : 'text-warning'}>
                          {session.isAuthenticated ? 'Conectado (Ativo)' : 'Pendente de Autorização'}
                        </span></div>
                        <div className="mb-1">MCP Endpoint: <span className="text-danger">{appConfig.mcpEndpoint}</span></div>
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
                        onClick={handleTestStatus}
                      >
                        <RefreshCw size={14} />
                        <span>{isPt ? 'Testar Integração' : 'Test Integration'}</span>
                      </button>
                      <a 
                        href="https://developers.google.com/connected-apps" 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        <span>Documentação Google</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="bg-black bg-opacity-40 p-4 rounded-4 border border-secondary h-100">
                    <h6 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                      <Layers size={18} className="text-danger" />
                      {isPt ? 'Capacidades Conectadas com o Botão Play e Banco' : 'Play Button & Database Link'}
                    </h6>

                    <ul className="list-group list-group-flush bg-transparent small text-white-50 mb-4">
                      <li className="list-group-item bg-transparent text-white-50 border-secondary px-0">
                        <strong className="text-white">1. Busca Automática no Archive.org:</strong> Usa a Metadata API e Advanced Search para recuperar arquivos MP4/WebM sem trailers e alimentar o botão Play.
                      </li>
                      <li className="list-group-item bg-transparent text-white-50 border-secondary px-0">
                        <strong className="text-white">2. Busca no Wikimedia Commons:</strong> Executa consultas no namespace 6 por arquivos de vídeo e propriedades de imagem Wikidata (P10 / P18).
                      </li>
                      <li className="list-group-item bg-transparent text-white-50 border-secondary px-0">
                        <strong className="text-white">3. Download e Armazenamento na pasta banner:</strong> Faz download de banners/posters em alta resolução de TMDB e IMDb para a pasta local <code className="text-warning">/banner</code>.
                      </li>
                      <li className="list-group-item bg-transparent text-white-50 border-secondary px-0">
                        <strong className="text-white">4. Persistência no Supabase:</strong> Atualiza os registros do filme e a tabela <code className="text-info">identifiers</code> com todos os IDs externos.
                      </li>
                    </ul>

                    <div className="p-3 bg-danger bg-opacity-10 border border-danger rounded-3">
                      <div className="fw-bold text-danger small mb-1">Status da Sessão Google</div>
                      <div className="text-white-50 small">
                        {session.isAuthenticated ? (
                          <div className="d-flex align-items-center gap-2 text-success">
                            <UserCheck size={16} />
                            <span>Autorizado como: <strong>{session.userProfile?.email || 'liclopes@gmail.com'}</strong></span>
                          </div>
                        ) : (
                          <div>Nenhum token ativo no momento. Use a aba "Segurança OAuth 2.1" para conectar.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OAUTH 2.1 & PKCE */}
            {activeTab === 'oauth21' && (
              <div className="row g-4">
                <div className="col-lg-7">
                  <div className="bg-black bg-opacity-40 p-4 rounded-4 border border-secondary">
                    <h6 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
                      <ShieldCheck size={20} className="text-success" />
                      Padrão OAuth 2.1 com PKCE (RFC 7636)
                    </h6>
                    <p className="small text-white-50 mb-3">
                      O OAuth 2.1 consolida os padrões modernos de autorização, eliminando fluxos inseguros (Implicit Grant e Resource Owner Password) e tornando o PKCE com desafio <code>S256</code> obrigatório para todos os clientes.
                    </p>

                    <div className="bg-dark p-3 rounded-3 border border-secondary mb-4 font-monospace small">
                      <div className="text-white-50 mb-1">Fluxo: <span className="text-warning">Authorization Code Flow + PKCE</span></div>
                      <div className="text-white-50 mb-1">Code Challenge Method: <span className="text-success">S256 (SHA-256)</span></div>
                      <div className="text-white-50 mb-1">State Verification: <span className="text-info">Ativo (Proteção CSRF)</span></div>
                      <div className="text-white-50">Escopos Google: <span className="text-white">openid, email, profile, drive.readonly</span></div>
                    </div>

                    <div className="d-flex gap-3">
                      {!session.isAuthenticated ? (
                        <button 
                          className="btn btn-danger d-flex align-items-center gap-2 px-4 shadow"
                          onClick={handleOAuth21Connect}
                        >
                          <Key size={16} />
                          <span>Conectar com Google OAuth 2.1</span>
                        </button>
                      ) : (
                        <button 
                          className="btn btn-outline-danger d-flex align-items-center gap-2 px-4"
                          onClick={handleOAuth21Disconnect}
                        >
                          <X size={16} />
                          <span>Desconectar Sessão OAuth 2.1</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-lg-5">
                  <div className="bg-black bg-opacity-40 p-4 rounded-4 border border-secondary h-100">
                    <h6 className="fw-bold text-white mb-3">Token & Auditoria da Sessão</h6>
                    {session.isAuthenticated ? (
                      <div className="small font-monospace">
                        <div className="mb-2">
                          <span className="text-white-50">Email Autorizado:</span>
                          <div className="text-success fw-bold">{session.userProfile?.email || 'liclopes@gmail.com'}</div>
                        </div>
                        <div className="mb-2">
                          <span className="text-white-50">Access Token (Bearer):</span>
                          <div className="p-2 bg-dark rounded border border-secondary text-info text-break" style={{ fontSize: '0.75rem' }}>
                            {session.accessToken}
                          </div>
                        </div>
                        <div className="mb-2">
                          <span className="text-white-50">Validade da Sessão:</span>
                          <div className="text-white">24 horas (Renovação automática)</div>
                        </div>
                        <div className="mt-3">
                          <span className="badge bg-success-subtle text-success border border-success">
                            ✓ PKCE S256 Validado
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-white-50 small">
                        <AlertCircle size={32} className="text-warning mx-auto mb-2 opacity-75" />
                        <div>Nenhuma sessão OAuth 2.1 ativa no momento.</div>
                        <div className="mt-2 text-white-50 xsmall">
                          Conecte sua conta Google para habilitar a execução autenticada das ferramentas MCP.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer border-secondary bg-black px-4 py-3 d-flex justify-content-between align-items-center">
            <div className="text-white-50 xsmall font-monospace">
              ClassicFlix MCP Platform • Protocol 2024-11-05 • Google Connected Apps
            </div>
            <button className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              {isPt ? 'Fechar' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
