function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeMatchFormatKey(value) {
    return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E'].includes(value)
        ? value
        : 'D1';
}

function createStageMatch(label = '') {
    return {
        id: uid(),
        label,
        teamAId: '',
        teamBId: '',
        scoreA: '',
        scoreB: '',
        scoreDetail: null,
        formatKey: 'D1',
        matchFormatKey: 'D1',
    };
}

export function createEmptyFinalStage() {
    return {
        settings: {
            entryRound: 'quarter',
            poolQualifierMode: 'top2',
            enableThirdPlaceMatch: false,
            enablePlacement5to8: false,
            finalMatchFormatKey: 'D1',
        },
        roundOf16: Array.from({ length: 8 }, (_, index) => createStageMatch(`Huitième ${index + 1}`)),
        quarterFinals: [
            createStageMatch('Quart 1'),
            createStageMatch('Quart 2'),
            createStageMatch('Quart 3'),
            createStageMatch('Quart 4'),
        ],
        semiFinals: [
            createStageMatch('Demi 1'),
            createStageMatch('Demi 2'),
        ],
        final: createStageMatch('Finale'),
        thirdPlace: createStageMatch('Petite finale'),
        placement5to8Semis: [
            createStageMatch('Place 5-8 / Demi 1'),
            createStageMatch('Place 5-8 / Demi 2'),
        ],
        placement5to8Finals: {
            place5: createStageMatch('Match place 5'),
            place7: createStageMatch('Match place 7'),
        },
    };
}

function sanitizeEntryRound(value) {
    return ['round16', 'quarter', 'semi'].includes(value) ? value : 'quarter';
}

function sanitizeQualifierMode(value) {
    return ['winners', 'top2', 'best4', 'all'].includes(value) ? value : 'top2';
}

function ensureMatchCount(matches, count, labelPrefix) {
    const source = Array.isArray(matches) ? matches : [];
    return Array.from({ length: count }, (_, index) => sanitizeMatch(source[index], `${labelPrefix} ${index + 1}`));
}

function sanitizeMatch(match, fallbackLabel = '') {
    const formatKey = sanitizeMatchFormatKey(
        match?.formatKey ||
        match?.matchFormatKey ||
        match?.scoreDetail?.formatKey ||
        'D1'
    );

    return {
        id: match?.id || uid(),
        label: match?.label || fallbackLabel,
        teamAId: match?.teamAId || '',
        teamBId: match?.teamBId || '',
        scoreA: match?.scoreA ?? '',
        scoreB: match?.scoreB ?? '',
        scoreDetail: match?.scoreDetail || null,
        formatKey,
        matchFormatKey: formatKey,
    };
}

function sanitizeStage(stage) {
    const empty = createEmptyFinalStage();

    return {
        settings: {
            entryRound: sanitizeEntryRound(stage?.settings?.entryRound || empty.settings.entryRound),
            poolQualifierMode: sanitizeQualifierMode(stage?.settings?.poolQualifierMode || empty.settings.poolQualifierMode),
            enableThirdPlaceMatch: Boolean(stage?.settings?.enableThirdPlaceMatch),
            enablePlacement5to8: Boolean(stage?.settings?.enablePlacement5to8),
            finalMatchFormatKey: sanitizeMatchFormatKey(
                stage?.settings?.finalMatchFormatKey ||
                stage?.settings?.matchFormatKey ||
                'D1'
            ),
        },
        roundOf16: ensureMatchCount(stage?.roundOf16 || empty.roundOf16, 8, 'Huitième'),
        quarterFinals: ensureMatchCount(stage?.quarterFinals || empty.quarterFinals, 4, 'Quart'),
        semiFinals: ensureMatchCount(stage?.semiFinals || empty.semiFinals, 2, 'Demi'),
        final: sanitizeMatch(stage?.final || empty.final, 'Finale'),
        thirdPlace: sanitizeMatch(stage?.thirdPlace || empty.thirdPlace, 'Petite finale'),
        placement5to8Semis: ensureMatchCount(stage?.placement5to8Semis || empty.placement5to8Semis, 2, 'Place 5-8 / Demi'),
        placement5to8Finals: {
            place5: sanitizeMatch(
                stage?.placement5to8Finals?.place5 || empty.placement5to8Finals.place5,
                'Match place 5'
            ),
            place7: sanitizeMatch(
                stage?.placement5to8Finals?.place7 || empty.placement5to8Finals.place7,
                'Match place 7'
            ),
        },
    };
}

function preserveScoresIfSameTeams(previousMatch, nextTeamAId, nextTeamBId) {
    const sameTeams =
        (previousMatch?.teamAId || '') === (nextTeamAId || '') &&
        (previousMatch?.teamBId || '') === (nextTeamBId || '');

    const previousFormatKey = sanitizeMatchFormatKey(
        previousMatch?.formatKey ||
        previousMatch?.matchFormatKey ||
        previousMatch?.scoreDetail?.formatKey ||
        'D1'
    );

    return {
        ...previousMatch,
        teamAId: nextTeamAId || '',
        teamBId: nextTeamBId || '',
        scoreA: sameTeams ? previousMatch?.scoreA ?? '' : '',
        scoreB: sameTeams ? previousMatch?.scoreB ?? '' : '',
        scoreDetail: sameTeams ? previousMatch?.scoreDetail || null : null,
        formatKey: sameTeams ? previousFormatKey : 'D1',
        matchFormatKey: sameTeams ? previousFormatKey : 'D1',
    };
}

export function getDisplayWinner(match) {
    const scoreA = Number(match?.scoreA);
    const scoreB = Number(match?.scoreB);

    const isValid =
        match?.scoreA !== '' &&
        match?.scoreB !== '' &&
        Number.isFinite(scoreA) &&
        Number.isFinite(scoreB);

    if (!isValid) return null;
    if (scoreA === scoreB) return 'draw';
    return scoreA > scoreB ? 'A' : 'B';
}

function getWinnerTeamId(match) {
    const winner = getDisplayWinner(match);
    if (winner === 'A') return match.teamAId || '';
    if (winner === 'B') return match.teamBId || '';
    return '';
}

function getLoserTeamId(match) {
    const winner = getDisplayWinner(match);
    if (winner === 'A') return match.teamBId || '';
    if (winner === 'B') return match.teamAId || '';
    return '';
}

function clearScores(match) {
    const formatKey = sanitizeMatchFormatKey(
        match?.formatKey ||
        match?.matchFormatKey ||
        match?.scoreDetail?.formatKey ||
        'D1'
    );

    return {
        ...match,
        scoreA: '',
        scoreB: '',
        scoreDetail: null,
        formatKey,
        matchFormatKey: formatKey,
    };
}

function clearMatchTeamsAndScores(match) {
    return clearScores({ ...match, teamAId: '', teamBId: '' });
}

export function setFinalStageOption(stage, optionKey, value) {
    const safeStage = sanitizeStage(stage);

    const sanitizedValue =
        optionKey === 'entryRound'
            ? sanitizeEntryRound(value)
            : optionKey === 'poolQualifierMode'
                ? sanitizeQualifierMode(value)
                : optionKey === 'finalMatchFormatKey'
                    ? sanitizeMatchFormatKey(value)
                    : Boolean(value);

    return {
        ...safeStage,
        settings: {
            ...safeStage.settings,
            [optionKey]: sanitizedValue,
        },
    };
}

export function assignStageTeam(stage, stageKey, matchIndex, field, teamId) {
    const safeStage = sanitizeStage(stage);
    const targetKey = stageKey === 'roundOf16' || stageKey === 'semiFinals' ? stageKey : 'quarterFinals';

    return {
        ...safeStage,
        [targetKey]: safeStage[targetKey].map((match, index) =>
            index === matchIndex
                ? clearScores({
                    ...match,
                    [field]: teamId || '',
                })
                : match
        ),
    };
}

export function assignQuarterTeam(stage, matchIndex, field, teamId) {
    return assignStageTeam(stage, 'quarterFinals', matchIndex, field, teamId);
}

export function updateFinalStageMatch(stage, stageKey, matchIndex, field, value) {
    const safeStage = sanitizeStage(stage);

    const buildPatch = () => {
        if (field === 'scoreDetail') {
            const detail = value || {};
            const formatKey = sanitizeMatchFormatKey(detail.formatKey || detail.matchFormatKey || 'D1');

            return {
                scoreA: detail.scoreA ?? '',
                scoreB: detail.scoreB ?? '',
                scoreDetail: {
                    ...detail,
                    formatKey,
                },
                formatKey,
                matchFormatKey: formatKey,
            };
        }

        const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));
        return { [field]: sanitized };
    };

    const patch = buildPatch();

    if (stageKey === 'final') {
        return {
            ...safeStage,
            final: {
                ...safeStage.final,
                ...patch,
            },
        };
    }

    if (stageKey === 'thirdPlace') {
        return {
            ...safeStage,
            thirdPlace: {
                ...safeStage.thirdPlace,
                ...patch,
            },
        };
    }

    if (stageKey === 'placement5to8Finals') {
        return {
            ...safeStage,
            placement5to8Finals: {
                ...safeStage.placement5to8Finals,
                [matchIndex]: {
                    ...safeStage.placement5to8Finals[matchIndex],
                    ...patch,
                },
            },
        };
    }

    return {
        ...safeStage,
        [stageKey]: safeStage[stageKey].map((match, index) =>
            index === matchIndex
                ? {
                    ...match,
                    ...patch,
                }
                : match
        ),
    };
}

function syncRoundPairs(targetMatches, previousMatches, winnerIds) {
    return targetMatches.map((match, index) =>
        preserveScoresIfSameTeams(
            previousMatches[index] || match,
            winnerIds[index * 2] || '',
            winnerIds[index * 2 + 1] || ''
        )
    );
}

export function syncFinalStageWithTeams(stage, allTeams = []) {
    const safeStage = sanitizeStage(stage);
    const entryRound = safeStage.settings.entryRound;
    const validTeamIds = new Set((allTeams || []).map((team) => team.id));

    const keepValidTeams = (match) => ({
        ...match,
        teamAId: validTeamIds.has(match.teamAId) ? match.teamAId : '',
        teamBId: validTeamIds.has(match.teamBId) ? match.teamBId : '',
    });

    const roundOf16 = safeStage.roundOf16.map(keepValidTeams);
    let quarterFinals = safeStage.quarterFinals.map(keepValidTeams);
    let semiFinals = safeStage.semiFinals.map(keepValidTeams);

    if (entryRound === 'round16') {
        quarterFinals = syncRoundPairs(quarterFinals, safeStage.quarterFinals.map(keepValidTeams), roundOf16.map(getWinnerTeamId));
    } else if (entryRound === 'semi') {
        quarterFinals = quarterFinals.map(clearMatchTeamsAndScores);
    }

    if (entryRound === 'round16' || entryRound === 'quarter') {
        semiFinals = syncRoundPairs(semiFinals, safeStage.semiFinals.map(keepValidTeams), quarterFinals.map(getWinnerTeamId));
    }

    const sfWinners = semiFinals.map(getWinnerTeamId);
    const sfLosers = semiFinals.map(getLoserTeamId);

    const nextFinal = preserveScoresIfSameTeams(
        keepValidTeams(safeStage.final),
        sfWinners[0] || '',
        sfWinners[1] || ''
    );

    let nextThirdPlace = keepValidTeams(safeStage.thirdPlace);
    if (safeStage.settings.enableThirdPlaceMatch) {
        nextThirdPlace = preserveScoresIfSameTeams(
            nextThirdPlace,
            sfLosers[0] || '',
            sfLosers[1] || ''
        );
    } else {
        nextThirdPlace = clearMatchTeamsAndScores(nextThirdPlace);
    }

    let placement5to8Semis = safeStage.placement5to8Semis.map(keepValidTeams);
    let placement5to8Finals = {
        place5: keepValidTeams(safeStage.placement5to8Finals.place5),
        place7: keepValidTeams(safeStage.placement5to8Finals.place7),
    };

    const qfLosers = quarterFinals.map(getLoserTeamId);
    const canUsePlacement5to8 = safeStage.settings.enablePlacement5to8 && entryRound !== 'semi';

    if (canUsePlacement5to8) {
        placement5to8Semis = syncRoundPairs(placement5to8Semis, placement5to8Semis, qfLosers);

        const placementSemiWinners = placement5to8Semis.map(getWinnerTeamId);
        const placementSemiLosers = placement5to8Semis.map(getLoserTeamId);

        placement5to8Finals.place5 = preserveScoresIfSameTeams(
            placement5to8Finals.place5,
            placementSemiWinners[0] || '',
            placementSemiWinners[1] || ''
        );

        placement5to8Finals.place7 = preserveScoresIfSameTeams(
            placement5to8Finals.place7,
            placementSemiLosers[0] || '',
            placementSemiLosers[1] || ''
        );
    } else {
        placement5to8Semis = placement5to8Semis.map(clearMatchTeamsAndScores);
        placement5to8Finals = {
            place5: clearMatchTeamsAndScores(placement5to8Finals.place5),
            place7: clearMatchTeamsAndScores(placement5to8Finals.place7),
        };
    }

    return {
        ...safeStage,
        roundOf16,
        quarterFinals,
        semiFinals,
        final: nextFinal,
        thirdPlace: nextThirdPlace,
        placement5to8Semis,
        placement5to8Finals,
    };
}

export function getFinalStageMatchesForStats(stage) {
    const safeStage = sanitizeStage(stage);
    const entryRound = safeStage.settings.entryRound;

    return [
        ...(entryRound === 'round16' ? safeStage.roundOf16 : []),
        ...(entryRound === 'round16' || entryRound === 'quarter' ? safeStage.quarterFinals : []),
        ...safeStage.semiFinals,
        ...(safeStage.settings.enableThirdPlaceMatch ? [safeStage.thirdPlace] : []),
        ...(safeStage.settings.enablePlacement5to8 && entryRound !== 'semi' ? safeStage.placement5to8Semis : []),
        ...(safeStage.settings.enablePlacement5to8 && entryRound !== 'semi'
            ? [safeStage?.placement5to8Finals?.place5, safeStage?.placement5to8Finals?.place7]
            : []),
        safeStage.final,
    ].filter(Boolean);
}

function buildStageStatMap(allTeams, stage) {
    const safeStage = sanitizeStage(stage);
    const statMap = new Map(
        (allTeams || []).map((team) => [
            team.id,
            {
                teamId: team.id,
                teamName: team.name,
                cumulativeRank: team.cumulativeRank || 0,
                finalPlayed: 0,
                finalWins: 0,
                finalLosses: 0,
                finalPointsFor: 0,
                finalPointsAgainst: 0,
                finalDiff: 0,
                finalTotal: 0,
            },
        ])
    );

    getFinalStageMatchesForStats(safeStage).forEach((match) => {
        const scoreA = Number(match.scoreA);
        const scoreB = Number(match.scoreB);

        const valid =
            match.teamAId &&
            match.teamBId &&
            match.scoreA !== '' &&
            match.scoreB !== '' &&
            Number.isFinite(scoreA) &&
            Number.isFinite(scoreB);

        if (!valid) return;

        const teamA = statMap.get(match.teamAId);
        const teamB = statMap.get(match.teamBId);
        if (!teamA || !teamB) return;

        teamA.finalPlayed += 1;
        teamB.finalPlayed += 1;

        teamA.finalPointsFor += scoreA;
        teamA.finalPointsAgainst += scoreB;
        teamB.finalPointsFor += scoreB;
        teamB.finalPointsAgainst += scoreA;

        const diffA = scoreA - scoreB;
        const diffB = scoreB - scoreA;

        teamA.finalDiff += diffA;
        teamB.finalDiff += diffB;

        teamA.finalTotal += diffA;
        teamB.finalTotal += diffB;

        if (scoreA > scoreB) {
            teamA.finalWins += 1;
            teamB.finalLosses += 1;
        } else if (scoreB > scoreA) {
            teamB.finalWins += 1;
            teamA.finalLosses += 1;
        }
    });

    return statMap;
}

function buildPoolStatMap(rankedPools = []) {
    const poolStatMap = new Map();

    rankedPools.forEach((pool) => {
        (pool.ranking || []).forEach((row, index) => {
            poolStatMap.set(row.teamId, {
                poolName: pool.name || '',
                poolRank: index + 1,
                poolPlayed: row.played || 0,
                poolWins: row.wins || 0,
                poolLosses: row.losses || 0,
                poolPointsFor: row.pointsFor || 0,
                poolPointsAgainst: row.pointsAgainst || 0,
                poolDiff: row.diff || 0,
                poolTotal: row.totalScore || 0,
            });
        });
    });

    return poolStatMap;
}

function getPoolStats(poolStatMap, teamId) {
    return (
        poolStatMap.get(teamId) || {
            poolName: '',
            poolRank: 999,
            poolPlayed: 0,
            poolWins: 0,
            poolLosses: 0,
            poolPointsFor: 0,
            poolPointsAgainst: 0,
            poolDiff: 0,
            poolTotal: 0,
        }
    );
}

function buildRankingRow(teamId, position, teamMap, statMap, poolStatMap) {
    const team = teamMap.get(teamId);
    const finalStats = statMap.get(teamId) || {};
    const poolStats = getPoolStats(poolStatMap, teamId);

    const played = (poolStats.poolPlayed || 0) + (finalStats.finalPlayed || 0);
    const wins = (poolStats.poolWins || 0) + (finalStats.finalWins || 0);
    const losses = (poolStats.poolLosses || 0) + (finalStats.finalLosses || 0);
    const pointsFor = (poolStats.poolPointsFor || 0) + (finalStats.finalPointsFor || 0);
    const pointsAgainst = (poolStats.poolPointsAgainst || 0) + (finalStats.finalPointsAgainst || 0);
    const diff = pointsFor - pointsAgainst;

    return {
        position,
        teamId,
        teamName: team?.name || finalStats.teamName || '',
        cumulativeRank: team?.cumulativeRank || finalStats.cumulativeRank || 0,
        ...poolStats,
        ...finalStats,
        played,
        wins,
        losses,
        pointsFor,
        pointsAgainst,
        diff,
        totalScore: diff,
    };
}

function sortByStageTieBreak(a, b) {
    if ((b.finalWins || 0) !== (a.finalWins || 0)) return (b.finalWins || 0) - (a.finalWins || 0);
    if ((b.finalDiff || 0) !== (a.finalDiff || 0)) return (b.finalDiff || 0) - (a.finalDiff || 0);
    if ((b.finalPointsFor || 0) !== (a.finalPointsFor || 0)) return (b.finalPointsFor || 0) - (a.finalPointsFor || 0);
    if ((b.poolWins || 0) !== (a.poolWins || 0)) return (b.poolWins || 0) - (a.poolWins || 0);
    if ((b.poolDiff || 0) !== (a.poolDiff || 0)) return (b.poolDiff || 0) - (a.poolDiff || 0);
    if ((b.poolPointsFor || 0) !== (a.poolPointsFor || 0)) return (b.poolPointsFor || 0) - (a.poolPointsFor || 0);
    return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
}

function sortRemainingPoolTeams(a, b) {
    if ((b.poolWins || 0) !== (a.poolWins || 0)) return (b.poolWins || 0) - (a.poolWins || 0);
    if ((b.poolDiff || 0) !== (a.poolDiff || 0)) return (b.poolDiff || 0) - (a.poolDiff || 0);
    if ((b.poolPointsFor || 0) !== (a.poolPointsFor || 0)) return (b.poolPointsFor || 0) - (a.poolPointsFor || 0);
    if ((a.poolRank || 999) !== (b.poolRank || 999)) return (a.poolRank || 999) - (b.poolRank || 999);
    return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
}

function pushSortedLosers({ ranking, seen, losers, startPosition, teamMap, statMap, poolStatMap }) {
    let position = startPosition;
    [...losers].sort(sortByStageTieBreak).forEach((team) => {
        if (!team?.teamId || seen.has(team.teamId)) return;
        seen.add(team.teamId);
        ranking.push(buildRankingRow(team.teamId, position, teamMap, statMap, poolStatMap));
        position += 1;
    });
    return position;
}

export function buildFinalRanking(stage, rankedPools = [], allTeams = []) {
    const safeStage = sanitizeStage(stage);
    const entryRound = safeStage.settings.entryRound;
    const statMap = buildStageStatMap(allTeams, safeStage);
    const poolStatMap = buildPoolStatMap(rankedPools);
    const teamMap = new Map((allTeams || []).map((team) => [team.id, team]));

    const finalWinner = getWinnerTeamId(safeStage.final);
    const finalLoser = getLoserTeamId(safeStage.final);

    const ranking = [];
    const seen = new Set();

    const pushRankedTeam = (position, teamId) => {
        if (!teamId || seen.has(teamId)) return;
        seen.add(teamId);
        ranking.push(buildRankingRow(teamId, position, teamMap, statMap, poolStatMap));
    };

    const makeComparableRow = (teamId) => buildRankingRow(teamId, 0, teamMap, statMap, poolStatMap);

    pushRankedTeam(1, finalWinner);
    pushRankedTeam(2, finalLoser);

    const semiLosers = safeStage.semiFinals.map(getLoserTeamId).filter(Boolean).map(makeComparableRow);

    if (safeStage.settings.enableThirdPlaceMatch) {
        pushRankedTeam(3, getWinnerTeamId(safeStage.thirdPlace));
        pushRankedTeam(4, getLoserTeamId(safeStage.thirdPlace));
    } else {
        const sortedSemiLosers = [...semiLosers].sort(sortByStageTieBreak);
        pushRankedTeam(3, sortedSemiLosers[0]?.teamId);
        pushRankedTeam(4, sortedSemiLosers[1]?.teamId);
    }

    let nextPosition = 5;

    if (entryRound !== 'semi') {
        const qfLosers = safeStage.quarterFinals.map(getLoserTeamId).filter(Boolean).map(makeComparableRow);

        if (safeStage.settings.enablePlacement5to8) {
            pushRankedTeam(5, getWinnerTeamId(safeStage.placement5to8Finals.place5));
            pushRankedTeam(6, getLoserTeamId(safeStage.placement5to8Finals.place5));
            pushRankedTeam(7, getWinnerTeamId(safeStage.placement5to8Finals.place7));
            pushRankedTeam(8, getLoserTeamId(safeStage.placement5to8Finals.place7));
            nextPosition = 9;
        } else {
            nextPosition = pushSortedLosers({
                ranking,
                seen,
                losers: qfLosers,
                startPosition: 5,
                teamMap,
                statMap,
                poolStatMap,
            });
        }
    }

    if (entryRound === 'round16') {
        const r16Losers = safeStage.roundOf16.map(getLoserTeamId).filter(Boolean).map(makeComparableRow);
        nextPosition = pushSortedLosers({
            ranking,
            seen,
            losers: r16Losers,
            startPosition: Math.max(nextPosition, ranking.length + 1),
            teamMap,
            statMap,
            poolStatMap,
        });
    }

    const remainingPoolTeams = [];
    rankedPools.forEach((pool) => {
        (pool.ranking || []).forEach((row) => {
            if (!seen.has(row.teamId)) remainingPoolTeams.push(buildRankingRow(row.teamId, 0, teamMap, statMap, poolStatMap));
        });
    });

    remainingPoolTeams.sort(sortRemainingPoolTeams);

    nextPosition = Math.max(nextPosition, ranking.length + 1);
    remainingPoolTeams.forEach((team) => {
        if (seen.has(team.teamId)) return;
        seen.add(team.teamId);
        ranking.push({ ...team, position: nextPosition });
        nextPosition += 1;
    });

    const missingTeams = (allTeams || [])
        .filter((team) => !seen.has(team.id))
        .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999));

    missingTeams.forEach((team) => {
        ranking.push(buildRankingRow(team.id, nextPosition, teamMap, statMap, poolStatMap));
        nextPosition += 1;
    });

    return ranking.sort((a, b) => a.position - b.position);
}
