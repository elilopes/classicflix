
-- Update existing identifiers table to support Universal Player sources
ALTER TABLE public.identifiers 
ADD COLUMN IF NOT EXISTS commons TEXT,
ADD COLUMN IF NOT EXISTS youtube TEXT;

-- Ensure RLS is enabled (it might be already)
ALTER TABLE public.identifiers ENABLE ROW LEVEL SECURITY;

-- Re-apply or ensure policies exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Identifiers') THEN
        CREATE POLICY "Public Read Identifiers" ON public.identifiers FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth Insert/Update Identifiers') THEN
        CREATE POLICY "Auth Insert/Update Identifiers" ON public.identifiers FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
