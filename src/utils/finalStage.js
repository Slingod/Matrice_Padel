function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createEmptyFinalStage() {
    return {
        slots: Array.from({ length: 8 }, (_, index) => ({
            id: `slot-${index + 1}`,
            label: `Place ${index + 1}`,
            teamId: '',
        })),
        quarterFinals: [
            createStageMatch('QF1', 1, 8),
            createStageMatch('QF2', 4, 5),
            createStageMatch('QF3', 2, 7),
            createStageMatch('QF4', 3, 6),
        ],
        semiFinals: [
            createStageMatch('SF1'),
            createStageMatch('SF2'),
        ],
        final: createStageMatch('FINAL'),
        thirdPlace: createStageMatch('TP'),
    };
}

function createStageMatch(code, slotA = null, slotB = null) {
    return {
        id: uid(),
        code,
        sourceSlotA: slotA,
        sourceSlotB: slotB,
        teamAId: '',
        teamBId: '',
        scoreA: '',
        scoreB: '',
    };
}

export function syncFinalStageWithTeams(finalStage, allTeams) {
    const validIds = new Set(allTeams.map((team) => team.id));

    const next = structuredCloneSafe(finalStage || createEmptyFinalStage());

    next.slots = next.slots.map((slot) => ({
        ...slot,
        teamId: validIds.has(slot.teamId) ? slot.teamId : '',
    }));

    next.quarterFinals = next.quarterFinals.map((match, index) => ({
        ...match,
        teamAId: next.slots[getQuarterPairs()[index][0] - 1]?.teamId || '',
        teamBId: next.slots[getQuarterPairs()[index][1] - 1]?.teamId || '',
    }));

    const qfWinners = next.quarterFinals.map((match) => getWinnerId(match));
    const qfLosers = next.quarterFinals.map((match) => getLoserId(match));

    next.semiFinals[0].teamAId = qfWinners[0] || '';
    next.semiFinals[0].teamBId = qfWinners[1] || '';
    next.semiFinals[1].teamAId = qfWinners[2] || '';
    next.semiFinals[1].teamBId = qfWinners[3] || '';

    const sfWinners = next.semiFinals.map((match) => getWinnerId(match));
    const sfLosers = next.semiFinals.map((match) => getLoserId(match));

    next.final.teamAId = sfWinners[0] || '';
    next.final.teamBId = sfWinners[1] || '';

    next.thirdPlace.teamAId = sfLosers[0] || '';
    next.thirdPlace.teamBId = sfLosers[1] || '';

    // Nettoyage si une source disparaît
    next.semiFinals = next.semiFinals.map((match) => sanitizeMatchScores(match));
    next.final = sanitizeMatchScores(next.final);
    next.thirdPlace = sanitizeMatchScores(next.thirdPlace);

    return next;
}

function sanitizeMatchScores(match) {
    if (!match.teamAId || !match.teamBId) {
        return {
            ...match,
            scoreA: '',
            scoreB: '',
        };
    }

    return match;
}

function getQuarterPairs() {
    return [
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6],
    ];
}

export function updateFinalStageMatch(finalStage, stageKey, matchIndex, field, value) {
    const next = structuredCloneSafe(finalStage);

    if (stageKey === 'final') {
        next.final[field] = normalizeScore(value);
        return next;
    }

    if (stageKey === 'thirdPlace') {
        next.thirdPlace[field] = normalizeScore(value);
        return next;
    }

    next[stageKey][matchIndex][field] = normalizeScore(value);
    return next;
}

function normalizeScore(value) {
    if (value === '') return '';
    return String(Math.max(0, Number(value) || 0));
}

export function assignTeamToFinalSlot(finalStage, slotIndex, teamId) {
    const next = structuredCloneSafe(finalStage);
    next.slots[slotIndex].teamId = teamId;
    return next;
}

export function getWinnerId(match) {
    const a = Number(match.scoreA);
    const b = Number(match.scoreB);

    if (
        !match.teamAId ||
        !match.teamBId ||
        match.scoreA === '' ||
        match.scoreB === '' ||
        Number.isNaN(a) ||
        Number.isNaN(b) ||
        a === b
    ) {
        return '';
    }

    return a > b ? match.teamAId : match.teamBId;
}

export function getLoserId(match) {
    const winnerId = getWinnerId(match);
    if (!winnerId) return '';
    return winnerId === match.teamAId ? match.teamBId : match.teamAId;
}

export function getDisplayWinner(match) {
    const winnerId = getWinnerId(match);
    if (!winnerId) return null;
    return winnerId === match.teamAId ? 'A' : 'B';
}

export function buildFinalRanking(finalStage, pools, allTeams) {
    const teamMap = new Map(allTeams.map((team) => [team.id, team]));
    const poolRankMap = buildPoolRankMap(pools);

    const championId = getWinnerId(finalStage.final);
    const finalistId = getLoserId(finalStage.final);
    const thirdId = getWinnerId(finalStage.thirdPlace);
    const fourthId = getLoserId(finalStage.thirdPlace);

    const qfLosers = finalStage.quarterFinals
        .map((match) => getLoserId(match))
        .filter(Boolean)
        .map((teamId) => ({
            teamId,
            poolRank: poolRankMap.get(teamId)?.rank ?? 999,
            poolName: poolRankMap.get(teamId)?.poolName ?? '',
        }))
        .sort((a, b) => a.poolRank - b.poolRank || a.poolName.localeCompare(b.poolName));

    const used = new Set([championId, finalistId, thirdId, fourthId].filter(Boolean));

    const results = [];

    if (championId) results.push(makeRankRow(1, championId, 'Vainqueur', teamMap, poolRankMap));
    if (finalistId) results.push(makeRankRow(2, finalistId, 'Finaliste', teamMap, poolRankMap));
    if (thirdId) results.push(makeRankRow(3, thirdId, '3e place', teamMap, poolRankMap));
    if (fourthId) results.push(makeRankRow(4, fourthId, '4e place', teamMap, poolRankMap));

    qfLosers.forEach((entry, index) => {
        if (used.has(entry.teamId)) return;
        results.push(
            makeRankRow(5 + index, entry.teamId, 'Éliminé en quart', teamMap, poolRankMap)
        );
        used.add(entry.teamId);
    });

    return results;
}

function makeRankRow(position, teamId, reason, teamMap, poolRankMap) {
    const team = teamMap.get(teamId);
    const poolInfo = poolRankMap.get(teamId);

    return {
        position,
        teamId,
        teamName: team?.name || 'Équipe inconnue',
        reason,
        poolName: poolInfo?.poolName || '',
        poolRank: poolInfo?.rank || '',
    };
}

function buildPoolRankMap(pools) {
    const map = new Map();

    pools.forEach((pool) => {
        const ranking = pool.ranking || [];
        ranking.forEach((row, index) => {
            map.set(row.teamId, {
                poolName: pool.name,
                rank: index + 1,
            });
        });
    });

    return map;
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}