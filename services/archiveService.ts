
/**
 * Resolves the actual playable MP4 URL from an Internet Archive identifier.
 * Uses the standard download redirector to ensure robustness.
 */
export const resolveArchiveVideoUrl = async (src: string): Promise<string> => {
  let identifier = '';

  // 1. Extract Identifier from download or details URL
  if (src.includes('archive.org/download/')) {
    const parts = src.split('archive.org/download/');
    if (parts.length >= 2) identifier = parts[1].split('/')[0];
  } else if (src.includes('archive.org/details/')) {
    const parts = src.split('archive.org/details/');
    if (parts.length >= 2) identifier = parts[1].split('/')[0];
  }

  if (!identifier) {
    return src;
  }

  try {
    // 2. Fetch Metadata
    const metaUrl = `https://archive.org/metadata/${identifier}`;
    let data;
    
    try {
        const response = await fetch(metaUrl);
        if (!response.ok) return src;
        data = await response.json();
    } catch (e) {
        return src;
    }

    if (!data.files || data.files.length === 0) {
        return src;
    }

    // 3. Find the best video file
    // Priority: h.264 (MP4) > MPEG4 > Any MP4. Exclude trailers.
    let bestFile = data.files.find((f: any) => f.format === 'h.264' && f.name.endsWith('.mp4') && !f.name.toLowerCase().includes('trailer'));
    
    if (!bestFile) {
        bestFile = data.files.find((f: any) => f.format === 'MPEG4' && f.name.endsWith('.mp4'));
    }
    
    if (!bestFile) {
        bestFile = data.files.find((f: any) => f.name.endsWith('.mp4') && !f.name.toLowerCase().includes('trailer'));
    }

    // 4. Construct robust redirect URL
    if (bestFile) {
        // We use the standard /download/ endpoint which handles redirects to the correct node automatically.
        // We MUST encode the filename to handle spaces and special characters.
        const safeFilename = encodeURIComponent(bestFile.name);
        return `https://archive.org/download/${identifier}/${safeFilename}`;
    }

    return src;
  } catch (error) {
    console.error("Error resolving Archive URL:", error);
    return src;
  }
};
