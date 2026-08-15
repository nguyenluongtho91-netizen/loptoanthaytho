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

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'test_admin@example.com';
  const password = 'password123';
  
  console.log(`Creating/updating user ${email}...`);
  
  // Try to find if user exists in profiles first
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
  
  let userId;
  if (profile) {
    console.log(`User already exists in profiles (ID: ${profile.id}). Updating password...`);
    userId = profile.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      console.error('Error updating password:', updateError);
    } else {
      console.log('Password updated successfully.');
    }
  } else {
    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Test Admin' }
    });
    
    if (createError) {
      console.error('Error creating user in auth:', createError);
      return;
    }
    
    userId = newUser.user.id;
    console.log(`Auth user created successfully (ID: ${userId}).`);
  }
  
  // Make sure the profile has ADMIN role
  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    name: 'Test Admin',
    role: 'ADMIN',
    active: true
  });
  
  if (upsertError) {
    console.error('Error upserting profile:', upsertError);
  } else {
    console.log('Profile updated to ADMIN successfully.');
  }
}

main();
