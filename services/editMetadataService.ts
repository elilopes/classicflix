
import { sendEditToBackend } from './wikidataWriteService';
import { updateSupabaseMovie } from './supabaseClient';

export const EditMetadataService = {
  /**
   * Salva os metadados no Supabase (e opcionalmente no MySQL local) e, opcionalmente, sincroniza com o Wikidata
   */
  saveMovieMetadata: async (id: string, data: any, sync: boolean) => {
    // 1. Atualização no Supabase (Principal)
    try {
      await updateSupabaseMovie(data.wikidataId, data);
    } catch (supabaseError) {
      console.error("Erro ao atualizar Supabase:", supabaseError);
      // Continuamos para tentar o MySQL se configurado, ou falhamos se Supabase for crítico
    }

    // 2. Atualização no Banco de Dados MySQL (Local - Opcional)
    try {
      const response = await fetch(`http://localhost:3001/api/movies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        console.warn("MySQL local não respondeu ou deu erro.");
      }
    } catch (mysqlError) {
      console.warn("MySQL local inacessível.");
    }

    // 3. Sincronização com Wikidata (Se o usuário marcou o switch e existe um QID)
    if (sync && data.wikidataId) {
      try {
        await sendEditToBackend({
          qid: data.wikidataId,
          description: data.description,
          language: data.language || 'pt'
        });
      } catch (wikiError: any) {
        console.error("Erro na sincronização Wikidata:", wikiError);
        throw new Error(`Dados salvos localmente, mas a sincronização com Wikidata falhou: ${wikiError.message}`);
      }
    }

    return { success: true };
  }
};
