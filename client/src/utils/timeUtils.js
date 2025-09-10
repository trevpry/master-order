export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
};

export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const parseTimeString = (timeString) => {
  if (!timeString) return 0;
  
  const parts = timeString.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
};

export default {
  formatDuration,
  formatTime,
  parseTimeString
};
