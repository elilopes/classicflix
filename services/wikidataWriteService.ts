
/**
 * Service to communicate with the custom Replit Backend.
 * This enables writing to Wikidata by proxying requests through a secure server.
 */

export interface WikidataEditPayload {
    qid: string;
    data: Record<string, string>; // Key is Property (e.g., P345), Value is the value
}

export const sendEditToBackend = async (backendUrl: string, payload: WikidataEditPayload) => {
    // Ensure URL doesn't end with slash for consistency
    const baseUrl = backendUrl.replace(/\/$/, "");
    const endpoint = `${baseUrl}/edit-movie`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to connect to backend');
        }

        return result;
    } catch (error: any) {
        console.error("Backend Edit Error:", error);
        throw new Error(error.message || "Network error connecting to Replit backend");
    }
};
