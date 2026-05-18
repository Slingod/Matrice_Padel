import { useEffect, useMemo, useRef, useState } from 'react';
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

function formatSignedValue(value) {
    const number = Number(value) || 0;
    return number > 0 ? `+${number}` : String(number);
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
        setDiffA: isComplete ? wonA - wonB : 0,
        setDiffB: isComplete ? wonB - wonA : 0,
        pointsA,
        pointsB,
        isComplete,
        format,
    };
}

function getSetDiffLabel(computed) {
    if (!computed?.isComplete) return 'Score à saisir';

    return `Sets : ${formatSignedValue(computed.setDiffA)} / ${formatSignedValue(computed.setDiffB)}`;
}

function notifyScoreChanged(matchId, payload) {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
        new CustomEvent('padelingo:match-score-change', {
            detail: { matchId, payload },
        })
    );
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

function makeScoreSignature(matchId, formatKey, sets) {
    return JSON.stringify({ matchId, formatKey, sets });
}

function MatchScoreEditor(props) {
    const { match, onScoreChange, disabled = false } = props;

    const globalFormatKey = getGlobalFormatKey(props);
    const [storedScore, setStoredScore] = useState(() => getStoredMatchScore(match?.id));
    const lastHydratedSignatureRef = useRef('');

    useEffect(() => {
        setStoredScore(getStoredMatchScore(match?.id));
        lastHydratedSignatureRef.current = '';
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
        if (!matchHasRealScore) return globalFormatKey;
        return getSavedMatchFormatKey(match, storedScore);
    }, [matchHasRealScore, globalFormatKey, match, storedScore]);

    const format = getMatchFormat(effectiveFormatKey);

    const sets = useMemo(() => {
        if (!matchHasRealScore) return buildEmptySets(globalFormatKey);
        if (match?.scoreDetail?.sets) return normalizeSets(match.scoreDetail.sets, effectiveFormatKey);
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
    const setDiffLabel = getSetDiffLabel(computed);

    useEffect(() => {
        if (!match?.id || disabled) return;
        if (!hasAnySetScore(sets)) return;

        const signature = makeScoreSignature(match.id, effectiveFormatKey, sets);
        if (lastHydratedSignatureRef.current === signature) return;

        const nextComputed = computeMatchScoreFromSets(sets, effectiveFormatKey);

        const metadata = {
            formatKey: effectiveFormatKey,
            sets,
            pointsA: nextComputed.pointsA,
            pointsB: nextComputed.pointsB,
            isComplete: nextComputed.isComplete,
        };

        callParentScoreChange(onScoreChange, nextComputed.scoreA, nextComputed.scoreB, metadata);

        notifyScoreChanged(match.id, {
            scoreA: nextComputed.scoreA,
            scoreB: nextComputed.scoreB,
            ...metadata,
        });

        lastHydratedSignatureRef.current = signature;
    }, [match?.id, disabled, effectiveFormatKey, sets, onScoreChange]);

    function persistSets(nextSets) {
        if (!match?.id) return;

        const hasScoreAfterChange = hasAnySetScore(nextSets);

        if (!hasScoreAfterChange) {
            removeStoredMatchScore(match.id);
            setStoredScore(null);

            const metadata = {
                formatKey: globalFormatKey,
                sets: buildEmptySets(globalFormatKey),
                pointsA: 0,
                pointsB: 0,
                isComplete: false,
            };

            callParentScoreChange(onScoreChange, '', '', metadata);
            notifyScoreChanged(match.id, { scoreA: '', scoreB: '', ...metadata });
            return;
        }

        const formatKeyToSave = effectiveFormatKey || globalFormatKey;
        const normalizedSets = normalizeSets(nextSets, formatKeyToSave);
        const nextComputed = computeMatchScoreFromSets(normalizedSets, formatKeyToSave);

        const nextStoredScore = saveStoredMatchScore(match.id, {
            formatKey: formatKeyToSave,
            sets: normalizedSets,
            scoreA: nextComputed.scoreA,
            scoreB: nextComputed.scoreB,
            pointsA: nextComputed.pointsA,
            pointsB: nextComputed.pointsB,
            isComplete: nextComputed.isComplete,
        });

        setStoredScore(nextStoredScore);

        const metadata = {
            formatKey: formatKeyToSave,
            sets: normalizedSets,
            pointsA: nextComputed.pointsA,
            pointsB: nextComputed.pointsB,
            isComplete: nextComputed.isComplete,
        };

        callParentScoreChange(onScoreChange, nextComputed.scoreA, nextComputed.scoreB, metadata);

        notifyScoreChanged(match.id, {
            scoreA: nextComputed.scoreA,
            scoreB: nextComputed.scoreB,
            ...metadata,
        });
    }

    function handleSetScoreChange(index, field, value) {
        if (disabled || !match?.id) return;

        const nextSets = sets.map((set, setIndex) =>
            setIndex === index
                ? { ...set, [field]: normalizeScoreValue(value) }
                : set
        );

        persistSets(nextSets);
    }

    return (
        <div className="match-score-editor">
            <div className="match-score-editor-head">
                <span className="match-format-badge">{format.key}</span>

                <span
                    className={
                        computed.isComplete
                            ? 'match-set-diff-inline match-set-diff-inline-head'
                            : 'match-score-summary'
                    }
                >
                    {setDiffLabel}
                </span>
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
