const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function read(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function write(relPath, content) {
    fs.writeFileSync(path.join(ROOT, relPath), content, 'utf8');
}

function backup(relPath) {
    const file = path.join(ROOT, relPath);
    const backupFile = file + '.bak-final-format';
    if (!fs.existsSync(backupFile)) {
        fs.copyFileSync(file, backupFile);
    }
}

function replaceOrThrow(content, search, replacement, label) {
    if (!content.includes(search)) {
        throw new Error(`Patch impossible : bloc introuvable pour ${label}`);
    }
    return content.replace(search, replacement);
}

function patchUseTournamentState() {
    const rel = 'src/hooks/useTournamentState.js';
    backup(rel);
    let s = read(rel);

    if (!s.includes('function handleFinalMatchFormatChange')) {
        s = s.replace(
            `    function handleToggleThirdPlace() {`,
            `    function handleFinalMatchFormatChange(value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(prev || createEmptyFinalStage(), 'finalMatchFormatKey', value),
                allTeams
            )
        );
    }

    function handleToggleThirdPlace() {`
        );
    }

    if (!s.includes('handleFinalMatchFormatChange,')) {
        s = s.replace(
            `        handleFinalMatchScore,
        handleFinalQualifierModeChange,`,
            `        handleFinalMatchScore,
        handleFinalMatchFormatChange,
        handleFinalQualifierModeChange,`
        );
    }

    write(rel, s);
}

function patchFinalStage() {
    const rel = 'src/utils/finalStage.js';
    backup(rel);
    let s = read(rel);

    if (!s.includes("finalMatchFormatKey: 'D1'")) {
        s = s.replace(
            `            enablePlacement5to8: false,`,
            `            enablePlacement5to8: false,
            finalMatchFormatKey: 'D1',`
        );
    }

    if (!s.includes('function sanitizeMatchFormatKey')) {
        s = s.replace(
            `function sanitizeQualifierMode(value) {
    return ['winners', 'top2', 'best4', 'all'].includes(value) ? value : 'top2';
}`,
            `function sanitizeQualifierMode(value) {
    return ['winners', 'top2', 'best4', 'all'].includes(value) ? value : 'top2';
}

function sanitizeMatchFormatKey(value) {
    return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E'].includes(value) ? value : 'D1';
}`
        );
    }

    if (!s.includes('finalMatchFormatKey: sanitizeMatchFormatKey')) {
        s = s.replace(
            `            enablePlacement5to8: Boolean(stage?.settings?.enablePlacement5to8),`,
            `            enablePlacement5to8: Boolean(stage?.settings?.enablePlacement5to8),
            finalMatchFormatKey: sanitizeMatchFormatKey(
                stage?.settings?.finalMatchFormatKey ||
                stage?.settings?.matchFormatKey ||
                'D1'
            ),`
        );
    }

    s = s.replace(
        `        scoreA: match?.scoreA ?? '',
        scoreB: match?.scoreB ?? '',
    };`,
        `        scoreA: match?.scoreA ?? '',
        scoreB: match?.scoreB ?? '',
        formatKey: sanitizeMatchFormatKey(match?.formatKey || match?.matchFormatKey || match?.scoreDetail?.formatKey || 'D1'),
        matchFormatKey: sanitizeMatchFormatKey(match?.matchFormatKey || match?.formatKey || match?.scoreDetail?.formatKey || 'D1'),
        scoreDetail: match?.scoreDetail || null,
    };`
    );

    // Rendre setFinalStageOption compatible avec finalMatchFormatKey.
    s = s.replace(
        `    const sanitizedValue =
        optionKey === 'entryRound'
            ? sanitizeEntryRound(value)
            : optionKey === 'poolQualifierMode'
                ? sanitizeQualifierMode(value)
                : Boolean(value);`,
        `    const sanitizedValue =
        optionKey === 'entryRound'
            ? sanitizeEntryRound(value)
            : optionKey === 'poolQualifierMode'
                ? sanitizeQualifierMode(value)
                : optionKey === 'finalMatchFormatKey'
                    ? sanitizeMatchFormatKey(value)
                    : Boolean(value);`
    );

    // Remplacer clearScores pour nettoyer les détails.
    s = s.replace(
        `function clearScores(match) {
    return {
        ...match,
        scoreA: '',
        scoreB: '',
    };
}`,
        `function clearScores(match) {
    return {
        ...match,
        scoreA: '',
        scoreB: '',
        scoreDetail: null,
        formatKey: match?.formatKey || 'D1',
        matchFormatKey: match?.matchFormatKey || match?.formatKey || 'D1',
    };
}`
    );

    // Remplacer preserveScoresIfSameTeams pour ne pas traîner les anciens détails si les équipes changent.
    s = s.replace(
        `function preserveScoresIfSameTeams(previousMatch, nextTeamAId, nextTeamBId) {
    const sameTeams =
        (previousMatch?.teamAId || '') === (nextTeamAId || '') &&
        (previousMatch?.teamBId || '') === (nextTeamBId || '');

    return {
        ...previousMatch,
        teamAId: nextTeamAId || '',
        teamBId: nextTeamBId || '',
        scoreA: sameTeams ? previousMatch?.scoreA ?? '' : '',
        scoreB: sameTeams ? previousMatch?.scoreB ?? '' : '',
    };
}`,
        `function preserveScoresIfSameTeams(previousMatch, nextTeamAId, nextTeamBId) {
    const sameTeams =
        (previousMatch?.teamAId || '') === (nextTeamAId || '') &&
        (previousMatch?.teamBId || '') === (nextTeamBId || '');

    return {
        ...previousMatch,
        teamAId: nextTeamAId || '',
        teamBId: nextTeamBId || '',
        scoreA: sameTeams ? previousMatch?.scoreA ?? '' : '',
        scoreB: sameTeams ? previousMatch?.scoreB ?? '' : '',
        scoreDetail: sameTeams ? previousMatch?.scoreDetail || null : null,
        formatKey: sameTeams ? previousMatch?.formatKey || previousMatch?.scoreDetail?.formatKey || 'D1' : 'D1',
        matchFormatKey: sameTeams ? previousMatch?.matchFormatKey || previousMatch?.formatKey || previousMatch?.scoreDetail?.formatKey || 'D1' : 'D1',
    };
}`
    );

    // Remplacer updateFinalStageMatch pour accepter scoreDetail.
    const start = s.indexOf('export function updateFinalStageMatch(');
    const end = s.indexOf('function syncRoundPairs', start);
    if (start === -1 || end === -1) throw new Error('updateFinalStageMatch introuvable');
    const before = s.slice(0, start);
    const after = s.slice(end);
    const newFn = `export function updateFinalStageMatch(stage, stageKey, matchIndex, field, value) {
    const safeStage = sanitizeStage(stage);

    const buildPatch = () => {
        if (field === 'scoreDetail') {
            const detail = value || {};
            const formatKey = sanitizeMatchFormatKey(detail.formatKey || detail.matchFormatKey || 'D1');

            return {
                scoreA: detail.scoreA ?? '',
                scoreB: detail.scoreB ?? '',
                scoreDetail: {
                    ...detail,
                    formatKey,
                },
                formatKey,
                matchFormatKey: formatKey,
            };
        }

        const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));
        return { [field]: sanitized };
    };

    const patch = buildPatch();

    if (stageKey === 'final') {
        return {
            ...safeStage,
            final: {
                ...safeStage.final,
                ...patch,
            },
        };
    }

    if (stageKey === 'thirdPlace') {
        return {
            ...safeStage,
            thirdPlace: {
                ...safeStage.thirdPlace,
                ...patch,
            },
        };
    }

    if (stageKey === 'placement5to8Finals') {
        return {
            ...safeStage,
            placement5to8Finals: {
                ...safeStage.placement5to8Finals,
                [matchIndex]: {
                    ...safeStage.placement5to8Finals[matchIndex],
                    ...patch,
                },
            },
        };
    }

    return {
        ...safeStage,
        [stageKey]: safeStage[stageKey].map((match, index) =>
            index === matchIndex
                ? {
                    ...match,
                    ...patch,
                }
                : match
        ),
    };
}

`;
    s = before + newFn + after;

    write(rel, s);
}

function patchTournament() {
    const rel = 'src/utils/tournament.js';
    backup(rel);
    let s = read(rel);

    s = s.replace(
        `        scoreA: match.scoreA ?? '',
        scoreB: match.scoreB ?? '',
        round: match.round || 1,
        localCourt: match.localCourt || 1,
        courtOverride: match.courtOverride || '',
    };`,
        `        scoreA: match.scoreA ?? '',
        scoreB: match.scoreB ?? '',
        scoreDetail: match.scoreDetail || null,
        formatKey: match.formatKey || match.matchFormatKey || match.scoreDetail?.formatKey || '',
        matchFormatKey: match.matchFormatKey || match.formatKey || match.scoreDetail?.formatKey || '',
        round: match.round || 1,
        localCourt: match.localCourt || 1,
        courtOverride: match.courtOverride || '',
    };`
    );

    s = s.replace(
        `            id: existing.id || scheduledMatch.id,
            scoreA: existing.scoreA ?? '',
            scoreB: existing.scoreB ?? '',
        };`,
        `            id: existing.id || scheduledMatch.id,
            scoreA: existing.scoreA ?? '',
            scoreB: existing.scoreB ?? '',
            scoreDetail: existing.scoreDetail || null,
            formatKey: existing.formatKey || existing.matchFormatKey || existing.scoreDetail?.formatKey || '',
            matchFormatKey: existing.matchFormatKey || existing.formatKey || existing.scoreDetail?.formatKey || '',
            courtOverride: existing.courtOverride || '',
        };`
    );

    write(rel, s);
}

function main() {
    patchUseTournamentState();
    patchFinalStage();
    patchTournament();

    console.log('✅ Patch Format phase finale appliqué.');
    console.log('Des sauvegardes .bak-final-format ont été créées à côté des fichiers modifiés.');
}

main();
