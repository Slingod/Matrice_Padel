const STORAGE_KEY = 'padelingo-match-score-details-v2';

function safeJsonParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function canUseLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStore() {
    if (!canUseLocalStorage()) return {};
    return safeJsonParse(window.localStorage.getItem(STORAGE_KEY), {});
}

function setStore(nextStore) {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
}

export function getStoredMatchScore(matchId) {
    if (!matchId) return null;

    const store = getStore();
    return store[matchId] || null;
}

export function saveStoredMatchScore(matchId, payload = {}) {
    if (!matchId) return null;

    const store = getStore();

    const nextPayload = {
        ...payload,
        updatedAt: new Date().toISOString(),
    };

    store[matchId] = nextPayload;
    setStore(store);

    return nextPayload;
}

export function setStoredMatchScore(matchId, payload = {}) {
    return saveStoredMatchScore(matchId, payload);
}

export function storeMatchScore(matchId, payload = {}) {
    return saveStoredMatchScore(matchId, payload);
}

export function updateStoredMatchScore(matchId, payload = {}) {
    return saveStoredMatchScore(matchId, payload);
}

export function removeStoredMatchScore(matchId) {
    if (!matchId) return;

    const store = getStore();
    delete store[matchId];
    setStore(store);
}

export function deleteStoredMatchScore(matchId) {
    removeStoredMatchScore(matchId);
}

export function clearStoredMatchScore(matchId) {
    removeStoredMatchScore(matchId);
}

export function hasStoredMatchScore(matchId) {
    return Boolean(getStoredMatchScore(matchId));
}

export function getAllStoredMatchScores() {
    return getStore();
}

export function clearAllStoredMatchScores() {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(STORAGE_KEY);
}

// Alias de compatibilité au cas où un composant utilise un ancien nom.
export const readStoredMatchScore = getStoredMatchScore;
export const persistStoredMatchScore = saveStoredMatchScore;
export const saveMatchScoreDetail = saveStoredMatchScore;
export const getMatchScoreDetail = getStoredMatchScore;
export const removeMatchScoreDetail = removeStoredMatchScore;
