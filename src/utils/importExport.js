import * as XLSX from 'xlsx';
import {
    computeRanking,
    createPool,
    createSerpentinEntry,
} from './tournament';
import { createEmptyFinalStage } from './finalStage';

function sanitizeSheetName(name) {
    return String(name || 'Feuille').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Feuille';
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function formatRank(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('fr-FR');
}

function buildTeamDisplayName(players) {
    return players.map((player) => player.name).join(' & ');
}

function buildTeamFullName(players) {
    return players.map((player) => player.name).join(' & ');
}

function uniqueBy(array, keyFn) {
    const seen = new Set();
    return array.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

function parseParticipantsSheet(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const grouped = {};

    rows.forEach((row) => {
        const rawTeam = normalizeText(row['Équipe'] || row['Equipe']);
        const rawSlot = normalizeText(row['Joueur']);
        const rawName = normalizeText(row['Nom']);
        const rawRank = Number(row['Rang']) || 0;

        if (!rawTeam || !rawName) return;

        const match = rawTeam.match(/(\d+)/);
        if (!match) return;

        const teamNumber = Number(match[1]);

        if (!grouped[teamNumber]) {
            grouped[teamNumber] = {
                number: `Équipe ${teamNumber}`,
                players: [],
            };
        }

        grouped[teamNumber].players.push({
            slot: rawSlot,
            name: rawName,
            rank: rawRank,
        });
    });

    return Object.entries(grouped)
        .map(([key, value]) => {
            const players = value.players.sort((a, b) => a.slot.localeCompare(b.slot));
            const cumulativeRank = players.reduce(
                (sum, player) => sum + (Number(player.rank) || 0),
                0
            );

            return {
                number: `Équipe ${key}`,
                players,
                cumulativeRank,
                name: buildTeamDisplayName(players),
                fullName: buildTeamFullName(players),
                matchLabel: buildTeamFullName(players),
            };
        })
        .sort((a, b) => {
            const aNum = Number(String(a.number).match(/(\d+)/)?.[1] || 0);
            const bNum = Number(String(b.number).match(/(\d+)/)?.[1] || 0);
            return aNum - bNum;
        });
}

function buildBaseRows(baseTeams) {
    return baseTeams.map((team) => ({
        Equipe: team.number,
        Nom_affiche: team.name,
        Joueur_1: team.players?.[0]?.name || '',
        Rang_1: team.players?.[0]?.rank || '',
        Joueur_2: team.players?.[1]?.name || '',
        Rang_2: team.players?.[1]?.rank || '',
        Rang_cumule: team.cumulativeRank || 0,
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
                Equipe: team?.name || '',
                Numero_equipe: team?.number || '',
                Rang_cumule: team?.cumulativeRank || '',
            });
        });
    });

    return rows;
}

function buildPoolRows(pool) {
    const ranking = computeRanking(pool.teams, pool.matches);

    const rankingMap = new Map();
    ranking.forEach((row, index) => {
        rankingMap.set(row.teamId, { position: index + 1, ...row });
    });

    return pool.teams.map((team) => {
        const stats = rankingMap.get(team.id);

        return {
            Equipe: team.name,
            Numero_equipe: team.number,
            Joueur_1: team.players?.[0]?.name || '',
            Rang_1: team.players?.[0]?.rank || '',
            Joueur_2: team.players?.[1]?.name || '',
            Rang_2: team.players?.[1]?.rank || '',
            Rang_cumule: team.cumulativeRank || 0,
            Classement: stats?.position ?? '',
            Joues: stats?.played ?? 0,
            Victoires: stats?.wins ?? 0,
            Defaites: stats?.losses ?? 0,
            PF: stats?.pointsFor ?? 0,
            PA: stats?.pointsAgainst ?? 0,
            Diff: stats?.diff ?? 0,
            Total: stats?.totalScore ?? 0,
        };
    });
}

export function exportTournamentToCSV(baseTeams, pools, serpentinMap) {
    const teamMap = new Map(baseTeams.map((team) => [team.id, team]));
    const lines = [];

    lines.push([
        'Type',
        'Poule',
        'Equipe',
        'Numero_equipe',
        'Joueur_1',
        'Rang_1',
        'Joueur_2',
        'Rang_2',
        'Rang_cumule',
        'Classement',
        'Joues',
        'Victoires',
        'Defaites',
        'PF',
        'PA',
        'Diff',
        'Total',
        'Position',
    ].join(','));

    buildBaseRows(baseTeams).forEach((row) => {
        lines.push(
            [
                'BASE',
                '',
                row.Nom_affiche,
                row.Equipe,
                row.Joueur_1,
                row.Rang_1,
                row.Joueur_2,
                row.Rang_2,
                row.Rang_cumule,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
            ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(',')
        );
    });

    buildSerpentinRows(pools, serpentinMap, teamMap).forEach((row) => {
        lines.push(
            [
                'SERPENTIN',
                row.Poule,
                row.Equipe,
                row.Numero_equipe,
                '',
                '',
                '',
                '',
                row.Rang_cumule,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                row.Position,
            ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(',')
        );
    });

    pools.forEach((pool) => {
        buildPoolRows(pool).forEach((row) => {
            lines.push(
                [
                    'POULE',
                    pool.name,
                    row.Equipe,
                    row.Numero_equipe,
                    row.Joueur_1,
                    row.Rang_1,
                    row.Joueur_2,
                    row.Rang_2,
                    row.Rang_cumule,
                    row.Classement,
                    row.Joues,
                    row.Victoires,
                    row.Defaites,
                    row.PF,
                    row.PA,
                    row.Diff,
                    row.Total,
                    '',
                ]
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(',')
            );
        });
    });

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
        type: 'text/csv;charset=utf-8;',
    });

    downloadBlob(blob, 'matrice-padel.csv');
}

export function exportTournamentToXLSX(baseTeams, pools, serpentinMap) {
    const workbook = XLSX.utils.book_new();
    const teamMap = new Map(baseTeams.map((team) => [team.id, team]));

    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildBaseRows(baseTeams)),
        'Base'
    );

    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(buildSerpentinRows(pools, serpentinMap, teamMap)),
        'Serpentin'
    );

    pools.forEach((pool) => {
        const poolRows = buildPoolRows(pool);
        const matchRows = pool.matches.map((match, index) => {
            const teamA = pool.teams.find((team) => team.id === match.teamAId);
            const teamB = pool.teams.find((team) => team.id === match.teamBId);

            return {
                Match: index + 1,
                Equipe_A: teamA?.name || '',
                Score_A: match.scoreA,
                Score_B: match.scoreB,
                Equipe_B: teamB?.name || '',
            };
        });

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(poolRows),
            sanitizeSheetName(`${pool.name} equipes`)
        );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(matchRows),
            sanitizeSheetName(`${pool.name} matchs`)
        );
    });

    XLSX.writeFile(workbook, 'matrice-padel.xlsx');
}

export async function importTournamentFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const participantsSheet =
        workbook.Sheets.Participants ||
        workbook.Sheets.participants ||
        workbook.Sheets['Liste joueurs'] ||
        workbook.Sheets['liste joueur'];

    const importedTeams = participantsSheet ? parseParticipantsSheet(participantsSheet) : [];

    const uniqueTeams = uniqueBy(
        importedTeams,
        (team) => team.number || team.fullName || team.name
    );

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
        baseTeams: uniqueTeams,
        pools,
        serpentin,
        activeTab: 'base',
        finalStage: createEmptyFinalStage(),
    };
}