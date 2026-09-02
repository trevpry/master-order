-- Existing rows took the 'release' default; artist candidates always point at a MusicBrainz artist.
UPDATE "IdentificationCandidate" SET "musicBrainzEntityType" = 'artist' WHERE "entityType" = 'artist';
