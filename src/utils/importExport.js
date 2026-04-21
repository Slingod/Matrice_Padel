import * as XLSX from 'xlsx';
import {
    computeRanking,
    createPool,
    createSerpentinEntry,
    syncMatchesPreserveScores,
} from './tournament';

function sanitizeSheetName(name) {
    return String(name || 'Feuille').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Feuille';
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeTeamDisplayName(fullName) {
    const clean = normalizeText(fullName);
    if (!clean) return '';

    const parts = clean.split(/\s+/);
    const lastWord = parts[parts.length - 1] || '';
    return lastWord.toUpperCase();
}

function buildTeamNameFromPlayers(players) {
    const names = players
        .map((player) => normalizeTeamDisplayName(player))
        .filter(Boolean);

    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    return `${names[0]} & ${names[1]}`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

function buildPoolRows(pool, serpentinMap) {
    const ranking = computeRanking(pool.teams, pool.matches);

    const rankingMap = new Map();
    ranking.forEach((row, index) => {
        rankingMap.set(row.teamId, { position: index + 1, ...row });
    });

    return pool.teams.map((team) => {
        const stats = rankingMap.get(team.id);

        return {
            Poule: pool.name,
            Equipe: team.name,
            Classement: stats?.position ?? '',
            Joues: stats?.played ?? 0,
            Victoires: stats?.wins ?? 0,
            Defaites: stats?.losses ?? 0,
            Points_marques: stats?.pointsFor ?? 0,
            Points_encaisses: stats?.pointsAgainst ?? 0,
            Difference: stats?.diff ?? 0,
            Total: stats?.totalScore ?? 0,
            Serpentin: (serpentinMap[pool.id] || []).map((entry) => entry.value).join(' | '),
        };
    });
}

export function exportPoolsToCSV(pools, serpentinMap) {
    const lines = [];
    lines.push(
        [
            'Poule',
            'Equipe',
            'Classement',
            'Joues',
            'Victoires',
            'Defaites',
            'Points_marques',
            'Points_encaisses',
            'Difference',
            'Total',
            'Serpentin',
        ].join(',')
    );

    pools.forEach((pool) => {
        buildPoolRows(pool, serpentinMap).forEach((row) => {
            lines.push(
                [
                    row.Poule,
                    row.Equipe,
                    row.Classement,
                    row.Joues,
                    row.Victoires,
                    row.Defaites,
                    row.Points_marques,
                    row.Points_encaisses,
                    row.Difference,
                    row.Total,
                    row.Serpentin,
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

export function exportPoolsToXLSX(pools, serpentinMap) {
    const workbook = XLSX.utils.book_new();

    const globalRows = [];
    pools.forEach((pool) => {
        globalRows.push(...buildPoolRows(pool, serpentinMap));
    });

    const allSheet = XLSX.utils.json_to_sheet(globalRows);
    XLSX.utils.book_append_sheet(workbook, allSheet, 'Export global');

    const serpentinRows = [];
    pools.forEach((pool) => {
        (serpentinMap[pool.id] || []).forEach((entry, index) => {
            serpentinRows.push({
                Poule: pool.name,
                Position: index + 1,
                Valeur: entry.value,
            });
        });
    });

    const serpSheet = XLSX.utils.json_to_sheet(serpentinRows);
    XLSX.utils.book_append_sheet(workbook, serpSheet, 'Serpentin');

    pools.forEach((pool) => {
        const ranking = computeRanking(pool.teams, pool.matches);

        const matchRows = pool.matches.map((match, index) => {
            const teamAName = pool.teams.find((team) => team.id === match.teamAId)?.name || '';
            const teamBName = pool.teams.find((team) => team.id === match.teamBId)?.name || '';

            return {
                Match: index + 1,
                Equipe_A: teamAName,
                Score_A: match.scoreA,
                Score_B: match.scoreB,
                Equipe_B: teamBName,
            };
        });

        const rankingRows = ranking.map((row, index) => ({
            Classement: index + 1,
            Equipe: row.teamName,
            J: row.played,
            V: row.wins,
            D: row.losses,
            PF: row.pointsFor,
            PA: row.pointsAgainst,
            Diff: row.diff,
            Total: row.totalScore,
        }));

        const teamSheet = XLSX.utils.json_to_sheet(
            pool.teams.map((team, index) => ({
                Ordre: index + 1,
                Equipe: team.name,
            }))
        );

        const matchSheet = XLSX.utils.json_to_sheet(matchRows);
        const rankingSheet = XLSX.utils.json_to_sheet(rankingRows);

        XLSX.utils.book_append_sheet(
            workbook,
            teamSheet,
            sanitizeSheetName(`${pool.name} equipes`)
        );
        XLSX.utils.book_append_sheet(
            workbook,
            matchSheet,
            sanitizeSheetName(`${pool.name} matchs`)
        );
        XLSX.utils.book_append_sheet(
            workbook,
            rankingSheet,
            sanitizeSheetName(`${pool.name} classement`)
        );
    });

    XLSX.writeFile(workbook, 'matrice-padel.xlsx');
}

function parseListeJoueurSheet(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const grouped = {};

    rows.forEach((row) => {
        const teamNumberRaw = normalizeText(row['Équipe'] || row['Equipe']);
        const playerName = normalizeText(row['Nom']);

        if (!teamNumberRaw || !playerName) return;

        const match = teamNumberRaw.match(/(\d+)/);
        if (!match) return;

        const teamNumber = Number(match[1]);

        if (!grouped[teamNumber]) grouped[teamNumber] = [];
        grouped[teamNumber].push(playerName);
    });

    const result = {};
    Object.entries(grouped).forEach(([teamNumber, players]) => {
        result[Number(teamNumber)] = buildTeamNameFromPlayers(players);
    });

    return result;
}

function parseSerpentinSheet(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
    });

    if (!rows.length) return {};

    const headers = rows[0].map((value) => normalizeText(value));
    const result = {};

    headers.forEach((header, colIndex) => {
        if (!header) return;

        result[header] = rows
            .slice(1)
            .map((row) => row[colIndex])
            .filter((value) => value !== '' && value !== null && value !== undefined)
            .map((value) => String(value));
    });

    return result;
}

function findPoolNameBySheetName(sheetName) {
    const clean = normalizeText(sheetName).toLowerCase();

    if (clean === 'poule a') return 'Poule A';
    if (clean === 'poule b') return 'Poule B';
    if (clean === 'poule c') return 'Poule C';

    return null;
}

function parsePoolMatches(sheet, teamNameToId) {
    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
    });

    const matches = [];

    rows.forEach((row, index) => {
        const teamAName = normalizeText(row[1]);
        const teamBName = normalizeText(row[2]);
        const scoreA = row[4];
        const scoreB = row[5];

        if (!teamAName || !teamBName) return;

        // Ignore la ligne d’en-tête "Equipe 1 / Equipe 2"
        if (
            teamAName.toLowerCase() === 'equipe 1' &&
            teamBName.toLowerCase() === 'equipe 2'
        ) {
            return;
        }

        const teamAId = teamNameToId[teamAName.toLowerCase()];
        const teamBId = teamNameToId[teamBName.toLowerCase()];

        if (!teamAId || !teamBId) return;

        matches.push({
            id: `import-${index}-${teamAId}-${teamBId}`,
            teamAId,
            teamBId,
            scoreA: scoreA === '' || scoreA === null ? '' : String(scoreA),
            scoreB: scoreB === '' || scoreB === null ? '' : String(scoreB),
        });
    });

    return matches;
}

function buildPoolsFromSpecificWorkbook(workbook) {
    const listeJoueurSheet = workbook.Sheets['liste joueur'];
    const serpentinSheet = workbook.Sheets['serpentin'];

    if (!listeJoueurSheet || !serpentinSheet) {
        return null;
    }

    const teamByNumber = parseListeJoueurSheet(listeJoueurSheet);
    const serpentinRaw = parseSerpentinSheet(serpentinSheet);

    const pools = [];
    const serpentin = {};

    const serpentinEntries = Object.entries(serpentinRaw);

    serpentinEntries.forEach(([rawPoolName, teamNumbers]) => {
        const normalizedPoolName =
            rawPoolName.toLowerCase() === 'poule a'
                ? 'Poule A'
                : rawPoolName.toLowerCase() === 'poule b'
                    ? 'Poule B'
                    : rawPoolName.toLowerCase() === 'poule c'
                        ? 'Poule C'
                        : rawPoolName;

        const teamNames = teamNumbers
            .map((value) => Number(String(value).trim()))
            .filter((value) => !Number.isNaN(value))
            .map((teamNumber) => teamByNumber[teamNumber])
            .filter(Boolean);

        const pool = createPool(normalizedPoolName, teamNames);
        pools.push(pool);

        serpentin[pool.id] = teamNumbers.map((value) =>
            createSerpentinEntry(String(value))
        );
    });

    const poolsByName = Object.fromEntries(pools.map((pool) => [pool.name, pool]));

    workbook.SheetNames.forEach((sheetName) => {
        const poolName = findPoolNameBySheetName(sheetName);
        if (!poolName) return;

        const pool = poolsByName[poolName];
        if (!pool) return;

        const teamNameToId = {};
        pool.teams.forEach((team) => {
            teamNameToId[team.name.toLowerCase()] = team.id;
        });

        const importedMatches = parsePoolMatches(workbook.Sheets[sheetName], teamNameToId);

        pool.matches = syncMatchesPreserveScores(pool.teams, importedMatches);
    });

    return {
        pools,
        serpentin,
        activeTab: 'serpentin',
    };
}

export async function importTournamentFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Cas spécifique à ton fichier "matrice poule.xlsx"
    const specificImport = buildPoolsFromSpecificWorkbook(workbook);
    if (specificImport) {
        return specificImport;
    }

    // Fallback simple pour d’autres fichiers plus standards
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rows.length) {
        return {
            pools: [createPool('Poule A', [])],
            serpentin: {},
            activeTab: 'serpentin',
        };
    }

    const keys = Object.keys(rows[0]);
    const poolKey = keys.find((key) => /poule/i.test(key));
    const teamKey = keys.find((key) => /equipe|équipe|team/i.test(key));

    if (poolKey && teamKey) {
        const grouped = {};

        rows.forEach((row) => {
            const poolName = normalizeText(row[poolKey]);
            const teamName = normalizeText(row[teamKey]);

            if (!poolName || !teamName) return;

            if (!grouped[poolName]) grouped[poolName] = [];
            grouped[poolName].push(teamName);
        });

        const pools = Object.entries(grouped).map(([poolName, teamNames]) =>
            createPool(poolName, teamNames)
        );

        const serpentin = {};
        pools.forEach((pool) => {
            serpentin[pool.id] = [];
        });

        return {
            pools,
            serpentin,
            activeTab: 'serpentin',
        };
    }

    return {
        pools: [createPool('Poule A', [])],
        serpentin: {},
        activeTab: 'serpentin',
    };
}