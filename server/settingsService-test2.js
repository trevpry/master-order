async function getSettings() {
  console.log('getSettings called');
  return { test: 'success' };
}

module.exports = {
  getSettings
};
