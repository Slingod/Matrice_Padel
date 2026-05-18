import { createSerpentinEntry, syncMatchesPreserveScores } from './tournament';
import { createEmptyFinalStage } from './finalStage';
import { calculateFftMatchStats } from './fftScoring.js';

export function syncPoolsFromSerpentin(baseTeams, previousPools, serpentinMap) {
    const teamMap = new Map(baseTeams.map((team) => [team.id, team]));

    return previousPools.map((pool) => {
        const selectedIds = (serpentinMap[pool.id] || [])
            .map((entry) => entry.value)
            .filter(Boolean);

        const uniqueIds = [...new Set(selectedIds)];
        const teams = uniqueIds.map((teamId) => teamMap.get(teamId)).filter(Boolean);

        return {
            ...pool,
            teams,
            matches: normalizePoolMatchesToFftPadelRotation(
                { ...pool, teams, matches: syncMatchesPreserveScores(teams, pool.matches) },
                pool.matches
            ),
        };
    });
}

export function createCombinedStatRow(team = {}) {
    return {
        teamId: team.id,
        teamName: team.name,
        cumulativeRank: team.cumulativeRank || 0,
        played: 0,
        wins: 0,
        losses: 0,
        setsFor: 0,
        setsAgainst: 0,
        setDiff: 0,
        useSetPriority: false,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        fftGameDiff: 0,
        totalScore: 0,
    };
}

export function applyMatchToStats(statMap, matchOrTeamAId, teamBId = null, scoreA = '', scoreB = '') {
    const isMatchObject = typeof matchOrTeamAId === 'object' && matchOrTeamAId !== null;
    const match = isMatchObject
        ? matchOrTeamAId
        : {
            teamAId: matchOrTeamAId,
            teamBId,
            scoreA,
            scoreB,
        };

    const stats = calculateFftMatchStats(match);

    if (!stats.isComplete || !match.teamAId || !match.teamBId) return;

    const teamA = statMap.get(match.teamAId);
    const teamB = statMap.get(match.teamBId);

    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    teamA.setsFor = (teamA.setsFor || 0) + stats.setsA;
    teamA.setsAgainst = (teamA.setsAgainst || 0) + stats.setsB;
    teamB.setsFor = (teamB.setsFor || 0) + stats.setsB;
    teamB.setsAgainst = (teamB.setsAgainst || 0) + stats.setsA;

    teamA.setDiff = (teamA.setDiff || 0) + stats.setDiffA;
    teamB.setDiff = (teamB.setDiff || 0) + stats.setDiffB;

    teamA.useSetPriority = Boolean(teamA.useSetPriority || stats.useSetPriority);
    teamB.useSetPriority = Boolean(teamB.useSetPriority || stats.useSetPriority);

    teamA.pointsFor += stats.fftGamesA;
    teamA.pointsAgainst += stats.fftGamesB;
    teamB.pointsFor += stats.fftGamesB;
    teamB.pointsAgainst += stats.fftGamesA;

    teamA.diff += stats.fftGameDiffA;
    teamB.diff += stats.fftGameDiffB;

    teamA.fftGameDiff = (teamA.fftGameDiff || 0) + stats.fftGameDiffA;
    teamB.fftGameDiff = (teamB.fftGameDiff || 0) + stats.fftGameDiffB;

    teamA.totalScore += stats.fftGameDiffA;
    teamB.totalScore += stats.fftGameDiffB;

    if (stats.winner === 'A') {
        teamA.wins += 1;
        teamB.losses += 1;
    } else if (stats.winner === 'B') {
        teamB.wins += 1;
        teamA.losses += 1;
    }
}

export function buildTeamFromDraft(draft, existingId) {
    const player1Rank = Number(draft.player1Rank) || 0;
    const player2Rank = Number(draft.player2Rank) || 0;

    return {
        id: existingId,
        number: String(draft.number || '').trim(),
        name: String(draft.displayName || '').trim(),
        fullName: String(draft.displayName || '').trim(),
        matchLabel: String(draft.displayName || '').trim(),
        players: [
            {
                id: `${existingId}-p1`,
                slot: 'J1',
                name: String(draft.player1Name || '').trim(),
                rank: player1Rank,
            },
            {
                id: `${existingId}-p2`,
                slot: 'J2',
                name: String(draft.player2Name || '').trim(),
                rank: player2Rank,
            },
        ],
        cumulativeRank: player1Rank + player2Rank,
        isSeed: Boolean(draft.isSeed),
    };
}

export function getInitialDraftFromTeam(team) {
    return {
        number: team.number || '',
        displayName: team.name || '',
        player1Name: team.players?.[0]?.name || '',
        player1Rank: String(team.players?.[0]?.rank ?? ''),
        player2Name: team.players?.[1]?.name || '',
        player2Rank: String(team.players?.[1]?.rank ?? ''),
        isSeed: Boolean(team.isSeed),
    };
}


export function clearTeamFromFinalStage(stage, teamId) {
    const clearMatch = (match = {}) => {
        const hasTeamA = match.teamAId === teamId;
        const hasTeamB = match.teamBId === teamId;

        if (!hasTeamA && !hasTeamB) return match;

        return {
            ...match,
            teamAId: hasTeamA ? '' : match.teamAId,
            teamBId: hasTeamB ? '' : match.teamBId,
            scoreA: '',
            scoreB: '',
        };
    };

    const baseStage = stage || createEmptyFinalStage();

    return {
        ...baseStage,
        roundOf16: (baseStage.roundOf16 || []).map(clearMatch),
        quarterFinals: (baseStage.quarterFinals || []).map(clearMatch),
        semiFinals: (baseStage.semiFinals || []).map(clearMatch),
        final: clearMatch(baseStage.final),
        thirdPlace: clearMatch(baseStage.thirdPlace),
        placement5to8Semis: (baseStage.placement5to8Semis || []).map(clearMatch),
        placement5to8Finals: {
            place5: clearMatch(baseStage.placement5to8Finals?.place5),
            place7: clearMatch(baseStage.placement5to8Finals?.place7),
        },
    };
}

export function groupMatchesByRound(matches) {
    const roundMap = new Map();

    [...matches]
        .sort((a, b) => {
            if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
            return (a.localCourt || 0) - (b.localCourt || 0);
        })
        .forEach((match) => {
            const round = match.round || 1;
            if (!roundMap.has(round)) {
                roundMap.set(round, []);
            }
            roundMap.get(round).push(match);
        });

    return [...roundMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, roundMatches]) => ({ round, matches: roundMatches }));
}

export const FFT_PADEL_ROTATIONS = {
    4: [
        [[1, 4], [2, 3]],
        [[1, 3], [2, 4]],
        [[1, 2], [3, 4]],
    ],
    5: [
        [[1, 5], [2, 4]],
        [[1, 4], [5, 3]],
        [[1, 3], [4, 2]],
        [[1, 2], [3, 5]],
        [[2, 5], [3, 4]],
    ],
    6: [
        [[1, 6], [2, 5], [3, 4]],
        [[1, 5], [6, 4], [2, 3]],
        [[1, 4], [5, 3], [6, 2]],
        [[1, 3], [4, 2], [5, 6]],
        [[1, 2], [3, 6], [4, 5]],
    ],
};

export function getMatchPairKey(teamAId, teamBId) {
    return [teamAId, teamBId].sort().join('__');
}

export function normalizePoolMatchesToFftPadelRotation(pool, previousMatches = []) {
    const teams = pool.teams || [];
    const rotation = FFT_PADEL_ROTATIONS[teams.length];

    if (!rotation) {
        return [...(pool.matches || [])].sort((a, b) => {
            if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
            return (a.localCourt || 0) - (b.localCourt || 0);
        });
    }

    const previousByPair = new Map();
    [...previousMatches, ...(pool.matches || [])].forEach((match) => {
        if (!match.teamAId || !match.teamBId) return;
        previousByPair.set(getMatchPairKey(match.teamAId, match.teamBId), match);
    });

    return rotation.flatMap((roundPairs, roundIndex) =>
        roundPairs.map(([teamANumber, teamBNumber], courtIndex) => {
            const teamA = teams[teamANumber - 1];
            const teamB = teams[teamBNumber - 1];
            const existing = previousByPair.get(getMatchPairKey(teamA?.id, teamB?.id));
            const isSameDirection = existing?.teamAId === teamA?.id && existing?.teamBId === teamB?.id;
            const isReversed = existing?.teamAId === teamB?.id && existing?.teamBId === teamA?.id;

            return {
                ...(existing || {}),
                id:
                    existing?.id ||
                    `${pool.id}-match-${roundIndex + 1}-${courtIndex + 1}-${teamA?.id || 'a'}-${teamB?.id || 'b'}`,
                round: roundIndex + 1,
                localCourt: courtIndex + 1,
                teamAId: teamA?.id || '',
                teamBId: teamB?.id || '',
                scoreA: isReversed ? existing?.scoreB ?? '' : isSameDirection ? existing?.scoreA ?? '' : existing?.scoreA ?? '',
                scoreB: isReversed ? existing?.scoreA ?? '' : isSameDirection ? existing?.scoreB ?? '' : existing?.scoreB ?? '',
            };
        })
    );
}

export function sortMatchesForDisplay(matches) {
    return [...(matches || [])].sort((a, b) => {
        if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
        return (a.localCourt || 0) - (b.localCourt || 0);
    });
}

export function normalizeCourtLabels(labels, courtCount) {
    const count = Math.max(1, Number(courtCount) || 1);
    return Array.from({ length: count }, (_, index) => {
        const rawLabel = labels?.[index];
        const label = String(rawLabel ?? '').trim();
        return label || String(index + 1);
    });
}

export function buildGlobalPlanning(pools, courtCount) {
    const poolQueues = pools.map((pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        rounds: groupMatchesByRound(pool.matches),
    }));

    const slots = [];
    let slotNumber = 1;

    while (poolQueues.some((item) => item.rounds.length > 0)) {
        let remainingCourts = courtCount;
        const slotMatches = [];

        for (const poolQueue of poolQueues) {
            const nextRound = poolQueue.rounds[0];
            if (!nextRound) continue;

            if (nextRound.matches.length <= remainingCourts) {
                nextRound.matches.forEach((match, index) => {
                    slotMatches.push({
                        slot: slotNumber,
                        terrain: courtCount - remainingCourts + index + 1,
                        poolId: poolQueue.poolId,
                        poolName: poolQueue.poolName,
                        round: nextRound.round,
                        match,
                    });
                });

                remainingCourts -= nextRound.matches.length;
                poolQueue.rounds.shift();
            }
        }

        if (slotMatches.length === 0) {
            const firstPoolWithRounds = poolQueues.find((item) => item.rounds.length > 0);
            if (!firstPoolWithRounds) break;

            const forcedRound = firstPoolWithRounds.rounds.shift();
            forcedRound.matches.slice(0, courtCount).forEach((match, index) => {
                slotMatches.push({
                    slot: slotNumber,
                    terrain: index + 1,
                    poolId: firstPoolWithRounds.poolId,
                    poolName: firstPoolWithRounds.poolName,
                    round: forcedRound.round,
                    match,
                });
            });
        }

        slots.push(slotMatches);
        slotNumber += 1;
    }

    return slots.flat();
}

export function shuffleArray(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


export function getOriginalTeamOrderNumber(team) {
    return Number(String(team?.number || '').match(/(\d+)/)?.[1] || 0);
}

export function getSeedTeams(teams) {
    return [...teams]
        .filter((team) => Boolean(team.isSeed))
        .sort((a, b) => {
            const aRank = Number(a.cumulativeRank) || 999999999;
            const bRank = Number(b.cumulativeRank) || 999999999;
            if (aRank !== bRank) return aRank - bRank;

            const aNum = getOriginalTeamOrderNumber(a);
            const bNum = getOriginalTeamOrderNumber(b);
            if (aNum !== bNum) return aNum - bNum;

            return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
        });
}

export function buildBalancedRandomSerpentin(playableTeams, pools) {
    if (!pools.length) return {};

    const sortedTeams = [...playableTeams].sort((a, b) => {
        const aRank = Number(a.cumulativeRank) || 999999999;
        const bRank = Number(b.cumulativeRank) || 999999999;
        if (aRank !== bRank) return aRank - bRank;
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });

    const poolIds = pools.map((pool) => pool.id);
    const assignments = Object.fromEntries(poolIds.map((poolId) => [poolId, []]));

    sortedTeams.forEach((team, index) => {
        const block = Math.floor(index / poolIds.length);
        const position = index % poolIds.length;
        const poolIndex = block % 2 === 0 ? position : poolIds.length - 1 - position;
        assignments[poolIds[poolIndex]].push(createSerpentinEntry(team.id));
    });

    return Object.fromEntries(
        pools.map((pool) => {
            const rows = assignments[pool.id] || [];
            return [pool.id, rows.length > 0 ? rows : [createSerpentinEntry('')]];
        })
    );
}

export function pairSeedsWithOpponents(seedSlots, opponents) {
    const recurse = (index, remainingOpponents, acc) => {
        if (index >= seedSlots.length) return acc;

        const seed = seedSlots[index];

        const preferred = remainingOpponents.filter(
            (candidate) => !seed.poolId || !candidate.poolId || seed.poolId !== candidate.poolId
        );

        const ordered = [
            ...preferred,
            ...remainingOpponents.filter((item) => !preferred.includes(item)),
        ];

        for (const opponent of ordered) {
            const nextRemaining = remainingOpponents.filter((item) => item.teamId !== opponent.teamId);
            const result = recurse(index + 1, nextRemaining, [...acc, [seed, opponent]]);
            if (result) return result;
        }

        return null;
    };

    return recurse(0, opponents, []) || [];
}


function compareQualifiedTeams(a, b) {
    if ((a.poolRank || 999) !== (b.poolRank || 999)) return (a.poolRank || 999) - (b.poolRank || 999);
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
    if ((b.diff || 0) !== (a.diff || 0)) return (b.diff || 0) - (a.diff || 0);
    if ((b.pointsFor || 0) !== (a.pointsFor || 0)) return (b.pointsFor || 0) - (a.pointsFor || 0);
    return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
}

function buildSeedTeamRows(allTeams) {
    return getSeedTeams(allTeams)
        .slice(0, 4)
        .map((team, index) => ({
            teamId: team.id,
            teamName: team.name,
            cumulativeRank: team.cumulativeRank || 0,
            poolId: null,
            poolName: 'TS',
            poolRank: 0,
            wins: 0,
            totalScore: 0,
            diff: 0,
            pointsFor: 0,
            type: 'ts',
            tsNumber: index + 1,
        }));
}

function buildQualifiedPoolRows(rankedPools, usedTsIds, qualifierMode = 'top2') {
    const rows = rankedPools.flatMap((pool) =>
        (pool.ranking || [])
            .filter((team) => !usedTsIds.has(team.teamId))
            .map((team, rankIndex) => ({
                teamId: team.teamId,
                teamName: team.teamName,
                cumulativeRank: team.cumulativeRank || 0,
                poolId: pool.id,
                poolName: pool.name,
                poolRank: rankIndex + 1,
                wins: team.wins || 0,
                totalScore: team.totalScore || 0,
                diff: team.diff || 0,
                pointsFor: team.pointsFor || 0,
                type: rankIndex === 0 ? 'winner' : rankIndex === 1 ? 'second' : 'extra',
            }))
    );

    if (qualifierMode === 'winners') {
        return rows.filter((team) => team.poolRank === 1).sort(compareQualifiedTeams);
    }

    if (qualifierMode === 'best4') {
        return rows.sort(compareQualifiedTeams).slice(0, 4);
    }

    if (qualifierMode === 'all') {
        return rows.sort(compareQualifiedTeams);
    }

    return rows.filter((team) => team.poolRank <= 2).sort(compareQualifiedTeams);
}

function buildEmptyMatches(count) {
    return Array.from({ length: count }, () => ({ teamAId: '', teamBId: '', scoreA: '', scoreB: '' }));
}

function getBracketSize(teamCount) {
    if (teamCount >= 16) return 16;
    if (teamCount >= 8) return 8;
    if (teamCount >= 4) return 4;
    return 0;
}

function getFixedSeedSlot(tsNumber, bracketSize) {
    if (bracketSize === 16) {
        return {
            2: { matchIndex: 0, field: 'teamAId' },
            3: { matchIndex: 2, field: 'teamAId' },
            4: { matchIndex: 5, field: 'teamBId' },
            1: { matchIndex: 7, field: 'teamBId' },
        }[tsNumber] || null;
    }

    if (bracketSize === 8) {
        return {
            2: { matchIndex: 0, field: 'teamAId' },
            3: { matchIndex: 1, field: 'teamAId' },
            4: { matchIndex: 2, field: 'teamBId' },
            1: { matchIndex: 3, field: 'teamBId' },
        }[tsNumber] || null;
    }

    return {
        2: { matchIndex: 0, field: 'teamAId' },
        1: { matchIndex: 1, field: 'teamBId' },
    }[tsNumber] || null;
}

function placeFixedSeeds(matches, seedTeams, bracketSize) {
    const usedIds = new Set();

    seedTeams.forEach((seed) => {
        const slot = getFixedSeedSlot(seed.tsNumber, bracketSize);
        if (!slot || !matches[slot.matchIndex]) return;

        matches[slot.matchIndex][slot.field] = seed.teamId;
        usedIds.add(seed.teamId);
    });

    return usedIds;
}

function findTeamForSlot({ candidates, usedIds, oppositeTeam, preferWeakest }) {
    const ordered = preferWeakest ? [...candidates].reverse() : [...candidates];
    const differentPool = ordered.find(
        (candidate) =>
            !usedIds.has(candidate.teamId) &&
            (!oppositeTeam?.poolId || !candidate.poolId || oppositeTeam.poolId !== candidate.poolId)
    );

    return differentPool || ordered.find((candidate) => !usedIds.has(candidate.teamId)) || null;
}

function fillBracketMatches(matches, candidates, teamRowMap) {
    const usedIds = new Set(
        matches.flatMap((match) => [match.teamAId, match.teamBId]).filter(Boolean)
    );

    matches.forEach((match, matchIndex) => {
        ['teamAId', 'teamBId'].forEach((field) => {
            if (match[field]) return;

            const oppositeField = field === 'teamAId' ? 'teamBId' : 'teamAId';
            const oppositeTeam = teamRowMap.get(match[oppositeField]);
            const preferWeakest = Boolean(oppositeTeam && (oppositeTeam.type === 'ts' || oppositeTeam.poolRank === 1));
            const picked = findTeamForSlot({ candidates, usedIds, oppositeTeam, preferWeakest });

            if (!picked) return;
            match[field] = picked.teamId;
            usedIds.add(picked.teamId);
        });

        if (!match.teamAId || !match.teamBId) {
            const remaining = candidates.filter((candidate) => !usedIds.has(candidate.teamId));
            if (!match.teamAId && remaining[0]) {
                match.teamAId = remaining[0].teamId;
                usedIds.add(remaining[0].teamId);
            }
            if (!match.teamBId && remaining[1]) {
                match.teamBId = remaining[1].teamId;
                usedIds.add(remaining[1].teamId);
            }
        }

        matches[matchIndex] = match;
    });

    return matches;
}

export function buildAutoFinalDraw({ rankedPools, allTeams, qualifierMode = 'top2' }) {
    const tsTeams = buildSeedTeamRows(allTeams);
    const usedTsIds = new Set(tsTeams.map((team) => team.teamId));
    const poolQualifiedTeams = buildQualifiedPoolRows(rankedPools, usedTsIds, qualifierMode);
    const participants = [...tsTeams, ...poolQualifiedTeams];
    const bracketSize = getBracketSize(participants.length);

    if (!bracketSize) return null;

    const matchCount = bracketSize / 2;
    const matches = buildEmptyMatches(matchCount);
    const teamRowMap = new Map(participants.map((team) => [team.teamId, team]));

    placeFixedSeeds(matches, tsTeams, bracketSize);

    const sortedParticipants = [...participants]
        .sort((a, b) => {
            if (a.type === 'ts' && b.type !== 'ts') return -1;
            if (a.type !== 'ts' && b.type === 'ts') return 1;
            if (a.type === 'ts' && b.type === 'ts') return (a.tsNumber || 999) - (b.tsNumber || 999);
            return compareQualifiedTeams(a, b);
        })
        .slice(0, bracketSize);

    const selectedIds = new Set(sortedParticipants.map((team) => team.teamId));
    const selectedRows = sortedParticipants.filter((team) => selectedIds.has(team.teamId));
    fillBracketMatches(matches, selectedRows, teamRowMap);

    const entryRound = bracketSize === 16 ? 'round16' : bracketSize === 8 ? 'quarter' : 'semi';

    return {
        entryRound,
        matches,
        qualifiedCount: selectedRows.length,
        totalCandidateCount: participants.length,
    };
}

export function buildAutoQuarterDraw({ rankedPools, allTeams }) {
    const draw = buildAutoFinalDraw({ rankedPools, allTeams, qualifierMode: 'top2' });
    return draw?.entryRound === 'quarter' ? draw.matches : [];
}
