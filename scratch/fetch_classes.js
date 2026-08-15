const url = 'https://ulzcqypxfvexjpnxuxgo.supabase.co/rest/v1/classes?select=*';
const anonKey = 'sb_publishable_9co-50aMwmxNnE1Bd5Ou3Q_IuTdSZtD';

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    console.log(data.map(c => ({ id: c.id, class_name: c.class_name, subject: c.subject, room: c.room, schedule: c.schedule, status: c.status })));
  } catch (err) {
    console.error(err);
  }
}

run();
