import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function checkExams() {
  const { data, error } = await supabase.from('exams').select('*').limit(3);
  if (error) {
    console.error('Error fetching exams:', error);
  } else {
    for (const exam of data) {
      console.log('Exam Title:', exam.title);
      console.log('Exam Data keys:', Object.keys(exam.data || {}));
      if (exam.data?.questions) {
        console.log('Sample Questions count:', exam.data.questions.length);
        console.log('Sample Question 1:', exam.data.questions[0]);
      }
      console.log('-------------------');
    }
  }
}

checkExams();
