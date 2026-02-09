
import { Movie } from '../types';

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
 */
const getWikimediaThumbnail = (originalUrl: string, width: number = 500): string => {
    if (!originalUrl) return '';
    if (!originalUrl.includes('upload.wikimedia.org')) return originalUrl;
    
    // Check if it's already a thumbnail
    if (originalUrl.includes('/thumb/')) return originalUrl;

    try {
        const url = new URL(originalUrl);
        url.searchParams.set('width', width.toString());
        return url.toString();
    } catch (e) {
        return originalUrl;
    }
};

export const resolveWikimediaDirectUrl = async (url: string): Promise<string> => {
    if (!url || !url.includes('commons.wikimedia.org/wiki/Special:FilePath/')) {
        return url;
    }

    try {
        const parts = url.split('Special:FilePath/');
        if (parts.length < 2) return url;
        
        const filenameEncoded = parts[1];
        const filename = decodeURIComponent(filenameEncoded);

        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (!pages) return url;

        const firstPageId = Object.keys(pages)[0];
        const imageInfo = pages[firstPageId]?.imageinfo;

        if (imageInfo && imageInfo.length > 0) {
            return imageInfo[0].url;
        }
        
        return url;
    } catch (e) {
        return url;
    }
};

export const fetchMovieByQid = async (qid: string): Promise<Partial<Movie> | null> => {
    const cleanQid = qid.trim().toUpperCase();
    if (!cleanQid.startsWith('Q')) return null;

    const sparql = `
      SELECT ?itemLabel ?description ?image ?director ?directorLabel ?pubDate ?duration ?typeLabel ?iaId 
        (GROUP_CONCAT(DISTINCT ?castLabel; SEPARATOR="|") AS ?castList)
        (GROUP_CONCAT(DISTINCT ?composerLabel; SEPARATOR="|") AS ?composerList)
        (GROUP_CONCAT(DISTINCT ?dopLabel; SEPARATOR="|") AS ?dopList)
        (GROUP_CONCAT(DISTINCT ?subjectLabel; SEPARATOR="|") AS ?themeList)
        (GROUP_CONCAT(DISTINCT ?genreLabel; SEPARATOR="|") AS ?genreList)
      WHERE {
        BIND(wd:${cleanQid} AS ?item)
        OPTIONAL { ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "en") }
        OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P57 ?director. ?director rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "en") }
        OPTIONAL { ?item wdt:P577 ?pubDate. }
        OPTIONAL { ?item wdt:P2047 ?duration. }
        OPTIONAL { ?item wdt:P724 ?iaId. }
        OPTIONAL { ?item wdt:P31 ?type. BIND(IF(?type = wd:Q5398426, "Series", "Movie") AS ?typeLabel) }
        OPTIONAL { ?item wdt:P161 ?castItem. ?castItem rdfs:label ?castLabel. FILTER(LANG(?castLabel) = "en") }
        OPTIONAL { ?item wdt:P86 ?compItem. ?compItem rdfs:label ?composerLabel. FILTER(LANG(?composerLabel) = "en") }
        OPTIONAL { ?item wdt:P344 ?dopItem. ?dopItem rdfs:label ?dopLabel. FILTER(LANG(?dopLabel) = "en") }
        OPTIONAL { ?item wdt:P921 ?subItem. ?subItem rdfs:label ?subjectLabel. FILTER(LANG(?subjectLabel) = "en") }
        OPTIONAL { ?item wdt:P136 ?genreItem. ?genreItem rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
      } GROUP BY ?itemLabel ?description ?image ?director ?directorLabel ?pubDate ?duration ?typeLabel ?iaId
    `;

    const data = await executeSparqlQuery(sparql);
    if (!data || !data.results || !data.results.bindings || !data.results.bindings[0]) return null;

    const b = data.results.bindings[0];
    const year = b.pubDate ? new Date(b.pubDate.value).getFullYear() : new Date().getFullYear();
    
    // Extract Director QID from URI (e.g., http://www.wikidata.org/entity/Q123 -> Q123)
    let directorId = "";
    if (b.director && b.director.value) {
        const parts = b.director.value.split('/');
        directorId = parts[parts.length - 1];
    }
    
    // Use the thumbnail helper for the poster
    const posterUrl = b.image ? getWikimediaThumbnail(b.image.value, 600) : "";

    return {
        wikidataId: cleanQid,
        title: b.itemLabel?.value || "",
        description: b.description?.value || "",
        posterUrl: posterUrl,
        director: b.directorLabel?.value || "Unknown",
        directorId: directorId, // Return the QID
        year: year,
        duration: b.duration ? `${Math.floor(Number(b.duration.value))}m` : "",
        type: b.typeLabel?.value === "Series" ? "Series" : "Movie",
        videoUrl: b.iaId ? `https://archive.org/download/${b.iaId.value}/${b.iaId.value}.mp4` : "",
        cast: b.castList?.value ? b.castList.value.split('|').slice(0, 8) : [],
        genres: b.genreList?.value ? b.genreList.value.split('|').slice(0, 3) : ["Drama"],
        themes: b.themeList?.value ? b.themeList.value.split('|').slice(0, 5) : [],
        cinematographers: b.dopList?.value ? b.dopList.value.split('|').slice(0, 2) : [],
        composers: b.composerList?.value ? b.composerList.value.split('|').slice(0, 2) : []
    };
};

/**
 * Fetches additional images for the movie gallery.
 */
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
            getWikimediaThumbnail(b.image.value, 800)
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

    const sparql = `
      SELECT 
        ?originalTitle
        ?colorLabel
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
        
        OPTIONAL { ?movie wdt:P1476 ?originalTitle. }
        OPTIONAL { ?movie wdt:P462 ?color. ?color rdfs:label ?colorLabel. FILTER(LANG(?colorLabel) = "en") }
        
        { SELECT ?movie ?castLabel WHERE { ?movie wdt:P161 ?cast. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?cast rdfs:label ?castLabel } } LIMIT 15 }
        UNION
        { SELECT ?movie ?composerLabel WHERE { ?movie wdt:P86 ?composer. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?composer rdfs:label ?composerLabel } } LIMIT 3 }
        UNION
        { SELECT ?movie ?dopLabel WHERE { ?movie wdt:P344 ?dop. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?dop rdfs:label ?dopLabel } } LIMIT 3 }
        UNION
        { SELECT ?movie ?subjectLabel WHERE { ?movie wdt:P921 ?subject. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?subject rdfs:label ?subjectLabel } } LIMIT 5 }
        UNION
        { SELECT ?movie ?producerLabel WHERE { ?movie wdt:P162 ?producer. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?producer rdfs:label ?producerLabel } } LIMIT 5 }
        UNION
        { SELECT ?movie ?countryLabel WHERE { ?movie wdt:P495 ?country. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?country rdfs:label ?countryLabel } } LIMIT 3 }
        UNION
        { SELECT ?movie ?artDirLabel WHERE { ?movie wdt:P3174 ?artDir. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?artDir rdfs:label ?artDirLabel } } LIMIT 3 }
        UNION
        { SELECT ?movie ?distribLabel WHERE { ?movie wdt:P750 ?distrib. SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?distrib rdfs:label ?distribLabel } } LIMIT 3 }
        UNION
        { SELECT ?movie ?basedOnLabel WHERE { { ?movie wdt:P144 ?basedOn. } UNION { ?movie wdt:P1877 ?basedOn. } SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,pt". ?basedOn rdfs:label ?basedOnLabel } } LIMIT 2 }

      } GROUP BY ?originalTitle ?colorLabel
    `;

    try {
        const data = await executeSparqlQuery(sparql);
        if (!data || !data.results || !data.results.bindings || data.results.bindings.length === 0) {
             return null;
        }

        const b = data.results.bindings[0];
        const split = (str: any) => str?.value ? str.value.split('|').filter(Boolean) : [];

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
        return null;
    }
};
