function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createStageMatch(code) {
    return {
        id: uid(),
        code,
        teamAId: '',
        teamBId: '',
        scoreA: '',
        scoreB: '',
    };
}

export function createEmptyFinalStage() {
    return {
        quarterFinals: [
            createStageMatch('QF1'),
            createStageMatch('QF2'),
            createStageMatch('QF3'),
            createStageMatch('QF4'),
        ],
        semiFinals: [
            createStageMatch('SF1'),
            createStageMatch('SF2'),
        ],
        final: createStageMatch('FINAL'),
    };
}

export function assignQuarterTeam(finalStage, matchIndex, field, teamId) {
    const next = structuredCloneSafe(finalStage);
    next.quarterFinals[matchIndex][field] = teamId;
    return next;
}

export function updateFinalStageMatch(finalStage, stageKey, matchIndex, field, value) {
    const next = structuredCloneSafe(finalStage);

    if (stageKey === 'final') {
        next.final[field] = normalizeScore(value);
        return next;
    }

    next[stageKey][matchIndex][field] = normalizeScore(value);
    return next;
}

function normalizeScore(value) {
    if (value === '') return '';
    return String(Math.max(0, Number(value) || 0));
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

export function syncFinalStageWithTeams(finalStage, allTeams) {
    const validIds = new Set(allTeams.map((team) => team.id));
    const next = structuredCloneSafe(finalStage || createEmptyFinalStage());

    next.quarterFinals = next.quarterFinals.map((match) =>
        sanitizeMatchScores({
            ...match,
            teamAId: validIds.has(match.teamAId) ? match.teamAId : '',
            teamBId: validIds.has(match.teamBId) ? match.teamBId : '',
        })
    );

    const qfWinners = next.quarterFinals.map((match) => getWinnerId(match));

    next.semiFinals[0].teamAId = qfWinners[0] || '';
    next.semiFinals[0].teamBId = qfWinners[1] || '';
    next.semiFinals[1].teamAId = qfWinners[2] || '';
    next.semiFinals[1].teamBId = qfWinners[3] || '';

    next.semiFinals = next.semiFinals.map((match) => sanitizeMatchScores(match));

    const sfWinners = next.semiFinals.map((match) => getWinnerId(match));

    next.final.teamAId = sfWinners[0] || '';
    next.final.teamBId = sfWinners[1] || '';
    next.final = sanitizeMatchScores(next.final);

    return next;
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

function makeRankRow(position, teamId, reason, teamMap, poolRankMap) {
    const team = teamMap.get(teamId);
    const poolInfo = poolRankMap.get(teamId);

    return {
        position,
        teamId,
        teamName: team?.name || 'Équipe inconnue',
        cumulativeRank: team?.cumulativeRank || 0,
        reason,
        poolName: poolInfo?.poolName || '',
        poolRank: poolInfo?.rank || '',
    };
}

export function buildFinalRanking(finalStage, pools, allTeams) {
    const teamMap = new Map(allTeams.map((team) => [team.id, team]));
    const poolRankMap = buildPoolRankMap(pools);

    const championId = getWinnerId(finalStage.final);
    const finalistId = getLoserId(finalStage.final);

    const semiLosers = finalStage.semiFinals
        .map((match) => getLoserId(match))
        .filter(Boolean)
        .map((teamId) => ({
            teamId,
            poolRank: poolRankMap.get(teamId)?.rank ?? 999,
            cumulativeRank: teamMap.get(teamId)?.cumulativeRank ?? 999999,
        }))
        .sort((a, b) => a.poolRank - b.poolRank || a.cumulativeRank - b.cumulativeRank);

    const qfLosers = finalStage.quarterFinals
        .map((match) => getLoserId(match))
        .filter(Boolean)
        .map((teamId) => ({
            teamId,
            poolRank: poolRankMap.get(teamId)?.rank ?? 999,
            cumulativeRank: teamMap.get(teamId)?.cumulativeRank ?? 999999,
        }))
        .sort((a, b) => a.poolRank - b.poolRank || a.cumulativeRank - b.cumulativeRank);

    const results = [];

    if (championId) results.push(makeRankRow(1, championId, 'Vainqueur', teamMap, poolRankMap));
    if (finalistId) results.push(makeRankRow(2, finalistId, 'Finaliste', teamMap, poolRankMap));

    if (semiLosers[0]) {
        results.push(makeRankRow(3, semiLosers[0].teamId, 'Éliminé en demi', teamMap, poolRankMap));
    }

    if (semiLosers[1]) {
        results.push(makeRankRow(4, semiLosers[1].teamId, 'Éliminé en demi', teamMap, poolRankMap));
    }

    qfLosers.forEach((entry, index) => {
        results.push(
            makeRankRow(5 + index, entry.teamId, 'Éliminé en quart', teamMap, poolRankMap)
        );
    });

    return results;
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}