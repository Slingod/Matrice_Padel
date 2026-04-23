import * as XLSX from 'xlsx';
import { computeRanking, createPool, createSerpentinEntry } from './tournament';
import { createEmptyFinalStage } from './finalStage';

function sanitizeSheetName(name) {
    return String(name || 'Feuille').replace(/[\\/?*\[\]:]/g, '').slice(0, 31) || 'Feuille';
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeHeader(value) {
    return normalizeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function buildTeamDisplayName(players) {
    return players.map((player) => player.name).join(' & ');
}

function dedupeTeams(teams) {
    const seen = new Set();

    return teams.filter((team) => {
        const key = `${team.number}__${team.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseRowsFromSheet(sheet) {
    const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
    });

    if (!matrix.length) return [];

    const headerRowIndex = matrix.findIndex(
        (row) =>
            Array.isArray(row) &&
            row.some((cell) => {
                const normalized = normalizeHeader(cell);
                return normalized === 'equipe' || normalized === 'joueur' || normalized === 'nom';
            })
    );

    if (headerRowIndex === -1) return [];

    const rawHeaders = matrix[headerRowIndex];
    const headers = rawHeaders.map((header, index) => normalizeText(header) || `col_${index}`);

    return matrix
        .slice(headerRowIndex + 1)
        .filter((row) => Array.isArray(row) && row.some((cell) => normalizeText(cell) !== ''))
        .map((row) => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] ?? '';
            });
            return obj;
        });
}

function findValue(row, aliases) {
    for (const [key, value] of Object.entries(row)) {
        if (aliases.includes(normalizeHeader(key))) {
            return value;
        }
    }
    return '';
}

function parseParticipantsRows(rows) {
    const grouped = {};

    rows.forEach((row) => {
        const rawTeam = findValue(row, ['equipe']) || findValue(row, ['team']) || '';
        const rawSlot = findValue(row, ['joueur']) || findValue(row, ['player']) || '';
        const rawName = findValue(row, ['nom']) || findValue(row, ['name']) || '';
        const rawRank =
            findValue(row, ['rang']) ||
            findValue(row, ['rank']) ||
            findValue(row, ['rang combine']) ||
            '';

        const teamName = normalizeText(rawTeam);
        const slot = normalizeText(rawSlot);
        const playerName = normalizeText(rawName);
        const rank = Number(rawRank) || 0;

        if (!teamName || !playerName) return;

        const match = teamName.match(/(\d+)/);
        const teamNumber = match ? Number(match[1]) : null;
        const teamLabel = teamNumber ? `Équipe ${teamNumber}` : teamName;

        if (!grouped[teamLabel]) {
            grouped[teamLabel] = { number: teamLabel, players: [] };
        }

        grouped[teamLabel].players.push({
            id: `${teamLabel}-${slot || grouped[teamLabel].players.length + 1}`,
            slot: slot || `J${grouped[teamLabel].players.length + 1}`,
            name: playerName,
            rank,
        });
    });

    return Object.values(grouped)
        .map((team, index) => {
            const players = [...team.players].sort((a, b) => a.slot.localeCompare(b.slot));
            const cumulativeRank = players.reduce((sum, player) => sum + (Number(player.rank) || 0), 0);

            return {
                id: `team-import-${index + 1}-${Date.now()}`,
                number: team.number,
                name: buildTeamDisplayName(players),
                fullName: buildTeamDisplayName(players),
                matchLabel: buildTeamDisplayName(players),
                players,
                cumulativeRank,
            };
        })
        .sort((a, b) => {
            const aNum = Number(String(a.number).match(/(\d+)/)?.[1] || 999999);
            const bNum = Number(String(b.number).match(/(\d+)/)?.[1] || 999999);
            return aNum - bNum;
        });
}

function buildBaseRows(baseTeams) {
    return baseTeams.map((team) => ({
        Équipe: team.number,
        'Nom affiché': team.name,
        'Joueur 1': team.players?.[0]?.name || '',
        'Rang 1': team.players?.[0]?.rank || '',
        'Joueur 2': team.players?.[1]?.name || '',
        'Rang 2': team.players?.[1]?.rank || '',
        'Rang cumulé': team.cumulativeRank || 0,
    }));
}

function buildSerpentinRows(pools, serpentinMap, teamMap) {
    const rows = [];

    pools.forEach((pool) => {
        (serpentinMap[pool.id] || []).forEach((entry, index) => {
            const team = teamMap.get(entry.value);
            rows.push({
                Poule: pool.name,
                Position: index + 1,
                Équipe: team?.name || '',
                'Numéro équipe': team?.number || '',
                'Rang cumulé': team?.cumulativeRank || '',
            });
        });
    });

    return rows;
}

function buildPoolRankingRows(pool) {
    const ranking = computeRanking(pool.teams, pool.matches);
    const rankingMap = new Map();
    ranking.forEach((row, index) => {
        rankingMap.set(row.teamId, { position: index + 1, ...row });
    });

    return pool.teams.map((team) => {
        const stats = rankingMap.get(team.id);
        return {
            Classement: stats?.position ?? '',
            Équipe: team.name,
            'Numéro équipe': team.number,
            'Rang cumulé': team.cumulativeRank || 0,
            J: stats?.played ?? 0,
            V: stats?.wins ?? 0,
            D: stats?.losses ?? 0,
            PF: stats?.pointsFor ?? 0,
            PA: stats?.pointsAgainst ?? 0,
            Diff: stats?.diff ?? 0,
            Total: stats?.totalScore ?? 0,
        };
    });
}

function buildPoolMatchRows(pool, getTeamNameById) {
    return [...pool.matches]
        .sort((a, b) => {
            if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
            return (a.localCourt || 0) - (b.localCourt || 0);
        })
        .map((match, index) => {
            const scoreA = Number(match.scoreA);
            const scoreB = Number(match.scoreB);
            const isValid =
                match.scoreA !== '' &&
                match.scoreB !== '' &&
                Number.isFinite(scoreA) &&
                Number.isFinite(scoreB);

            return {
                Match: index + 1,
                Rotation: match.round || 1,
                Terrain: match.localCourt || 1,
                'Équipe 1': getTeamNameById(match.teamAId) || '',
                'Score 1': match.scoreA ?? '',
                'Score 2': match.scoreB ?? '',
                'Équipe 2': getTeamNameById(match.teamBId) || '',
                Diff1: isValid ? scoreA - scoreB : '',
                Diff2: isValid ? scoreB - scoreA : '',
            };
        });
}

function groupMatchesByRound(matches) {
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

function buildGlobalPlanning(pools, courtCount) {
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

function buildPlanningRows(pools, courtCount, getTeamNameById) {
    return buildGlobalPlanning(pools, Math.max(1, Number(courtCount) || 1)).map((row) => ({
        Créneau: row.slot,
        Terrain: row.terrain,
        Poule: row.poolName,
        Rotation: row.round,
        'Équipe 1': getTeamNameById(row.match.teamAId) || '',
        'Équipe 2': getTeamNameById(row.match.teamBId) || '',
    }));
}

function buildFinalStageRows(finalStage, getTeamNameById) {
    const rows = [];

    finalStage.quarterFinals.forEach((match, index) => {
        rows.push({
            Phase: 'Quart de finale',
            Match: `Quart ${index + 1}`,
            'Équipe 1': getTeamNameById(match.teamAId) || '',
            'Score 1': match.scoreA ?? '',
            'Score 2': match.scoreB ?? '',
            'Équipe 2': getTeamNameById(match.teamBId) || '',
        });
    });

    finalStage.semiFinals.forEach((match, index) => {
        rows.push({
            Phase: 'Demi-finale',
            Match: `Demi ${index + 1}`,
            'Équipe 1': getTeamNameById(match.teamAId) || '',
            'Score 1': match.scoreA ?? '',
            'Score 2': match.scoreB ?? '',
            'Équipe 2': getTeamNameById(match.teamBId) || '',
        });
    });

    if (finalStage.thirdPlaceEnabled) {
        rows.push({
            Phase: 'Petite finale',
            Match: '3e / 4e place',
            'Équipe 1': getTeamNameById(finalStage.thirdPlace.teamAId) || '',
            'Score 1': finalStage.thirdPlace.scoreA ?? '',
            'Score 2': finalStage.thirdPlace.scoreB ?? '',
            'Équipe 2': getTeamNameById(finalStage.thirdPlace.teamBId) || '',
        });
    }

    if (finalStage.quarterPlacementEnabled) {
        finalStage.placementSemis.forEach((match, index) => {
            rows.push({
                Phase: 'Classement 5-8',
                Match: `Classement ${index + 1}`,
                'Équipe 1': getTeamNameById(match.teamAId) || '',
                'Score 1': match.scoreA ?? '',
                'Score 2': match.scoreB ?? '',
                'Équipe 2': getTeamNameById(match.teamBId) || '',
            });
        });
    }

    rows.push({
        Phase: 'Finale',
        Match: 'Finale',
        'Équipe 1': getTeamNameById(finalStage.final.teamAId) || '',
        'Score 1': finalStage.final.scoreA ?? '',
        'Score 2': finalStage.final.scoreB ?? '',
        'Équipe 2': getTeamNameById(finalStage.final.teamBId) || '',
    });

    return rows;
}

function buildCombinedRows(combinedPointsRanking) {
    return combinedPointsRanking.map((team, index) => ({
        Place: index + 1,
        Équipe: team.teamName,
        'Rang cumulé': team.cumulativeRank || 0,
        J: team.played,
        V: team.wins,
        D: team.losses,
        PF: team.pointsFor,
        PA: team.pointsAgainst,
        Diff: team.diff,
        Total: team.totalScore,
    }));
}

function buildFinalRankingRows(finalRanking) {
    return finalRanking.map((row) => ({
        Place: row.position,
        Équipe: row.teamName,
        'Rang cumulé': row.cumulativeRank || 0,
    }));
}

export function exportTournamentToCSV(
    baseTeams,
    pools,
    serpentinMap,
    finalStage,
    finalRanking,
    combinedPointsRanking,
    courtCount = 4
) {
    const teamMap = new Map(baseTeams.map((team) => [team.id, team]));
    const getTeamNameById = (teamId) => teamMap.get(teamId)?.name || '';

    const rows = [];
    buildBaseRows(baseTeams).forEach((row) => rows.push({ Section: 'Base', ...row }));
    buildSerpentinRows(pools, serpentinMap, teamMap).forEach((row) =>
        rows.push({ Section: 'Serpentin', ...row })
    );
    buildPlanningRows(pools, courtCount, getTeamNameById).forEach((row) =>
        rows.push({ Section: 'Planning', ...row })
    );

    pools.forEach((pool) => {
        buildPoolRankingRows(pool).forEach((row) =>
            rows.push({ Section: `${pool.name} - Classement`, ...row })
        );
        buildPoolMatchRows(pool, getTeamNameById).forEach((row) =>
            rows.push({ Section: `${pool.name} - Matchs`, ...row })
        );
    });

    buildFinalStageRows(finalStage, getTeamNameById).forEach((row) =>
        rows.push({ Section: 'Phase finale', ...row })
    );
    buildCombinedRows(combinedPointsRanking).forEach((row) =>
        rows.push({ Section: 'Cumuls points', ...row })
    );
    buildFinalRankingRows(finalRanking).forEach((row) =>
        rows.push({ Section: 'Classement final', ...row })
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'matrice-padel.csv');
}

export function exportTournamentToXLSX(
    baseTeams,
    pools,
    serpentinMap,
    finalStage,
    finalRanking,
    combinedPointsRanking,
    courtCount = 4
) {
    const workbook = XLSX.utils.book_new();
    const teamMap = new Map(baseTeams.map((team) => [team.id, team]));
    const getTeamNameById = (teamId) => teamMap.get(teamId)?.name || '';

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildBaseRows(baseTeams)), 'Base');
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildSerpentinRows(pools, serpentinMap, teamMap)),
        'Serpentin'
    );
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildPlanningRows(pools, courtCount, getTeamNameById)),
        'Planning'
    );

    pools.forEach((pool) => {
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(buildPoolRankingRows(pool)),
            sanitizeSheetName(`${pool.name} classement`)
        );
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(buildPoolMatchRows(pool, getTeamNameById)),
            sanitizeSheetName(`${pool.name} matchs`)
        );
    });

    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildFinalStageRows(finalStage, getTeamNameById)),
        'Phase finale'
    );
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildCombinedRows(combinedPointsRanking)),
        'Cumuls points'
    );
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildFinalRankingRows(finalRanking)),
        'Classement final'
    );

    XLSX.writeFile(workbook, 'matrice-padel.xlsx');
}

export async function importTournamentFile(file) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    let rows = [];

    if (extension === 'csv') {
        const firstSheetName = workbook.SheetNames[0];
        rows = parseRowsFromSheet(workbook.Sheets[firstSheetName]);
    } else {
        const participantsSheetName =
            workbook.SheetNames.find((name) => normalizeHeader(name) === 'participants') ||
            workbook.SheetNames.find((name) => normalizeHeader(name) === 'liste joueurs') ||
            workbook.SheetNames.find((name) => normalizeHeader(name) === 'liste joueur') ||
            workbook.SheetNames.find((name) => normalizeHeader(name) === 'infos') ||
            workbook.SheetNames[0];

        rows = parseRowsFromSheet(workbook.Sheets[participantsSheetName]);
    }

    const importedTeams = dedupeTeams(parseParticipantsRows(rows));

    const pools = [createPool('Poule A', []), createPool('Poule B', []), createPool('Poule C', [])];
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
        baseTeams: importedTeams,
        pools,
        serpentin,
        activeTab: 'base',
        finalStage: createEmptyFinalStage(),
        courtCount: 4,
    };
}
