
-- 1. Tabela de Likes para rastrear quem curtiu o quê
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_id UUID NOT NULL, -- ID da resenha ou comentário
    target_type TEXT NOT NULL CHECK (target_type IN ('review', 'comment')),
    userid UUID NOT NULL REFERENCES public.users(userid) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(target_id, userid) -- Garante que o usuário só curta uma vez
);

-- 2. Adicionar contadores para performance
ALTER TABLE public.moviereviews ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.moviecomments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 3. Habilitar RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança
CREATE POLICY "Likes Public Read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Likes Auth Insert" ON public.likes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Likes Auth Delete" ON public.likes FOR DELETE USING (auth.uid() = userid);

-- 5. Função RPC para gerenciar likes e contadores de forma atômica
CREATE OR REPLACE FUNCTION public.toggle_like(
    p_target_id UUID,
    p_target_type TEXT,
    p_userid UUID
) RETURNS VOID AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Verifica se o like já existe
    SELECT EXISTS(SELECT 1 FROM public.likes WHERE target_id = p_target_id AND userid = p_userid) INTO v_exists;

    IF v_exists THEN
        -- Remove o like
        DELETE FROM public.likes WHERE target_id = p_target_id AND userid = p_userid;
        
        -- Decrementa o contador
        IF p_target_type = 'review' THEN
            UPDATE public.moviereviews SET likes_count = likes_count - 1 WHERE id = p_target_id;
        ELSE
            UPDATE public.moviecomments SET likes_count = likes_count - 1 WHERE id = p_target_id;
        END IF;
    ELSE
        -- Adiciona o like
        INSERT INTO public.likes (target_id, target_type, userid) VALUES (p_target_id, p_target_type, p_userid);
        
        -- Incrementa o contador
        IF p_target_type = 'review' THEN
            UPDATE public.moviereviews SET likes_count = likes_count + 1 WHERE id = p_target_id;
        ELSE
            UPDATE public.moviecomments SET likes_count = likes_count + 1 WHERE id = p_target_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
