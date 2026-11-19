import { translateTextNode } from "./translateRoutes.ts";

export interface MovieKnowledgeQuery {
  title: string;
  year?: number | string | null;
  language?: string;
  wikidataId?: string;
  director?: string;
}

interface WikiSection {
  heading: string;
  content: string;
}

interface WikiArticleData {
  lang: string;
  title: string;
  url: string;
  intro: string;
  sections: WikiSection[];
}

const WIKI_HEADERS = {
  "User-Agent": "ClassicFlix-App/1.0 (https://classicflix.onrender.com)",
  Accept: "application/json",
};

const getOmdbKey = () => process.env.OMDB_KEY || process.env.VITE_OMDB_KEY || "dc3946fe";
const getTmdbKey = () =>
  process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || "e6a44aa8865934c03ad582bc72c5b85d";

const normalizeLang = (language?: string): string => {
  const raw = String(language || "pt").trim().toLowerCase();
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("it")) return "it";
  if (raw.startsWith("hi")) return "hi";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("zh")) return "zh";
  return "en";
};

const safeTranslate = async (text: string, from: string, to: string): Promise<string> => {
  const cleaned = String(text || "").trim();
  if (!cleaned || from === to) return cleaned;
  try {
    if (cleaned.length <= 1600) {
      const res = await translateTextNode(cleaned, from, to);
      return res.translatedText || cleaned;
    }
    const paragraphs = cleaned.split(/\n+/).filter(Boolean);
    const translatedParagraphs: string[] = [];
    for (const para of paragraphs.slice(0, 8)) {
      if (para.length <= 1600) {
        const res = await translateTextNode(para, from, to);
        translatedParagraphs.push(res.translatedText || para);
      } else {
        const chunk = para.slice(0, 1550);
        const res = await translateTextNode(chunk, from, to);
        translatedParagraphs.push(res.translatedText || chunk);
      }
    }
    return translatedParagraphs.join("\n\n");
  } catch {
    return cleaned;
  }
};

const getYearNumber = (year?: number | string | null): number | null => {
  const num = Number(year);
  return Number.isFinite(num) && num > 1880 && num < 2100 ? Math.floor(num) : null;
};

export interface WikidataFacts {
  qid: string;
  label?: string;
  description?: string;
  imdbId?: string;
  archiveId?: string;
  sitelinks: Record<string, string>;
  directors: string[];
  producers: string[];
  cast: string[];
  cinematographers: string[];
  composers: string[];
  genres: string[];
  countries: string[];
  languages: string[];
  licenses: string[];
  awards: string[];
  filmingLocations: string[];
  narrativeLocations: string[];
  year?: number;
  durationMinutes?: number;
  budget?: string;
  boxOffice?: string;
}

export const fetchWikidataEntityFacts = async (
  wikidataId?: string,
  title?: string,
  lang: string = "pt"
): Promise<WikidataFacts | null> => {
  try {
    let qid = wikidataId && /^Q\d+$/i.test(wikidataId.trim()) ? wikidataId.trim().toUpperCase() : "";

    if (!qid && title) {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
        title
      )}&language=en&format=json&limit=5`;
      const sRes = await fetch(searchUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
      if (sRes.ok) {
        const sData: any = await sRes.json();
        const filmMatch = (sData?.search || []).find((entry: any) =>
          /(film|movie|cinema|television|series|animation|short|documentary|filme|série)/i.test(
            entry?.description || ""
          )
        );
        qid = (filmMatch?.id || sData?.search?.[0]?.id || "").toUpperCase();
      }
    }

    if (!qid || !/^Q\d+$/i.test(qid)) return null;

    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(entityUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const json: any = await res.json();
    const entity = json?.entities?.[qid];
    if (!entity) return null;

    const sitelinks: Record<string, string> = {};
    for (const [site, info] of Object.entries<any>(entity.sitelinks || {})) {
      if (info?.title) sitelinks[site] = String(info.title);
    }

    const claims = entity.claims || {};
    const extractClaimQids = (prop: string, limit = 6): string[] =>
      (claims[prop] || [])
        .map((c: any) => c?.mainsnak?.datavalue?.value?.id)
        .filter((id: any) => typeof id === "string" && /^Q\d+$/i.test(id))
        .slice(0, limit);

    const directorQids = extractClaimQids("P57", 5);
    const producerQids = extractClaimQids("P162", 5);
    const castQids = extractClaimQids("P161", 5);
    const cinemQids = extractClaimQids("P344", 3);
    const composerQids = extractClaimQids("P86", 3);
    const genreQids = extractClaimQids("P136", 5);
    const countryQids = extractClaimQids("P495", 3);
    const languageQids = extractClaimQids("P364", 3);
    const licenseQids = [...extractClaimQids("P275", 3), ...extractClaimQids("P6216", 2)];
    const awardQids = extractClaimQids("P166", 6);
    const filmingQids = extractClaimQids("P915", 5);
    const narrativeQids = extractClaimQids("P840", 5);

    const allLabelQids = Array.from(
      new Set([
        ...directorQids,
        ...producerQids,
        ...castQids,
        ...cinemQids,
        ...composerQids,
        ...genreQids,
        ...countryQids,
        ...languageQids,
        ...licenseQids,
        ...awardQids,
        ...filmingQids,
        ...narrativeQids,
      ])
    ).slice(0, 50);

    const labelMap = new Map<string, string>();
    if (allLabelQids.length > 0) {
      const lblUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${allLabelQids.join(
        "|"
      )}&props=labels&languages=${encodeURIComponent(`${lang}|en`)}&format=json`;
      const lblRes = await fetch(lblUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
      if (lblRes.ok) {
        const lblJson: any = await lblRes.json();
        for (const [id, item] of Object.entries<any>(lblJson?.entities || {})) {
          const val = item?.labels?.[lang]?.value || item?.labels?.en?.value;
          if (val) labelMap.set(id, val);
        }
      }
    }

    const mapQids = (qids: string[]) => qids.map((id) => labelMap.get(id) || "").filter(Boolean);

    const imdbId = claims?.P345?.[0]?.mainsnak?.datavalue?.value
      ? String(claims.P345[0].mainsnak.datavalue.value)
      : undefined;

    const archiveId = claims?.P724?.[0]?.mainsnak?.datavalue?.value
      ? String(claims.P724[0].mainsnak.datavalue.value)
      : undefined;

    const pubTime = String(claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time || "");
    const yearMatch = pubTime.match(/(\d{4})/);
    const parsedYear = yearMatch ? Number(yearMatch[1]) : undefined;

    const durRaw = Number(claims?.P2047?.[0]?.mainsnak?.datavalue?.value?.amount);
    const durationMinutes = Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : undefined;

    const formatAmount = (prop: string) => {
      const val = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
      const amt = Number(val?.amount);
      if (!Number.isFinite(amt) || amt <= 0) return undefined;
      return `$${Math.round(amt).toLocaleString("en-US")}`;
    };

    const label = entity?.labels?.[lang]?.value || entity?.labels?.en?.value;
    const description = entity?.descriptions?.[lang]?.value || entity?.descriptions?.en?.value;

    return {
      qid,
      label,
      description,
      imdbId,
      archiveId,
      sitelinks,
      directors: mapQids(directorQids),
      producers: mapQids(producerQids),
      cast: mapQids(castQids),
      cinematographers: mapQids(cinemQids),
      composers: mapQids(composerQids),
      genres: mapQids(genreQids),
      countries: mapQids(countryQids),
      languages: mapQids(languageQids),
      licenses: mapQids(licenseQids),
      awards: mapQids(awardQids),
      filmingLocations: mapQids(filmingQids),
      narrativeLocations: mapQids(narrativeQids),
      year: parsedYear,
      durationMinutes,
      budget: formatAmount("P2130"),
      boxOffice: formatAmount("P2142"),
    };
  } catch {
    return null;
  }
};

const fetchInternetArchiveMetadata = async (
  archiveId?: string
): Promise<{ description?: string; creator?: string; date?: string; runtime?: string } | null> => {
  if (!archiveId) return null;
  try {
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(archiveId)}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const meta = data?.metadata || {};
    const rawDesc = Array.isArray(meta.description) ? meta.description[0] : meta.description;
    const cleanDesc = rawDesc
      ? String(rawDesc).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : undefined;
    return {
      description: cleanDesc || undefined,
      creator: meta.creator ? String(Array.isArray(meta.creator) ? meta.creator[0] : meta.creator) : undefined,
      date: meta.date ? String(meta.date) : undefined,
      runtime: meta.runtime ? String(meta.runtime) : undefined,
    };
  } catch {
    return null;
  }
};

const parseWikipediaExtractSections = (fullExtract: string): { intro: string; sections: WikiSection[] } => {
  const lines = String(fullExtract || "").split("\n");
  const introLines: string[] = [];
  const sections: WikiSection[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^={2,4}\s*(.+?)\s*={2,4}$/);
    if (match) {
      if (currentHeading) {
        const joined = currentLines.join("\n").trim();
        if (joined) sections.push({ heading: currentHeading, content: joined });
      }
      currentHeading = match[1].trim();
      currentLines = [];
    } else if (!currentHeading) {
      introLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentHeading) {
    const joined = currentLines.join("\n").trim();
    if (joined) sections.push({ heading: currentHeading, content: joined });
  }

  return {
    intro: introLines.join("\n").trim(),
    sections,
  };
};

const fetchWikipediaPageExtract = async (
  wikiLang: string,
  pageTitle: string
): Promise<WikiArticleData | null> => {
  try {
    const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(
      pageTitle
    )}&format=json`;
    const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const json: any = await res.json();
    const pages = Object.values<any>(json?.query?.pages || {});
    const page = pages[0];
    if (!page || page.missing !== undefined || !page.extract) return null;

    const { intro, sections } = parseWikipediaExtractSections(page.extract);
    const resolvedTitle = page.title || pageTitle;
    return {
      lang: wikiLang,
      title: resolvedTitle,
      url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/\s+/g, "_"))}`,
      intro,
      sections,
    };
  } catch {
    return null;
  }
};

const searchWikipediaFilmArticle = async (
  wikiLang: string,
  title: string,
  year: number | null
): Promise<WikiArticleData | null> => {
  try {
    const queries = year
      ? [`"${title}" ${year} ${wikiLang === "pt" ? "filme" : "film"}`, `${title} ${year}`, title]
      : [`"${title}" ${wikiLang === "pt" ? "filme" : "film"}`, title];

    for (const q of queries) {
      const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q
      )}&srlimit=5&format=json`;
      const sRes = await fetch(searchUrl, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(6000) });
      if (!sRes.ok) continue;
      const sData: any = await sRes.json();
      const hits: any[] = sData?.query?.search || [];
      if (hits.length === 0) continue;

      const cleanTitleLower = title.toLowerCase();
      const scored = hits
        .map((hit) => {
          const hitTitle = String(hit.title || "");
          const hitSnippet = String(hit.snippet || "").replace(/<[^>]+>/g, "");
          const combined = `${hitTitle} ${hitSnippet}`.toLowerCase();
          let score = 0;
          if (hitTitle.toLowerCase().includes(cleanTitleLower)) score += 3;
          if (year && combined.includes(String(year))) score += 4;
          if (/(film|movie|cinema|directed|director|filme|longa-metragem|dirigido|cineasta|television|series|short)/i.test(combined)) {
            score += 4;
          }
          if (/\(disambiguation\)|\(desambiguação\)/i.test(hitTitle)) score -= 10;
          return { hitTitle, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (!best || best.score < 3) continue;

      const article = await fetchWikipediaPageExtract(wikiLang, best.hitTitle);
      if (article && (article.intro || article.sections.length > 0)) {
        return article;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const resolveBestWikipediaArticles = async (
  query: MovieKnowledgeQuery,
  wikiFacts: WikidataFacts | null
): Promise<{ targetWiki: WikiArticleData | null; enWiki: WikiArticleData | null }> => {
  const lang = normalizeLang(query.language);
  const year = getYearNumber(query.year) || wikiFacts?.year || null;
  const siteKey = `${lang}wiki`;

  const [targetWiki, enWiki] = await Promise.all([
    lang !== "en"
      ? wikiFacts?.sitelinks?.[siteKey]
        ? fetchWikipediaPageExtract(lang, wikiFacts.sitelinks[siteKey])
        : searchWikipediaFilmArticle(lang, query.title, year)
      : Promise.resolve(null),
    wikiFacts?.sitelinks?.enwiki
      ? fetchWikipediaPageExtract("en", wikiFacts.sitelinks.enwiki)
      : searchWikipediaFilmArticle("en", query.title, year),
  ]);

  return { targetWiki, enWiki };
};

const fetchOmdbData = async (title: string, year: number | null, imdbId?: string): Promise<any | null> => {
  try {
    const key = getOmdbKey();
    if (!key) return null;
    const params = imdbId
      ? `i=${encodeURIComponent(imdbId)}&plot=full&apikey=${key}`
      : `t=${encodeURIComponent(title)}${year ? `&y=${year}` : ""}&plot=full&apikey=${key}`;
    const res = await fetch(`https://www.omdbapi.com/?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.Response !== "True") return null;
    return data;
  } catch {
    return null;
  }
};

const fetchTmdbData = async (title: string, year: number | null, lang: string): Promise<any | null> => {
  try {
    const key = getTmdbKey();
    if (!key) return null;
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(
      title
    )}${year ? `&year=${year}` : ""}`;
    const sRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!sRes.ok) return null;
    const sData: any = await sRes.json();
    const movieId = sData?.results?.[0]?.id;
    if (!movieId) return null;

    const tmdbLang = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : lang === "it" ? "it-IT" : "en-US";
    const [detailRes, revEnRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${key}&language=${tmdbLang}&append_to_response=reviews`, {
        signal: AbortSignal.timeout(6000),
      }),
      tmdbLang !== "en-US"
        ? fetch(`https://api.themoviedb.org/3/movie/${movieId}/reviews?api_key=${key}&language=en-US`, {
            signal: AbortSignal.timeout(6000),
          })
        : Promise.resolve(null),
    ]);

    if (!detailRes.ok) return null;
    const detail: any = await detailRes.json();
    if (revEnRes && revEnRes.ok) {
      const enRevs: any = await revEnRes.json();
      if (!detail.reviews?.results?.length && enRevs?.results?.length) {
        detail.reviews = enRevs;
      }
    }
    return detail;
  } catch {
    return null;
  }
};

const matchSections = (article: WikiArticleData | null, regex: RegExp): WikiSection[] => {
  if (!article) return [];
  return article.sections.filter((s) => regex.test(s.heading));
};

const trimParagraphText = (text: string, maxChars: number = 1400): string => {
  const cleaned = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastPeriod = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(".\n"));
  return lastPeriod > 250 ? slice.slice(0, lastPeriod + 1) : `${slice.trim()}...`;
};

const getLabels = (lang: string) => {
  if (lang === "pt") {
    return {
      ratingsHeader: "Notas e Avaliações da Crítica",
      awardsLabel: "Premiações",
      criticalReceptionHeader: "Recepção da Crítica e Consenso",
      publicReviewsHeader: "Avaliações Registradas (TMDb)",
      catalogProfileHeader: "Registro Catalográfico e Preservação",
      sourceNote: "Fontes consultadas via Node.js: Wikipedia, Wikidata, Archive.org, OMDb e TMDb.",
      analysisHeader: "Análise Crítica e Significado Histórico",
      themesStyleHeader: "Temas, Estilo e Legado",
      historyHeader: "Contexto Histórico do Cinema em",
      filmHistoryHeader: "Lançamento e Legado da Obra",
      archiveNoteHeader: "Notas de Acervo e Preservação",
    };
  }
  return {
    ratingsHeader: "Critical Ratings & Scores",
    awardsLabel: "Awards",
    criticalReceptionHeader: "Critical Reception & Consensus",
    publicReviewsHeader: "Recorded Reviews (TMDb)",
    catalogProfileHeader: "Archival Record & Preservation",
    sourceNote: "Sources consulted via Node.js: Wikipedia, Wikidata, Archive.org, OMDb & TMDb.",
    analysisHeader: "Critical Analysis & Historical Significance",
    themesStyleHeader: "Themes, Style & Legacy",
    historyHeader: "Historical Context of Cinema in",
    filmHistoryHeader: "Release & Legacy of the Work",
    archiveNoteHeader: "Archive & Preservation Notes",
  };
};

// --- Node.js First Metadata Lookup Helpers (Director P57->P162, Year, Language) ---

export const findNodeDirector = async (
  title: string,
  year?: number | string | null,
  wikidataId?: string
): Promise<{ director: string } | null> => {
  const yearNum = getYearNumber(year);
  const wikiFacts = await fetchWikidataEntityFacts(wikidataId, title, "en");
  if (wikiFacts) {
    if (wikiFacts.directors.length > 0) {
      return { director: wikiFacts.directors.join(", ") };
    }
    if (wikiFacts.producers.length > 0) {
      return { director: wikiFacts.producers.join(", ") };
    }
  }

  const [{ enWiki }, omdb, tmdb, archiveMeta] = await Promise.all([
    resolveBestWikipediaArticles({ title, year: yearNum, language: "en", wikidataId }, wikiFacts),
    fetchOmdbData(title, yearNum, wikiFacts?.imdbId),
    fetchTmdbData(title, yearNum, "en"),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);

  if (omdb?.Director && omdb.Director !== "N/A") {
    return { director: String(omdb.Director) };
  }
  if (tmdb?.credits?.crew) {
    const dir = tmdb.credits.crew.find((c: any) => c?.job === "Director")?.name;
    if (dir) return { director: String(dir) };
  }
  if (enWiki?.intro) {
    const m = enWiki.intro.match(/directed by ([A-Z][^.,;(\n]{3,60})/i);
    if (m?.[1]) return { director: m[1].trim() };
  }
  if (archiveMeta?.creator) {
    return { director: archiveMeta.creator };
  }
  return null;
};

export const findNodeYear = async (title: string, wikidataId?: string): Promise<{ year: number } | null> => {
  const wikiFacts = await fetchWikidataEntityFacts(wikidataId, title, "en");
  if (wikiFacts?.year && wikiFacts.year > 1880) {
    return { year: wikiFacts.year };
  }
  const [omdb, tmdb, archiveMeta] = await Promise.all([
    fetchOmdbData(title, null, wikiFacts?.imdbId),
    fetchTmdbData(title, null, "en"),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);
  const omdbYear = omdb?.Year ? Number(String(omdb.Year).match(/\d{4}/)?.[0]) : 0;
  if (omdbYear > 1880) return { year: omdbYear };
  const tmdbYear = tmdb?.release_date ? Number(String(tmdb.release_date).match(/\d{4}/)?.[0]) : 0;
  if (tmdbYear > 1880) return { year: tmdbYear };
  const archYear = archiveMeta?.date ? Number(String(archiveMeta.date).match(/\d{4}/)?.[0]) : 0;
  if (archYear > 1880) return { year: archYear };
  return null;
};

export const findNodeLanguage = async (title: string, wikidataId?: string): Promise<{ language: string } | null> => {
  const wikiFacts = await fetchWikidataEntityFacts(wikidataId, title, "en");
  if (wikiFacts?.languages && wikiFacts.languages.length > 0) {
    return { language: wikiFacts.languages[0] };
  }
  const omdb = await fetchOmdbData(title, null, wikiFacts?.imdbId);
  if (omdb?.Language && omdb.Language !== "N/A") {
    return { language: String(omdb.Language).split(",")[0].trim() };
  }
  return null;
};

// --- Node.js First Knowledge Builders for More Info Tabs ---

export const buildNodeCriticsSummary = async (query: MovieKnowledgeQuery): Promise<string | null> => {
  const lang = normalizeLang(query.language);
  const wikiFacts = await fetchWikidataEntityFacts(query.wikidataId, query.title, lang);
  const year = getYearNumber(query.year) || wikiFacts?.year || null;
  const labels = getLabels(lang);

  const [{ targetWiki, enWiki }, omdb, tmdb, archiveMeta] = await Promise.all([
    resolveBestWikipediaArticles({ ...query, year }, wikiFacts),
    fetchOmdbData(query.title, year, wikiFacts?.imdbId),
    fetchTmdbData(query.title, year, lang),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);

  const blocks: string[] = [];

  // 1. Ratings & Awards
  const ratingLines: string[] = [];
  if (omdb?.imdbRating && omdb.imdbRating !== "N/A") {
    ratingLines.push(`• **IMDb:** ${omdb.imdbRating}/10${omdb.imdbVotes && omdb.imdbVotes !== "N/A" ? ` (${omdb.imdbVotes})` : ""}`);
  }
  if (Array.isArray(omdb?.Ratings)) {
    for (const r of omdb.Ratings) {
      if (r?.Source === "Rotten Tomatoes" && r?.Value) {
        ratingLines.push(`• **Rotten Tomatoes:** ${r.Value}`);
      } else if (r?.Source === "Metacritic" && r?.Value) {
        ratingLines.push(`• **Metacritic:** ${r.Value}`);
      }
    }
  }
  if (tmdb?.vote_average > 0) {
    ratingLines.push(`• **TMDb:** ${Number(tmdb.vote_average).toFixed(1)}/10 (${tmdb.vote_count || 0})`);
  }
  const awardsText =
    (omdb?.Awards && omdb.Awards !== "N/A" ? omdb.Awards : "") ||
    (wikiFacts?.awards?.length ? wikiFacts.awards.join(", ") : "");
  if (awardsText) {
    const translatedAwards = lang !== "en" ? await safeTranslate(awardsText, "en", lang) : awardsText;
    ratingLines.push(`• **${labels.awardsLabel}:** ${translatedAwards}`);
  }

  if (ratingLines.length > 0) {
    blocks.push(`**${labels.ratingsHeader}**\n${ratingLines.join("\n")}`);
  }

  // 2. Wikipedia Reception section (target language first, else English translated)
  const receptionRegex = /(reception|critical|review|response|acclaim|legacy|accolade|award|cr[ií]tica|recep[çc][ãa]o|avalia[çc][ãa]o|pr[eê]mio|legado)/i;
  let wikiReceptionSections = matchSections(targetWiki, receptionRegex);
  let receptionLang = targetWiki?.lang || lang;
  if (wikiReceptionSections.length === 0 && enWiki) {
    wikiReceptionSections = matchSections(enWiki, receptionRegex);
    receptionLang = "en";
  }

  if (wikiReceptionSections.length > 0) {
    const combinedRaw = wikiReceptionSections
      .slice(0, 3)
      .map((s) => trimParagraphText(s.content, 900))
      .join("\n\n");
    const finalReception =
      receptionLang !== lang ? await safeTranslate(combinedRaw, receptionLang, lang) : combinedRaw;
    if (finalReception.trim().length > 40) {
      blocks.push(`**${labels.criticalReceptionHeader}**\n${finalReception}`);
    }
  } else {
    const introSource = targetWiki?.intro || enWiki?.intro || "";
    const introLang = targetWiki?.intro ? targetWiki.lang : "en";
    if (introSource.trim().length > 60) {
      const trimmedIntro = trimParagraphText(introSource, 950);
      const translatedIntro = introLang !== lang ? await safeTranslate(trimmedIntro, introLang, lang) : trimmedIntro;
      blocks.push(`**${labels.criticalReceptionHeader}**\n${translatedIntro}`);
    }
  }

  // 3. TMDb written reviews
  const tmdbReviews: any[] = Array.isArray(tmdb?.reviews?.results) ? tmdb.reviews.results : [];
  if (tmdbReviews.length > 0) {
    const revSnippets: string[] = [];
    for (const rev of tmdbReviews.slice(0, 2)) {
      const rawContent = trimParagraphText(String(rev?.content || "").replace(/<[^>]+>/g, ""), 450);
      if (!rawContent) continue;
      const translatedContent = lang !== "en" ? await safeTranslate(rawContent, "auto", lang) : rawContent;
      revSnippets.push(`• **${rev.author || "Crítico TMDb"}:** "${translatedContent}"`);
    }
    if (revSnippets.length > 0) {
      blocks.push(`**${labels.publicReviewsHeader}**\n${revSnippets.join("\n\n")}`);
    }
  }

  // 4. Fallback to Internet Archive / Wikidata archival record when external reviews don't exist
  if (blocks.length === 0 && (archiveMeta?.description || wikiFacts)) {
    const metaLines: string[] = [];
    if (archiveMeta?.description) {
      const trDesc = lang !== "en" ? await safeTranslate(trimParagraphText(archiveMeta.description, 600), "en", lang) : archiveMeta.description;
      metaLines.push(trDesc);
    } else if (wikiFacts?.description) {
      metaLines.push(wikiFacts.description);
    }
    if (wikiFacts?.genres?.length) {
      metaLines.push(`• **${lang === "pt" ? "Gêneros" : "Genres"}:** ${wikiFacts.genres.join(", ")}`);
    }
    if (wikiFacts?.licenses?.length) {
      metaLines.push(`• **${lang === "pt" ? "Direitos / Licença" : "Rights / License"}:** ${wikiFacts.licenses.join(", ")}`);
    }
    if (metaLines.length > 0) {
      blocks.push(`**${labels.catalogProfileHeader}**\n${metaLines.join("\n")}`);
    }
  }

  if (blocks.length === 0) return null;
  blocks.push(`_${labels.sourceNote}_`);
  return blocks.join("\n\n");
};

export const buildNodeTrivia = async (query: MovieKnowledgeQuery): Promise<string[] | null> => {
  const lang = normalizeLang(query.language);
  const wikiFacts = await fetchWikidataEntityFacts(query.wikidataId, query.title, lang);
  const year = getYearNumber(query.year) || wikiFacts?.year || null;

  const [{ targetWiki, enWiki }, omdb, tmdb, archiveMeta] = await Promise.all([
    resolveBestWikipediaArticles({ ...query, year }, wikiFacts),
    fetchOmdbData(query.title, year, wikiFacts?.imdbId),
    fetchTmdbData(query.title, year, lang),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);

  const rawFacts: Array<{ text: string; sourceLang: string }> = [];

  const triviaRegex = /(production|filming|development|casting|special effects|music|soundtrack|restoration|trivia|legacy|popular culture|curiosidade|produ[çc][ãa]o|bastidores|filmag|m[úu]sica|restaura|legado)/i;
  const preferredSections = [
    ...matchSections(targetWiki, triviaRegex).map((s) => ({ s, l: targetWiki!.lang })),
    ...matchSections(enWiki, triviaRegex).map((s) => ({ s, l: "en" })),
  ];

  const seenSentences = new Set<string>();
  for (const item of preferredSections) {
    const sentences = item.s.content
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 60 && s.length <= 280 && !/^see also|^references/i.test(s));

    for (const sentence of sentences.slice(0, 2)) {
      const key = sentence.slice(0, 50).toLowerCase();
      if (seenSentences.has(key)) continue;
      seenSentences.add(key);
      rawFacts.push({ text: sentence, sourceLang: item.l });
      if (rawFacts.length >= 4) break;
    }
    if (rawFacts.length >= 4) break;
  }

  if (rawFacts.length < 4 && wikiFacts) {
    if (wikiFacts.awards.length > 0) {
      rawFacts.push({
        text:
          lang === "pt"
            ? `A obra recebeu reconhecimentos registrados no Wikidata, incluindo: ${wikiFacts.awards.join(", ")}.`
            : `The production received awards recorded on Wikidata, including: ${wikiFacts.awards.join(", ")}.`,
        sourceLang: lang,
      });
    }
    if (wikiFacts.filmingLocations.length > 0 && rawFacts.length < 4) {
      rawFacts.push({
        text:
          lang === "pt"
            ? `As gravações incluíram locações em: ${wikiFacts.filmingLocations.join(", ")}.`
            : `Filming took place in locations including: ${wikiFacts.filmingLocations.join(", ")}.`,
        sourceLang: lang,
      });
    }
    if (wikiFacts.narrativeLocations.length > 0 && rawFacts.length < 4) {
      rawFacts.push({
        text:
          lang === "pt"
            ? `A narrativa da produção se passa em: ${wikiFacts.narrativeLocations.join(", ")}.`
            : `The story is set in: ${wikiFacts.narrativeLocations.join(", ")}.`,
        sourceLang: lang,
      });
    }
    if ((wikiFacts.directors.length > 0 || wikiFacts.producers.length > 0) && rawFacts.length < 4) {
      const teamParts: string[] = [];
      if (wikiFacts.directors.length) {
        teamParts.push(`${lang === "pt" ? "direção de" : "directed by"} ${wikiFacts.directors.join(", ")}`);
      }
      if (wikiFacts.producers.length) {
        teamParts.push(`${lang === "pt" ? "produção de" : "produced by"} ${wikiFacts.producers.join(", ")}`);
      }
      rawFacts.push({
        text:
          lang === "pt"
            ? `Ficha de autoria no Wikidata registra ${teamParts.join(" e ")}.`
            : `Wikidata credits list this work as ${teamParts.join(" and ")}.`,
        sourceLang: lang,
      });
    }
    if (wikiFacts.cast.length > 0 && rawFacts.length < 4) {
      rawFacts.push({
        text:
          lang === "pt"
            ? `O elenco registrado no Wikidata conta com: ${wikiFacts.cast.join(", ")}.`
            : `Cast members recorded on Wikidata include: ${wikiFacts.cast.join(", ")}.`,
        sourceLang: lang,
      });
    }
    if ((wikiFacts.cinematographers.length > 0 || wikiFacts.composers.length > 0) && rawFacts.length < 4) {
      const parts: string[] = [];
      if (wikiFacts.cinematographers.length) {
        parts.push(`${lang === "pt" ? "fotografia por" : "cinematography by"} ${wikiFacts.cinematographers.join(", ")}`);
      }
      if (wikiFacts.composers.length) {
        parts.push(`${lang === "pt" ? "trilha sonora por" : "music by"} ${wikiFacts.composers.join(", ")}`);
      }
      rawFacts.push({
        text:
          lang === "pt"
            ? `Créditos técnicos registrados incluem ${parts.join(" e ")}.`
            : `Technical credits include ${parts.join(" and ")}.`,
        sourceLang: lang,
      });
    }
    if ((wikiFacts.countries.length > 0 || wikiFacts.licenses.length > 0 || wikiFacts.durationMinutes) && rawFacts.length < 4) {
      const bits: string[] = [];
      if (wikiFacts.countries.length) bits.push(`${lang === "pt" ? "país de origem" : "country"}: ${wikiFacts.countries.join(", ")}`);
      if (wikiFacts.durationMinutes) bits.push(`${lang === "pt" ? "duração" : "runtime"}: ${wikiFacts.durationMinutes} min`);
      if (wikiFacts.licenses.length) bits.push(`${lang === "pt" ? "status legal" : "rights"}: ${wikiFacts.licenses.join(", ")}`);
      rawFacts.push({
        text:
          lang === "pt"
            ? `Metadados do catálogo no Wikidata (${wikiFacts.qid}): ${bits.join("; ")}.`
            : `Wikidata catalog metadata (${wikiFacts.qid}): ${bits.join("; ")}.`,
        sourceLang: lang,
      });
    }
  }

  if (rawFacts.length < 4 && archiveMeta?.description) {
    rawFacts.push({
      text: trimParagraphText(archiveMeta.description, 260),
      sourceLang: "en",
    });
  }

  if (rawFacts.length < 4 && omdb) {
    if (omdb.Awards && omdb.Awards !== "N/A") {
      rawFacts.push({
        text: `Awards & Honors (OMDb): ${omdb.Awards}.`,
        sourceLang: "en",
      });
    }
    if (omdb.Writer && omdb.Writer !== "N/A" && rawFacts.length < 4) {
      rawFacts.push({
        text: `Screenplay & writing credits: ${omdb.Writer}.`,
        sourceLang: "en",
      });
    }
  }

  if (rawFacts.length < 4 && tmdb) {
    if (tmdb.tagline) {
      rawFacts.push({
        text: lang === "pt" ? `Slogan oficial divulgado na época: "${tmdb.tagline}".` : `Official tagline: "${tmdb.tagline}".`,
        sourceLang: lang,
      });
    }
    if (Array.isArray(tmdb.production_companies) && tmdb.production_companies.length > 0 && rawFacts.length < 4) {
      const companies = tmdb.production_companies.map((c: any) => c?.name).filter(Boolean).slice(0, 4).join(", ");
      if (companies) {
        rawFacts.push({
          text:
            lang === "pt"
              ? `Estúdios e produtoras envolvidos na realização: ${companies}.`
              : `Production companies involved: ${companies}.`,
          sourceLang: lang,
        });
      }
    }
  }

  if (rawFacts.length === 0) return null;

  const results: string[] = [];
  for (const fact of rawFacts.slice(0, 4)) {
    const out = await safeTranslate(fact.text, fact.sourceLang, lang);
    if (out.trim().length > 10) {
      results.push(out.trim());
    }
  }
  return results;
};

export const buildNodeCinemaHistory = async (query: MovieKnowledgeQuery): Promise<string | null> => {
  const lang = normalizeLang(query.language);
  const wikiFacts = await fetchWikidataEntityFacts(query.wikidataId, query.title, lang);
  const year = getYearNumber(query.year) || wikiFacts?.year || null;
  const labels = getLabels(lang);

  const [{ targetWiki, enWiki }, yearArticleTarget, yearArticleEn, archiveMeta] = await Promise.all([
    resolveBestWikipediaArticles({ ...query, year }, wikiFacts),
    year && lang === "pt" ? fetchWikipediaPageExtract("pt", `${year} no cinema`) : Promise.resolve(null),
    year ? fetchWikipediaPageExtract("en", `${year} in film`) : Promise.resolve(null),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);

  const blocks: string[] = [];

  if (year) {
    const yearArticle = yearArticleTarget || yearArticleEn;
    if (yearArticle) {
      const yearSectionsText = [
        trimParagraphText(yearArticle.intro, 900),
        ...matchSections(yearArticle, /(event|overview|trend|acontecimento|cinema|highest|notable|award|premia)/i)
          .slice(0, 2)
          .map((s) => trimParagraphText(s.content, 650)),
      ]
        .filter(Boolean)
        .join("\n\n");

      const translatedYear =
        yearArticle.lang !== lang
          ? await safeTranslate(yearSectionsText, yearArticle.lang, lang)
          : yearSectionsText;

      if (translatedYear.trim().length > 50) {
        blocks.push(`**${labels.historyHeader} ${year}**\n${translatedYear}`);
      }
    }
  }

  const releaseRegex = /(release|history|historical|context|legacy|restoration|influence|lan[çc]amento|hist[óo]r|contexto|legado|influ[êe]ncia)/i;
  let movieHistorySections = matchSections(targetWiki, releaseRegex);
  let histLang = targetWiki?.lang || lang;
  if (movieHistorySections.length === 0 && enWiki) {
    movieHistorySections = matchSections(enWiki, releaseRegex);
    histLang = "en";
  }

  if (movieHistorySections.length > 0) {
    const rawMovieHist = movieHistorySections
      .slice(0, 2)
      .map((s) => trimParagraphText(s.content, 850))
      .join("\n\n");
    const translatedMovieHist =
      histLang !== lang ? await safeTranslate(rawMovieHist, histLang, lang) : rawMovieHist;
    if (translatedMovieHist.trim().length > 40) {
      blocks.push(`**${labels.filmHistoryHeader}**\n${translatedMovieHist}`);
    }
  } else if (archiveMeta?.description) {
    const trArch =
      lang !== "en"
        ? await safeTranslate(trimParagraphText(archiveMeta.description, 700), "en", lang)
        : archiveMeta.description;
    blocks.push(`**${labels.archiveNoteHeader}**\n${trArch}`);
  }

  if (blocks.length === 0) return null;
  blocks.push(`_${labels.sourceNote}_`);
  return blocks.join("\n\n");
};

export const buildNodeCriticalAnalysis = async (query: MovieKnowledgeQuery): Promise<string | null> => {
  const lang = normalizeLang(query.language);
  const wikiFacts = await fetchWikidataEntityFacts(query.wikidataId, query.title, lang);
  const year = getYearNumber(query.year) || wikiFacts?.year || null;
  const labels = getLabels(lang);

  const [{ targetWiki, enWiki }, omdb, tmdb, archiveMeta] = await Promise.all([
    resolveBestWikipediaArticles({ ...query, year }, wikiFacts),
    fetchOmdbData(query.title, year, wikiFacts?.imdbId),
    fetchTmdbData(query.title, year, lang),
    fetchInternetArchiveMetadata(wikiFacts?.archiveId),
  ]);

  const analysisRegex = /(theme|style|analysis|interpretation|cinematography|visual|influence|legacy|impact|reception|criticism|tema|estilo|an[áa]lise|linguagem|influ[êe]ncia|legado|impacto|cr[ií]tica)/i;
  let sections = matchSections(targetWiki, analysisRegex);
  let sourceLang = targetWiki?.lang || lang;
  if (sections.length === 0 && enWiki) {
    sections = matchSections(enWiki, analysisRegex);
    sourceLang = "en";
  }

  const blocks: string[] = [];

  const introSrc =
    targetWiki?.intro ||
    enWiki?.intro ||
    tmdb?.overview ||
    (omdb?.Plot && omdb.Plot !== "N/A" ? omdb.Plot : "") ||
    archiveMeta?.description ||
    wikiFacts?.description ||
    "";
  const introLang = targetWiki?.intro
    ? targetWiki.lang
    : enWiki?.intro
      ? "en"
      : tmdb?.overview
        ? lang
        : omdb?.Plot || archiveMeta?.description
          ? "en"
          : lang;

  if (introSrc && introSrc !== "N/A") {
    const trimmed = trimParagraphText(introSrc, 850);
    const translatedIntro = introLang !== lang ? await safeTranslate(trimmed, introLang, lang) : trimmed;
    blocks.push(`**${labels.analysisHeader}**\n${translatedIntro}`);
  }

  if (sections.length > 0) {
    const rawThemes = sections
      .slice(0, 3)
      .map((s) => trimParagraphText(s.content, 850))
      .join("\n\n");
    const translatedThemes = sourceLang !== lang ? await safeTranslate(rawThemes, sourceLang, lang) : rawThemes;
    if (translatedThemes.trim().length > 40) {
      blocks.push(`**${labels.themesStyleHeader}**\n${translatedThemes}`);
    }
  } else if (wikiFacts) {
    const metaBullets: string[] = [];
    if (wikiFacts.directors.length) metaBullets.push(`• **${lang === "pt" ? "Direção" : "Direction"}:** ${wikiFacts.directors.join(", ")}`);
    if (wikiFacts.producers.length) metaBullets.push(`• **${lang === "pt" ? "Produção" : "Production"}:** ${wikiFacts.producers.join(", ")}`);
    if (wikiFacts.genres.length) metaBullets.push(`• **${lang === "pt" ? "Gêneros" : "Genres"}:** ${wikiFacts.genres.join(", ")}`);
    if (wikiFacts.countries.length) metaBullets.push(`• **${lang === "pt" ? "Origem" : "Origin"}:** ${wikiFacts.countries.join(", ")}`);
    if (wikiFacts.licenses.length) metaBullets.push(`• **${lang === "pt" ? "Domínio / Licença" : "Rights / License"}:** ${wikiFacts.licenses.join(", ")}`);
    if (metaBullets.length > 0) {
      blocks.push(`**${labels.themesStyleHeader}**\n${metaBullets.join("\n")}`);
    }
  }

  if (blocks.length === 0) return null;
  blocks.push(`_${labels.sourceNote}_`);
  return blocks.join("\n\n");
};
