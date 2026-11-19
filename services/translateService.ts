export interface TranslateWikidataPayload {
  title?: string;
  label?: string;
  instanceLabel?: string;
  genres?: string[];
  themes?: string[];
  from?: string;
  to?: string;
}

export interface TranslateWikidataResponse {
  titlePt: string;
  labelPt: string;
  instanceLabelPt: string;
  genresPt: string[];
  themesPt: string[];
  provider?: string;
}

export const translateTextViaServer = async (
  text: string,
  to: string = 'pt',
  from: string = 'auto'
): Promise<string> => {
  const clean = String(text || '').trim();
  if (!clean) return '';

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean, from, to }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || `Erro ao traduzir texto (${response.status})`);
  }

  const data = await response.json();
  return data.translatedText || clean;
};

export const translateWikidataMetadata = async (
  payload: TranslateWikidataPayload
): Promise<TranslateWikidataResponse> => {
  const response = await fetch('/api/translate/wikidata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      from: payload.from || 'auto',
      to: payload.to || 'pt',
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || `Erro ao traduzir metadados do Wikidata (${response.status})`);
  }

  return response.json();
};
