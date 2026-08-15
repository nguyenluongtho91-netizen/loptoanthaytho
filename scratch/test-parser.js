function parseScheduleToDays(scheduleStr) {
  if (!scheduleStr) return [];
  
  const str = scheduleStr.trim().toLowerCase();
  if (!str) return [];

  // 1. Find all weekday keywords and their indices
  const dayKeywords = [
    { name: 'chủ nhật', keys: ['chủ nhật', 'chủn nhật', 'cn', 'c.n', 'sunday'], value: 0 },
    { name: 'thứ 2', keys: ['thứ 2', 'thứ hai', 't2', 't.2', 'monday'], value: 1 },
    { name: 'thứ 3', keys: ['thứ 3', 'thứ ba', 't3', 't.3', 'tuesday'], value: 2 },
    { name: 'thứ 4', keys: ['thứ 4', 'thứ tư', 't4', 't.4', 'wednesday'], value: 3 },
    { name: 'thứ 5', keys: ['thứ 5', 'thứ năm', 't5', 't.5', 'thursday'], value: 4 },
    { name: 'thứ 6', keys: ['thứ 6', 'thứ sáu', 't6', 't.6', 'friday'], value: 5 },
    { name: 'thứ 7', keys: ['thứ 7', 'thứ bảy', 't7', 't.7', 'saturday'], value: 6 }
  ];

  const foundDays = [];

  for (const group of dayKeywords) {
    for (const key of group.keys) {
      let index = str.indexOf(key);
      while (index !== -1) {
        const isDuplicate = foundDays.some(fd => fd.index <= index && index < fd.index + fd.length);
        if (!isDuplicate) {
          foundDays.push({
            day: group.value,
            index: index,
            length: key.length
          });
        }
        index = str.indexOf(key, index + 1);
      }
    }
  }

  foundDays.sort((a, b) => a.index - b.index);

  // 2. Find all time ranges and their indices
  const timeRegex = /(\d{1,2}\s*[h:]\s*\d{0,2}\s*(?:-|–|đến)\s*\d{1,2}\s*[h:]\s*\d{0,2})/g;
  
  const foundTimes = [];
  let match;
  while ((match = timeRegex.exec(str)) !== null) {
    foundTimes.push({
      time: match[1].trim(),
      index: match.index,
      length: match[1].length
    });
  }

  if (foundTimes.length === 0) {
    return foundDays.map(fd => ({ day: fd.day, time: '' }));
  }

  const results = foundDays.map((fd, i) => {
    if (foundTimes.length === 1) {
      return { day: fd.day, time: foundTimes[0].time };
    }

    const nextDayIndex = i < foundDays.length - 1 ? foundDays[i + 1].index : Infinity;
    const matchingTime = foundTimes.find(ft => ft.index >= fd.index && ft.index < nextDayIndex);

    if (matchingTime) {
      return { day: fd.day, time: matchingTime.time };
    }

    let closestTime = foundTimes[0];
    let minDiff = Math.abs(foundTimes[0].index - fd.index);
    for (const ft of foundTimes) {
      const diff = Math.abs(ft.index - fd.index);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = ft;
      }
    }
    return { day: fd.day, time: closestTime ? closestTime.time : '' };
  });

  return results;
}

const testCases = [
  'Thứ 4 (2h30-4h30), Thứ 7 (2h30-4h30), ',
  'Thứ 3 và thứ 6 (2h30 - 4h30)',
  'Thứ 2, thứ 5, 2h30-4h30',
  '',
  null,
  'T2: 18h00 - 20h00, T5: 17h00 - 19h00'
];

testCases.forEach(tc => {
  console.log(`Input: "${tc}"`);
  console.log('Output:', parseScheduleToDays(tc));
  console.log('---');
});
