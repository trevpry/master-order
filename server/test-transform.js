// Test the exact transformation logic from the import script
const video4515 = {
  id: '4515',
  title: '06:TutankhamenΓÇöA Murder Theory',
  url: 'https://www.thegreatcoursesplus.com/great-pharaohs-of-ancient-egypt/?lecplay=06',
  eventId: '620',
  channelId: null
};

console.log('Original record:', video4515);

// Apply the same transformation logic as in the import script
const transformedRecord = {
  ...video4515,
  id: parseInt(video4515.id),
  // Map CSV fields to schema fields
  eventId: video4515.eventId ? parseInt(video4515.eventId) : null,
  thumbnailUrl: video4515.thumbnail || video4515.thumbnailUrl || null,
  channelId: video4515.channelId ? parseInt(video4515.channelId) : null,
  // Add required type field based on URL detection
  type: video4515.type || 'greatcoursesplus',
  // Remove the old field names
  historicalEventId: undefined,
  thumbnail: undefined,
  watchedProgress: undefined,
  isWatched: undefined,
  source: undefined,
  sourceId: undefined
};

console.log('Transformed record:', transformedRecord);
console.log('EventID after transformation:', transformedRecord.eventId, '(type:', typeof transformedRecord.eventId, ')');

// Test parseInt specifically
console.log('parseInt("620"):', parseInt("620"));
console.log('parseInt(""):', parseInt(""));
console.log('parseInt(null):', parseInt(null));