
-- ===============================================================
-- SCHEMA PARA COMENTÁRIOS E AVALIAÇÕES (SUPABASE)
-- ===============================================================
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Tabela de Resenhas (Reviews) com Notas
CREATE TABLE IF NOT EXISTS moviereviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- wikidataid como chave estrangeira (referenciando movies)
    wikidataid TEXT NOT NULL REFERENCES movies(wikidataid) ON DELETE CASCADE,
    
    -- userid como chave estrangeira (referenciando users)
    userid UUID NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    
    -- email em vez de user_email
    email TEXT NOT NULL,
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Comentários/Respostas (Threads)
CREATE TABLE IF NOT EXISTS moviecomments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reviewid UUID NOT NULL REFERENCES moviereviews(id) ON DELETE CASCADE,
	
	-- wikidataid como chave estrangeira (referenciando movies)
    wikidataid TEXT NOT NULL REFERENCES movies(wikidataid) ON DELETE CASCADE,
    
    -- userid como chave estrangeira (referenciando users)
    userid UUID NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    
    email TEXT NOT NULL,
    
    content TEXT NOT NULL,
    parent_id UUID REFERENCES moviecomments(id) ON DELETE CASCADE, -- Para threads aninhadas
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE moviereviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE moviecomments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança para moviereviews
-- Qualquer um pode ler as resenhas
CREATE POLICY "Allow public read access to reviews" ON moviereviews FOR SELECT USING (true);

-- Apenas usuários logados podem criar resenhas (validando o userid)
CREATE POLICY "Allow authenticated users to create reviews" ON moviereviews 
FOR INSERT WITH CHECK (auth.uid() = userid);

-- Apenas o dono pode deletar sua própria resenha
CREATE POLICY "Allow users to delete their own reviews" ON moviereviews 
FOR DELETE USING (auth.uid() = userid);

-- 5. Políticas de Segurança para moviecomments
-- Qualquer um pode ler os comentários
CREATE POLICY "Allow public read access to comments" ON moviecomments FOR SELECT USING (true);

-- Apenas usuários logados podem responder (validando o userid)
CREATE POLICY "Allow authenticated users to create comments" ON moviecomments 
FOR INSERT WITH CHECK (auth.uid() = userid);

-- Apenas o dono pode deletar sua própria resposta
CREATE POLICY "Allow users to delete their own comments" ON moviecomments 
FOR DELETE USING (auth.uid() = userid);
