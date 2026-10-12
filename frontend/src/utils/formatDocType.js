// Primo returns raw, machine-oriented type codes (snake_case, abbreviated,
// pluralized inconsistently). Map the known ones to reader-friendly labels;
// anything unrecognized falls back to a title-cased, underscore-stripped version.
const DOC_TYPE_LABELS = {
    ebook_02: "E-Book",
    conference_proceeding: "Conference Proceeding",
    conference_proceedings: "Conference Proceeding",
    books: "Book",
    book: "Book",
};

const titleCaseFallback = (raw) =>
    raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

export function formatDocType(rawType) {
    const raw = (Array.isArray(rawType) ? rawType[0] : rawType || "").trim();
    if (!raw) return "";

    const key = raw.toLowerCase();
    return DOC_TYPE_LABELS[key] || titleCaseFallback(key);
}
