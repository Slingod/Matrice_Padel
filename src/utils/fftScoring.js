const SUPER_TIE_BREAK_FORMATS = new Set(['B1', 'B2', 'C1', 'C2']);
const SET_PRIORITY_FORMATS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function isFilledScoreValue(value) {
    return value !== '' && value !== null && value !== undefined;
}

function formatSignedValue(value) {
    const number = Number(value) || 0;
    return number > 0 ? `+${number}` : String(number);
}

export function getFftFormatKey(match = {}) {
    return (
        match?.scoreDetail?.formatKey ||
        match?.scoreDetail?.matchFormatKey ||
        match?.scoreDetail?.format ||
        match?.formatKey ||
        match?.matchFormatKey ||
        match?.format ||
        'D1'
    );
}

export function usesSetPriorityRanking(formatKey) {
    return SET_PRIORITY_FORMATS.has(formatKey);
}

export function isSuperTieBreakSet(formatKey, setIndex) {
    return SUPER_TIE_BREAK_FORMATS.has(formatKey) && setIndex === 2;
}

export function getRequiredSetsToWinByFormat(formatKey) {
    if (SET_PRIORITY_FORMATS.has(formatKey)) {
        return 2;
    }

    return 1;
}

export function normalizeFftSets(match = {}) {
    const sets = match?.scoreDetail?.sets;

    if (Array.isArray(sets)) {
        return sets.map((set) => ({
            scoreA:
                set?.scoreA === undefined || set?.scoreA === null
                    ? set?.a === undefined || set?.a === null
                        ? ''
                        : String(set.a)
                    : String(set.scoreA),
            scoreB:
                set?.scoreB === undefined || set?.scoreB === null
                    ? set?.b === undefined || set?.b === null
                        ? ''
                        : String(set.b)
                    : String(set.scoreB),
        }));
    }

    if (isFilledScoreValue(match?.scoreA) && isFilledScoreValue(match?.scoreB)) {
        return [
            {
                scoreA: String(match.scoreA),
                scoreB: String(match.scoreB),
            },
        ];
    }

    return [];
}

/**
 * Calcule les statistiques FFT utilisées partout dans Padelingo.
 *
 * Règle B1/B2/C1/C2 :
 * Le 3e set est un super tie-break. Il départage le match en sets,
 * mais il compte seulement 1 point de jeu pour le gagnant et 0 pour le perdant
 * dans PF / PA / Diff / Total.
 *
 * Donc :
 * 10-0  => +1 / -1
 * 10-4  => +1 / -1
 * 13-11 => +1 / -1
 *
 * Les sets classiques gardent leur score réel :
 * 5-3 => +2
 * 0-4 => -4
 */
export function calculateFftMatchStats(match = {}) {
    const formatKey = getFftFormatKey(match);
    const requiredSets = getRequiredSetsToWinByFormat(formatKey);
    const sets = normalizeFftSets(match);

    let setsA = 0;
    let setsB = 0;

    let rawPointsA = 0;
    let rawPointsB = 0;

    let fftGamesA = 0;
    let fftGamesB = 0;

    const countedSets = [];

    for (let index = 0; index < sets.length; index += 1) {
        const set = sets[index];

        if (!isFilledScoreValue(set.scoreA) || !isFilledScoreValue(set.scoreB)) {
            continue;
        }

        const scoreA = Number(set.scoreA);
        const scoreB = Number(set.scoreB);

        if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) {
            continue;
        }

        const winner = scoreA > scoreB ? 'A' : 'B';
        const isSuperTieBreak = isSuperTieBreakSet(formatKey, index);

        rawPointsA += scoreA;
        rawPointsB += scoreB;

        if (winner === 'A') {
            setsA += 1;
        } else {
            setsB += 1;
        }

        const countedGamesA = isSuperTieBreak ? (winner === 'A' ? 1 : 0) : scoreA;
        const countedGamesB = isSuperTieBreak ? (winner === 'B' ? 1 : 0) : scoreB;

        fftGamesA += countedGamesA;
        fftGamesB += countedGamesB;

        countedSets.push({
            index,
            scoreA,
            scoreB,
            winner,
            isSuperTieBreak,
            fftGamesA: countedGamesA,
            fftGamesB: countedGamesB,
        });

        if (setsA >= requiredSets || setsB >= requiredSets) {
            break;
        }
    }

    const isComplete = setsA >= requiredSets || setsB >= requiredSets;

    return {
        formatKey,
        useSetPriority: usesSetPriorityRanking(formatKey),
        sets,
        countedSets,

        scoreA: isComplete ? String(setsA) : '',
        scoreB: isComplete ? String(setsB) : '',

        setsA,
        setsB,
        setDiffA: setsA - setsB,
        setDiffB: setsB - setsA,
        setDiff: setsA - setsB,

        rawPointsA,
        rawPointsB,

        fftGamesA,
        fftGamesB,
        fftGameDiffA: fftGamesA - fftGamesB,
        fftGameDiffB: fftGamesB - fftGamesA,

        isComplete,
        winner: !isComplete ? null : setsA > setsB ? 'A' : setsB > setsA ? 'B' : 'draw',
    };
}

export function getFftSetDiffLabels(match = {}) {
    const stats = calculateFftMatchStats(match);

    if (!stats.isComplete) {
        return {
            labelA: '',
            labelB: '',
            pairLabel: 'Score à saisir',
        };
    }

    const labelA = formatSignedValue(stats.setDiffA);
    const labelB = formatSignedValue(stats.setDiffB);

    return {
        labelA,
        labelB,
        pairLabel: `${labelA} / ${labelB}`,
    };
}

export function compareFftRankingRows(a, b) {
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);

    const aUsesSetPriority = Boolean(a.useSetPriority);
    const bUsesSetPriority = Boolean(b.useSetPriority);

    if (aUsesSetPriority || bUsesSetPriority) {
        if ((b.setDiff || 0) !== (a.setDiff || 0)) return (b.setDiff || 0) - (a.setDiff || 0);
    }

    const gameDiffA = a.fftGameDiff ?? a.diff ?? 0;
    const gameDiffB = b.fftGameDiff ?? b.diff ?? 0;

    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
    if ((b.pointsFor || 0) !== (a.pointsFor || 0)) return (b.pointsFor || 0) - (a.pointsFor || 0);
    if ((a.pointsAgainst || 0) !== (b.pointsAgainst || 0)) return (a.pointsAgainst || 0) - (b.pointsAgainst || 0);

    return 0;
}

export function isPerfectFftTie(a, b) {
    const aUsesSetPriority = Boolean(a.useSetPriority);
    const bUsesSetPriority = Boolean(b.useSetPriority);

    const sameBase =
        (a.wins || 0) === (b.wins || 0) &&
        (a.losses || 0) === (b.losses || 0) &&
        (a.pointsFor || 0) === (b.pointsFor || 0) &&
        (a.pointsAgainst || 0) === (b.pointsAgainst || 0) &&
        (a.fftGameDiff ?? a.diff ?? 0) === (b.fftGameDiff ?? b.diff ?? 0);

    if (!sameBase) return false;

    if (aUsesSetPriority || bUsesSetPriority) {
        return (
            (a.setsFor || 0) === (b.setsFor || 0) &&
            (a.setsAgainst || 0) === (b.setsAgainst || 0) &&
            (a.setDiff || 0) === (b.setDiff || 0)
        );
    }

    return true;
}

export function assignSharedRanks(rows = []) {
    let currentPosition = 1;

    return rows.map((row, index, source) => {
        if (index > 0) {
            const previous = source[index - 1];

            if (!isPerfectFftTie(row, previous)) {
                currentPosition = index + 1;
            }
        }

        const previous = source[index - 1];
        const next = source[index + 1];

        const isExAequo =
            Boolean(previous && isPerfectFftTie(row, previous)) ||
            Boolean(next && isPerfectFftTie(row, next));

        return {
            ...row,
            position: currentPosition,
            isExAequo,
        };
    });
}
