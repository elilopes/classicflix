import { getSupabase, getCurrentUser } from './bd';

export interface UserScore {
    userid: string;
    quizscore: number;
    stopscore: number;
    emojiscore: number;
    mosaicscore: number;
    nosferatuscore: number;
}

export const getUserScore = async (): Promise<UserScore | null> => {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('userscore')
        .select('*')
        .eq('userid', user.id)
        .single();

    if (error) {
        console.error("Erro ao buscar score do usuário:", error.message);
        return null;
    }
    return data;
};

export const updateUserScore = async (gameType: 'quizscore' | 'stopscore' | 'emojiscore' | 'mosaicscore' | 'nosferatuscore', score: number) => {
    const supabase = await getSupabase();
    if (!supabase) return;
    const user = await getCurrentUser();
    if (!user) return;

    // Primeiro, tenta buscar o score atual
    const { data: currentScore } = await supabase
        .from('userscore')
        .select(gameType)
        .eq('userid', user.id)
        .single();

    // Se já existe e o score novo não é maior, não faz nada (opcional)
    if (currentScore && currentScore[gameType] >= score) return;

    // Atualiza ou insere
    const { error } = await supabase
        .from('userscore')
        .upsert({
            userid: user.id,
            [gameType]: score
        });

    if (error) {
        console.error(`Erro ao atualizar ${gameType}:`, error.message);
    }
};
