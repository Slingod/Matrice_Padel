import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateFftMatchStats, getFftSetDiffLabels } from './fftScoring.js';

function formatSigned(value) {
    const number = Number(value) || 0;
    return number > 0 ? `+${number}` : String(number);
}

function formatPosition(row, fallbackIndex) {
    if (!row?.position) return fallbackIndex + 1;
    return row.isExAequo ? `${row.position} ex æquo` : row.position;
}

function safeValue(value) {
    return value === null || value === undefined ? '' : value;
}

function escapeCsv(value) {
    return `"${String(safeValue(value)).replaceAll('"', '""')}"`;
}

function getTeamNameFromSources(teamId, options = {}, pool = null) {
    if (!teamId) return '';

    if (typeof options.getTeamNameById === 'function') {
        const resolved = options.getTeamNameById(teamId);
        if (resolved) return resolved;
    }

    const poolTeam = pool?.teams?.find((team) => team.id === teamId);
    if (poolTeam?.name) return poolTeam.name;

    const allTeam = options.allTeams?.find((team) => team.id === teamId);
    if (allTeam?.name) return allTeam.name;

    return teamId;
}

function buildRankingRows(ranking = []) {
    return ranking.map((team, index) => ({
        Place: formatPosition(team, index),
        Equipe: team.teamName || team.name || '',
        Rang_cumule: team.cumulativeRank || '',
        Joues: team.played ?? 0,
        Victoires: team.wins ?? 0,
        Defaites: team.losses ?? 0,
        Sets: formatSigned(team.setDiff ?? 0),
        Points_marques: team.pointsFor ?? 0,
        Points_encaisses: team.pointsAgainst ?? 0,
        Difference: formatSigned(team.diff ?? 0),
        Total: formatSigned(team.totalScore ?? 0),
    }));
}

function buildPoolRows(pool) {
    return buildRankingRows(pool.ranking || []);
}

function buildPoolRowsFromTeams(pool) {
    const rankingMap = new Map();

    (pool.ranking || []).forEach((team, index) => {
        rankingMap.set(team.teamId, {
            position: team.position || index + 1,
            ...team,
        });
    });

    return (pool.teams || []).map((team, index) => {
        const stats = rankingMap.get(team.id);

        return {
            Place: stats ? formatPosition(stats, index) : '',
            Equipe: team.name,
            Rang_cumule: team.cumulativeRank || '',
            Joues: stats?.played ?? 0,
            Victoires: stats?.wins ?? 0,
            Defaites: stats?.losses ?? 0,
            Sets: formatSigned(stats?.setDiff ?? 0),
            Points_marques: stats?.pointsFor ?? 0,
            Points_encaisses: stats?.pointsAgainst ?? 0,
            Difference: formatSigned(stats?.diff ?? 0),
            Total: formatSigned(stats?.totalScore ?? 0),
        };
    });
}

function buildMatchScoreLabel(match) {
    const stats = calculateFftMatchStats(match);

    if (!stats.isComplete) return 'Score à saisir';

    return `${stats.scoreA} - ${stats.scoreB}`;
}

function buildMatchRows(matches = [], options = {}, pool = null, phase = '') {
    return (matches || []).filter(Boolean).map((match) => {
        const stats = calculateFftMatchStats(match);
        const setLabels = getFftSetDiffLabels(match);

        return {
            Phase: phase || match.label || '',
            Rotation: match.round || '',
            Terrain: match.courtOverride || match.localCourt || '',
            Match: match.label || '',
            Equipe_1: getTeamNameFromSources(match.teamAId, options, pool),
            Score_sets: buildMatchScoreLabel(match),
            Sets_Equipe_1: setLabels.labelA || '',
            Sets_Equipe_2: setLabels.labelB || '',
            Equipe_2: getTeamNameFromSources(match.teamBId, options, pool),
            Diff_1: stats.isComplete ? formatSigned(stats.fftGameDiffA) : '',
            Diff_2: stats.isComplete ? formatSigned(stats.fftGameDiffB) : '',
        };
    });
}

function buildPoolMatchRows(pool, options = {}) {
    return buildMatchRows(pool.matches || [], options, pool, pool.name);
}

function getFinalStageMatches(finalStage) {
    if (!finalStage) return [];

    const settings = finalStage.settings || {};
    const entryRound = settings.entryRound || 'quarter';

    return [
        ...(entryRound === 'round16'
            ? (finalStage.roundOf16 || []).map((match) => ({ ...match, phase: 'Huitièmes de finale' }))
            : []),
        ...(entryRound === 'round16' || entryRound === 'quarter'
            ? (finalStage.quarterFinals || []).map((match) => ({ ...match, phase: 'Quarts de finale' }))
            : []),
        ...((finalStage.semiFinals || []).map((match) => ({ ...match, phase: 'Demi-finales' }))),
        ...(settings.enableThirdPlaceMatch && finalStage.thirdPlace
            ? [{ ...finalStage.thirdPlace, phase: 'Petite finale' }]
            : []),
        ...(settings.enablePlacement5to8 && entryRound !== 'semi'
            ? [
                ...((finalStage.placement5to8Semis || []).map((match) => ({
                    ...match,
                    phase: 'Classement 5-8',
                }))),
                finalStage.placement5to8Finals?.place5
                    ? { ...finalStage.placement5to8Finals.place5, phase: 'Match place 5' }
                    : null,
                finalStage.placement5to8Finals?.place7
                    ? { ...finalStage.placement5to8Finals.place7, phase: 'Match place 7' }
                    : null,
            ].filter(Boolean)
            : []),
        ...(finalStage.final ? [{ ...finalStage.final, phase: 'Finale' }] : []),
    ];
}

function buildFinalStageMatchRows(finalStage, options = {}) {
    return getFinalStageMatches(finalStage).map((match) => {
        const stats = calculateFftMatchStats(match);
        const setLabels = getFftSetDiffLabels(match);

        return {
            Phase: match.phase || '',
            Match: match.label || '',
            Equipe_1: getTeamNameFromSources(match.teamAId, options),
            Score_sets: buildMatchScoreLabel(match),
            Sets_Equipe_1: setLabels.labelA || '',
            Sets_Equipe_2: setLabels.labelB || '',
            Equipe_2: getTeamNameFromSources(match.teamBId, options),
            Diff_1: stats.isComplete ? formatSigned(stats.fftGameDiffA) : '',
            Diff_2: stats.isComplete ? formatSigned(stats.fftGameDiffB) : '',
        };
    });
}

function addCsvSection(lines, title, rows) {
    lines.push(escapeCsv(title));

    if (!rows.length) {
        lines.push(escapeCsv('Aucune donnée'));
        lines.push('');
        return;
    }

    const headers = Object.keys(rows[0]);
    lines.push(headers.map(escapeCsv).join(','));

    rows.forEach((row) => {
        lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
    });

    lines.push('');
}

function appendSheet(workbook, sheetName, rows) {
    const sheetRows = rows.length ? rows : [{ Information: 'Aucune donnée' }];
    const sheet = XLSX.utils.json_to_sheet(sheetRows);

    XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        getUniqueSheetName(workbook, sheetName)
    );
}

function addPdfTable(doc, title, head, body, startY = null) {
    const y = startY ?? ((doc.lastAutoTable?.finalY || 0) + 14 || 18);

    doc.setFontSize(14);
    doc.text(title, 14, y);

    autoTable(doc, {
        startY: y + 6,
        head: [head],
        body,
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fontStyle: 'bold',
        },
    });
}

export function exportPoolsToCSV(pools, serpentinColumns = {}, options = {}) {
    const lines = [];

    pools.forEach((pool) => {
        addCsvSection(lines, `${pool.name} - Classement`, buildPoolRowsFromTeams(pool));
        addCsvSection(lines, `${pool.name} - Matchs`, buildPoolMatchRows(pool, options));

        const serpentinRows = (serpentinColumns[pool.name] || []).map((value, index) => ({
            Position: index + 1,
            Valeur: value,
        }));

        addCsvSection(lines, `Serpentin ${pool.name}`, serpentinRows);
        lines.push('');
    });

    const finalStageRows = buildFinalStageMatchRows(options.finalStage, options);
    if (finalStageRows.length) {
        addCsvSection(lines, 'Phase finale - Matchs', finalStageRows);
    }

    const finalRankingRows = buildRankingRows(options.finalRanking || []);
    if (finalRankingRows.length) {
        addCsvSection(lines, 'Classement final', finalRankingRows);
    }

    const finalOnlyRows = buildRankingRows(options.finalOnlyPointsRanking || []);
    if (finalOnlyRows.length) {
        addCsvSection(lines, 'Statistiques phase finale uniquement', finalOnlyRows);
    }

    const combinedRows = buildRankingRows(options.combinedPointsRanking || []);
    if (combinedRows.length) {
        addCsvSection(lines, 'Statistiques globales poules + phase finale', combinedRows);
    }

    const blob = new Blob([`\uFEFF${lines.join('\\n')}`], {
        type: 'text/csv;charset=utf-8;',
    });

    downloadBlob(blob, 'matrice-padel.csv');
}

export function exportPoolsToXLSX(pools, serpentinColumns = {}, options = {}) {
    const workbook = XLSX.utils.book_new();

    pools.forEach((pool) => {
        appendSheet(workbook, `${pool.name}`, buildPoolRowsFromTeams(pool));
        appendSheet(workbook, `Matchs ${pool.name}`, buildPoolMatchRows(pool, options));

        const serpentinData = (serpentinColumns[pool.name] || []).map((value, index) => ({
            Position: index + 1,
            Valeur: value,
        }));

        appendSheet(workbook, `Serp ${pool.name}`, serpentinData);
    });

    appendSheet(workbook, 'Phase finale', buildFinalStageMatchRows(options.finalStage, options));
    appendSheet(workbook, 'Classement final', buildRankingRows(options.finalRanking || []));

    if (options.finalOnlyPointsRanking?.length) {
        appendSheet(workbook, 'Stats finale', buildRankingRows(options.finalOnlyPointsRanking));
    }

    if (options.combinedPointsRanking?.length) {
        appendSheet(workbook, 'Stats globales', buildRankingRows(options.combinedPointsRanking));
    }

    XLSX.writeFile(workbook, 'matrice-padel.xlsx');
}

export function exportPoolsToPDF(pools, serpentinColumns = {}, options = {}) {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    pools.forEach((pool, poolIndex) => {
        if (poolIndex > 0) doc.addPage();

        doc.setFontSize(18);
        doc.text(pool.name, 14, 18);

        addPdfTable(
            doc,
            'Classement',
            ['Place', 'Equipe', 'J', 'V', 'D', 'S', 'PF', 'PA', 'Diff', 'Total'],
            buildPoolRows(pool).map((row) => [
                row.Place,
                row.Equipe,
                row.Joues,
                row.Victoires,
                row.Defaites,
                row.Sets,
                row.Points_marques,
                row.Points_encaisses,
                row.Difference,
                row.Total,
            ]),
            28
        );

        addPdfTable(
            doc,
            'Matchs',
            ['Rotation', 'Terrain', 'Equipe 1', 'Score', 'S1', 'S2', 'Equipe 2', 'Diff 1', 'Diff 2'],
            buildPoolMatchRows(pool, options).map((row) => [
                row.Rotation,
                row.Terrain,
                row.Equipe_1,
                row.Score_sets,
                row.Sets_Equipe_1,
                row.Sets_Equipe_2,
                row.Equipe_2,
                row.Diff_1,
                row.Diff_2,
            ])
        );

        addPdfTable(
            doc,
            `Serpentin - ${pool.name}`,
            ['Position', 'Valeur'],
            (serpentinColumns[pool.name] || []).map((value, index) => [
                index + 1,
                value,
            ])
        );
    });

    const finalStageRows = buildFinalStageMatchRows(options.finalStage, options);
    if (finalStageRows.length) {
        doc.addPage();
        doc.setFontSize(18);
        doc.text('Phase finale', 14, 18);

        addPdfTable(
            doc,
            'Matchs du tableau final',
            ['Phase', 'Match', 'Equipe 1', 'Score', 'S1', 'S2', 'Equipe 2', 'Diff 1', 'Diff 2'],
            finalStageRows.map((row) => [
                row.Phase,
                row.Match,
                row.Equipe_1,
                row.Score_sets,
                row.Sets_Equipe_1,
                row.Sets_Equipe_2,
                row.Equipe_2,
                row.Diff_1,
                row.Diff_2,
            ]),
            28
        );
    }

    const finalRankingRows = buildRankingRows(options.finalRanking || []);
    if (finalRankingRows.length) {
        doc.addPage();
        doc.setFontSize(18);
        doc.text('Classement final', 14, 18);

        addPdfTable(
            doc,
            'Classement final',
            ['Place', 'Equipe', 'J', 'V', 'D', 'S', 'PF', 'PA', 'Diff', 'Total'],
            finalRankingRows.map((row) => [
                row.Place,
                row.Equipe,
                row.Joues,
                row.Victoires,
                row.Defaites,
                row.Sets,
                row.Points_marques,
                row.Points_encaisses,
                row.Difference,
                row.Total,
            ]),
            28
        );
    }

    doc.save('matrice-padel.pdf');
}

function sanitizeSheetName(name) {
    return String(name || '')
        .replace(/[\\\\/?*[\\]:]/g, '')
        .slice(0, 31) || 'Feuille';
}

function getUniqueSheetName(workbook, rawName) {
    const baseName = sanitizeSheetName(rawName);
    const existingNames = new Set(workbook.SheetNames || []);

    if (!existingNames.has(baseName)) return baseName;

    for (let index = 2; index < 1000; index += 1) {
        const suffix = ` ${index}`;
        const candidate = sanitizeSheetName(`${baseName.slice(0, 31 - suffix.length)}${suffix}`);
        if (!existingNames.has(candidate)) return candidate;
    }

    return sanitizeSheetName(`${Date.now()}`);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}
