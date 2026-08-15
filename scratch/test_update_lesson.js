import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  const { data: lessons, error: fetchErr } = await supabase.from('lessons').select('*').limit(1);
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  if (!lessons || lessons.length === 0) {
    console.log('No lessons found to test.');
    return;
  }

  const lesson = lessons[0];
  console.log('Attempting to update lesson:', lesson.id);

  const { data, error } = await supabase
    .from('lessons')
    .update({ 
      exam_ids: [],
      exam_id: null 
    })
    .eq('id', lesson.id)
    .select();

  if (error) {
    console.error('Update failed with error:', error);
  } else {
    console.log('Update succeeded:', data);
  }
}

main();
