import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ulzcqypxfvexjpnxuxgo.supabase.co'
const supabaseKey = 'sb_publishable_9co-50aMwmxNnE1Bd5Ou3Q_IuTdSZtD'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const lessonId = 'ef3a7012-8af9-4ee4-8b2c-04486423c5aa'
  await supabase
    .from('lessons')
    .update({ pdf_url: null })
    .eq('id', lessonId)
  console.log('Restored pdf_url to null.')
}
run()
