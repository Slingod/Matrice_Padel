import { normalizeAppState } from './tournament';

const EXPORT_VERSION = 1;
export const SAVED_TOURNAMENTS_KEY = 'matrice-padel-named-tournaments-v1';

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function buildDateForFilename() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function buildId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeSaveName(name) {
    return String(name || '').trim().slice(0, 80);
}

export function buildTournamentSnapshot(state) {
    return {
        app: 'Padelingo',
        type: 'tournament-backup',
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        storage: {
            method: 'localStorage',
            cookiesUsed: false,
            serverSync: false,
        },
        state,
    };
}

export function exportTournamentToJSON(state, filenamePrefix = 'matrice-padel-sauvegarde') {
    const snapshot = buildTournamentSnapshot(state);
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${filenamePrefix}-${buildDateForFilename()}.json`);
}

export async function importTournamentJsonFile(file) {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const rawState = parsed?.state || parsed;

    if (!rawState || !Array.isArray(rawState.pools)) {
        throw new Error('Le fichier JSON ne ressemble pas à une sauvegarde Padelingo.');
    }

    return normalizeAppState(rawState);
}

export function formatSaveDate(value) {
    if (!value) return 'Aucune sauvegarde locale';

    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(new Date(value));
    } catch {
        return 'Sauvegarde locale active';
    }
}

export function getSavedTournaments() {
    try {
        const raw = localStorage.getItem(SAVED_TOURNAMENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item) => item?.id && item?.name && item?.state)
            .map((item) => ({
                ...item,
                state: normalizeAppState(item.state),
            }))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } catch {
        return [];
    }
}

function persistSavedTournaments(items) {
    localStorage.setItem(SAVED_TOURNAMENTS_KEY, JSON.stringify(items));
}

export function saveNamedTournament(name, state, existingId = null) {
    const safeName = sanitizeSaveName(name);

    if (!safeName) {
        throw new Error('Le nom du tournoi est obligatoire.');
    }

    const now = new Date().toISOString();
    const normalizedState = normalizeAppState(state);
    const currentItems = getSavedTournaments();
    const targetId = existingId || buildId();
    const existing = currentItems.find((item) => item.id === targetId);

    const nextItem = {
        id: targetId,
        name: safeName,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        state: normalizedState,
    };

    const nextItems = [
        nextItem,
        ...currentItems.filter((item) => item.id !== targetId),
    ].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    persistSavedTournaments(nextItems);
    return nextItem;
}

export function deleteNamedTournament(saveId) {
    const currentItems = getSavedTournaments();
    const nextItems = currentItems.filter((item) => item.id !== saveId);
    persistSavedTournaments(nextItems);
    return nextItems;
}

export function getNamedTournament(saveId) {
    return getSavedTournaments().find((item) => item.id === saveId) || null;
}
