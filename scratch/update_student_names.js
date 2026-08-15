import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Function to convert string to Title Case (Vietnamese proper casing)
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    env[key] = value
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

console.log('Using Supabase URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Fetching all students...');
  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, student_code')
  
  if (error) {
    console.error('Error fetching students:', error)
    return
  }

  console.log(`Found ${students.length} students. Checking names...`);
  
  const toUpdate = [];
  for (const s of students) {
    const originalName = s.full_name || '';
    const formattedName = toTitleCase(originalName);
    
    if (originalName !== formattedName) {
      toUpdate.push({
        id: s.id,
        student_code: s.student_code,
        original: originalName,
        formatted: formattedName
      });
    }
  }

  console.log(`\nWill update ${toUpdate.length} / ${students.length} student names.`);
  console.log('Sample updates (first 10):');
  toUpdate.slice(0, 10).forEach(u => {
    console.log(`- [${u.student_code}]: "${u.original}" -> "${u.formatted}"`);
  });

  if (process.argv.includes('--commit')) {
    console.log('\nCommitting updates to database...');
    let updatedCount = 0;
    for (const u of toUpdate) {
      const { error: updateErr } = await supabase
        .from('students')
        .update({ full_name: u.formatted })
        .eq('id', u.id)
      
      if (updateErr) {
        console.error(`Failed to update [${u.student_code}]:`, updateErr.message);
      } else {
        updatedCount++;
      }
    }
    console.log(`Successfully updated ${updatedCount} students.`);
  } else {
    console.log('\nThis was a DRY RUN. Run with "node scratch/update_student_names.js --commit" to perform the actual update.');
  }
}

run()
