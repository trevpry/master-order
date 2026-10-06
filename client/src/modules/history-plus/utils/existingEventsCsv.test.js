import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExistingEventsCsv, getExistingEventsCsvFileName, getExistingEventsCsvReferenceText } from './existingEventsCsv.js';

test('video prompt CSV exports only the title and dates with CSV escaping', () => {
  const csv = buildExistingEventsCsv([
    { title: 'An "event", with commas', startDate: '-0044-03-15', endDate: '0040-01-01', details: 'Private details', description: 'Not exported' },
    { title: 'Another event' }
  ], { includeDescription: false });
  assert.equal(csv, 'Event Title,Start Date,End Date\n"An ""event"", with commas",-0044-03-15,0040-01-01\nAnother event,,');
  assert.equal(buildExistingEventsCsv([], { includeDescription: false }), 'Event Title,Start Date,End Date');
});

test('video prompt filename and reference match the downloaded CSV', () => {
  const fileName = getExistingEventsCsvFileName();
  assert.equal(fileName, 'Existing History Events.csv');
  assert.equal(getExistingEventsCsvReferenceText(fileName, { includeDescription: false }),
    'Existing historical events are provided separately in the CSV file "Existing History Events.csv". The file columns are: Event Title, Start Date, End Date.');
});

test('other prompt exports retain their existing filenames and description column', () => {
  assert.equal(getExistingEventsCsvFileName('course-analysis'), 'course-analysis-existing-events.csv');
  assert.equal(buildExistingEventsCsv([{ title: 'Event', description: 'Details' }]), 'Event Title,Start Date,End Date,Event Description\nEvent,,,Details');
});