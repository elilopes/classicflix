/**
 * Wikipedia / Wikimedia OAuth 2.0 Client Service
 * Compliant with Wikimedia OAuth 2.0 standards and AI Studio OAuth guidelines.
 */

export interface WikipediaUser {
  id: string;
  userid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: 'wikipedia';
  user_metadata: {
    full_name: string;
    avatar_url: string;
    wiki_username: string;
    wiki_sub?: string;
    edit_count?: number;
    registered?: string;
    groups?: string[];
  };
  accessToken?: string;
}

export interface WikipediaAuthUrlResponse {
  configured: boolean;
  url?: string;
  redirectUri: string;
  clientId?: string;
  setupUrl?: string;
  devCallbackUrl?: string;
  sharedCallbackUrl?: string;
  message?: string;
}

/**
 * Fetch OAuth URL and configuration status from server
 */
export const getWikipediaAuthUrl = async (): Promise<WikipediaAuthUrlResponse> => {
  const redirectUri = `${window.location.origin}/auth/wikipedia/callback`;
  const response = await fetch(`/api/auth/wikipedia/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
  if (!response.ok) {
    throw new Error('Falha ao obter URL de autenticação da Wikipedia');
  }
  return await response.json();
};

/**
 * Direct verification of Wikipedia username via public Wikimedia API
 * Allows immediate interactive testing and validation
 */
export const verifyWikipediaUser = async (username: string): Promise<WikipediaUser> => {
  const response = await fetch('/api/auth/wikipedia/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Usuário da Wikipedia não encontrado');
  }

  return result.user;
};

/**
 * Saves Wikipedia user to local storage and syncs with Supabase if possible
 */
export const saveWikipediaUser = async (user: WikipediaUser) => {
  try {
    localStorage.setItem('classicflix_user', JSON.stringify(user));
  } catch (e) {
    console.error('Erro ao salvar no localStorage:', e);
  }

  // Attempt to sync with Supabase public.users
  try {
    const { getSupabase } = await import('./bd');
    const sb = await getSupabase();
    if (sb) {
      await sb.from('users').upsert({
        userid: user.userid,
        email: user.email,
        nome: user.displayName
      }, { onConflict: 'userid' });
    }
  } catch (dbErr) {
    console.warn('Aviso ao sincronizar usuário Wikipedia no banco de dados:', dbErr);
  }
};
