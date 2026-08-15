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

console.log(toTitleCase("BÙI LÊ THANH TRÚC"));
console.log(toTitleCase("bùi lê thanh trúc"));
console.log(toTitleCase("PHẠM HẢI LONG"));
console.log(toTitleCase("NGUYỄN THỊ SƯƠNG"));
