import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Querying classes...');
  const { data, error } = await supabase.from('classes').select('*').limit(1);
  if (error) {
    console.error('Error fetching classes:', error);
  } else {
    console.log('Classes sample row:', data);
  }
  
  console.log('Querying profiles...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(5);
  if (pError) {
    console.error('Error fetching profiles:', pError);
  } else {
    console.log('Profiles sample:', profiles);
  }
}

main();
