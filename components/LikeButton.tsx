
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

interface LikeButtonProps {
  targetId: string;
  targetType: 'review' | 'comment';
  initialLikes: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ targetId, targetType, initialLikes }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const likeRef = doc(db, 'likes', `${user.uid}_${targetId}`);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    });

    return () => unsubscribe();
  }, [targetId, user]);

  const handleToggleLike = async () => {
    if (!user) return;

    // Call the Supabase RPC function
    // Since we are using Firebase for data, we need to call the Supabase RPC function
    // through a fetch request to a Supabase edge function or API route.
    // Assuming we have a way to call Supabase RPC.
    
    // For now, let's just simulate the logic or use a placeholder for the RPC call.
    // The user asked to use Supabase for the likes feature.
    
    try {
      const response = await fetch('/api/toggle-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, targetType, userId: user.uid })
      });
      
      if (!response.ok) throw new Error('Failed to toggle like');
      
      // Optimistic update
      setLikes(prev => isLiked ? prev - 1 : prev + 1);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  return (
    <button 
      className={`btn btn-link p-0 d-flex align-items-center gap-1 ${isLiked ? 'text-danger' : 'text-secondary'}`}
      onClick={handleToggleLike}
    >
      <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
      <span className="xsmall">{likes}</span>
    </button>
  );
};
