import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://rqtlqqmdldpsrtuviedy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdGxxcW1kbGRwc3J0dXZpZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDgyOTQsImV4cCI6MjA4NTI4NDI5NH0.egKKScXyTjpS6NcOI1oZT-nCU3IKu_1h5xA48ZN4nSM');
async function run() {
  const { data, error } = await sb.from('users').select('*').eq('email', 'liclopes@gmail.com');
  console.log('User:', data);
  console.log('Error:', error);
}
run();
