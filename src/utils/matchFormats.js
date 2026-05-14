export const MATCH_FORMATS = {
    A1: {
        key: 'A1',
        label: 'A1 · 3 sets à 6 jeux',
        shortLabel: 'A1',
        description: '3 sets à 6 jeux.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Set 3'],
        decisivePoint: false,
    },
    A2: {
        key: 'A2',
        label: 'A2 · 3 sets à 6 jeux · point décisif',
        shortLabel: 'A2',
        description: '3 sets à 6 jeux, point décisif.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Set 3'],
        decisivePoint: true,
    },
    B1: {
        key: 'B1',
        label: 'B1 · 2 sets à 6 + super tie-break',
        shortLabel: 'B1',
        description: '2 sets à 6 jeux ; 3e set = super jeu décisif à 10 points.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Super jeu décisif'],
        decisivePoint: false,
    },
    B2: {
        key: 'B2',
        label: 'B2 · 2 sets à 6 · point décisif + super tie-break',
        shortLabel: 'B2',
        description: '2 sets à 6 jeux, point décisif ; 3e set = super jeu décisif à 10 points.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Super jeu décisif'],
        decisivePoint: true,
    },
    C1: {
        key: 'C1',
        label: 'C1 · 2 sets à 4 + super tie-break',
        shortLabel: 'C1',
        description: '2 sets à 4 jeux, jeu décisif à 4/4 ; 3e set = super jeu décisif à 10 points.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Super jeu décisif'],
        decisivePoint: false,
    },
    C2: {
        key: 'C2',
        label: 'C2 · 2 sets à 4 · point décisif + super tie-break',
        shortLabel: 'C2',
        description: '2 sets à 4 jeux, point décisif, jeu décisif à 4/4 ; 3e set = super jeu décisif à 10 points.',
        setSlots: 3,
        setsToWin: 2,
        setLabels: ['Set 1', 'Set 2', 'Super jeu décisif'],
        decisivePoint: true,
    },
    D1: {
        key: 'D1',
        label: 'D1 · 1 set à 9 jeux',
        shortLabel: 'D1',
        description: '1 set à 9 jeux, jeu décisif à 7 points à 8/8.',
        setSlots: 1,
        setsToWin: 1,
        setLabels: ['Set'],
        decisivePoint: false,
    },
    D2: {
        key: 'D2',
        label: 'D2 · 1 set à 9 jeux · point décisif',
        shortLabel: 'D2',
        description: '1 set à 9 jeux, point décisif, jeu décisif à 7 points à 8/8.',
        setSlots: 1,
        setsToWin: 1,
        setLabels: ['Set'],
        decisivePoint: true,
    },
    E: {
        key: 'E',
        label: 'E · 1 set à 10 points',
        shortLabel: 'E',
        description: '1 set à 10 points. Format réservé aux P25 selon le cahier des charges tournois.',
        setSlots: 1,
        setsToWin: 1,
        setLabels: ['Set'],
        decisivePoint: true,
    },
};

export const MATCH_FORMAT_KEYS = Object.keys(MATCH_FORMATS);

export const DEFAULT_MATCH_FORMAT_KEY = 'D1';

// Alias conservé pour les anciens composants déjà créés.
export const DEFAULT_MATCH_FORMAT = DEFAULT_MATCH_FORMAT_KEY;

const STORED_MATCH_FORMAT_KEY = 'padelingo-global-match-format-v1';

export function isValidMatchFormatKey(formatKey) {
    return Boolean(formatKey && MATCH_FORMATS[formatKey]);
}

export function sanitizeMatchFormatKey(formatKey) {
    return isValidMatchFormatKey(formatKey) ? formatKey : DEFAULT_MATCH_FORMAT_KEY;
}

export function getMatchFormat(formatKey) {
    return MATCH_FORMATS[sanitizeMatchFormatKey(formatKey)];
}

export function getRequiredSetsToWin(formatKey) {
    return getMatchFormat(formatKey).setsToWin || 1;
}

export function getMatchFormatOptions() {
    return Object.values(MATCH_FORMATS);
}

export function getStoredMatchFormat() {
    if (typeof localStorage === 'undefined') {
        return DEFAULT_MATCH_FORMAT_KEY;
    }

    const stored = localStorage.getItem(STORED_MATCH_FORMAT_KEY);
    return sanitizeMatchFormatKey(stored);
}

export function setStoredMatchFormat(formatKey) {
    const safeFormatKey = sanitizeMatchFormatKey(formatKey);

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORED_MATCH_FORMAT_KEY, safeFormatKey);
    }

    return safeFormatKey;
}

// Aliases pour rester compatible avec les versions précédentes.
export const storeMatchFormat = setStoredMatchFormat;
export const saveStoredMatchFormat = setStoredMatchFormat;
export const persistStoredMatchFormat = setStoredMatchFormat;
export const updateStoredMatchFormat = setStoredMatchFormat;

export function clearStoredMatchFormat() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORED_MATCH_FORMAT_KEY);
    }
}
