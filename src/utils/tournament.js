const STORAGE_KEY = 'matrice-padel-v6';

function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createPlayer(name, rank = 0, slot = '') {
    return {
        id: uid(),
        slot,
        name: String(name || '').trim(),
        rank: Number(rank) || 0,
    };
}

export function createTeam(data) {
    const players = Array.isArray(data?.players) ? data.players : [];
    const cumulativeRank =
        Number(data?.cumulativeRank) ||
        players.reduce((sum, player) => sum + (Number(player.rank) || 0), 0);

    return {
        id: data?.id || uid(),
        number: data?.number || '',
        name: String(data?.name || '').trim(),
        fullName: String(data?.fullName || data?.name || '').trim(),
        matchLabel: String(data?.matchLabel || data?.name || '').trim(),
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

export function createMatch(teamAId, teamBId) {
    return {
        id: uid(),
        teamAId,
        teamBId,
        scoreA: '',
        scoreB: '',
    };
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
        serpentin[pool.id] = [];
    });

    return {
        baseTeams: [],
        pools,
        serpentin,
        activeTab: 'base',
        finalStage: null,
    };
}

function pairKey(a, b) {
    return [a, b].sort().join('__');
}

function isCompletedMatch(match) {
    return match.scoreA !== '' && match.scoreB !== '';
}

function countConsecutiveAppearances(schedule, teamId) {
    let count = 0;

    for (let i = schedule.length - 1; i >= 0; i -= 1) {
        const match = schedule[i];
        const appears = match.teamAId === teamId || match.teamBId === teamId;

        if (!appears) break;
        count += 1;
    }

    return count;
}

function wouldBreakFatigueRule(schedule, match) {
    const aCount = countConsecutiveAppearances(schedule, match.teamAId);
    const bCount = countConsecutiveAppearances(schedule, match.teamBId);

    return aCount >= 2 || bCount >= 2;
}

function fatigueOrder(matches, seedSchedule = []) {
    const remaining = [...matches];
    const ordered = [...seedSchedule];

    while (remaining.length > 0) {
        let selectedIndex = remaining.findIndex(
            (match) => !wouldBreakFatigueRule(ordered, match)
        );

        if (selectedIndex === -1) {
            selectedIndex = 0;
        }

        ordered.push(remaining[selectedIndex]);
        remaining.splice(selectedIndex, 1);
    }

    return ordered.slice(seedSchedule.length);
}

export function syncMatchesPreserveScores(teams, existingMatches = []) {
    const validTeamIds = new Set(teams.map((team) => team.id));
    const existingMap = new Map();

    existingMatches.forEach((match) => {
        if (
            validTeamIds.has(match.teamAId) &&
            validTeamIds.has(match.teamBId) &&
            match.teamAId !== match.teamBId
        ) {
            existingMap.set(pairKey(match.teamAId, match.teamBId), match);
        }
    });

    const validExistingOrdered = existingMatches.filter((match) => {
        const key = pairKey(match.teamAId, match.teamBId);
        return existingMap.has(key);
    });

    const seen = new Set(validExistingOrdered.map((match) => pairKey(match.teamAId, match.teamBId)));
    const missing = [];

    for (let i = 0; i < teams.length; i += 1) {
        for (let j = i + 1; j < teams.length; j += 1) {
            const key = pairKey(teams[i].id, teams[j].id);

            if (!seen.has(key)) {
                missing.push(createMatch(teams[i].id, teams[j].id));
            }
        }
    }

    const orderedMissing = fatigueOrder(missing, validExistingOrdered);
    return [...validExistingOrdered, ...orderedMissing];
}

export function optimizeMatchOrder(matches = []) {
    const completed = matches.filter(isCompletedMatch);
    const pending = matches.filter((match) => !isCompletedMatch(match));
    const orderedPending = fatigueOrder(pending, completed);
    return [...completed, ...orderedPending];
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
    ranking.forEach((team) => {
        teamMap.set(team.teamId, team);
    });

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
                        ? team.players.map((player) => createPlayer(player.name, player.rank, player.slot))
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
                            ? team.players.map((player) => createPlayer(player.name, player.rank, player.slot))
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
                parsed.activeTab === 'finals' ||
                parsed.activeTab === 'final-ranking' ||
                pools.some((pool) => pool.id === parsed.activeTab)
                    ? parsed.activeTab
                    : 'base',
            finalStage: parsed.finalStage || null,
        };
    } catch {
        return createDefaultState();
    }
}