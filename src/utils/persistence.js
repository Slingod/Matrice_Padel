import { normalizeAppState } from './tournament';

const EXPORT_VERSION = 2;
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

/**
 * Le classement, la colonne S, PF/PA/Diff/Total ne sont pas sauvegardés comme vérité figée.
 * On sauvegarde seulement les données sources : équipes, matchs, scoreDetail.sets, formats,
 * phase finale, terrains, serpentin. Au chargement, normalizeAppState réhydrate l'état,
 * puis l'application recalcule automatiquement S / PF / PA / Diff / Total avec les règles FFT.
 */
function normalizeTournamentStateForSave(state) {
    return normalizeAppState({
        ...state,
        scoringVersion: 'fft-v2-sets-priority',
        savedSchemaVersion: EXPORT_VERSION,
    });
}

export function buildTournamentSnapshot(state) {
    const normalizedState = normalizeTournamentStateForSave(state);

    return {
        app: 'Padelingo',
        type: 'tournament-backup',
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        scoring: {
            version: 'fft-v2-sets-priority',
            calculatedFields: ['S', 'PF', 'PA', 'Diff', 'Total', 'Classement'],
            persistedSourceFields: [
                'scoreA',
                'scoreB',
                'scoreDetail.formatKey',
                'scoreDetail.sets',
                'scoreDetail.pointsA',
                'scoreDetail.pointsB',
                'scoreDetail.isComplete',
            ],
            note: 'Les colonnes S/PF/PA/Diff/Total sont recalculées au chargement depuis les scores sauvegardés.',
        },
        storage: {
            method: 'localStorage',
            cookiesUsed: false,
            serverSync: false,
        },
        state: normalizedState,
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

function normalizeSavedTournamentItem(item) {
    if (!item?.id || !item?.name || !item?.state) return null;

    return {
        ...item,
        version: Number(item.version || 1),
        scoringVersion: item.scoringVersion || item.state?.scoringVersion || 'legacy',
        state: normalizeAppState(item.state),
    };
}

export function getSavedTournaments() {
    try {
        const raw = localStorage.getItem(SAVED_TOURNAMENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(normalizeSavedTournamentItem)
            .filter(Boolean)
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
    const normalizedState = normalizeTournamentStateForSave(state);
    const currentItems = getSavedTournaments();
    const targetId = existingId || buildId();
    const existing = currentItems.find((item) => item.id === targetId);

    const nextItem = {
        id: targetId,
        name: safeName,
        version: EXPORT_VERSION,
        scoringVersion: 'fft-v2-sets-priority',
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
