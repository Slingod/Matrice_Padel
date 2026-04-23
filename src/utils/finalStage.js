function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createStageMatch(label = '') {
    return {
        id: uid(),
        label,
        teamAId: '',
        teamBId: '',
        scoreA: '',
        scoreB: '',
    };
}

export function createEmptyFinalStage() {
    return {
        settings: {
            enableThirdPlaceMatch: false,
            enablePlacement5to8: false,
        },
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

function sanitizeMatch(match, fallbackLabel = '') {
    return {
        id: match?.id || uid(),
        label: match?.label || fallbackLabel,
        teamAId: match?.teamAId || '',
        teamBId: match?.teamBId || '',
        scoreA: match?.scoreA ?? '',
        scoreB: match?.scoreB ?? '',
    };
}

function sanitizeStage(stage) {
    const empty = createEmptyFinalStage();

    return {
        settings: {
            enableThirdPlaceMatch: Boolean(stage?.settings?.enableThirdPlaceMatch),
            enablePlacement5to8: Boolean(stage?.settings?.enablePlacement5to8),
        },
        quarterFinals: (stage?.quarterFinals || empty.quarterFinals).map((match, index) =>
            sanitizeMatch(match, `Quart ${index + 1}`)
        ),
        semiFinals: (stage?.semiFinals || empty.semiFinals).map((match, index) =>
            sanitizeMatch(match, `Demi ${index + 1}`)
        ),
        final: sanitizeMatch(stage?.final || empty.final, 'Finale'),
        thirdPlace: sanitizeMatch(stage?.thirdPlace || empty.thirdPlace, 'Petite finale'),
        placement5to8Semis: (stage?.placement5to8Semis || empty.placement5to8Semis).map(
            (match, index) => sanitizeMatch(match, `Place 5-8 / Demi ${index + 1}`)
        ),
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

    return {
        ...previousMatch,
        teamAId: nextTeamAId || '',
        teamBId: nextTeamBId || '',
        scoreA: sameTeams ? previousMatch?.scoreA ?? '' : '',
        scoreB: sameTeams ? previousMatch?.scoreB ?? '' : '',
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
    return {
        ...match,
        scoreA: '',
        scoreB: '',
    };
}

export function setFinalStageOption(stage, optionKey, value) {
    const safeStage = sanitizeStage(stage);

    return {
        ...safeStage,
        settings: {
            ...safeStage.settings,
            [optionKey]: Boolean(value),
        },
    };
}

export function assignQuarterTeam(stage, matchIndex, field, teamId) {
    const safeStage = sanitizeStage(stage);

    const quarterFinals = safeStage.quarterFinals.map((match, index) =>
        index === matchIndex
            ? clearScores({
                ...match,
                [field]: teamId || '',
            })
            : match
    );

    return {
        ...safeStage,
        quarterFinals,
    };
}

export function updateFinalStageMatch(stage, stageKey, matchIndex, field, value) {
    const safeStage = sanitizeStage(stage);
    const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));

    if (stageKey === 'final') {
        return {
            ...safeStage,
            final: {
                ...safeStage.final,
                [field]: sanitized,
            },
        };
    }

    if (stageKey === 'thirdPlace') {
        return {
            ...safeStage,
            thirdPlace: {
                ...safeStage.thirdPlace,
                [field]: sanitized,
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
                    [field]: sanitized,
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
                    [field]: sanitized,
                }
                : match
        ),
    };
}

export function syncFinalStageWithTeams(stage, allTeams = []) {
    const safeStage = sanitizeStage(stage);
    const validTeamIds = new Set((allTeams || []).map((team) => team.id));

    const keepValidTeams = (match) => ({
        ...match,
        teamAId: validTeamIds.has(match.teamAId) ? match.teamAId : '',
        teamBId: validTeamIds.has(match.teamBId) ? match.teamBId : '',
    });

    const quarterFinals = safeStage.quarterFinals.map(keepValidTeams);

    const qfWinners = quarterFinals.map(getWinnerTeamId);
    const qfLosers = quarterFinals.map(getLoserTeamId);

    const nextSemiFinals = safeStage.semiFinals.map(keepValidTeams);
    nextSemiFinals[0] = preserveScoresIfSameTeams(
        nextSemiFinals[0],
        qfWinners[0] || '',
        qfWinners[1] || ''
    );
    nextSemiFinals[1] = preserveScoresIfSameTeams(
        nextSemiFinals[1],
        qfWinners[2] || '',
        qfWinners[3] || ''
    );

    const sfWinners = nextSemiFinals.map(getWinnerTeamId);
    const sfLosers = nextSemiFinals.map(getLoserTeamId);

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
        nextThirdPlace = clearScores({
            ...nextThirdPlace,
            teamAId: '',
            teamBId: '',
        });
    }

    let placement5to8Semis = safeStage.placement5to8Semis.map(keepValidTeams);
    let placement5to8Finals = {
        place5: keepValidTeams(safeStage.placement5to8Finals.place5),
        place7: keepValidTeams(safeStage.placement5to8Finals.place7),
    };

    if (safeStage.settings.enablePlacement5to8) {
        placement5to8Semis[0] = preserveScoresIfSameTeams(
            placement5to8Semis[0],
            qfLosers[0] || '',
            qfLosers[1] || ''
        );
        placement5to8Semis[1] = preserveScoresIfSameTeams(
            placement5to8Semis[1],
            qfLosers[2] || '',
            qfLosers[3] || ''
        );

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
        placement5to8Semis = placement5to8Semis.map((match) =>
            clearScores({
                ...match,
                teamAId: '',
                teamBId: '',
            })
        );

        placement5to8Finals = {
            place5: clearScores({
                ...placement5to8Finals.place5,
                teamAId: '',
                teamBId: '',
            }),
            place7: clearScores({
                ...placement5to8Finals.place7,
                teamAId: '',
                teamBId: '',
            }),
        };
    }

    return {
        ...safeStage,
        quarterFinals,
        semiFinals: nextSemiFinals,
        final: nextFinal,
        thirdPlace: nextThirdPlace,
        placement5to8Semis,
        placement5to8Finals,
    };
}

function buildStageStatMap(allTeams, stage) {
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

    const allMatches = [
        ...(stage?.quarterFinals || []),
        ...(stage?.semiFinals || []),
        ...(stage?.settings?.enableThirdPlaceMatch ? [stage.thirdPlace] : []),
        ...(stage?.settings?.enablePlacement5to8 ? stage.placement5to8Semis || [] : []),
        ...(stage?.settings?.enablePlacement5to8
            ? [stage?.placement5to8Finals?.place5, stage?.placement5to8Finals?.place7]
            : []),
        stage?.final,
    ].filter(Boolean);

    allMatches.forEach((match) => {
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

function sortByFinalTieBreak(a, b) {
    if ((b.finalPointsFor || 0) !== (a.finalPointsFor || 0)) {
        return (b.finalPointsFor || 0) - (a.finalPointsFor || 0);
    }

    if ((b.finalDiff || 0) !== (a.finalDiff || 0)) {
        return (b.finalDiff || 0) - (a.finalDiff || 0);
    }

    return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
}

export function buildFinalRanking(stage, rankedPools = [], allTeams = []) {
    const safeStage = sanitizeStage(stage);
    const statMap = buildStageStatMap(allTeams, safeStage);
    const teamMap = new Map((allTeams || []).map((team) => [team.id, team]));

    const finalWinner = getWinnerTeamId(safeStage.final);
    const finalLoser = getLoserTeamId(safeStage.final);

    const ranking = [];
    const seen = new Set();

    const pushRankedTeam = (position, teamId) => {
        if (!teamId || seen.has(teamId)) return;

        seen.add(teamId);
        ranking.push({
            position,
            teamId,
            teamName: teamMap.get(teamId)?.name || '',
            cumulativeRank: teamMap.get(teamId)?.cumulativeRank || 0,
        });
    };

    pushRankedTeam(1, finalWinner);
    pushRankedTeam(2, finalLoser);

    const semiLosers = safeStage.semiFinals
        .map(getLoserTeamId)
        .filter(Boolean)
        .map((teamId) => ({
            teamId,
            teamName: teamMap.get(teamId)?.name || '',
            cumulativeRank: teamMap.get(teamId)?.cumulativeRank || 0,
            ...(statMap.get(teamId) || {}),
        }));

    if (safeStage.settings.enableThirdPlaceMatch) {
        pushRankedTeam(3, getWinnerTeamId(safeStage.thirdPlace));
        pushRankedTeam(4, getLoserTeamId(safeStage.thirdPlace));
    } else {
        const sortedSemiLosers = [...semiLosers].sort(sortByFinalTieBreak);
        pushRankedTeam(3, sortedSemiLosers[0]?.teamId);
        pushRankedTeam(4, sortedSemiLosers[1]?.teamId);
    }

    const qfLosers = safeStage.quarterFinals
        .map(getLoserTeamId)
        .filter(Boolean)
        .map((teamId) => ({
            teamId,
            teamName: teamMap.get(teamId)?.name || '',
            cumulativeRank: teamMap.get(teamId)?.cumulativeRank || 0,
            ...(statMap.get(teamId) || {}),
        }));

    if (safeStage.settings.enablePlacement5to8) {
        pushRankedTeam(5, getWinnerTeamId(safeStage.placement5to8Finals.place5));
        pushRankedTeam(6, getLoserTeamId(safeStage.placement5to8Finals.place5));
        pushRankedTeam(7, getWinnerTeamId(safeStage.placement5to8Finals.place7));
        pushRankedTeam(8, getLoserTeamId(safeStage.placement5to8Finals.place7));
    } else {
        const sortedQfLosers = [...qfLosers].sort(sortByFinalTieBreak);
        pushRankedTeam(5, sortedQfLosers[0]?.teamId);
        pushRankedTeam(6, sortedQfLosers[1]?.teamId);
        pushRankedTeam(7, sortedQfLosers[2]?.teamId);
        pushRankedTeam(8, sortedQfLosers[3]?.teamId);
    }

    const remainingPoolTeams = [];
    rankedPools.forEach((pool) => {
        pool.ranking.forEach((row, index) => {
            if (seen.has(row.teamId)) return;

            remainingPoolTeams.push({
                teamId: row.teamId,
                teamName: row.teamName,
                cumulativeRank: row.cumulativeRank || 0,
                poolRank: index + 1,
                totalScore: row.totalScore || 0,
                diff: row.diff || 0,
                wins: row.wins || 0,
                pointsFor: row.pointsFor || 0,
            });
        });
    });

    remainingPoolTeams.sort((a, b) => {
        if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
    });

    let nextPosition = ranking.length + 1;
    remainingPoolTeams.forEach((team) => {
        if (seen.has(team.teamId)) return;
        seen.add(team.teamId);

        ranking.push({
            position: nextPosition,
            teamId: team.teamId,
            teamName: team.teamName,
            cumulativeRank: team.cumulativeRank || 0,
        });

        nextPosition += 1;
    });

    const missingTeams = (allTeams || [])
        .filter((team) => !seen.has(team.id))
        .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999));

    missingTeams.forEach((team) => {
        ranking.push({
            position: nextPosition,
            teamId: team.id,
            teamName: team.name,
            cumulativeRank: team.cumulativeRank || 0,
        });
        nextPosition += 1;
    });

    return ranking.sort((a, b) => a.position - b.position);
}