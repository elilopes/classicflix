/**
 * Resolve a playable video file from an Internet Archive item.
 * Refuses books, audio, documents and other non-movie media types.
 */
export const resolveArchiveVideoUrl = async (src: string): Promise<string> => {
  let identifier = '';
  try {
    const url = new URL(src);
    const match = url.pathname.match(/\/(?:download|details)\/([^/]+)/);
    if (match?.[1]) identifier = decodeURIComponent(match[1]);
    // A direct media file should be passed through without another metadata lookup.
    if (/\.(mp4|m4v|webm|ogv|ogg)(?:$|\?)/i.test(url.pathname)) return src;
  } catch { return src; }
  if (!identifier) return src;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let data: any;
    try {
      const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, { signal: controller.signal });
      if (!response.ok) return '';
      data = await response.json();
    } finally { clearTimeout(timeout); }

    if (data.metadata?.mediatype !== 'movies') return '';
    const files = (data.files || []).filter((f: any) => {
      const name = String(f.name || '').toLowerCase();
      const format = String(f.format || '').toLowerCase();
      if (!/\.(mp4|m4v|webm|ogv|ogg)$/.test(name)) return false;
      if (/sample|trailer|preview|thumb|poster|cover|subtitle|torrent/.test(name)) return false;
      return format.includes('video') || format.includes('h.264') || format.includes('mpeg') ||
        format.includes('webm') || format.includes('ogg') || f.source === 'original';
    });
    files.sort((a: any, b: any) => {
      const rank = (f: any) => (/\.mp4$/i.test(f.name) ? 50 : /\.webm$/i.test(f.name) ? 30 : 10) +
        (String(f.format || '').toLowerCase().includes('h.264') ? 20 : 0) + (f.source === 'original' ? 5 : 0);
      return rank(b) - rank(a);
    });
    const best = files[0];
    return best?.name
      ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(best.name)}`
      : src;
  } catch (error) {
    console.warn('Error resolving Archive video:', error);
    return src;
  }
};
