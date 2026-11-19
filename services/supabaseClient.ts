
import { movies as localMovies } from '../movies.ts';
import { Movie, UserMovieInteraction } from '../types.ts';
import { getSupabase, getCurrentUser as getSupabaseUser, isValidUuid } from './bd.ts';
import { getGoogleDrivePosterUrl } from './drivePosterMap.ts';
import { auth, db, collection, doc, setDoc, getDocs, getDocFromServer, query, where, serverTimestamp, Timestamp } from '../firebase.ts';

enum FirestoreOperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null) {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData?.map(provider => ({
                providerId: provider.providerId,
                email: provider.email,
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on module initialization
(async function testFirestoreConnection() {
    try {
        await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
        }
    }
})();

// Re-export auth functions
export { signInUser, signUpUser, signOutUser, subscribeToAuthChanges, getCurrentUser, signInWithGoogle, signInWithWikipedia } from './bd.ts';

// Helper to clean array input from Postgres
const cleanArray = (val: any): string[] => {
    if (Array.isArray(val)) {
        return val.map((s: any) => String(s).replace(/[\[\]\{\}"]/g, '').trim()).filter(Boolean);
    }
    if (typeof val === 'string') {
        let cleaned = val.trim();
        if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
            cleaned = cleaned.slice(1, -1);
        }
        return cleaned.split(',').map((s: string) => s.replace(/[\[\]\{\}"]/g, '').trim()).filter(Boolean);
    }
    return [];
};

export const fetchSupabaseMovies = async (): Promise<Movie[]> => {
    try {
        const supabase = await getSupabase();
        if (!supabase) return localMovies;

        let allMovies: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const to = from + step - 1;
            let data = null;
            let error = null;
            let retries = 3;

            while (retries > 0) {
                const response = await supabase
                    .from('movies')
                    .select('*, technicaldetails(*), description(*)')
                    .range(from, to);
                
                data = response.data;
                error = response.error;

                if (!error) break;

                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (error) {
                console.warn(`Aviso: Não foi possível buscar o bloco ${from}-${to} após tentativas. Retornando os dados já carregados.`);
                hasMore = false;
                break;
            }

            if (data && data.length > 0) {
                allMovies = [...allMovies, ...data];
                if (data.length < step) hasMore = false;
                else from += step;
            } else {
                hasMore = false;
            }
        }

        if (allMovies.length === 0) {
            console.warn("Supabase returned 0 movies. Falling back to local movies.");
            return localMovies;
        }

        const moviesWithIds = allMovies.map(item => ({...item, id: String(item.id || `id-${Math.random()}`)}));
        const uniqueMovies = Array.from(new Map(moviesWithIds.map(item => [item.id, item])).values());

        return uniqueMovies.map((item: any) => {
            // Merge joined tables
            const td = Array.isArray(item.technicaldetails) ? item.technicaldetails[0] : (item.technicaldetails || {});
            const descObj = Array.isArray(item.description) ? item.description[0] : (item.description || {});
            
            const rawDesc = typeof item.description === 'string' ? item.description : item.descriptionen;
            const rawDescPt = typeof item.descriptionPt === 'string' ? item.descriptionPt : item.descriptionpt;

            const qid = item.wikidataid || item.wikidataId;
            const drivePoster = getGoogleDrivePosterUrl(qid);
            const rawPoster = item.posterurl || item.posterUrl || "";
            const isRawPosterDrive = rawPoster.includes('lh3.googleusercontent.com') || rawPoster.includes('drive.google.com');

            let finalPoster = rawPoster;
            let backupPoster: string | undefined = undefined;

            if (isRawPosterDrive) {
                finalPoster = rawPoster;
                if (drivePoster && drivePoster !== rawPoster) {
                    backupPoster = drivePoster;
                }
            } else if (drivePoster) {
                finalPoster = drivePoster;
                backupPoster = rawPoster || undefined;
            } else {
                finalPoster = rawPoster;
            }

            return {
                id: item.id,
                wikidataId: qid,
                title: item.title,
                titlePt: item.titlept || item.titlePt,
                originalTitle: item.originaltitle || item.originalTitle,
                year: item.year,
                language: item.language || "Unknown",
                hasSubtitles: item.hassubtitles || item.hasSubtitles,
                subtitleUrl: item.subtitleurl || item.subtitleUrl,
                posterUrl: finalPoster,
                backupPosterUrl: backupPoster,
                videoUrl: item.videourl || item.videoUrl,
                trailerUrl: item.trailerurl || item.trailerUrl,
                description: rawDesc || descObj.descriptionen || "",
                descriptionPt: rawDescPt || descObj.descriptionpt || "",
                duration: td.duration || item.duration || "",
                genres: cleanArray(td.genres || item.genres),
                director: td.director || item.director || "Unknown",
                directorId: td.directorid || td.directorId || item.directorid || item.directorId,
                type: item.type || "Movie",
                rating: td.rating || item.rating || "",
                cast: cleanArray(td.castmembers || td.cast_members || td.castMembers || item.cast_members || item.castmembers || item.castMembers),
                cinematographers: cleanArray(td.cinematographers || item.cinematographers),
                composers: cleanArray(td.composers || item.composers),
                themes: cleanArray(td.themes || item.themes),
                popularity: item.popularity || 0,
                awards: cleanArray(item.awards),
                license: td.sourcelabel || item.license || ""
            };
        });
    } catch (err) { 
        console.error("fetchSupabaseMovies error:", err);
        return localMovies; 
    }
};

const generateMovieRowId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12);
};

const toCsvText = (val: unknown): string | null => {
    const cleanToken = (s: unknown) =>
        String(s || '')
            .replace(/[\[\]"()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    if (Array.isArray(val)) {
        const joined = val.map(cleanToken).filter(Boolean).join(',');
        return joined || null;
    }
    if (typeof val === 'string') {
        const parts = val.split(',').map(cleanToken).filter(Boolean);
        const joined = parts.join(',');
        return joined || null;
    }
    return null;
};

const formatAwardsForDb = (awards: unknown): string | null => {
    if (Array.isArray(awards)) {
        return awards.length > 0 ? JSON.stringify(awards) : null;
    }
    if (typeof awards === 'string') {
        const trimmed = awards.trim();
        return trimmed || null;
    }
    return null;
};

// Fix: Implement addSupabaseMovie to persist new movies directly to movies, description, and technicaldetails
export const addSupabaseMovie = async (
    movie: Partial<Movie> & {
        descriptionEn?: string;
        identifiers?: Movie['identifiers'] & { youtubeId?: string };
    }
) => {
    const supabase = await getSupabase();
    if (!supabase) {
        throw new Error('Supabase indisponível. A produção não foi importada.');
    }

    const wikidataId = movie.wikidataId?.trim();
    if (!wikidataId) {
        throw new Error('Não foi possível importar a produção: QID do Wikidata ausente.');
    }

    const providedId = typeof movie.id === 'string' ? movie.id.trim() : '';
    const finalId = providedId || generateMovieRowId();
    const finalTitle = movie.title || movie.originalTitle || wikidataId;
    const englishDescription = movie.descriptionEn || movie.description || null;

    const movieRow = {
        id: finalId,
        wikidataid: wikidataId,
        title: finalTitle,
        titlept: movie.titlePt || null,
        originaltitle: movie.originalTitle || null,
        year: movie.year ?? null,
        language: movie.language || null,
        hassubtitles: movie.hasSubtitles ?? null,
        posterurl: movie.posterUrl || null,
        videourl: movie.videoUrl || null,
        trailerurl: movie.trailerUrl || null,
        subtitleurl: movie.subtitleUrl || null,
        description: englishDescription,
        type: movie.type || null,
        awards: formatAwardsForDb(movie.awards),
        popularity: movie.popularity ?? null,
    };

    const descriptionRow = {
        id: finalId,
        title: finalTitle,
        descriptionen: englishDescription,
        descriptionpt: movie.descriptionPt || null,
        descriptionhi: movie.descriptionHi || null,
        descriptionru: movie.descriptionRu || null,
        descriptionit: movie.descriptionIt || null,
    };

    const technicalDetailsRow = {
        id: finalId,
        title: finalTitle,
        duration: movie.duration || null,
        genres: toCsvText(movie.genres),
        director: movie.director && movie.director !== 'Unknown' ? movie.director : null,
        sourcelabel: movie.sourceLabel || movie.license || null,
        castmembers: toCsvText(movie.cast),
        cinematographers: toCsvText(movie.cinematographers),
        composers: toCsvText(movie.composers),
        themes: toCsvText(movie.themes),
        rating: movie.rating || null,
    };

    const identifiersRow = {
        archiveid: movie.identifiers?.archiveId || null,
        imdbid: movie.identifiers?.imdbId || null,
        omdbid: movie.identifiers?.omdbId || null,
        openmdbid: movie.identifiers?.openMdbId || null,
        googleknowid: movie.identifiers?.googleKnowId || null,
        ofdbid: movie.identifiers?.ofdbId || null,
        commons: movie.identifiers?.wikimediaCommons || null,
        youtube: movie.identifiers?.youtubeId || null,
    };

    const { error } = await supabase.rpc('classicflix_import_movie_atomic', {
        p_movie: movieRow,
        p_description: descriptionRow,
        p_technicaldetails: technicalDetailsRow,
        p_identifiers: identifiersRow,
    });

    if (error) {
        console.error('Falha na importação atômica do ClassicFlix:', error);
        throw new Error(`Falha ao gravar a produção ${wikidataId}: ${error.message}`);
    }

    return { wikidataId, id: finalId, success: true };
};

export interface PersistWikidataProductionInput {
    action: 'insert' | 'update';
    item: { wikidataId: string; supabaseType?: string; instanceLabel?: string };
    draft: any;
    selectedFields: string[];
    sources: Record<string, { source: string; url: string }>;
    media: Array<{
        media_type: string;
        source: string;
        source_id: string;
        url: string;
        page_url?: string;
        license?: string;
        attribution?: string;
        metadata?: Record<string, unknown>;
    }>;
}

export const persistWikidataProduction = async (input: PersistWikidataProductionInput) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível. Nenhuma alteração foi gravada.');

    const qid = input.item.wikidataId?.trim().toUpperCase();
    if (!qid || !/^Q\\d+$/.test(qid)) throw new Error('QID do Wikidata inválido.');

    const draft = input.draft || {};
    const movieRow = {
        id: `wd-${qid.toLowerCase()}`,
        wikidataid: qid,
        title: draft.title || draft.originalTitle || qid,
        titlept: draft.titlePt || null,
        originaltitle: draft.originalTitle || null,
        year: Number(draft.year) > 0 ? Number(draft.year) : null,
        language: draft.language || null,
        hassubtitles: false,
        posterurl: draft.posterUrl || null,
        videourl: draft.videoUrl || null,
        trailerurl: draft.trailerUrl || null,
        subtitleurl: null,
        description: draft.descriptionEn || null,
        type: input.item.supabaseType || input.item.instanceLabel || 'film',
        awards: null,
        popularity: 0,
    };
    const descriptionRow = {
        id: movieRow.id,
        title: movieRow.title,
        descriptionen: draft.descriptionEn || null,
        descriptionpt: draft.descriptionPt || null,
        descriptionhi: null,
        descriptionru: null,
        descriptionit: null,
    };
    const technicalRow = {
        id: movieRow.id,
        title: movieRow.title,
        duration: draft.duration || null,
        genres: toCsvText(draft.genres),
        director: draft.director || null,
        sourcelabel: draft.license || null,
        castmembers: null,
        cinematographers: null,
        composers: null,
        themes: toCsvText(draft.themes),
        rating: null,
    };
    const identifiers = {
        archiveid: draft.identifiers?.archiveId || null,
        imdbid: draft.identifiers?.imdbId || null,
        omdbid: null,
        openmdbid: null,
        googleknowid: draft.identifiers?.googleKnowId || null,
        ofdbid: draft.identifiers?.ofdbId || null,
        commons: draft.identifiers?.wikimediaCommons || null,
        youtube: draft.identifiers?.youtubeId || null,
        tmdbid: draft.identifiers?.tmdbId || null,
    };

    const { data, error } = await supabase.rpc('classicflix_import_movie_with_history', {
        p_action: input.action,
        p_movie: movieRow,
        p_description: descriptionRow,
        p_technicaldetails: technicalRow,
        p_identifiers: identifiers,
        p_selected_fields: input.selectedFields,
        p_sources: input.sources || {},
        p_media: input.media || [],
    });
    if (error) {
        try {
            const { error: auditError } = await supabase.rpc('classicflix_log_import_failure', {
                p_qid: qid,
                p_action: input.action,
                p_error: error.message || 'Falha ao gravar a importação e seu histórico.',
                p_selected_fields: input.selectedFields,
            });
            if (auditError) console.warn('Não foi possível registrar a falha no histórico:', auditError.message);
        } catch (auditError) {
            console.warn('Não foi possível registrar a falha no histórico:', auditError);
        }
        console.error('Falha na importação/revisão Wikidata:', error);
        throw new Error(error.message || 'Falha ao gravar a importação e seu histórico.');
    }
    return data as string;
};

export const getWikidataImportHistory = async (limit = 50) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível para consultar o histórico.');
    const { data, error } = await supabase.rpc('classicflix_get_import_history', { p_limit: limit });
    if (error) throw new Error(error.message || 'Falha ao consultar histórico de importações.');
    return data || [];
};

// Fix: Implement updateSupabaseMovie to update movies, description, and technicaldetails directly
export const updateSupabaseMovie = async (wikidataId: string, updates: any) => {
    const supabase = await getSupabase();
    if (!supabase) return;

    const { error: movieError } = await supabase.from('movies').update({
        title: updates.title,
        titlept: updates.titlePt ?? null,
        originaltitle: updates.originalTitle ?? null,
        year: updates.year ?? null,
        language: updates.language ?? null,
        hassubtitles: updates.hasSubtitles ?? false,
        posterurl: updates.posterUrl ?? null,
        videourl: updates.videoUrl ?? null,
        trailerurl: updates.trailerUrl ?? null,
        subtitleurl: updates.subtitleUrl ?? null,
        description: updates.description ?? null,
        type: updates.type ?? undefined,
        awards: formatAwardsForDb(updates.awards),
        popularity: updates.popularity ?? 0,
    }).eq('wikidataid', wikidataId);

    if (movieError) {
        console.error("Supabase Update Error (movies):", movieError);
        throw movieError;
    }

    try {
        await supabase.from('description').upsert([{
            wikidataid: wikidataId,
            title: updates.title,
            descriptionen: updates.description ?? null,
            descriptionpt: updates.descriptionPt ?? null,
        }], { onConflict: 'wikidataid' });
    } catch (descErr) {
        console.warn("Aviso ao atualizar tabela description:", descErr);
    }

    try {
        await supabase.from('technicaldetails').upsert([{
            wikidataid: wikidataId,
            title: updates.title,
            duration: updates.duration ?? null,
            genres: toCsvText(updates.genres),
            director: updates.director ?? null,
            sourcelabel: updates.sourceLabel || updates.license || null,
            castmembers: toCsvText(updates.cast),
            cinematographers: toCsvText(updates.cinematographers),
            composers: toCsvText(updates.composers),
            themes: toCsvText(updates.themes),
            rating: updates.rating ?? null,
        }], { onConflict: 'wikidataid' });
    } catch (techErr) {
        console.warn("Aviso ao atualizar tabela technicaldetails:", techErr);
    }
};

// Fix: Implement deleteSupabaseMovies to remove movie records
export const deleteSupabaseMovies = async (wikidataIds: string[]) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('movies').delete().in('wikidataid', wikidataIds);
    if (error) throw error;
};

export const getExistingWikidataIds = async (): Promise<string[]> => {
    const supabase = await getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase.from('movies').select('wikidataid');
    if (error) return [];
    return data.map(m => m.wikidataid).filter(Boolean);
};

const getLocalProgress = (userId: string, wikidataId: string): number => {
    try {
        const saved = localStorage.getItem(`classicflix_progress_${userId}_${wikidataId}`);
        return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
        return 0;
    }
};

const getLocalUserLists = (userId: string): UserMovieInteraction[] => {
    try {
        const raw = localStorage.getItem(`classicflix_userlists_${userId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveLocalUserLists = (userId: string, lists: UserMovieInteraction[]) => {
    try {
        localStorage.setItem(`classicflix_userlists_${userId}`, JSON.stringify(lists));
    } catch {}
};

const resolveSupabaseUuid = async (user: any): Promise<string | null> => {
    const candidate = user?.id || user?.userid;
    if (isValidUuid(candidate)) return candidate;

    const supabase = await getSupabase();
    if (supabase) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id && isValidUuid(session.user.id)) {
                return session.user.id;
            }
        } catch {}
    }
    return null;
};

export const getUserInteractions = async (): Promise<UserMovieInteraction[]> => {
    const user = await getSupabaseUser();
    const rawUserId = user?.id || user?.userid;
    if (!rawUserId) return [];

    const supabaseUuid = await resolveSupabaseUuid(user);
    if (supabaseUuid) {
        const supabase = await getSupabase();
        if (supabase) {
            const { data, error } = await supabase
                .from('userlists')
                .select('*')
                .eq('userid', supabaseUuid)
                .order('lastupdated', { ascending: false });

            if (error) {
                console.error("Erro ao buscar userlists:", error.message);
                return [];
            }

            return (data || []).map((row: any) => {
                const watchLaterVal = Boolean(row.watchlater ?? row.iswatchlist);
                return {
                    wikidataid: row.wikidataid,
                    isfavorite: Boolean(row.isfavorite),
                    iswatched: Boolean(row.iswatched),
                    watchlater: watchLaterVal,
                    iswatchlist: watchLaterVal,
                    progress_seconds: row.progress_seconds ?? getLocalProgress(supabaseUuid, row.wikidataid),
                    lastupdated: row.lastupdated,
                };
            });
        }
    }

    // For Firebase Auth users (e.g. Google OAuth), read from Firestore
    if (auth.currentUser?.uid) {
        const fbUid = auth.currentUser.uid;
        const path = `users/${fbUid}/userlists`;
        try {
            const snap = await getDocs(
                query(collection(db, 'users', fbUid, 'userlists'), where('userid', '==', fbUid))
            );
            const items: UserMovieInteraction[] = [];
            snap.forEach((docSnap) => {
                const row = docSnap.data();
                const watchLaterVal = Boolean(row.watchlater ?? row.iswatchlist);
                const lastUpdatedVal = row.lastupdated instanceof Timestamp
                    ? row.lastupdated.toDate().toISOString()
                    : (typeof row.lastupdated === 'string' ? row.lastupdated : undefined);
                items.push({
                    wikidataid: row.wikidataid || docSnap.id,
                    isfavorite: Boolean(row.isfavorite),
                    iswatched: Boolean(row.iswatched),
                    watchlater: watchLaterVal,
                    iswatchlist: watchLaterVal,
                    progress_seconds: getLocalProgress(fbUid, row.wikidataid || docSnap.id),
                    lastupdated: lastUpdatedVal,
                });
            });
            return items.sort((a, b) => (b.lastupdated || '').localeCompare(a.lastupdated || ''));
        } catch (error) {
            handleFirestoreError(error, FirestoreOperationType.LIST, path);
        }
    }

    // Fallback for non-UUID / non-Firebase OAuth sessions (e.g., Wikipedia OAuth)
    return getLocalUserLists(String(rawUserId));
};

export const updateInteraction = async (wikidataId: string, updates: Partial<UserMovieInteraction>) => {
    const user = await getSupabaseUser();
    const rawUserId = user?.id || user?.userid;
    if (!rawUserId || !wikidataId) return;

    if (updates.progress_seconds !== undefined) {
        try {
            localStorage.setItem(`classicflix_progress_${rawUserId}_${wikidataId}`, String(Math.floor(updates.progress_seconds)));
        } catch {}
    }

    const hasListUpdates =
        updates.isfavorite !== undefined ||
        updates.iswatched !== undefined ||
        updates.watchlater !== undefined ||
        updates.iswatchlist !== undefined;

    if (!hasListUpdates) return;

    const supabaseUuid = await resolveSupabaseUuid(user);
    if (supabaseUuid) {
        const supabase = await getSupabase();
        if (!supabase) return;

        const payload: Record<string, any> = {
            userid: supabaseUuid,
            wikidataid: wikidataId,
            lastupdated: new Date().toISOString()
        };

        if (updates.isfavorite !== undefined) payload.isfavorite = Boolean(updates.isfavorite);
        if (updates.iswatched !== undefined) payload.iswatched = Boolean(updates.iswatched);
        if (updates.watchlater !== undefined || updates.iswatchlist !== undefined) {
            payload.watchlater = Boolean(updates.watchlater ?? updates.iswatchlist);
        }

        const { error } = await supabase
            .from('userlists')
            .upsert(payload, { onConflict: 'userid,wikidataid' });

        if (error) {
            console.error("Erro ao atualizar userlists:", error.message);
            throw error;
        }
        return;
    }

    // For Firebase Auth users (e.g. Google OAuth), write to Firestore
    if (auth.currentUser?.uid) {
        const fbUid = auth.currentUser.uid;
        const path = `users/${fbUid}/userlists/${wikidataId}`;
        try {
            const existingLists = await getUserInteractions();
            const existing = existingLists.find(i => i.wikidataid === wikidataId);
            const nextFavorite = updates.isfavorite !== undefined ? Boolean(updates.isfavorite) : Boolean(existing?.isfavorite);
            const nextWatched = updates.iswatched !== undefined ? Boolean(updates.iswatched) : Boolean(existing?.iswatched);
            const nextWatchLater = (updates.watchlater !== undefined || updates.iswatchlist !== undefined)
                ? Boolean(updates.watchlater ?? updates.iswatchlist)
                : Boolean(existing?.watchlater ?? existing?.iswatchlist);

            await setDoc(doc(db, 'users', fbUid, 'userlists', wikidataId), {
                userid: fbUid,
                wikidataid: wikidataId,
                isfavorite: nextFavorite,
                iswatched: nextWatched,
                watchlater: nextWatchLater,
                lastupdated: serverTimestamp(),
            });
            return;
        } catch (error) {
            handleFirestoreError(error, FirestoreOperationType.WRITE, path);
        }
    }

    // LocalStorage fallback (e.g., Wikipedia OAuth)
    const current = getLocalUserLists(String(rawUserId));
    const idx = current.findIndex(i => i.wikidataid === wikidataId);
    const prev = idx >= 0 ? current[idx] : {
        wikidataid: wikidataId,
        isfavorite: false,
        iswatched: false,
        watchlater: false,
        iswatchlist: false,
        progress_seconds: 0
    };
    const nextWatchLater = (updates.watchlater !== undefined || updates.iswatchlist !== undefined)
        ? Boolean(updates.watchlater ?? updates.iswatchlist)
        : Boolean(prev.watchlater ?? prev.iswatchlist);
    const updatedItem: UserMovieInteraction = {
        ...prev,
        isfavorite: updates.isfavorite !== undefined ? Boolean(updates.isfavorite) : prev.isfavorite,
        iswatched: updates.iswatched !== undefined ? Boolean(updates.iswatched) : prev.iswatched,
        watchlater: nextWatchLater,
        iswatchlist: nextWatchLater,
        lastupdated: new Date().toISOString(),
    };
    if (idx >= 0) current[idx] = updatedItem;
    else current.unshift(updatedItem);
    saveLocalUserLists(String(rawUserId), current);
};

export const incrementMoviePopularity = async (id: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.rpc('increment_popularity', { movie_id: id });
};

export const savePlaybackProgress = async (wikidataId: string, seconds: number) => {
    await updateInteraction(wikidataId, { progress_seconds: Math.floor(seconds) });
};

export const updateMoviePoster = async (id: string, posterUrl: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    await supabase.from('movies').update({ posterurl: posterUrl }).eq('id', id);
};

export const updateMoviePosterByWikidataId = async (wikidataId: string, posterUrl: string): Promise<boolean> => {
    const supabase = await getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from('movies').update({ posterurl: posterUrl }).eq('wikidataid', wikidataId);
    return !error;
};

/**
 * Salva a pontuação do quiz no Supabase
 * Usa upsert pois userid é a chave primária
 */
export const saveQuizScore = async (score: number, movieTitle: string) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const user = await getSupabaseUser();
    if (!user) return;

    // Busca o score atual para garantir que só salvamos se for maior (opcional, mas comum em rankings)
    const { data: currentEntry } = await supabase
        .from('quizranking')
        .select('score')
        .eq('userid', user.id)
        .single();

    if (currentEntry && currentEntry.score >= score) return;

    const { error } = await supabase.from('quizranking').upsert({
        userid: user.id,
        email: user.email || 'Anônimo',
        score: score,
        title: movieTitle,
        created_at: new Date().toISOString()
    });

    if (error) console.error("Erro ao salvar score:", error.message);
};

/**
 * Busca o ranking global do quiz
 */
export const getLeaderboard = async () => {
    const supabase = await getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('quizranking')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Erro ao buscar leaderboard:", error.message);
        return [];
    }
    return data;
};

export const upsertIdentifiers = async (wikidataId: string, ids: {
    archiveId?: string;
    imdbId?: string;
    googleKnowId?: string;
    ofdbId?: string;
    openMdbId?: string;
    youtubeId?: string;
    commons?: string;
}) => {
    const supabase = await getSupabase();
    if (!supabase) {
        throw new Error('Supabase indisponível. Os identificadores não foram salvos.');
    }

    const { error } = await supabase.from('identifiers').upsert([{
        wikidataid: wikidataId,
        archiveid: ids.archiveId || null,
        imdbid: ids.imdbId || null,
        googleknowid: ids.googleKnowId || null,
        ofdbid: ids.ofdbId || null,
        openmdbid: ids.openMdbId || null,
        youtube: ids.youtubeId || null,
        commons: ids.commons || null,
        updatedat: new Date().toISOString(),
    }], { onConflict: 'wikidataid' });

    if (error) {
        console.error('Erro ao salvar identifiers:', error);
        throw new Error(`Falha ao salvar identificadores de ${wikidataId}: ${error.message}`);
    }
};

