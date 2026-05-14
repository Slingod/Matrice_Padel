
function isFilledScoreValue(value) {
    return value !== '' && value !== null && value !== undefined;
}

function getMatchPointsForRanking(match) {
    const detail = match?.scoreDetail || {};

    if (
        Number.isFinite(Number(detail.pointsA)) &&
        Number.isFinite(Number(detail.pointsB)) &&
        (Number(detail.pointsA) !== 0 || Number(detail.pointsB) !== 0)
    ) {
        return {
            pointsA: Number(detail.pointsA),
            pointsB: Number(detail.pointsB),
        };
    }

    if (Array.isArray(detail.sets)) {
        return detail.sets.reduce(
            (acc, set) => {
                if (!isFilledScoreValue(set?.scoreA) || !isFilledScoreValue(set?.scoreB)) {
                    return acc;
                }

                const scoreA = Number(set.scoreA);
                const scoreB = Number(set.scoreB);

                if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
                    return acc;
                }

                return {
                    pointsA: acc.pointsA + scoreA,
                    pointsB: acc.pointsB + scoreB,
                };
            },
            { pointsA: 0, pointsB: 0 }
        );
    }

    return {
        pointsA: Number(match?.scoreA) || 0,
        pointsB: Number(match?.scoreB) || 0,
    };
}

function getMatchGlobalScoreForRanking(match) {
    const detail = match?.scoreDetail || {};

    const rawScoreA = isFilledScoreValue(match?.scoreA)
        ? match.scoreA
        : isFilledScoreValue(detail.scoreA)
            ? detail.scoreA
            : undefined;

    const rawScoreB = isFilledScoreValue(match?.scoreB)
        ? match.scoreB
        : isFilledScoreValue(detail.scoreB)
            ? detail.scoreB
            : undefined;

    return {
        scoreA: rawScoreA === undefined ? NaN : Number(rawScoreA),
        scoreB: rawScoreB === undefined ? NaN : Number(rawScoreB),
    };
}

export const STORAGE_KEY = 'matrice-padel-v8';

function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeScoreDetailForStorage(detail, fallbackFormat = '') {
    if (!detail) return null;

    const sets = Array.isArray(detail.sets)
        ? detail.sets.map((set) => ({
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
        }))
        : [];

    const points = sets.reduce(
        (acc, set) => {
            if (!isFilledScoreValue(set.scoreA) || !isFilledScoreValue(set.scoreB)) {
                return acc;
            }

            const scoreA = Number(set.scoreA);
            const scoreB = Number(set.scoreB);

            if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
                return acc;
            }

            return {
                pointsA: acc.pointsA + scoreA,
                pointsB: acc.pointsB + scoreB,
            };
        },
        { pointsA: 0, pointsB: 0 }
    );

    const formatKey =
        detail.formatKey ||
        detail.matchFormatKey ||
        detail.format ||
        fallbackFormat ||
        '';

    const scoreA =
        detail.scoreA === undefined || detail.scoreA === null
            ? ''
            : String(detail.scoreA);

    const scoreB =
        detail.scoreB === undefined || detail.scoreB === null
            ? ''
            : String(detail.scoreB);

    return {
        formatKey,
        format: detail.format || formatKey,
        sets,
        scoreA,
        scoreB,
        pointsA:
            detail.pointsA === undefined || detail.pointsA === null
                ? points.pointsA
                : Number(detail.pointsA) || 0,
        pointsB:
            detail.pointsB === undefined || detail.pointsB === null
                ? points.pointsB
                : Number(detail.pointsB) || 0,
        isComplete: Boolean(detail.isComplete || (scoreA !== '' && scoreB !== '')),
    };
}

export function createPlayer(name, rank = 0, slot = '') {
    return {
        id: uid(),
        slot,
        name: String(name || '').trim(),
        rank: Number(rank) || 0,
    };
}

export function createTeam(data = {}) {
    const players = Array.isArray(data.players) ? data.players : [];
    const cumulativeRank =
        Number(data.cumulativeRank) ||
        players.reduce((sum, player) => sum + (Number(player.rank) || 0), 0);

    return {
        id: data.id || uid(),
        number: data.number || '',
        name: String(data.name || '').trim(),
        fullName: String(data.fullName || data.name || '').trim(),
        matchLabel: String(data.matchLabel || data.name || '').trim(),
        players,
        cumulativeRank,
        isSeed: Boolean(data.isSeed),
    };
}

export function createSerpentinEntry(value = '') {
    return {
        id: uid(),
        value: String(value ?? ''),
    };
}

export function createMatch(teamAId, teamBId, round = 1, localCourt = 1) {
    return {
        id: uid(),
        teamAId,
        teamBId,
        scoreA: '',
        scoreB: '',
        scoreDetail: null,
        format: '',
        round,
        localCourt,
    };
}

function pairKey(a, b) {
    return [a, b].sort().join('__');
}

function generateFourTeamsSchedule(teams) {
    if (teams.length !== 4) return [];

    const rounds = [
        [
            [teams[0], teams[1]],
            [teams[2], teams[3]],
        ],
        [
            [teams[0], teams[3]],
            [teams[1], teams[2]],
        ],
        [
            [teams[0], teams[2]],
            [teams[3], teams[1]],
        ],
    ];

    return rounds.flatMap((roundPairs, roundIndex) =>
        roundPairs.map((pair, pairIndex) =>
            createMatch(pair[0].id, pair[1].id, roundIndex + 1, pairIndex + 1)
        )
    );
}

function generateCircleSchedule(teams) {
    if (teams.length < 2) return [];

    const source = [...teams];
    const isOdd = source.length % 2 !== 0;

    if (isOdd) {
        source.push({ id: '__BYE__' });
    }

    const n = source.length;
    const rounds = n - 1;
    const half = n / 2;
    const rotation = [...source];
    const matches = [];

    for (let round = 0; round < rounds; round += 1) {
        let localCourt = 1;

        for (let i = 0; i < half; i += 1) {
            const home = rotation[i];
            const away = rotation[n - 1 - i];

            if (home.id === '__BYE__' || away.id === '__BYE__') continue;

            matches.push(createMatch(home.id, away.id, round + 1, localCourt));
            localCourt += 1;
        }

        const fixed = rotation[0];
        const rest = rotation.slice(1);
        rest.unshift(rest.pop());
        rotation.splice(0, rotation.length, fixed, ...rest);
    }

    return matches;
}

function generateScheduledMatches(teams) {
    if (teams.length === 4) {
        return generateFourTeamsSchedule(teams);
    }

    return generateCircleSchedule(teams);
}

function copyMatchData(scheduledMatch, existing) {
    if (!existing) return scheduledMatch;

    return {
        ...scheduledMatch,
        id: existing.id || scheduledMatch.id,
        scoreA: existing.scoreA ?? '',
        scoreB: existing.scoreB ?? '',
        scoreDetail: normalizeScoreDetailForStorage(existing.scoreDetail, existing.format) || null,
        format: existing.format || existing.scoreDetail?.formatKey || existing.scoreDetail?.format || existing.formatKey || existing.matchFormatKey || '',
        courtOverride: existing.courtOverride || '',
    };
}

export function syncMatchesPreserveScores(teams, existingMatches = []) {
    const scheduled = generateScheduledMatches(teams);

    const existingMap = new Map();
    existingMatches.forEach((match) => {
        if (!match.teamAId || !match.teamBId) return;
        existingMap.set(pairKey(match.teamAId, match.teamBId), match);
    });

    return scheduled.map((scheduledMatch) => {
        const existing = existingMap.get(pairKey(scheduledMatch.teamAId, scheduledMatch.teamBId));
        return copyMatchData(scheduledMatch, existing);
    });
}

export function optimizeMatchOrder(matches = []) {
    return [...matches].sort((a, b) => {
        if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
        return (a.localCourt || 0) - (b.localCourt || 0);
    });
}

export function getWinner(match) {
    const globalScore = getMatchGlobalScoreForRanking(match);
    const scoreA = globalScore.scoreA;
    const scoreB = globalScore.scoreB;

    const isValid =
        Number.isFinite(scoreA) &&
        Number.isFinite(scoreB);

    if (!isValid) return null;
    if (scoreA === scoreB) return 'draw';
    return scoreA > scoreB ? 'A' : 'B';
}

export function computeRanking(teams, matches) {
    const ranking = teams.map((team) => ({
        teamId: team.id,
        teamName: team.name,
        fullName: team.fullName,
        cumulativeRank: team.cumulativeRank || 0,
        players: team.players || [],
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        totalScore: 0,
    }));

    const teamMap = new Map();
    ranking.forEach((team) => teamMap.set(team.teamId, team));

    matches.forEach((match) => {
        const globalScore = getMatchGlobalScoreForRanking(match);
        const scoreA = globalScore.scoreA;
        const scoreB = globalScore.scoreB;
        const rankingPoints = getMatchPointsForRanking(match);

        const isValid =
            Number.isFinite(scoreA) &&
            Number.isFinite(scoreB) &&
            match.teamAId &&
            match.teamBId;

        if (!isValid) return;

        const teamA = teamMap.get(match.teamAId);
        const teamB = teamMap.get(match.teamBId);

        if (!teamA || !teamB) return;

        teamA.played += 1;
        teamB.played += 1;

        teamA.pointsFor += rankingPoints.pointsA;
        teamA.pointsAgainst += rankingPoints.pointsB;
        teamB.pointsFor += rankingPoints.pointsB;
        teamB.pointsAgainst += rankingPoints.pointsA;

        const diffA = rankingPoints.pointsA - rankingPoints.pointsB;
        const diffB = rankingPoints.pointsB - rankingPoints.pointsA;

        teamA.diff += diffA;
        teamB.diff += diffB;
        teamA.totalScore += diffA;
        teamB.totalScore += diffB;

        if (scoreA > scoreB) {
            teamA.wins += 1;
            teamB.losses += 1;
        } else if (scoreB > scoreA) {
            teamB.wins += 1;
            teamA.losses += 1;
        }
    });

    return ranking.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pointsFor - a.pointsFor;
    });
}

export function createPool(name, teamItems = []) {
    const teams = teamItems.map((team) => createTeam(team)).filter((team) => team.name);

    return {
        id: uid(),
        name: String(name || '').trim(),
        teams,
        matches: syncMatchesPreserveScores(teams, []),
    };
}

export function createDefaultState() {
    const pools = [
        createPool('Poule A', []),
        createPool('Poule B', []),
        createPool('Poule C', []),
    ];

    const serpentin = {};
    pools.forEach((pool) => {
        serpentin[pool.id] = [
            createSerpentinEntry(''),
            createSerpentinEntry(''),
            createSerpentinEntry(''),
            createSerpentinEntry(''),
        ];
    });

    return {
        baseTeams: [],
        pools,
        serpentin,
        activeTab: 'base',
        finalStage: null,
        courtCount: 4,
        courtLabels: ['1', '2', '3', '4'],
        matchFormat: 'D1',
        savedAt: null,
    };
}

function normalizeTeam(team = {}) {
    return createTeam({
        id: team.id,
        number: team.number,
        name: team.name,
        fullName: team.fullName,
        matchLabel: team.matchLabel,
        players: Array.isArray(team.players)
            ? team.players.map((player) => createPlayer(player.name, player.rank, player.slot))
            : [],
        cumulativeRank: team.cumulativeRank,
        isSeed: team.isSeed,
    });
}

function normalizeMatch(match = {}) {
    return {
        id: match.id || uid(),
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        scoreA: match.scoreA ?? '',
        scoreB: match.scoreB ?? '',
        scoreDetail: normalizeScoreDetailForStorage(match.scoreDetail, match.format) || null,
        format: match.format || match.scoreDetail?.formatKey || match.scoreDetail?.format || match.formatKey || match.matchFormatKey || '',
        round: match.round || 1,
        localCourt: match.localCourt || 1,
        courtOverride: match.courtOverride || '',
    };
}

function normalizeCourtLabelsForStorage(labels, courtCount) {
    const safeCourtCount = Math.max(1, Number(courtCount) || 1);
    const next = Array.isArray(labels)
        ? labels.slice(0, safeCourtCount).map((label, index) => String(label || index + 1))
        : [];

    while (next.length < safeCourtCount) {
        next.push(String(next.length + 1));
    }

    return next;
}

export function normalizeAppState(parsed) {
    if (!parsed || !Array.isArray(parsed.pools)) {
        return createDefaultState();
    }

    const baseTeams = Array.isArray(parsed.baseTeams) ? parsed.baseTeams.map(normalizeTeam) : [];

    const pools = parsed.pools.map((pool) => {
        const teams = Array.isArray(pool.teams) ? pool.teams.map(normalizeTeam) : [];
        const importedMatches = Array.isArray(pool.matches) ? pool.matches.map(normalizeMatch) : [];
        const importedByPair = new Map();

        importedMatches.forEach((match) => {
            if (!match.teamAId || !match.teamBId) return;
            importedByPair.set(pairKey(match.teamAId, match.teamBId), match);
        });

        const matches = syncMatchesPreserveScores(teams, importedMatches).map((match) => {
            const imported = importedByPair.get(pairKey(match.teamAId, match.teamBId));
            return imported
                ? {
                    ...match,
                    courtOverride: imported.courtOverride || '',
                    scoreDetail: imported.scoreDetail || match.scoreDetail || null,
                    format: imported.format || imported.scoreDetail?.formatKey || imported.scoreDetail?.format || match.format || '',
                    scoreA: imported.scoreA ?? match.scoreA ?? '',
                    scoreB: imported.scoreB ?? match.scoreB ?? '',
                }
                : match;
        });

        return {
            id: pool.id || uid(),
            name: pool.name || 'Poule',
            teams,
            matches,
        };
    });

    const serpentin = {};
    const rawSerpentin = parsed.serpentin || {};

    pools.forEach((pool) => {
        const entries = rawSerpentin[pool.id] || [];
        serpentin[pool.id] = Array.isArray(entries)
            ? entries.map((entry) =>
                typeof entry === 'string'
                    ? createSerpentinEntry(entry)
                    : {
                        id: entry.id || uid(),
                        value: String(entry.value ?? ''),
                    }
            )
            : [];
    });

    const courtCount = Number(parsed.courtCount) > 0 ? Number(parsed.courtCount) : 4;

    return {
        baseTeams,
        pools,
        serpentin,
        activeTab:
            parsed.activeTab === 'base' ||
            parsed.activeTab === 'serpentin' ||
            parsed.activeTab === 'planning' ||
            parsed.activeTab === 'finals' ||
            parsed.activeTab === 'final-ranking' ||
            parsed.activeTab === 'saves' ||
            pools.some((pool) => pool.id === parsed.activeTab)
                ? parsed.activeTab
                : 'base',
        finalStage: parsed.finalStage || null,
        courtCount,
        courtLabels: normalizeCourtLabelsForStorage(parsed.courtLabels, courtCount),
        matchFormat: parsed.matchFormat || parsed.format || 'D1',
        savedAt: parsed.savedAt || null,
    };
}

export function saveAppState(state) {
    const stateWithMetadata = {
        ...state,
        savedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithMetadata));
    return stateWithMetadata.savedAt;
}

export function clearAppState() {
    localStorage.removeItem(STORAGE_KEY);
}

export function getLocalSaveInfo() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);

        return {
            savedAt: parsed.savedAt || null,
            size: raw.length,
        };
    } catch {
        return null;
    }
}

export function loadAppState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return createDefaultState();
        }

        return normalizeAppState(JSON.parse(raw));
    } catch {
        return createDefaultState();
    }
}
