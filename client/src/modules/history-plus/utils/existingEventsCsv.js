const CSV_HEADERS = ['Event Title', 'Start Date', 'End Date', 'Event Description'];

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? '');

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const sanitizeDownloadName = (value, fallback = 'history-plus-events') => {
  const sanitized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return sanitized || fallback;
};

export const getExistingEventsCsvFileName = (baseName = 'history-plus-existing-events') => (
  `${sanitizeDownloadName(baseName, 'history-plus-existing-events')}-existing-events.csv`
);

export const getExistingEventsCsvReferenceText = (fileName = 'existing-events.csv') => (
  `Existing historical events are provided separately in the CSV file "${fileName}". The file columns are: Event Title, Start Date, End Date, Event Description.`
);

export const buildExistingEventsCsv = (events = []) => {
  const rows = [CSV_HEADERS.join(',')];

  events.forEach((event) => {
    const eventDescription = event?.details
      ?? event?.description
      ?? event?.eventDescription
      ?? '';

    rows.push([
      escapeCsvValue(event?.title || ''),
      escapeCsvValue(event?.startDate || ''),
      escapeCsvValue(event?.endDate || ''),
      escapeCsvValue(eventDescription)
    ].join(','));
  });

  return rows.join('\n');
};

export const downloadCsvFile = (fileName, csvContent) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (text) => {
  const value = String(text || '');
  if (!value) return false;

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, falling back to execCommand copy:', error?.message || error);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error);
    return false;
  }
};