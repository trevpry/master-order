/**
 * Normalize titles for strict equality checks while tolerating harmless formatting differences.
 */
function normalizeTitleForExactMatch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = {
  normalizeTitleForExactMatch
};
