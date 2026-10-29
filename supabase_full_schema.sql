
-- ===============================================================
-- SETUP COMPLETO PARA CLASSICFLIX (SUPABASE)
-- ===============================================================
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Tabela de Filmes (Suporta produções oficiais e independentes)
CREATE TABLE IF NOT EXISTS public.movies (
    id TEXT PRIMARY KEY,
    wikidataid TEXT UNIQUE, -- Pode ser NULL para produções independentes
    title TEXT NOT NULL,
    titlept TEXT,
    originaltitle TEXT,
    year INTEGER,
    language TEXT,
    hassubtitles BOOLEAN DEFAULT FALSE,
    subtitleurl TEXT,
    posterurl TEXT,
    videourl TEXT,
    trailerurl TEXT,
    description TEXT,
    descriptionpt TEXT,
    duration TEXT,
    genres TEXT[],
    director TEXT,
    type TEXT DEFAULT 'Movie',
    rating TEXT,
    castmembers TEXT[],
    cinematographers TEXT[],
    composers TEXT[],
    themes TEXT[],
    awards TEXT[],
    popularity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Usuários (Para vincular com o Auth do Supabase)
CREATE TABLE IF NOT EXISTS public.users (
    userid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    senha TEXT, -- Armazenado apenas para compatibilidade legada, use auth.users para login real
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Listas de Usuários (Watchlist, Favoritos e Progresso)
CREATE TABLE IF NOT EXISTS public.userlists (
    userid UUID REFERENCES public.users(userid) ON DELETE CASCADE,
    wikidataid TEXT NOT NULL, -- ID do filme ou Wikidata ID
    iswatched BOOLEAN DEFAULT FALSE,
    isfavorite BOOLEAN DEFAULT FALSE,
    progress_seconds INTEGER DEFAULT 0,
    lastupdated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (userid, wikidataid)
);

-- 4. Tabela de Ranking do Quiz
CREATE TABLE IF NOT EXISTS public.quizranking (
    userid UUID PRIMARY KEY REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    title TEXT, -- Título do filme do quiz
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Resenhas (Reviews)
CREATE TABLE IF NOT EXISTS public.moviereviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wikidataid TEXT NOT NULL, -- Referência ao ID do filme
    userid UUID NOT NULL REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Comentários (Threads)
CREATE TABLE IF NOT EXISTS public.moviecomments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reviewid UUID NOT NULL REFERENCES public.moviereviews(id) ON DELETE CASCADE,
    wikidataid TEXT NOT NULL,
    userid UUID NOT NULL REFERENCES public.users(userid) ON DELETE CASCADE,
    email TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.moviecomments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Função RPC para Popularidade
CREATE OR REPLACE FUNCTION increment_popularity(movie_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.movies
  SET popularity = popularity + 1
  WHERE id = movie_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Habilitar RLS (Row Level Security)
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.userlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moviereviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moviecomments ENABLE ROW LEVEL SECURITY;

-- 9. Políticas de Segurança (POLICIES)

-- Filmes: Leitura pública, escrita autenticada
CREATE POLICY "Public Read Movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Auth Insert Movies" ON public.movies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Usuários: Apenas o próprio usuário pode ver seus dados
CREATE POLICY "Users Self Read" ON public.users FOR SELECT USING (auth.uid() = userid);

-- Listas: Controle total pelo dono
CREATE POLICY "Userlists Owner Access" ON public.userlists FOR ALL USING (auth.uid() = userid);

-- Ranking: Leitura pública, escrita pelo dono
CREATE POLICY "Ranking Public Read" ON public.quizranking FOR SELECT USING (true);
CREATE POLICY "Ranking Owner Update" ON public.quizranking FOR ALL USING (auth.uid() = userid);

-- Resenhas: Leitura pública, escrita pelo dono
CREATE POLICY "Reviews Public Read" ON public.moviereviews FOR SELECT USING (true);
CREATE POLICY "Reviews Owner Insert" ON public.moviereviews FOR INSERT WITH CHECK (auth.uid() = userid);
CREATE POLICY "Reviews Owner Delete" ON public.moviereviews FOR DELETE USING (auth.uid() = userid);

-- Comentários: Leitura pública, escrita pelo dono
CREATE POLICY "Comments Public Read" ON public.moviecomments FOR SELECT USING (true);
CREATE POLICY "Comments Owner Insert" ON public.moviecomments FOR INSERT WITH CHECK (auth.uid() = userid);
CREATE POLICY "Comments Owner Delete" ON public.moviecomments FOR DELETE USING (auth.uid() = userid);

-- 10. Trigger para Sincronização de Usuários (Opcional mas recomendado)
-- Este trigger cria automaticamente uma entrada na tabela public.users quando um novo usuário se cadastra no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (userid, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
