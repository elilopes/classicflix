import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rqtlqqmdldpsrtuviedy.supabase.co';
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('movies').select('title, awards').not('awards', 'is', null).limit(10);
  console.log('movies with awards:', data);
  if (data && data.length === 0) {
      const { data: all } = await sb.from('movies').select('title, awards').limit(20);
      console.log('sample movies:', all);
  }
}
run();
