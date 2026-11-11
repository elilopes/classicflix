import { createClient } from '@supabase/supabase-js';
import https from 'https';

const SUPABASE_URL = 'https://rqtlqqmdldpsrtuviedy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function fetchFolderHtml() {
  return new Promise((resolve, reject) => {
    https.get('https://drive.google.com/drive/folders/1EplnNSliyeRLI0KcTYACJrvmIweqlxcX?usp=sharing', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching Google Drive folder HTML...');
  const html = await fetchFolderHtml() as string;
  
  const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
  if (!match) {
    console.error('Could not find _DRIVE_ivd in HTML');
    return;
  }
  
  const raw = eval("'" + match[1] + "'");
  const parsed = JSON.parse(raw);
  
  const driveMap = new Map<string, string>();
  if (parsed[0]) {
    parsed[0].forEach((item: any) => {
      const fileId = item[0];
      const name = item[2];
      if (name && name.startsWith('Q') && name.endsWith('.webp')) {
        const qid = name.replace('.webp', '');
        driveMap.set(qid, `https://lh3.googleusercontent.com/d/${fileId}`);
      }
    });
  }
  
  console.log(`Found ${driveMap.size} poster images in Google Drive folder payload.`);
  
  let from = 0;
  const step = 1000;
  let updatedCount = 0;
  
  while (true) {
    const { data: movies, error } = await supabase
      .from('movies')
      .select('id, wikidataid, posterurl')
      .range(from, from + step - 1);
      
    if (error) {
      console.error('Supabase error:', error);
      break;
    }
    
    if (!movies || movies.length === 0) break;
    
    console.log(`Processing batch ${from} to ${from + movies.length - 1}...`);
    
    for (const m of movies) {
      const qid = m.wikidataid;
      if (!qid) continue;
      
      const newPosterUrl = driveMap.get(qid);
      if (newPosterUrl) {
        const currentUrl = m.posterurl || '';
        const shouldReplace = !currentUrl || 
          currentUrl.includes('commons') || 
          currentUrl.includes('archive') || 
          currentUrl.includes('media-amazon') || 
          currentUrl.includes('upload') ||
          currentUrl.includes('wikimedia');
          
        if (shouldReplace && currentUrl !== newPosterUrl) {
          const { error: updateError } = await supabase
            .from('movies')
            .update({ posterurl: newPosterUrl })
            .eq('wikidataid', qid);
            
          if (!updateError) {
            updatedCount++;
          }
        }
      }
    }
    
    if (movies.length < step) break;
    from += step;
  }
  
  console.log(`Successfully updated ${updatedCount} movie poster URLs with Google Drive links!`);
}

run().catch(console.error);
