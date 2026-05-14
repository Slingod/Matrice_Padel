import { useEffect, useMemo, useState } from 'react';
import { getMatchFormat, getRequiredSetsToWin } from '../utils/matchFormats';
import {
    getStoredMatchScore,
    removeStoredMatchScore,
    saveStoredMatchScore,
} from '../utils/matchScoreStorage';

function normalizeScoreValue(value) {
    if (value === '' || value === null || value === undefined) return '';

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';

    return String(Math.max(0, parsed));
}

function isFilled(value) {
    return value !== '' && value !== null && value !== undefined;
}

function hasGlobalScore(match) {
    return isFilled(match?.scoreA) && isFilled(match?.scoreB);
}

function buildEmptySets(formatKey) {
    const format = getMatchFormat(formatKey);

    return Array.from({ length: format.setSlots }, () => ({
        scoreA: '',
        scoreB: '',
    }));
}

function normalizeSets(sets, formatKey) {
    const emptySets = buildEmptySets(formatKey);
    const source = Array.isArray(sets) ? sets : [];

    return emptySets.map((emptySet, index) => ({
        ...emptySet,
        scoreA: normalizeScoreValue(source[index]?.scoreA),
        scoreB: normalizeScoreValue(source[index]?.scoreB),
    }));
}

function hasAnySetScore(sets) {
    return Array.isArray(sets) &&
        sets.some((set) => isFilled(set?.scoreA) || isFilled(set?.scoreB));
}

function isSetComplete(set) {
    return isFilled(set.scoreA) &&
        isFilled(set.scoreB) &&
        Number.isFinite(Number(set.scoreA)) &&
        Number.isFinite(Number(set.scoreB)) &&
        Number(set.scoreA) !== Number(set.scoreB);
}

function computeMatchScoreFromSets(sets, formatKey) {
    const format = getMatchFormat(formatKey);
    const requiredSets = getRequiredSetsToWin(formatKey);
    let wonA = 0;
    let wonB = 0;
    let pointsA = 0;
    let pointsB = 0;

    for (const set of sets) {
        if (!isSetComplete(set)) continue;

        const scoreA = Number(set.scoreA);
        const scoreB = Number(set.scoreB);

        pointsA += scoreA;
        pointsB += scoreB;

        if (scoreA > scoreB) {
            wonA += 1;
        } else {
            wonB += 1;
        }

        if (wonA >= requiredSets || wonB >= requiredSets) {
            break;
        }
    }

    const isComplete = wonA >= requiredSets || wonB >= requiredSets;

    return {
        scoreA: isComplete ? String(wonA) : '',
        scoreB: isComplete ? String(wonB) : '',
        wonA,
        wonB,
        pointsA,
        pointsB,
        isComplete,
        requiredSets,
        format,
    };
}

function callParentScoreChange(onScoreChange, scoreA, scoreB, metadata) {
    if (typeof onScoreChange !== 'function') return;
    onScoreChange(scoreA, scoreB, metadata);
}

function getGlobalFormatKey(props) {
    return props.globalFormatKey ||
        props.matchFormatKey ||
        props.selectedFormatKey ||
        props.formatKey ||
        props.currentFormatKey ||
        props.tournamentFormatKey ||
        'D1';
}

function getSavedMatchFormatKey(match, storedScore) {
    return storedScore?.formatKey ||
        match?.scoreDetail?.formatKey ||
        match?.formatKey ||
        match?.matchFormatKey ||
        'D1';
}

function getSetLabel(format, index) {
    return format.setLabels?.[index] || `Set ${index + 1}`;
}

function MatchScoreEditor(props) {
    const {
        match,
        onScoreChange,
        disabled = false,
    } = props;

    const globalFormatKey = getGlobalFormatKey(props);
    const [storedScore, setStoredScore] = useState(() => getStoredMatchScore(match?.id));

    useEffect(() => {
        setStoredScore(getStoredMatchScore(match?.id));
    }, [match?.id]);

    const storedHasAnyScore = useMemo(
        () => hasAnySetScore(storedScore?.sets),
        [storedScore?.sets]
    );

    const matchDetailHasAnyScore = useMemo(
        () => hasAnySetScore(match?.scoreDetail?.sets),
        [match?.scoreDetail?.sets]
    );

    const matchHasRealScore =
        hasGlobalScore(match) ||
        storedHasAnyScore ||
        matchDetailHasAnyScore;

    const effectiveFormatKey = useMemo(() => {
        // Règle importante :
        // Match sans score réel = il suit le format global immédiatement.
        if (!matchHasRealScore) {
            return globalFormatKey;
        }

        // Match avec score réel = il garde son format sauvegardé.
        return getSavedMatchFormatKey(match, storedScore);
    }, [matchHasRealScore, globalFormatKey, match, storedScore]);

    const format = getMatchFormat(effectiveFormatKey);

    const sets = useMemo(() => {
        // Match vide : on reconstruit les sets depuis le format global.
        if (!matchHasRealScore) {
            return buildEmptySets(globalFormatKey);
        }

        // Priorité aux détails dans le match, car ils sont sauvegardés dans “Mes tournois”.
        if (match?.scoreDetail?.sets) {
            return normalizeSets(match.scoreDetail.sets, effectiveFormatKey);
        }

        return normalizeSets(storedScore?.sets, effectiveFormatKey);
    }, [
        matchHasRealScore,
        globalFormatKey,
        match?.scoreDetail?.sets,
        storedScore?.sets,
        effectiveFormatKey,
    ]);

    const computed = useMemo(
        () => computeMatchScoreFromSets(sets, effectiveFormatKey),
        [sets, effectiveFormatKey]
    );

    const isLockedForThisMatch = matchHasRealScore;

    function persistSets(nextSets) {
        if (!match?.id) return;

        const hasScoreAfterChange = hasAnySetScore(nextSets);

        if (!hasScoreAfterChange) {
            removeStoredMatchScore(match.id);
            setStoredScore(null);

            callParentScoreChange(onScoreChange, '', '', {
                formatKey: globalFormatKey,
                sets: buildEmptySets(globalFormatKey),
                isComplete: false,
            });

            return;
        }

        // Dès qu'un score est saisi, le format du match est figé sur le format affiché.
        const formatKeyToSave = effectiveFormatKey || globalFormatKey;
        const normalizedSets = normalizeSets(nextSets, formatKeyToSave);

        const nextStoredScore = saveStoredMatchScore(match.id, {
            formatKey: formatKeyToSave,
            sets: normalizedSets,
        });

        setStoredScore(nextStoredScore);

        const nextComputed = computeMatchScoreFromSets(normalizedSets, formatKeyToSave);

        callParentScoreChange(
            onScoreChange,
            nextComputed.scoreA,
            nextComputed.scoreB,
            {
                formatKey: formatKeyToSave,
                sets: normalizedSets,
                pointsA: nextComputed.pointsA,
                pointsB: nextComputed.pointsB,
                isComplete: nextComputed.isComplete,
            }
        );
    }

    function handleSetScoreChange(index, field, value) {
        if (disabled || !match?.id) return;

        const nextSets = sets.map((set, setIndex) =>
            setIndex === index
                ? {
                    ...set,
                    [field]: normalizeScoreValue(value),
                }
                : set
        );

        persistSets(nextSets);
    }

    function handleReset() {
        if (disabled || !match?.id) return;

        removeStoredMatchScore(match.id);
        setStoredScore(null);

        callParentScoreChange(onScoreChange, '', '', {
            formatKey: globalFormatKey,
            sets: buildEmptySets(globalFormatKey),
            isComplete: false,
        });
    }

    return (
        <div className="match-score-editor">
            <div className="match-score-editor-head">
                <span className="match-format-badge">{format.key}</span>

                <span className="match-score-summary">
                    {computed.isComplete
                        ? `${computed.scoreA} - ${computed.scoreB}`
                        : 'Score à saisir'}
                </span>

                <button
                    type="button"
                    className="small-btn"
                    onClick={handleReset}
                    disabled={disabled}
                    title="Effacer le score et laisser ce match suivre le format global actuel"
                >
                    Reset
                </button>
            </div>

            <p className="match-format-lock-note">
                {isLockedForThisMatch
                    ? `Format sauvegardé pour ce match : ${format.key}.`
                    : `Ce match suit le format global actuel : ${format.key}.`}
            </p>

            <div className="match-sets-grid">
                {sets.map((set, index) => {
                    const label = getSetLabel(format, index);

                    return (
                        <div className="match-set-row" key={`${match?.id || 'match'}-set-${index}`}>
                            <strong>{label}</strong>

                            <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={set.scoreA}
                                onChange={(event) =>
                                    handleSetScoreChange(index, 'scoreA', event.target.value)
                                }
                                disabled={disabled}
                                aria-label={`${label} équipe 1`}
                            />

                            <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={set.scoreB}
                                onChange={(event) =>
                                    handleSetScoreChange(index, 'scoreB', event.target.value)
                                }
                                disabled={disabled}
                                aria-label={`${label} équipe 2`}
                            />
                        </div>
                    );
                })}
            </div>

            <p className="match-format-help">
                Le match est validé dès qu’une équipe gagne le nombre de sets nécessaire.
            </p>
        </div>
    );
}

export default MatchScoreEditor;
