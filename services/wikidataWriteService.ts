
/**
 * Service to communicate with the custom node Backend.
 * This enables writing to Wikidata by proxying requests through a secure server.
 */
// URL fixa para o seu backend Replit permanente
const DEFAULT_BACKEND_URL = process.env.WIKIDATA_BACKEND_URL || 'https://classicflix.liclopes.replit.com/api/wikidata/edit';

export interface WikidataEditPayload {
    qid: string;
    claims?: Record<string, string>;
    description?: string;
    language?: string;
}

export const sendEditToBackend = async (payload: WikidataEditPayload, customUrl?: string) => {
    try {
        const url = customUrl || DEFAULT_BACKEND_URL;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao editar no Wikidata');

        return result;
    } catch (error: any) {
        console.error("Erro no serviço de escrita:", error);
        throw error;
    }
};
