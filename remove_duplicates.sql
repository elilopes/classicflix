
-- ====================================================================================
-- SCRIPT TO REMOVE DUPLICATES (Keeping Wikimedia/Archive.org Preferred)
-- 
-- Run this in your Supabase SQL Editor.
-- ====================================================================================

WITH Duplicates AS (
    -- 1. Identify Titles that appear more than once
    SELECT title
    FROM public.movies
    GROUP BY title
    HAVING COUNT(*) > 1
),
RankedMovies AS (
    -- 2. Rank them based on preference
    -- Priority 1: Has "Wikimedia Commons" label or video URL
    -- Priority 2: Has "Archive.org" label
    -- Priority 3: Any other
    -- We use ROW_NUMBER() to pick the top 1 per title
    SELECT 
        id, 
        title,
        ROW_NUMBER() OVER (
            PARTITION BY title 
            ORDER BY 
                CASE 
                    WHEN "sourceLabel" = 'Wikimedia Commons' THEN 1
                    WHEN "videoUrl" LIKE '%wikimedia%' THEN 2
                    WHEN "sourceLabel" = 'Archive.org' THEN 3
                    ELSE 4 
                END ASC,
                "videoUrl" IS NOT NULL DESC -- Prefer entry with video if source is same
        ) as rank
    FROM public.movies
    WHERE title IN (SELECT title FROM Duplicates)
)
-- 3. Delete the losers (Rank > 1)
DELETE FROM public.movies
WHERE id IN (
    SELECT id FROM RankedMovies WHERE rank > 1
);

-- 4. Specifically remove the broken "Charge - Open Movie" if it exists
DELETE FROM public.movies 
WHERE "videoUrl" LIKE '%Charge_-_Open_Movie%' 
   OR "videoUrl" LIKE '%wikipedia-commons-local-public.ff%';
