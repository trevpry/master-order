const test = require('node:test');
const assert = require('node:assert/strict');

const { splitArtistNameAndType, scoreArtistNameMatch } = require('../utils/artistNameMatch');

test('splits "Name — Type" on em dash, en dash, or double hyphen', () => {
  assert.deepEqual(splitArtistNameAndType('Antonio Mazzoni — Composer'), { name: 'Antonio Mazzoni', typeName: 'Composer' });
  assert.deepEqual(splitArtistNameAndType('Antonio Mazzoni -- Composer'), { name: 'Antonio Mazzoni', typeName: 'Composer' });
  assert.deepEqual(splitArtistNameAndType('Antonio Mazzoni – Composer'), { name: 'Antonio Mazzoni', typeName: 'Composer' });
  assert.deepEqual(splitArtistNameAndType('Jean-Baptiste Lully'), { name: 'Jean-Baptiste Lully', typeName: null });
});

test('scores artist names flexibly', () => {
  assert.equal(scoreArtistNameMatch('Antonio Mazzoni', 'antonio mazzoni'), 1);
  assert.ok(scoreArtistNameMatch('Antonio Mazzoni', 'Antonio Maria Mazzoni') >= 0.85);
  assert.ok(scoreArtistNameMatch('Leif Aruhn-Solén', 'Leif Aruhn-Solen') >= 0.85);
  assert.ok(scoreArtistNameMatch('Mazzoni, Antonio', 'Antonio Mazzoni') >= 0.85);
  assert.ok(scoreArtistNameMatch('J. S. Bach', 'Johann Sebastian Bach') >= 0.85);
  assert.ok(scoreArtistNameMatch('Antonio Vivaldi', 'Antonio Mazzoni') < 0.85);
  assert.ok(scoreArtistNameMatch('Anna Maria Panzarella', 'Anna Maria Mazzoni') < 0.85);
});
