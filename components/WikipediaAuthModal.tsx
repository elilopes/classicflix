import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Loader2, KeyRound, CheckCircle, UserCheck, ShieldCheck } from 'lucide-react';
import {
  verifyWikipediaUser,
  WikipediaUser,
  saveWikipediaUser,
  getWikipediaAuthUrl,
  getWikipediaOAuthStatus,
  WikipediaOAuthStatus
} from '../services/wikipediaAuthService';
import { AppLanguage } from '../types';

interface WikipediaAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: WikipediaUser) => void;
  appLanguage?: AppLanguage;
  authUrlData?: {
    configured: boolean;
    hasClientId?: boolean;
    hasClientSecret?: boolean;
    url?: string;
    setupUrl?: string;
    redirectUri?: string;
    devCallbackUrl?: string;
    sharedCallbackUrl?: string;
  } | null;
}

export const WikipediaAuthModal: React.FC<WikipediaAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appLanguage = 'pt',
  authUrlData
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<WikipediaUser | null>(null);
  const [oauthStatus, setOauthStatus] = useState<WikipediaOAuthStatus | null>(null);

  const isPt = appLanguage === 'pt';

  useEffect(() => {
    if (!isOpen) return;
    getWikipediaOAuthStatus()
      .then(setOauthStatus)
      .catch(() => {});
  }, [isOpen]);

  const isOAuthConfigured = oauthStatus?.configured ?? authUrlData?.configured ?? false;
  const hasClientId = oauthStatus?.hasClientId ?? authUrlData?.hasClientId ?? false;
  const hasClientSecret = oauthStatus?.hasClientSecret ?? authUrlData?.hasClientSecret ?? false;

  const devUrl =
    oauthStatus?.devCallbackUrl ||
    authUrlData?.devCallbackUrl ||
    'https://ais-dev-rketbkfc2ioywj5ptq55cf-18401513977.us-west1.run.app/auth/wikipedia/callback';
  const sharedUrl =
    oauthStatus?.sharedCallbackUrl ||
    authUrlData?.sharedCallbackUrl ||
    'https://ais-pre-rketbkfc2ioywj5ptq55cf-18401513977.us-west1.run.app/auth/wikipedia/callback';

  const handleLaunchOAuthPopup = async () => {
    setOauthLoading(true);
    setError(null);
    try {
      const freshUrl = await getWikipediaAuthUrl();
      if (!freshUrl.configured || !freshUrl.url) {
        setError(
          freshUrl.message ||
            (isPt
              ? 'WIKIPEDIA_CLIENT_ID e WIKIPEDIA_CLIENT_SECRET ainda precisam estar configurados em Settings > Secrets.'
              : 'WIKIPEDIA_CLIENT_ID and WIKIPEDIA_CLIENT_SECRET must be configured in Settings > Secrets.')
        );
        return;
      }

      const width = 650;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        freshUrl.url,
        'wikipedia_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );
      if (!popup) {
        setError(
          isPt
            ? 'Popup bloqueado pelo navegador. Permita popups para continuar o login OAuth da Wikipedia.'
            : 'Popup blocked by browser. Please allow popups to complete Wikipedia OAuth login.'
        );
      }
    } catch (err: any) {
      setError(err.message || (isPt ? 'Erro ao abrir login OAuth da Wikipedia.' : 'Failed to start Wikipedia OAuth login.'));
    } finally {
      setOauthLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!usernameInput.trim()) {
      setError(isPt ? 'Digite seu nome de usuário da Wikipedia.' : 'Enter your Wikipedia username.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await verifyWikipediaUser(usernameInput.trim());
      setVerifiedUser(user);
    } catch (err: any) {
      setError(err.message || (isPt ? 'Usuário não encontrado na Wikipedia.' : 'User not found on Wikipedia.'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLogin = async () => {
    if (!verifiedUser) return;
    setLoading(true);
    try {
      await saveWikipediaUser(verifiedUser);
      onSuccess(verifiedUser);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-dark border border-secondary w-100 shadow-2xl rounded-4 overflow-hidden text-white"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-bottom border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-40">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-white p-2 rounded-circle shadow-sm" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png"
                    alt="Wikipedia"
                    style={{ width: '28px', height: '28px' }}
                  />
                </div>
                <div>
                  <h5 className="m-0 fw-bold">
                    {isPt ? 'Conectar com a Wikipedia / Wikimedia' : 'Connect with Wikipedia / Wikimedia'}
                  </h5>
                  <p className="m-0 text-white-50 small">OAuth 2.0 & MediaWiki Profile</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="btn btn-link text-white-50 p-1 hover-white border-0"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-auto custom-scrollbar" style={{ maxHeight: '75vh' }}>
              {error && (
                <div className="alert alert-danger py-2 px-3 small mb-4">
                  {error}
                </div>
              )}

              {/* Status Banner */}
              <div className="p-3 rounded-3 bg-secondary bg-opacity-10 border border-secondary mb-4">
                <div className="d-flex align-items-start gap-2">
                  {isOAuthConfigured ? (
                    <ShieldCheck size={20} className="text-success mt-1 flex-shrink-0" />
                  ) : (
                    <KeyRound size={20} className="text-warning mt-1 flex-shrink-0" />
                  )}
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-1">
                      <h6 className={`fw-bold m-0 ${isOAuthConfigured ? 'text-success' : 'text-warning'}`}>
                        {isPt ? 'Configuração OAuth 2.0 Wikimedia' : 'Wikimedia OAuth 2.0 Setup'}
                      </h6>
                      <span className={`badge ${isOAuthConfigured ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {isOAuthConfigured
                          ? (isPt ? 'OAuth Ativo' : 'OAuth Active')
                          : (isPt ? 'Secrets Pendentes' : 'Secrets Pending')}
                      </span>
                    </div>
                    <p className="text-white-50 small mb-2">
                      {isOAuthConfigured
                        ? (isPt
                            ? 'Client ID e Client Secret da Wikimedia estão configurados no servidor. Clique abaixo para autorizar sua conta e recuperar automaticamente o token OAuth para editar no Wikidata:'
                            : 'Wikimedia Client ID and Client Secret are configured on the server. Click below to authorize your account and retrieve your OAuth token:')
                        : (isPt
                            ? 'A Wikimedia exige o registro prévio do consumidor OAuth 2.0 para gerar WIKIPEDIA_CLIENT_ID e WIKIPEDIA_CLIENT_SECRET (eles não podem ser emitidos apenas pelo login sem registro). Registre abaixo com as URLs de callback e adicione-os em Settings > Secrets; após isso, o login OAuth recupera automaticamente o token e seu perfil:'
                            : 'Wikimedia requires registering an OAuth 2.0 consumer first to issue WIKIPEDIA_CLIENT_ID and WIKIPEDIA_CLIENT_SECRET. Register below with these callback URLs and add them in Settings > Secrets; once added, OAuth login automatically retrieves your token and profile:')}
                    </p>
                    <div className="d-flex flex-wrap gap-2 mb-2 small">
                      <span className={`badge ${hasClientId ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-dark text-white-50 border border-secondary'}`}>
                        WIKIPEDIA_CLIENT_ID: {hasClientId ? 'OK' : (isPt ? 'Ausente' : 'Missing')}
                      </span>
                      <span className={`badge ${hasClientSecret ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-dark text-white-50 border border-secondary'}`}>
                        WIKIPEDIA_CLIENT_SECRET: {hasClientSecret ? 'OK' : (isPt ? 'Ausente' : 'Missing')}
                      </span>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      {isOAuthConfigured && (
                        <button
                          type="button"
                          onClick={handleLaunchOAuthPopup}
                          disabled={oauthLoading}
                          className="btn btn-sm btn-primary d-inline-flex align-items-center gap-2 fw-bold"
                        >
                          {oauthLoading ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                          <span>{isPt ? 'Conectar via OAuth Wikipedia (Popup)' : 'Connect via Wikipedia OAuth (Popup)'}</span>
                        </button>
                      )}
                      <a
                        href="https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1"
                      >
                        <span>{isPt ? 'Registrar / Gerenciar Consumidor Wikimedia' : 'Register / Manage Wikimedia Consumer'}</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-top border-secondary border-opacity-25 small">
                  <div className="text-white-50 mb-1 fw-bold">{isPt ? 'URLs de Retorno (Callback):' : 'Callback URLs:'}</div>
                  <div className="d-flex align-items-center justify-content-between bg-black bg-opacity-50 p-2 rounded mb-2 font-monospace text-truncate" style={{ fontSize: '0.75rem' }}>
                    <span className="text-truncate">{devUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(devUrl)}
                      className="btn btn-sm btn-link text-info p-0 ms-2 text-decoration-none"
                    >
                      {isPt ? 'Copiar' : 'Copy'}
                    </button>
                  </div>
                  <div className="d-flex align-items-center justify-content-between bg-black bg-opacity-50 p-2 rounded font-monospace text-truncate" style={{ fontSize: '0.75rem' }}>
                    <span className="text-truncate">{sharedUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(sharedUrl)}
                      className="btn btn-sm btn-link text-info p-0 ms-2 text-decoration-none"
                    >
                      {isPt ? 'Copiar' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Instant Verification / Login */}
              <div className="bg-black bg-opacity-30 border border-secondary rounded-3 p-3">
                <h6 className="fw-bold text-white mb-2 d-flex align-items-center gap-2">
                  <UserCheck size={18} className="text-success" />
                  {isPt ? 'Verificação Rápida por Usuário Wikipedia (Sem Token de Escrita)' : 'Quick Wikipedia Username Verification (No Write Token)'}
                </h6>
                <p className="text-white-50 small mb-3">
                  {isPt
                    ? 'Digite seu nome de usuário da Wikipedia (qualquer idioma: pt, en, etc.) para validar seu perfil público e entrar imediatamente (para editar itens no Wikidata com sua conta, use o login OAuth completo acima):'
                    : 'Enter your Wikipedia username (any language: pt, en, etc.) to validate your public profile immediately (full Wikidata OAuth edits require the OAuth popup above):'}
                </p>

                <div className="input-group mb-3">
                  <span className="input-group-text bg-dark border-secondary text-white-50">@</span>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder={isPt ? "Ex: Liclopes ou Jimmy Wales" : "E.g.: Liclopes or Jimmy Wales"}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
                  />
                  <button
                    className="btn btn-success d-flex align-items-center gap-2 fw-bold"
                    onClick={handleVerify}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : (isPt ? 'Verificar' : 'Verify')}
                  </button>
                </div>

                {verifiedUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded bg-success bg-opacity-10 border border-success border-opacity-30 mb-3"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <img
                        src={verifiedUser.photoURL || "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo-en-big.png"}
                        alt={verifiedUser.displayName}
                        className="rounded-circle border border-success p-1 bg-white"
                        style={{ width: '48px', height: '48px' }}
                      />
                      <div className="flex-grow-1">
                        <div className="fw-bold text-white fs-6 d-flex align-items-center gap-2">
                          {verifiedUser.displayName}
                          <CheckCircle size={16} className="text-success" />
                        </div>
                        <div className="text-white-50 small">
                          {verifiedUser.email}
                        </div>
                        <div className="text-white-50 xsmall mt-1">
                          {isPt ? 'Edições na Wikipedia:' : 'Wikipedia Edits:'} <strong className="text-success">{verifiedUser.user_metadata?.edit_count || 1}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-success w-100 mt-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                      onClick={handleConfirmLogin}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : (isPt ? 'Confirmar e Entrar' : 'Confirm and Log in')}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-top border-secondary bg-black bg-opacity-50 d-flex justify-content-end">
              <button className="btn btn-outline-secondary px-4" onClick={onClose}>
                {isPt ? 'Fechar' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
