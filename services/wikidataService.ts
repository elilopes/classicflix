import { Movie } from '../types';

// Helper to force HTTPS on URLs
const toHttps = (url: string | undefined | null): string => {
  if (!url) return '';
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  // Handle protocol-relative URLs (starting with //)
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
};

// Helper function to perform SPARQL queries with fallback strategy
const executeSparqlQuery = async (query: string): Promise<any> => {
  const finalQuery = query.replace(/\[AUTO_LANGUAGE\]/g, "en");
  
  try {
    const params = new URLSearchParams();
    params.append('query', finalQuery);
    params.append('format', 'json');

    // Attempt POST first
    const response = await fetch("https://query.wikidata.org/sparql", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: params.toString(),
      mode: 'cors',
      credentials: 'omit'
    });

    if (response.ok) {
        return await response.json();
    }
  } catch (error) {
    // Silent failure for POST
  }

  // Fallback to GET with simplified headers and origin=* for maximum CORS compatibility
  try {
     const url = new URL("https://query.wikidata.org/sparql");
     url.searchParams.append("query", finalQuery);
     url.searchParams.append("format", "json");
     url.searchParams.append("origin", "*"); // Critical fix for 'Failed to fetch'

     const response = await fetch(url.toString(), {
       method: 'GET',
       mode: 'cors',
       credentials: 'omit'
     });

     if (response.ok) {
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
     }
  } catch (error) {
     console.warn("Wikidata fetch failed (likely network/CORS)", error);
  }
  return null;
};

/**
 * Generates a stable Wikimedia Thumbnail URL.
 * Changed default width to 300 for "low quality" as requested.
 */
const getWikimediaThumbnail = (originalUrl: string, width: number = 300): string => {
    let url = toHttps(originalUrl);
    if (!url) return '';
    if (!url.includes('upload.wikimedia.org')) return url;
    
    // Check if it's already a thumbnail
    if (url.includes('/thumb/')) return url;

    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
        const u = new URL(url);
        u.searchParams.set('width', width.toString());
        return u.toString();
    } catch (e) {
        return url;
    }
};

export const resolveWikimediaDirectUrl = async (url: string): Promise<string> => {
    const safeUrl = toHttps(url);
    if (!safeUrl || !safeUrl.includes('commons.wikimedia.org/wiki/Special:FilePath/')) {
        return safeUrl;
    }

    try {
        const parts = safeUrl.split('Special:FilePath/');
        if (parts.length < 2) return safeUrl;
        
        const filenameEncoded = parts[1];
        const filename = decodeURIComponent(filenameEncoded);

        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (!pages) return safeUrl;

        const firstPageId = Object.keys(pages)[0];
        const imageInfo = pages[firstPageId]?.imageinfo;

        if (imageInfo && imageInfo.length > 0) {
            return toHttps(imageInfo[0].url);
        }
        
        return safeUrl;
    } catch (e) {
        return safeUrl;
    }
};

export const fetchMovieByQid = async (qid: string): Promise<Partial<Movie> | null> => {
    // Extract QID from URL if necessary
    let cleanQid = qid.trim();
    if (cleanQid.includes('wikidata.org/wiki/')) {
        cleanQid = cleanQid.split('wikidata.org/wiki/').pop() || cleanQid;
    } else if (cleanQid.includes('wikidata.org/entity/')) {
        cleanQid = cleanQid.split('wikidata.org/entity/').pop() || cleanQid;
    }
    
    cleanQid = cleanQid.split(/[?#]/)[0].toUpperCase();
    
    if (!cleanQid.startsWith('Q')) {
        console.warn(`Invalid QID format: ${qid}`);
        return null;
    }

    const sparql = `
      SELECT ?itemLabel ?itemDescription ?image ?pubDate ?director ?directorLabel ?duration ?typeLabel ?iaId
        (GROUP_CONCAT(DISTINCT ?castLabel; SEPARATOR="|") AS ?castList)
        (GROUP_CONCAT(DISTINCT ?composerLabel; SEPARATOR="|") AS ?composerList)
        (GROUP_CONCAT(DISTINCT ?dopLabel; SEPARATOR="|") AS ?dopList)
        (GROUP_CONCAT(DISTINCT ?subjectLabel; SEPARATOR="|") AS ?themeList)
        (GROUP_CONCAT(DISTINCT ?genreLabel; SEPARATOR="|") AS ?genreList)
      WHERE {
        BIND(wd:${cleanQid} AS ?item)
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P57 ?director. }
        OPTIONAL { ?item wdt:P577 ?pubDate. }
        OPTIONAL { ?item wdt:P2047 ?duration. }
        OPTIONAL { ?item wdt:P724 ?iaId. }
        OPTIONAL { ?item wdt:P31 ?type. }
        OPTIONAL { ?item wdt:P161 ?cast. }
        OPTIONAL { ?item wdt:P86 ?composer. }
        OPTIONAL { ?item wdt:P344 ?dop. }
        OPTIONAL { ?item wdt:P921 ?subject. }
        OPTIONAL { ?item wdt:P136 ?genre. }
        
        SERVICE wikibase:label { 
          bd:serviceParam wikibase:language "en,pt,es,fr".
          ?item rdfs:label ?itemLabel .
          ?item schema:description ?itemDescription .
          ?director rdfs:label ?directorLabel .
          ?type rdfs:label ?typeLabel .
          ?cast rdfs:label ?castLabel .
          ?composer rdfs:label ?composerLabel .
          ?dop rdfs:label ?dopLabel .
          ?subject rdfs:label ?subjectLabel .
          ?genre rdfs:label ?genreLabel .
        }
      } GROUP BY ?itemLabel ?itemDescription ?image ?pubDate ?director ?directorLabel ?duration ?typeLabel ?iaId
      LIMIT 1
    `;

    const data = await executeSparqlQuery(sparql);
    if (!data || !data.results || !data.results.bindings || !data.results.bindings[0]) return null;

    const b = data.results.bindings[0];
    
    // Robust year extraction (handles +1942-00-00 formats)
    let year = new Date().getFullYear();
    if (b.pubDate?.value) {
        const match = b.pubDate.value.match(/\d{4}/);
        if (match) year = parseInt(match[0]);
    }
    
    // Extract Director QID from URI (e.g., http://www.wikidata.org/entity/Q123 -> Q123)
    let directorId = "";
    if (b.director && b.director.value) {
        const parts = b.director.value.split('/');
        directorId = parts[parts.length - 1];
    }
    
    // Use the thumbnail helper for the poster - Default 300 for low quality
    const posterUrl = b.image ? getWikimediaThumbnail(b.image.value, 300) : "";

    return {
        wikidataId: cleanQid,
        title: b.itemLabel?.value || "",
        description: b.itemDescription?.value || "",
        posterUrl: posterUrl,
        director: b.directorLabel?.value || "Unknown",
        directorId: directorId, // Return the QID
        year: year,
        duration: b.duration ? `${Math.floor(Number(b.duration.value))}m` : "",
        type: b.typeLabel?.value || "film",
        videoUrl: b.iaId ? `https://archive.org/download/${b.iaId.value}/${b.iaId.value}.mp4` : "",
        cast: b.castList?.value ? b.castList.value.split('|').slice(0, 25) : [],
        genres: b.genreList?.value ? b.genreList.value.split('|').slice(0, 3) : ["Drama"],
        themes: b.themeList?.value ? b.themeList.value.split('|').slice(0, 5) : [],
        cinematographers: b.dopList?.value ? b.dopList.value.split('|').slice(0, 2) : [],
        composers: b.composerList?.value ? b.composerList.value.split('|').slice(0, 2) : []
    };
};

// Fetches additional images for the movie gallery.
export const fetchMovieImages = async (query: string): Promise<string[]> => {
    const isQid = /^Q\d+$/.test(query);
    const safeQuery = query.replace(/"/g, '\\"');
    
    let movieSelector = "";
    if (isQid) {
        movieSelector = `VALUES ?movie { wd:${query} }`;
    } else {
        movieSelector = `
            ?movie wdt:P31/wdt:P279* wd:Q11424.
            ?movie rdfs:label ?label.
            FILTER(LCASE(STR(?label)) = LCASE("${safeQuery}"))
        `;
    }

    const sparql = `
        SELECT ?image WHERE {
            { SELECT ?movie WHERE { ${movieSelector} } LIMIT 1 }
            ?movie wdt:P18 ?image.
        } LIMIT 10
    `;

    try {
        const data = await executeSparqlQuery(sparql);
        if (!data || !data.results || !data.results.bindings) return [];
        
        return data.results.bindings.map((b: any) => 
            getWikimediaThumbnail(b.image.value, 300)
        );
    } catch (e) {
        return [];
    }
};

/**
 * Fetches extended details including Producers, Country, Art Director, etc.
 * Supports searching by QID, IMDb ID, or Title.
 */
export const fetchExtendedWikidataDetails = async (query: string): Promise<any> => {
    const isQid = /^Q\d+$/.test(query);
    const isImdb = /^tt\d+$/.test(query);
    const safeQuery = query.replace(/"/g, '\\"');
    
    let movieSelector = "";
    if (isQid) {
        movieSelector = `VALUES ?movie { wd:${query} }`;
    } else if (isImdb) {
        movieSelector = `?movie wdt:P345 "${query}".`;
    } else {
        movieSelector = `
            ?movie wdt:P31/wdt:P279* wd:Q11424.
            ?movie rdfs:label ?label.
            FILTER(LCASE(STR(?label)) = LCASE("${safeQuery}"))
        `;
    }

    // Consulta otimizada: Agrupamos apenas pelo ID do filme (?movie)
    // Usamos SAMPLE para campos únicos e GROUP_CONCAT para listas
    const sparql = `
      SELECT 
        (SAMPLE(?origTitle) AS ?originalTitle)
        (SAMPLE(?clrLabel) AS ?colorLabel)
        (GROUP_CONCAT(DISTINCT ?castLabel; SEPARATOR="|") AS ?castList)
        (GROUP_CONCAT(DISTINCT ?composerLabel; SEPARATOR="|") AS ?composerList)
        (GROUP_CONCAT(DISTINCT ?dopLabel; SEPARATOR="|") AS ?dopList)
        (GROUP_CONCAT(DISTINCT ?subjectLabel; SEPARATOR="|") AS ?themeList)
        (GROUP_CONCAT(DISTINCT ?producerLabel; SEPARATOR="|") AS ?producerList)
        (GROUP_CONCAT(DISTINCT ?countryLabel; SEPARATOR="|") AS ?countryList)
        (GROUP_CONCAT(DISTINCT ?artDirLabel; SEPARATOR="|") AS ?artDirList)
        (GROUP_CONCAT(DISTINCT ?distribLabel; SEPARATOR="|") AS ?distribList)
        (GROUP_CONCAT(DISTINCT ?basedOnLabel; SEPARATOR="|") AS ?basedOnList)
      WHERE {
        { SELECT ?movie WHERE { ${movieSelector} } LIMIT 1 }
        
        OPTIONAL { ?movie wdt:P1476 ?origTitle. }
        OPTIONAL { ?movie wdt:P462 ?color. }
        OPTIONAL { ?movie wdt:P161 ?cast. }
        OPTIONAL { ?movie wdt:P86 ?comp. }
        OPTIONAL { ?movie wdt:P344 ?dop. }
        OPTIONAL { ?movie wdt:P921 ?sub. }
        OPTIONAL { ?movie wdt:P162 ?prod. }
        OPTIONAL { ?movie wdt:P495 ?ctry. }
        OPTIONAL { ?movie wdt:P3174 ?art. }
        OPTIONAL { ?movie wdt:P750 ?dist. }
        OPTIONAL { { ?movie wdt:P144 ?based. } UNION { ?movie wdt:P1877 ?based. } }

        SERVICE wikibase:label { 
          bd:serviceParam wikibase:language "en,pt,es,fr". 
          ?color rdfs:label ?clrLabel.
          ?cast rdfs:label ?castLabel.
          ?comp rdfs:label ?composerLabel.
          ?dop rdfs:label ?dopLabel.
          ?sub rdfs:label ?subjectLabel.
          ?prod rdfs:label ?producerLabel.
          ?ctry rdfs:label ?countryLabel.
          ?art rdfs:label ?artDirLabel.
          ?dist rdfs:label ?distribLabel.
          ?based rdfs:label ?basedOnLabel.
        }
      } GROUP BY ?movie
    `;

    try {
        const data = await executeSparqlQuery(sparql);
        if (!data || !data.results || !data.results.bindings || data.results.bindings.length === 0) {
             return null;
        }

        const b = data.results.bindings[0];
        
        // Função auxiliar para limpar e limitar a 30 itens para não travar a UI
        const split = (str: any) => {
            if (!str?.value) return [];
            return Array.from(new Set(str.value.split('|')))
                .filter(Boolean)
                .slice(0, 30); 
        };

        return {
            originalTitle: b.originalTitle?.value || "",
            color: b.colorLabel?.value || "",
            cast: split(b.castList),
            composers: split(b.composerList),
            cinematographers: split(b.dopList),
            themes: split(b.themeList),
            producers: split(b.producerList),
            countries: split(b.countryList),
            artDirectors: split(b.artDirList),
            distributors: split(b.distribList),
            basedOn: split(b.basedOnList)
        };
    } catch (e) {
        console.error("Wikidata Extended Error:", e);
        return null;
    }
};

/**
 * Searches for public domain movies on Wikidata that are not likely in the database.
 */
export const findPublicDomainMovies = async (existingIds: string[] = []): Promise<Partial<Movie>[]> => {
    const sparql = `
      SELECT ?item ?itemLabel ?itemDescription ?image ?pubDate ?directorLabel ?iaId
      WHERE {
        ?item wdt:P31 wd:Q11424. # instance of movie
        ?item wdt:P6216 wd:Q19652. # copyright status: public domain
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P57 ?director. ?director rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "en") }
        OPTIONAL { ?item wdt:P577 ?pubDate. }
        OPTIONAL { ?item wdt:P724 ?iaId. } # Internet Archive ID
        
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,pt". }
        
        # Limit to items that have at least one or more "classic" signs
        # (Internet Archive ID or older than 1970)
        FILTER(BOUND(?iaId) || (xsd:integer(SUBSTR(STR(?pubDate), 1, 4)) < 1970))
      }
      ORDER BY DESC(?pubDate)
      LIMIT 100
    `;

    try {
        const data = await executeSparqlQuery(sparql);
        if (!data || !data.results || !data.results.bindings) return [];
        
        const results = data.results.bindings
            .map((b: any) => {
                const qid = b.item.value.split('/').pop();
                
                // Robust year extraction
                let year = 1900;
                if (b.pubDate?.value) {
                    const match = b.pubDate.value.match(/\d{4}/);
                    if (match) year = parseInt(match[0]);
                }

                return {
                    wikidataId: qid,
                    title: b.itemLabel?.value || "Unknown",
                    description: b.itemDescription?.value || "",
                    year: year,
                    director: b.directorLabel?.value || "Unknown",
                    posterUrl: b.image ? getWikimediaThumbnail(b.image.value, 300) : "",
                    videoUrl: b.iaId ? `https://archive.org/download/${b.iaId.value}/${b.iaId.value}.mp4` : ""
                };
            })
            // Filter out existing ones
            .filter((item: any) => !existingIds.includes(item.wikidataId));

        return results;
    } catch (e) {
        console.error("Find Public Domain Movies Error:", e);
        return [];
    }
};

export interface TvSeriesCopyrightCheckResult {
    movie: Movie;
    qid: string;
    titleP1476: string;
    wikidataLabel: string;
    p31Qids: string[];
    p31Labels: string[];
    p6216Qids: string[];
    p6216Labels: string[];
    isTvSeries: boolean;
    isPublicDomain: boolean;
    checked: boolean;
}

export interface WikidataPublicDomainTvSeries {
    wikidataId: string;
    title: string;
    titleP1476: string;
    description: string;
    year: number;
    director: string;
    language: string;
    posterUrl: string;
    videoUrl: string;
    hasP1476: boolean;
    hasVideo: boolean;
}

export const PUBLIC_DOMAIN_TV_SERIES_SPARQL = `SELECT ?item
  (SAMPLE(?p1476Title) AS ?titleP1476)
  (SAMPLE(?itemLabel) AS ?label)
  (SAMPLE(?itemDescription) AS ?description)
  (SAMPLE(?image) AS ?posterImage)
  (SAMPLE(?pubDate) AS ?date)
  (SAMPLE(?directorLabel) AS ?director)
  (SAMPLE(?iaId) AS ?archiveId)
  (SAMPLE(?langLabel) AS ?origLang)
WHERE {
  ?item wdt:P31 wd:Q5398426 .   # instância de: série de televisão
  ?item wdt:P6216 wd:Q19652 .  # situação dos direitos autorais: domínio público
  OPTIONAL { ?item wdt:P1476 ?p1476Title . } # título
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P57 ?dir . ?dir rdfs:label ?directorLabel . FILTER(LANG(?directorLabel) IN ("pt", "en")) }
  OPTIONAL { ?item wdt:P577 ?pubDate . }
  OPTIONAL { ?item wdt:P724 ?iaId . }
  OPTIONAL { ?item wdt:P364 ?lang . ?lang rdfs:label ?langLabel . FILTER(LANG(?langLabel) = "en") }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "pt,en,es,fr".
    ?item rdfs:label ?itemLabel .
    ?item schema:description ?itemDescription .
  }
}
GROUP BY ?item
ORDER BY DESC(?date)
LIMIT 200`;

/**
 * Verifica itens do catálogo no Wikidata para P31 (Q5398426 - série de televisão),
 * P6216 (Q19652 - domínio público) e P1476 (título).
 */
export const verifyCatalogTvSeriesPublicDomain = async (
    targetMovies: Movie[],
    onProgress?: (checked: number, total: number) => void
): Promise<TvSeriesCopyrightCheckResult[]> => {
    const validTargets = targetMovies.filter(
        (m) => m.wikidataId && /^Q\d+$/i.test(m.wikidataId.trim())
    );
    const total = validTargets.length;
    const chunkSize = 40;
    const results: TvSeriesCopyrightCheckResult[] = [];

    for (let i = 0; i < validTargets.length; i += chunkSize) {
        const chunk = validTargets.slice(i, i + chunkSize);
        const valuesClause = chunk
            .map((m) => `wd:${m.wikidataId!.trim().toUpperCase()}`)
            .join(" ");

        const sparql = `
          SELECT ?item
            (SAMPLE(?p1476Title) AS ?titleP1476)
            (SAMPLE(?itemLabel) AS ?label)
            (GROUP_CONCAT(DISTINCT STR(?p31); SEPARATOR="|") AS ?p31Uris)
            (GROUP_CONCAT(DISTINCT ?p31Label; SEPARATOR="|") AS ?p31Labels)
            (GROUP_CONCAT(DISTINCT STR(?p6216); SEPARATOR="|") AS ?p6216Uris)
            (GROUP_CONCAT(DISTINCT ?p6216Label; SEPARATOR="|") AS ?p6216Labels)
          WHERE {
            VALUES ?item { ${valuesClause} }
            OPTIONAL { ?item wdt:P1476 ?p1476Title . }
            OPTIONAL { ?item wdt:P31 ?p31 . }
            OPTIONAL { ?item wdt:P6216 ?p6216 . }
            SERVICE wikibase:label {
              bd:serviceParam wikibase:language "pt,en,es,fr".
              ?item rdfs:label ?itemLabel .
              ?p31 rdfs:label ?p31Label .
              ?p6216 rdfs:label ?p6216Label .
            }
          }
          GROUP BY ?item
        `;

        const data = await executeSparqlQuery(sparql);
        const bindings: any[] = data?.results?.bindings || [];
        const byQid = new Map<string, any>();

        for (const b of bindings) {
            const qid = b.item?.value?.split("/").pop()?.toUpperCase();
            if (qid) byQid.set(qid, b);
        }

        for (const movie of chunk) {
            const qid = movie.wikidataId!.trim().toUpperCase();
            const b = byQid.get(qid);

            if (!b) {
                results.push({
                    movie,
                    qid,
                    titleP1476: "",
                    wikidataLabel: movie.title || "",
                    p31Qids: [],
                    p31Labels: [],
                    p6216Qids: [],
                    p6216Labels: [],
                    isTvSeries: false,
                    isPublicDomain: false,
                    checked: false,
                });
                continue;
            }

            const p31Qids = (b.p31Uris?.value || "")
                .split("|")
                .map((u: string) => u.split("/").pop()?.toUpperCase() || "")
                .filter(Boolean);
            const p31Labels = (b.p31Labels?.value || "")
                .split("|")
                .filter(Boolean);
            const p6216Qids = (b.p6216Uris?.value || "")
                .split("|")
                .map((u: string) => u.split("/").pop()?.toUpperCase() || "")
                .filter(Boolean);
            const p6216Labels = (b.p6216Labels?.value || "")
                .split("|")
                .filter(Boolean);

            results.push({
                movie,
                qid,
                titleP1476: b.titleP1476?.value || "",
                wikidataLabel: b.label?.value || movie.title || "",
                p31Qids,
                p31Labels,
                p6216Qids,
                p6216Labels,
                isTvSeries: p31Qids.includes("Q5398426"),
                isPublicDomain: p6216Qids.includes("Q19652"),
                checked: true,
            });
        }

        onProgress?.(Math.min(i + chunk.length, total), total);
    }

    return results;
};

/**
 * Consulta diretamente no Wikidata séries de televisão (P31=Q5398426)
 * em domínio público (P6216=Q19652) e retorna título P1476 e metadados.
 */
export const findPublicDomainTvSeries = async (): Promise<WikidataPublicDomainTvSeries[]> => {
    try {
        const data = await executeSparqlQuery(PUBLIC_DOMAIN_TV_SERIES_SPARQL);
        const bindings: any[] = data?.results?.bindings || [];

        return bindings
            .map((b: any) => {
                const qid = b.item?.value?.split("/").pop()?.toUpperCase() || "";
                if (!qid) return null;

                let year = 0;
                if (b.date?.value) {
                    const match = b.date.value.match(/\d{4}/);
                    if (match) year = parseInt(match[0], 10);
                }

                const iaId = b.archiveId?.value || "";
                const titleP1476 = b.titleP1476?.value || "";
                const label = b.label?.value || titleP1476 || qid;

                return {
                    wikidataId: qid,
                    title: titleP1476 || label,
                    titleP1476,
                    description: b.description?.value || "",
                    year,
                    director: b.director?.value || "Unknown",
                    language: b.origLang?.value || "Unknown",
                    posterUrl: b.posterImage?.value ? getWikimediaThumbnail(b.posterImage.value, 300) : "",
                    videoUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.mp4` : "",
                    hasP1476: Boolean(titleP1476),
                    hasVideo: Boolean(iaId),
                };
            })
            .filter(Boolean) as WikidataPublicDomainTvSeries[];
    } catch (e) {
        console.error("Find Public Domain TV Series Error:", e);
        return [];
    }
};

export type PublicDomainProductionCategory = 'all' | 'tv_series' | 'animated_short' | 'documentary_film';

export interface WikidataPublicDomainProduction {
    wikidataId: string;
    originalTitle: string;
    hasP1476: boolean;
    instanceQid: string;
    instanceLabel: string;
    isDocumentary: boolean;
    language: string;
    year: number;
    description: string;
    director: string;
    posterUrl: string;
    videoUrl: string;
    hasVideo: boolean;
    archiveId?: string;
    imdbId?: string;
    googleKnowId?: string;
    ofdbId?: string;
    youtubeId?: string;
    commons?: string;
}

export const buildPublicDomainProductionsSparql = (
    category: PublicDomainProductionCategory = 'all',
    limit: number = 150
): string => {
    const tvBranch = `{
    ?item wdt:P31 wd:Q5398426 .   # instância de: série de televisão
    ?item wdt:P6216 wd:Q19652 .  # situação dos direitos autorais: domínio público
    BIND(wd:Q5398426 AS ?matchedInstance)
    BIND(false AS ?isDoc)
  }`;

    const animShortBranch = `{
    ?item wdt:P31 wd:Q17517379 . # instância de: curta-metragem de animação
    ?item wdt:P6216 wd:Q19652 .  # situação dos direitos autorais: domínio público
    BIND(wd:Q17517379 AS ?matchedInstance)
    BIND(false AS ?isDoc)
  }`;

    const docFilmBranch = `{
    ?item wdt:P31 wd:Q11424 .    # instância de: filme
    ?item wdt:P136 wd:Q93204 .   # gênero: filme documental
    ?item wdt:P6216 wd:Q19652 .  # situação dos direitos autorais: domínio público
    BIND(wd:Q11424 AS ?matchedInstance)
    BIND(true AS ?isDoc)
  }`;

    let wherePattern = '';
    if (category === 'tv_series') {
        wherePattern = tvBranch;
    } else if (category === 'animated_short') {
        wherePattern = animShortBranch;
    } else if (category === 'documentary_film') {
        wherePattern = docFilmBranch;
    } else {
        wherePattern = `${tvBranch}\n  UNION\n  ${animShortBranch}\n  UNION\n  ${docFilmBranch}`;
    }

    return `SELECT ?item
  (SAMPLE(?p1476Title) AS ?titleP1476)
  (SAMPLE(?itemLabel) AS ?label)
  (SAMPLE(?itemDescription) AS ?description)
  (SAMPLE(?matchedInstance) AS ?instanceEntity)
  (SAMPLE(?matchedInstanceLabel) AS ?instanceName)
  (MAX(?isDoc) AS ?isDocumentaryFlag)
  (SAMPLE(?langLabel) AS ?origLang)
  (SAMPLE(?pubDate) AS ?date)
  (SAMPLE(?directorLabel) AS ?director)
  (SAMPLE(?image) AS ?posterImage)
  (SAMPLE(?iaId) AS ?archiveId)
  (SAMPLE(?imdbId) AS ?imdb)
  (SAMPLE(?gkgId) AS ?googleKnow)
  (SAMPLE(?ofdbId) AS ?ofdb)
  (SAMPLE(?ytId) AS ?youtube)
  (SAMPLE(?commonsStr) AS ?commons)
WHERE {
  ${wherePattern}
  OPTIONAL { ?item wdt:P1476 ?p1476Title . }
  OPTIONAL { ?item wdt:P364 ?lang . ?lang rdfs:label ?langLabel . FILTER(LANG(?langLabel) IN ("pt", "en")) }
  OPTIONAL { ?item wdt:P577 ?pubDate . }
  OPTIONAL { ?item wdt:P57 ?dir . ?dir rdfs:label ?directorLabel . FILTER(LANG(?directorLabel) IN ("pt", "en")) }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P724 ?iaId . }
  OPTIONAL { ?item wdt:P345 ?imdbId . }
  OPTIONAL { ?item wdt:P2671 ?gkgId . }
  OPTIONAL { ?item wdt:P3138 ?ofdbId . }
  OPTIONAL { ?item wdt:P1651 ?ytId . }
  OPTIONAL { ?item wdt:P373 ?commonsStr . }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "pt,en,es,fr".
    ?item rdfs:label ?itemLabel .
    ?item schema:description ?itemDescription .
    ?matchedInstance rdfs:label ?matchedInstanceLabel .
  }
}
GROUP BY ?item
ORDER BY DESC(?date)
LIMIT ${limit}`;
};

/**
 * Pesquisa no Wikidata produções visuais em domínio público (P6216=Q19652):
 * - Série de televisão (P31=Q5398426)
 * - Curta-metragem de animação (P31=Q17517379)
 * - Filme com gênero filme documental (P31=Q11424 e P136=Q93204)
 */
export const searchPublicDomainProductionsInWikidata = async (
    category: PublicDomainProductionCategory = 'all',
    limit: number = 150
): Promise<WikidataPublicDomainProduction[]> => {
    const sparql = buildPublicDomainProductionsSparql(category, limit);
    const data = await executeSparqlQuery(sparql);
    if (!data || !data.results || !data.results.bindings) {
        throw new Error("Não foi possível obter resposta do Wikidata SPARQL no momento.");
    }

    const bindings: any[] = data.results.bindings || [];

    return bindings
        .map((b: any) => {
            const qid = b.item?.value?.split("/").pop()?.toUpperCase() || "";
            if (!qid) return null;

            const instanceQid = b.instanceEntity?.value?.split("/").pop()?.toUpperCase() || "";
            const isDocumentary =
                b.isDocumentaryFlag?.value === "true" || b.isDocumentaryFlag?.value === "1";

            let fallbackInstanceLabel = "Produção Visual";
            if (instanceQid === "Q5398426") fallbackInstanceLabel = "Série de televisão";
            else if (instanceQid === "Q17517379") fallbackInstanceLabel = "Curta-metragem de animação";
            else if (instanceQid === "Q11424") {
                fallbackInstanceLabel = isDocumentary ? "Filme (Documentário)" : "Filme";
            }

            const rawInstanceName = b.instanceName?.value || fallbackInstanceLabel;
            const instanceLabel = isDocumentary && instanceQid === "Q11424"
                ? `${rawInstanceName} • Documentário`
                : rawInstanceName;

            let year = 0;
            if (b.date?.value) {
                const match = b.date.value.match(/\d{4}/);
                if (match) year = parseInt(match[0], 10);
            }

            const titleP1476 = b.titleP1476?.value || "";
            const label = b.label?.value || qid;
            const iaId = b.archiveId?.value || "";
            const imdbId = b.imdb?.value || "";
            const googleKnowId = b.googleKnow?.value || "";
            const ofdbId = b.ofdb?.value || "";
            const youtubeId = b.youtube?.value || "";
            const commons = b.commons?.value || "";

            return {
                wikidataId: qid,
                originalTitle: titleP1476 || label,
                hasP1476: Boolean(titleP1476),
                instanceQid,
                instanceLabel,
                isDocumentary,
                language: b.origLang?.value || "Não informado",
                year,
                description: b.description?.value || "",
                director: b.director?.value || "Unknown",
                posterUrl: b.posterImage?.value ? getWikimediaThumbnail(b.posterImage.value, 300) : "",
                videoUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.mp4` : "",
                hasVideo: Boolean(iaId),
                archiveId: iaId,
                imdbId,
                googleKnowId,
                ofdbId,
                youtubeId,
                commons,
            };
        })
        .filter(Boolean) as WikidataPublicDomainProduction[];
};
