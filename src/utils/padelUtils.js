export function createTeam(name) {
    return {
        id: crypto.randomUUID(),
        name: name.trim(),
    };
}

export function createMatch(teamAId, teamBId) {
    return {
        id: crypto.randomUUID(),
        teamAId,
        teamBId,
        scoreA: '',
        scoreB: '',
    };
}

export function generateAllMatches(teams) {
    const matches = [];

    for (let i = 0; i < teams.length; i += 1) {
        for (let j = i + 1; j < teams.length; j += 1) {
            matches.push(createMatch(teams[i].id, teams[j].id));
        }
    }

    return matches;
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

export function orderMatchesWithFatigue(rawMatches) {
    const remaining = [...rawMatches];
    const ordered = [];

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

    return ordered;
}

export function generateMatches(teams) {
    const rawMatches = generateAllMatches(teams);
    return orderMatchesWithFatigue(rawMatches);
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