
import { getSupabase, getCurrentUser } from './bd';
import { Review, Comment } from '../types';

export const fetchMovieReviews = async (movieId: string): Promise<Review[]> => {
    const supabase = await getSupabase();
    if (!supabase) return [];

    // Fetch reviews
    const { data: reviews, error: reviewsError } = await supabase
        .from('moviereviews')
        .select('*')
        .eq('wikidataid', movieId)
        .order('created_at', { ascending: false });

    if (reviewsError) {
        console.error("Error fetching reviews:", reviewsError);
        return [];
    }

    // Fetch comments for these reviews
    const reviewIds = reviews.map(r => r.id);
    if (reviewIds.length === 0) return reviews;

    const { data: comments, error: commentsError } = await supabase
        .from('moviecomments')
        .select('*')
        .in('reviewid', reviewIds)
        .order('created_at', { ascending: true });

    if (commentsError) {
        console.error("Error fetching comments:", commentsError);
        return reviews;
    }

    // Attach comments to reviews
    return reviews.map(review => ({
        ...review,
        replies: comments.filter(c => c.reviewid === review.id)
    }));
};

export const addReview = async (movieId: string, rating: number, content: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");
    
    const user = await getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.from('moviereviews').insert([{
        wikidataid: movieId,
        userid: user.id,
        email: user.email,
        rating,
        content,
        created_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    return data;
};

export const deleteReview = async (reviewId: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");
    
    const user = await getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
        .from('moviereviews')
        .delete()
        .eq('id', reviewId)
        .eq('userid', user.id);

    if (error) throw error;
};

export const addComment = async (reviewId: string, content: string, movieId: string, parentId?: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");
    
    const user = await getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.from('moviecomments').insert([{
        reviewid: reviewId,
        wikidataid: movieId,
        userid: user.id,
        email: user.email,
        content,
        parent_id: parentId,
        created_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    return data;
};

export const voteReview = async (reviewId: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");

    // First fetch current votes
    const { data: current, error: fetchError } = await supabase
        .from('moviereviews')
        .select('votes')
        .eq('id', reviewId)
        .single();

    if (fetchError) {
        console.warn("Could not fetch current votes, attempting direct increment or fallback", fetchError);
    }

    const currentVotes = current?.votes || 0;
    const newVotes = currentVotes + 1;

    const { data, error } = await supabase
        .from('moviereviews')
        .update({ votes: newVotes })
        .eq('id', reviewId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteComment = async (commentId: string) => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");
    
    const user = await getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
        .from('moviecomments')
        .delete()
        .eq('id', commentId)
        .eq('userid', user.id);

    if (error) throw error;
};


