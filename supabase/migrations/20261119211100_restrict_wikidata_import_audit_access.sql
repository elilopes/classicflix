-- Restringe as tabelas de auditoria e mídias ao contexto autenticado.
-- O histórico continua acessível pela RPC administrativa com validação de e-mail.
REVOKE ALL ON TABLE public.import_jobs, public.metadata_history, public.movie_media FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.import_jobs, public.metadata_history, public.movie_media TO authenticated;
REVOKE ALL ON FUNCTION public.classicflix_get_import_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classicflix_get_import_history(integer) TO authenticated;
