const url = 'https://ulzcqypxfvexjpnxuxgo.supabase.co/rest/v1/classes';
const anonKey = 'sb_publishable_9co-50aMwmxNnE1Bd5Ou3Q_IuTdSZtD';

const updates = [
  {
    id: '549b62b8-26ff-4049-b88b-4989dd2e1481',
    class_name: '2015 - TOÁN 6 KIM THÀNH',
    schedule: 'Thứ 2 (7h00-8h40), Thứ 5 (7h00-8h40)',
    room: 'KIM THÀNH'
  },
  {
    id: 'a8a9cb66-4d75-4d94-aa2a-7c0e22db2de9',
    class_name: '2013 - TOÁN 8 KIM THÀNH',
    schedule: 'Thứ 3 (7h00-8h40), Thứ 6 (7h00-8h40)',
    room: 'KIM THÀNH'
  },
  {
    id: 'd2d5f3fb-d7ec-4e1e-a645-f9401524879c',
    class_name: '2014 - TOÁN 7 KIM THÀNH',
    schedule: 'Thứ 4 (7h00-8h40), Thứ 7 (7h00-8h40)',
    room: 'KIM THÀNH'
  },
  {
    id: '22b0cdf8-2b11-402c-99b0-d615a34757f1',
    class_name: '2014 - TOÁN 7 TÂY SƠN',
    schedule: 'Thứ 2 (9h15-11h00), Thứ 5 (9h15-11h00)',
    room: 'TÂY SƠN'
  },
  {
    id: 'a423da68-4492-49dc-9d9b-be228f35c7ba',
    class_name: '2013 - TOÁN 8 TÂY SƠN',
    schedule: 'Thứ 3 (9h15-11h00), Thứ 6 (9h15-11h00)',
    room: 'TÂY SƠN'
  },
  {
    id: '45fb6c30-afa4-4039-81d9-c99719ed664e',
    class_name: '2015 - TOÁN 6 TÂY SƠN',
    schedule: 'Thứ 4 (9h15-11h00), Thứ 7 (9h15-11h00)',
    room: 'TÂY SƠN'
  },
  {
    id: '9bad5bbf-635c-4a3a-bfa3-0ea2e1a1e37b',
    class_name: '2012 - TOÁN 9 HÀ TÂN',
    schedule: 'Thứ 2 (14h30-16h30), Thứ 5 (14h30-16h30)',
    room: 'HÀ TÂN'
  },
  {
    id: '0c86cf10-07dd-4879-9114-611584d76eff',
    class_name: '2012 - TOÁN 9 KIM THÀNH',
    schedule: 'Thứ 3 (14h30-16h30), Thứ 6 (14h30-16h30)',
    room: 'KIM THÀNH'
  },
  {
    id: '6d559653-dbe6-438c-9f38-5f74ff82a023',
    class_name: '2012 - TOÁN 9 TÂY SƠN',
    schedule: 'Thứ 4 (14h30-16h30), Thứ 7 (14h30-16h30)',
    room: 'TÂY SƠN'
  }
];

async function run() {
  for (const item of updates) {
    try {
      const res = await fetch(`${url}?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          schedule: item.schedule,
          room: item.room
        })
      });
      if (res.ok) {
        console.log(`Updated successfully: ${item.class_name}`);
      } else {
        const errText = await res.text();
        console.error(`Failed to update ${item.class_name}:`, errText);
      }
    } catch (err) {
      console.error(`Error updating ${item.class_name}:`, err);
    }
  }
}

run();
