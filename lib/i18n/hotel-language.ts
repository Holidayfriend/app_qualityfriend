const SWEDISH_WORD = /\b(och|inte|är|också|från|denna|detta|ska|skulle|eller)\b/i;

/** English, German, and Italian only. Swedish letters and common Swedish words are rejected. */
export function fitsHotelLanguage(text: string) {
  const plain = text.replace(/<[^>]*>/g, " ");
  if (/[ÅåÆæØø]/.test(plain) || SWEDISH_WORD.test(plain)) return false;
  const letters = plain.replace(/[0-9\s.,;:!?'"“”„«»()[\]{}<>\-–—/&+%#@*_=|\\]/g, "");
  return /^[A-Za-zÀÈÉÌÍÎÒÓÙÚàèéìíîòóùúÄÖÜäöüß]*$/.test(letters);
}
