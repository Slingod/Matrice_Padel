import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function buildPoolRows(pool) {
    const rankingMap = new Map();

    pool.ranking.forEach((team, index) => {
        rankingMap.set(team.teamId, {
            position: index + 1,
            ...team,
        });
    });

    return pool.teams.map((team) => {
        const stats = rankingMap.get(team.id);

        return {
            Equipe: team.name,
            Classement: stats?.position ?? '',
            Joues: stats?.played ?? 0,
            Victoires: stats?.wins ?? 0,
            Defaites: stats?.losses ?? 0,
            Points_marques: stats?.pointsFor ?? 0,
            Points_encaisses: stats?.pointsAgainst ?? 0,
            Difference: stats?.diff ?? 0,
            Total: stats?.totalScore ?? 0,
        };
    });
}

export function exportPoolsToCSV(pools, serpentinColumns) {
    const lines = [];

    pools.forEach((pool) => {
        lines.push(`"${pool.name}"`);
        lines.push('Equipe,Classement,Joues,Victoires,Defaites,Points_marques,Points_encaisses,Difference,Total');

        buildPoolRows(pool).forEach((row) => {
            lines.push(
                [
                    row.Equipe,
                    row.Classement,
                    row.Joues,
                    row.Victoires,
                    row.Defaites,
                    row.Points_marques,
                    row.Points_encaisses,
                    row.Difference,
                    row.Total,
                ]
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(',')
            );
        });

        lines.push('');
        lines.push(`"Serpentin ${pool.name}"`);

        (serpentinColumns[pool.name] || []).forEach((value, index) => {
            lines.push(`"Position ${index + 1}","${String(value).replaceAll('"', '""')}"`);
        });

        lines.push('');
        lines.push('');
    });

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
        type: 'text/csv;charset=utf-8;',
    });

    downloadBlob(blob, 'matrice-padel.csv');
}

export function exportPoolsToXLSX(pools, serpentinColumns) {
    const workbook = XLSX.utils.book_new();

    pools.forEach((pool) => {
        const rankingSheetData = buildPoolRows(pool);
        const rankingSheet = XLSX.utils.json_to_sheet(rankingSheetData);
        XLSX.utils.book_append_sheet(
            workbook,
            rankingSheet,
            sanitizeSheetName(pool.name)
        );

        const serpentinData = (serpentinColumns[pool.name] || []).map((value, index) => ({
            Position: index + 1,
            Valeur: value,
        }));

        const serpentinSheet = XLSX.utils.json_to_sheet(serpentinData);
        XLSX.utils.book_append_sheet(
            workbook,
            serpentinSheet,
            sanitizeSheetName(`Serp ${pool.name}`)
        );
    });

    XLSX.writeFile(workbook, 'matrice-padel.xlsx');
}

export function exportPoolsToPDF(pools, serpentinColumns) {
    const doc = new jsPDF();

    pools.forEach((pool, poolIndex) => {
        if (poolIndex > 0) doc.addPage();

        doc.setFontSize(18);
        doc.text(pool.name, 14, 18);

        autoTable(doc, {
            startY: 26,
            head: [[
                '#',
                'Equipe',
                'J',
                'V',
                'D',
                'PF',
                'PA',
                'Diff',
                'Total',
            ]],
            body: pool.ranking.map((team, index) => [
                index + 1,
                team.teamName,
                team.played,
                team.wins,
                team.losses,
                team.pointsFor,
                team.pointsAgainst,
                team.diff,
                team.totalScore,
            ]),
        });

        const finalY = doc.lastAutoTable?.finalY ?? 40;

        doc.setFontSize(14);
        doc.text(`Serpentin - ${pool.name}`, 14, finalY + 12);

        autoTable(doc, {
            startY: finalY + 18,
            head: [['Position', 'Valeur']],
            body: (serpentinColumns[pool.name] || []).map((value, index) => [
                index + 1,
                value,
            ]),
        });
    });

    doc.save('matrice-padel.pdf');
}

function sanitizeSheetName(name) {
    return name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Feuille';
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}