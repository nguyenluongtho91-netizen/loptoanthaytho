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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Creating storage bucket "exams_pdf"...');
  const { data, error } = await supabase.storage.createBucket('exams_pdf', {
    public: true
  });

  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket "exams_pdf" created successfully:', data);
  }
}

main();
