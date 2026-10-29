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
        type: b.typeLabel?.value === "Series" ? "Series" : "Movie",
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
