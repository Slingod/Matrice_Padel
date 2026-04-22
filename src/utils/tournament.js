const STORAGE_KEY = 'matrice-padel-v8';

function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function syncMatchesPreserveScores(teams, existingMatches = []) {
    const scheduled = generateScheduledMatches(teams);

    const existingMap = new Map();
    existingMatches.forEach((match) => {
        if (!match.teamAId || !match.teamBId) return;
        existingMap.set(pairKey(match.teamAId, match.teamBId), match);
    });

    return scheduled.map((scheduledMatch) => {
        const existing = existingMap.get(pairKey(scheduledMatch.teamAId, scheduledMatch.teamBId));

        if (!existing) return scheduledMatch;

        return {
            ...scheduledMatch,
            id: existing.id || scheduledMatch.id,
            scoreA: existing.scoreA ?? '',
            scoreB: existing.scoreB ?? '',
        };
    });
}

export function optimizeMatchOrder(matches = []) {
    return [...matches].sort((a, b) => {
        if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
        return (a.localCourt || 0) - (b.localCourt || 0);
    });
}

export function getWinner(match) {
    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);

    const isValid =
        match.scoreA !== '' &&
        match.scoreB !== '' &&
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
        const scoreA = Number(match.scoreA);
        const scoreB = Number(match.scoreB);

        const isValid =
            Number.isFinite(scoreA) &&
            Number.isFinite(scoreB) &&
            match.scoreA !== '' &&
            match.scoreB !== '';

        if (!isValid) return;

        const teamA = teamMap.get(match.teamAId);
        const teamB = teamMap.get(match.teamBId);

        if (!teamA || !teamB) return;

        teamA.played += 1;
        teamB.played += 1;

        teamA.pointsFor += scoreA;
        teamA.pointsAgainst += scoreB;
        teamB.pointsFor += scoreB;
        teamB.pointsAgainst += scoreA;

        const diffA = scoreA - scoreB;
        const diffB = scoreB - scoreA;

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
    };
}

export function saveAppState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadAppState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return createDefaultState();
        }

        const parsed = JSON.parse(raw);

        if (!parsed || !Array.isArray(parsed.pools)) {
            return createDefaultState();
        }

        const baseTeams = Array.isArray(parsed.baseTeams)
            ? parsed.baseTeams.map((team) =>
                createTeam({
                    id: team.id,
                    number: team.number,
                    name: team.name,
                    fullName: team.fullName,
                    matchLabel: team.matchLabel,
                    players: Array.isArray(team.players)
                        ? team.players.map((player) =>
                            createPlayer(player.name, player.rank, player.slot)
                        )
                        : [],
                    cumulativeRank: team.cumulativeRank,
                })
            )
            : [];

        const pools = parsed.pools.map((pool) => {
            const teams = Array.isArray(pool.teams)
                ? pool.teams.map((team) =>
                    createTeam({
                        id: team.id,
                        number: team.number,
                        name: team.name,
                        fullName: team.fullName,
                        matchLabel: team.matchLabel,
                        players: Array.isArray(team.players)
                            ? team.players.map((player) =>
                                createPlayer(player.name, player.rank, player.slot)
                            )
                            : [],
                        cumulativeRank: team.cumulativeRank,
                    })
                )
                : [];

            const matches = Array.isArray(pool.matches)
                ? pool.matches.map((match) => ({
                    id: match.id || uid(),
                    teamAId: match.teamAId,
                    teamBId: match.teamBId,
                    scoreA: match.scoreA ?? '',
                    scoreB: match.scoreB ?? '',
                    round: match.round || 1,
                    localCourt: match.localCourt || 1,
                }))
                : [];

            return {
                id: pool.id || uid(),
                name: pool.name || 'Poule',
                teams,
                matches: syncMatchesPreserveScores(teams, matches),
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
                pools.some((pool) => pool.id === parsed.activeTab)
                    ? parsed.activeTab
                    : 'base',
            finalStage: parsed.finalStage || null,
            courtCount: Number(parsed.courtCount) > 0 ? Number(parsed.courtCount) : 4,
        };
    } catch {
        return createDefaultState();
    }
}