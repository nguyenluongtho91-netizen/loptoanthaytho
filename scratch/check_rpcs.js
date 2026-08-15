import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRpc() {
  console.log('Testing RPC or metadata access...')
  
  // Let's try executing RPC to see if there is an executive SQL function
  const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' })
  console.log('exec_sql RPC result:', { rpcData, rpcError })
  
  const { data: rpcData2, error: rpcError2 } = await supabase.rpc('exec', { query: 'SELECT 1' })
  console.log('exec RPC result:', { rpcData2, rpcError2 })

  // Let's see if we can query functions
  const { data: funcData, error: funcError } = await supabase
    .from('pg_proc')
    .select('*')
    .limit(1)
  console.log('Query pg_proc:', { hasData: !!funcData, funcError })
}

testRpc()
