// "Antonio Mazzoni — Composer" / "Antonio Mazzoni -- Composer" -> { name, typeName }
export const splitArtistNameAndType = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(.+?)\s+(?:—|–|--)\s+(.+)$/);
  return match
    ? { name: match[1].trim(), typeName: match[2].trim() }
    : { name: text, typeName: null };
};
