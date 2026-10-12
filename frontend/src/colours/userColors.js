/**
 * User accent colors (avatar chips, chat usernames, etc.) — a ColorBrewer
 * qualitative palette (colorbrewer2.org, type=qualitative, scheme=Set3, n=12)
 * plus 3 extra qualitative Brewer colors. Deliberately disjoint from
 * EVENT_COLORS (blue/emerald/red/violet, used for search/save/delete/view in
 * the Search Timeline) so "who did it" never gets visually confused with
 * "what happened".
 */
export const USER_COLOURS = [
    "#8dd3c7",
    "#ffffb3",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f",
    "#6a3d9a",
    "#ffff99",
    "#b15928",
];

// Several Set3 colors are pale pastels (that's the point of Set3 as a fill
// palette) — white text on top of e.g. "#ffffb3" is nearly unreadable. Pick
// dark or light text per-swatch instead of hardcoding white, so every color
// in the palette stays legible without having to replace any of them.
export function getReadableTextColor(hexColor) {
    const hex = String(hexColor || '').replace('#', '');
    if (hex.length !== 6) return '#ffffff';

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Perceived brightness (YIQ) — a light swatch gets dark ink text, a dark
    // swatch keeps white text.
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 165 ? '#1c1917' : '#ffffff';
}

/** Usernames used for AI/system replies (excluded from human color ordering). */
export const KNOWN_AI_CHAT_USERNAMES = new Set([
    "AI Assistant",
    "Query Reformulator",
    "Knowledge Gap Detector",
    "Result Summarizer",
]);

export function isHumanChatParticipant(username, msg) {
    if (!username) return false;
    if (msg && msg.isAIMessage) return false;
    if (KNOWN_AI_CHAT_USERNAMES.has(username)) return false;
    return true;
}

// Colors are handed out first-come-first-served, one per distinct username,
// so no two people ever share a color as long as there are no more than
// USER_COLOURS.length of them active in this browser session (a hash-modulo
// scheme can't promise that — two usernames can hash to the same slot). Once
// a username claims a color it keeps it for the rest of the session.
const usernameToColorIndex = new Map();
let nextQueuePosition = 0;

/**
 * Same color for a given username for as long as this page stays open
 * (first-come-first-served queue, not a hash — guarantees no collisions up
 * to USER_COLOURS.length distinct people). Colors wrap around and start
 * repeating only once more than USER_COLOURS.length people have been seen.
 */
export function getColorIndexForUsername(username) {
    if (!username) return 0;
    const key = String(username).trim().toLowerCase();

    if (usernameToColorIndex.has(key)) {
        return usernameToColorIndex.get(key);
    }

    const index = nextQueuePosition % USER_COLOURS.length;
    nextQueuePosition += 1;
    usernameToColorIndex.set(key, index);
    return index;
}
