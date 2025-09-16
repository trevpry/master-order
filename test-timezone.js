const now = new Date();
console.log('Current UTC time:', now.toISOString());
console.log('Current local time:', now.toString());

const formatter = new Intl.DateTimeFormat('en-CA', { 
  timeZone: 'America/New_York', 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit' 
});

const dateString = formatter.format(now);
console.log('Date in America/New_York timezone:', dateString);

// Also test what time it is in New York
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZoneName: 'short'
});

console.log('Current time in America/New_York:', timeFormatter.format(now));