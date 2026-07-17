import { useEffect, useMemo, useRef, useState } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
    clearAppState,
    computeRanking,
    createDefaultState,
    createPool,
    createSerpentinEntry,
    getLocalSaveInfo,
    loadAppState,
    saveAppState,
} from '../utils/tournament';
import { importTournamentFile } from '../utils/importExport';
import {
    deleteNamedTournament,
    exportTournamentToJSON,
    formatSaveDate,
    getNamedTournament,
    getSavedTournaments,
    importTournamentJsonFile,
    saveNamedTournament,
} from '../utils/persistence';
import {
    assignStageTeam,
    buildFinalRanking,
    createEmptyFinalStage,
    getFinalStageMatchesForStats,
    setFinalStageOption,
    syncFinalStageWithTeams,
    updateFinalStageMatch,
} from '../utils/finalStage';
import {
    applyMatchToStats,
    buildAutoFinalDraw,
    buildBalancedRandomSerpentin,
    buildGlobalPlanning,
    buildTeamFromDraft,
    clearTeamFromFinalStage,
    createCombinedStatRow,
    getInitialDraftFromTeam,
    getSeedTeams,
    normalizeCourtLabels,
    normalizePoolMatchesToFftPadelRotation,
    syncPoolsFromSerpentin,
} from '../utils/appLogic';
import { DEFAULT_MATCH_FORMAT, getStoredMatchFormat, storeMatchFormat, setStoredMatchFormat, sanitizeMatchFormatKey } from '../utils/matchFormats';
import { assignSharedRanks, compareFftRankingRows } from '../utils/fftScoring.js';

export function useTournamentState() {
    const [matchFormatKey, setMatchFormatKey] = useState(() => getStoredMatchFormat());

    useEffect(() => {
        const handleExternalPoolFormatChange = (event) => {
            const nextFormat = sanitizeMatchFormatKey(event?.detail?.formatKey);
            setMatchFormatKey(nextFormat);
            setStoredMatchFormat(nextFormat);
        };

        window.addEventListener('padelingo:match-format-change', handleExternalPoolFormatChange);

        return () => {
            window.removeEventListener('padelingo:match-format-change', handleExternalPoolFormatChange);
        };
    }, []);

    const initialState = useMemo(() => loadAppState(), []);
    const [baseTeams, setBaseTeams] = useState(initialState.baseTeams || []);
    const [pools, setPools] = useState(initialState.pools);
    const [serpentin, setSerpentin] = useState(initialState.serpentin);
    const [activeTab, setActiveTab] = useState(initialState.activeTab);
    const [courtCount, setCourtCount] = useState(initialState.courtCount || 4);
    const [courtLabels, setCourtLabels] = useState(() =>
        normalizeCourtLabels(initialState.courtLabels, initialState.courtCount || 4)
    );
    const [isCourtSettingsOpen, setIsCourtSettingsOpen] = useState(false);
    const [editingMatchCourtId, setEditingMatchCourtId] = useState(null);
    const [lastSavedAt, setLastSavedAt] = useState(() => initialState.savedAt || getLocalSaveInfo()?.savedAt || null);
    const [saveNotice, setSaveNotice] = useState(null);
    const [savedTournaments, setSavedTournaments] = useState(() => getSavedTournaments());
    const [selectedTournamentSaveId, setSelectedTournamentSaveId] = useState('');
    const [tournamentSaveName, setTournamentSaveName] = useState('');

    const [newPoolName, setNewPoolName] = useState('');
    const [editingBaseTeamId, setEditingBaseTeamId] = useState(null);
    const [editingBaseDraft, setEditingBaseDraft] = useState(null);
    const [newBaseDraft, setNewBaseDraft] = useState(() => getInitialDraftFromTeam({}));

    const importInputRef = useRef(null);
    const importInProgressRef = useRef(false);
    const importHandlerRef = useRef(null);
    const lastImportAttemptRef = useRef({
        signature: '',
        timestamp: 0,
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const allTeams = useMemo(() => {
        const uniqueMap = new Map();

        baseTeams.forEach((team) => {
            const key = team.number || team.fullName || team.name || team.id;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, team);
            }
        });

        return [...uniqueMap.values()].sort((a, b) => {
            const aRank = Number(a.cumulativeRank) || 999999999;
            const bRank = Number(b.cumulativeRank) || 999999999;
            if (aRank !== bRank) return aRank - bRank;

            const aNum = Number(String(a.number).match(/(\d+)/)?.[1] || 0);
            const bNum = Number(String(b.number).match(/(\d+)/)?.[1] || 0);
            return aNum - bNum;
        });
    }, [baseTeams]);

    const seedTeams = useMemo(() => getSeedTeams(allTeams), [allTeams]);
    const seedTeamIds = useMemo(() => new Set(seedTeams.map((team) => team.id)), [seedTeams]);
    const playableTeams = useMemo(
        () => allTeams.filter((team) => !seedTeamIds.has(team.id)),
        [allTeams, seedTeamIds]
    );

    const selectedSerpentinTeamIds = useMemo(() => {
        const ids = new Set();

        Object.values(serpentin || {}).forEach((entries) => {
            (entries || []).forEach((entry) => {
                if (entry.value) ids.add(entry.value);
            });
        });

        return ids;
    }, [serpentin]);

    const playableTeamNumberById = useMemo(() => {
        const map = new Map();
        playableTeams.forEach((team, index) => map.set(team.id, index + 1));
        return map;
    }, [playableTeams]);

    const seedTeamNumberById = useMemo(() => {
        const map = new Map();
        seedTeams.forEach((team, index) => map.set(team.id, index + 1));
        return map;
    }, [seedTeams]);

    const displayBaseTeams = useMemo(
        () => [...playableTeams, ...seedTeams],
        [playableTeams, seedTeams]
    );

    const [finalStage, setFinalStage] = useState(
        initialState.finalStage || createEmptyFinalStage()
    );

    const safeFinalStage = useMemo(
        () => syncFinalStageWithTeams(finalStage || createEmptyFinalStage(), allTeams),
        [finalStage, allTeams]
    );

    useEffect(() => {
        setPools((prev) => syncPoolsFromSerpentin(playableTeams, prev, serpentin));
    }, [playableTeams, serpentin]);

    useEffect(() => {
        setSerpentin((prev) => {
            let hasChanged = false;
            const next = {};

            Object.keys(prev).forEach((poolId) => {
                next[poolId] = (prev[poolId] || []).map((entry) => {
                    if (entry.value && seedTeamIds.has(entry.value)) {
                        hasChanged = true;
                        return { ...entry, value: '' };
                    }
                    return entry;
                });
            });

            return hasChanged ? next : prev;
        });
    }, [seedTeamIds]);


    useEffect(() => {
        setCourtLabels((prev) => normalizeCourtLabels(prev, courtCount));
    }, [courtCount]);

    useEffect(() => {
        const savedAt = saveAppState({
            baseTeams,
            pools,
            serpentin,
            activeTab,
            finalStage: safeFinalStage,
            courtCount,
            courtLabels,
            matchFormat: matchFormatKey,
        });
        setLastSavedAt(savedAt);
    }, [baseTeams, pools, serpentin, activeTab, safeFinalStage, courtCount, courtLabels, matchFormatKey]);

    useEffect(() => {
        if (!saveNotice) return undefined;

        const timeoutId = window.setTimeout(() => {
            setSaveNotice(null);
        }, 3800);

        return () => window.clearTimeout(timeoutId);
    }, [saveNotice]);

    const displayCourtLabel = (courtNumber) =>
        courtLabels[Math.max(0, Number(courtNumber || 1) - 1)] || String(courtNumber || 1);

    const displayMatchCourtLabel = (match, fallbackCourtNumber = null) => {
        const override = String(match?.courtOverride || '').trim();
        return override || displayCourtLabel(fallbackCourtNumber || match?.localCourt || 1);
    };

    function handleCourtLabelChange(index, value) {
        setCourtLabels((prev) => {
            const next = normalizeCourtLabels(prev, courtCount);
            next[index] = value;
            return next;
        });
    }

    function resetCourtLabels() {
        setCourtLabels(normalizeCourtLabels([], courtCount));
    }

    const activePool = pools.find((pool) => pool.id === activeTab) || null;

    const rankedPools = useMemo(
        () =>
            pools.map((pool) => ({
                ...pool,
                ranking: computeRanking(pool.teams, pool.matches),
            })),
        [pools]
    );

    const ranking = useMemo(() => {
        if (!activePool) return [];
        return computeRanking(activePool.teams, activePool.matches);
    }, [activePool]);

    const finalRanking = useMemo(
        () => buildFinalRanking(safeFinalStage, rankedPools, allTeams),
        [safeFinalStage, rankedPools, allTeams]
    );

    const combinedPointsRanking = useMemo(() => {
        const statMap = new Map(allTeams.map((team) => [team.id, createCombinedStatRow(team)]));

        pools.forEach((pool) => {
            pool.matches.forEach((match) => {
                applyMatchToStats(statMap, match);
            });
        });

        getFinalStageMatchesForStats(safeFinalStage).forEach((match) => {
            applyMatchToStats(statMap, match);
        });

        return assignSharedRanks([...statMap.values()]
            .filter(
                (team) =>
                    team.played > 0 ||
                    team.pointsFor > 0 ||
                    team.pointsAgainst > 0 ||
                    team.totalScore !== 0
            )
            .sort(compareFftRankingRows));
    }, [allTeams, pools, safeFinalStage]);

    const finalOnlyPointsRanking = useMemo(() => {
        const statMap = new Map(allTeams.map((team) => [team.id, createCombinedStatRow(team)]));

        getFinalStageMatchesForStats(safeFinalStage).forEach((match) => {
            applyMatchToStats(statMap, match);
        });

        return assignSharedRanks([...statMap.values()]
            .filter(
                (team) =>
                    team.played > 0 ||
                    team.pointsFor > 0 ||
                    team.pointsAgainst > 0 ||
                    team.totalScore !== 0
            )
            .sort(compareFftRankingRows));
    }, [allTeams, safeFinalStage]);

    const finalOptionGroups = useMemo(() => {
        const placedIds = new Set(pools.flatMap((pool) => pool.teams.map((team) => team.id)));

        const groups = pools.map((pool) => ({
            id: pool.id,
            name: pool.name,
            teams: pool.teams,
        }));

        const unplaced = allTeams.filter((team) => !placedIds.has(team.id));
        if (unplaced.length > 0) {
            groups.push({
                id: 'hors-poules',
                name: 'TS',
                teams: unplaced,
            });
        }

        return groups;
    }, [pools, allTeams]);

    const selectedQuarterTeamIds = useMemo(() => {
        const ids = new Set();

        safeFinalStage.quarterFinals.forEach((match) => {
            if (match.teamAId) ids.add(match.teamAId);
            if (match.teamBId) ids.add(match.teamBId);
        });

        return ids;
    }, [safeFinalStage.quarterFinals]);

    const starterFinalStageKey = safeFinalStage.settings.entryRound === 'round16'
        ? 'roundOf16'
        : safeFinalStage.settings.entryRound === 'semi'
            ? 'semiFinals'
            : 'quarterFinals';

    const selectedStarterTeamIds = useMemo(() => {
        const ids = new Set();

        (safeFinalStage[starterFinalStageKey] || []).forEach((match) => {
            if (match.teamAId) ids.add(match.teamAId);
            if (match.teamBId) ids.add(match.teamBId);
        });

        return ids;
    }, [safeFinalStage, starterFinalStageKey]);

    const globalPlanning = useMemo(
        () => buildGlobalPlanning(pools, Math.max(1, Number(courtCount) || 1)),
        [pools, courtCount]
    );




    function formatRank(value) {
        const number = Number(value) || 0;
        return number.toLocaleString('fr-FR');
    }

    function formatSigned(value) {
        const number = Number(value) || 0;
        return number > 0 ? '+' + number : String(number);
    }

    function getTeamNameById(teamId) {
        return allTeams.find((team) => team.id === teamId)?.name || '';
    }

    function getDisplayTeamNumber(team) {
        if (!team) return '';

        if (seedTeamIds.has(team.id)) {
            return `TS ${seedTeamNumberById.get(team.id) || ''}`.trim();
        }

        return `Équipe ${playableTeamNumberById.get(team.id) || ''}`.trim();
    }

    function getTeamLabelById(teamId) {
        const team = allTeams.find((item) => item.id === teamId);
        if (!team) return '';
        return `${getDisplayTeamNumber(team)} — ${team.name}${
            team.cumulativeRank ? ` — Rang cumulé: ${formatRank(team.cumulativeRank)}` : ''
        }`;
    }

    function handleStartBaseEdit(team) {
        setEditingBaseTeamId(team.id);
        setEditingBaseDraft(getInitialDraftFromTeam(team));
    }

    function handleCancelBaseEdit() {
        setEditingBaseTeamId(null);
        setEditingBaseDraft(null);
    }

    function handleToggleSeedTeam(team) {
        if (!team) return;

        const nextIsSeed = !Boolean(team.isSeed);

        if (nextIsSeed) {
            setSerpentin((prev) => {
                const next = {};

                Object.keys(prev).forEach((poolId) => {
                    next[poolId] = (prev[poolId] || []).map((entry) =>
                        entry.value === team.id ? { ...entry, value: '' } : entry
                    );
                });

                return next;
            });
        }

        setBaseTeams((prev) =>
            prev.map((item) =>
                item.id === team.id ? { ...item, isSeed: nextIsSeed } : item
            )
        );

        if (editingBaseTeamId === team.id) {
            setEditingBaseDraft((prev) => (prev ? { ...prev, isSeed: nextIsSeed } : prev));
        }
    }

    function handleBaseDraftChange(field, value) {
        setEditingBaseDraft((prev) => ({
            ...prev,
            [field]: value,
        }));
    }

    function handleSwapPlayersInDraft() {
        setEditingBaseDraft((prev) => ({
            ...prev,
            player1Name: prev.player2Name,
            player1Rank: prev.player2Rank,
            player2Name: prev.player1Name,
            player2Rank: prev.player1Rank,
        }));
    }

    function handleSaveBaseEdit(teamId) {
        if (!editingBaseDraft) return;

        const updatedTeam = buildTeamFromDraft(editingBaseDraft, teamId);
        setBaseTeams((prev) => prev.map((team) => (team.id === teamId ? updatedTeam : team)));

        setEditingBaseTeamId(null);
        setEditingBaseDraft(null);
    }

    function handleDeleteBaseTeam(team) {
        if (!team) return;

        const placedPoolNames = pools
            .filter((pool) => pool.teams.some((poolTeam) => poolTeam.id === team.id))
            .map((pool) => pool.name);

        const finalStageUsesTeam = [
            ...(safeFinalStage.roundOf16 || []),
            ...safeFinalStage.quarterFinals,
            ...safeFinalStage.semiFinals,
            safeFinalStage.final,
            safeFinalStage.thirdPlace,
            ...(safeFinalStage.placement5to8Semis || []),
            safeFinalStage.placement5to8Finals?.place5,
            safeFinalStage.placement5to8Finals?.place7,
        ]
            .filter(Boolean)
            .some((match) => match.teamAId === team.id || match.teamBId === team.id);

        const warningParts = [
            `Supprimer définitivement ${team.number || 'cette équipe'} — ${team.name || ''} ?`,
        ];

        if (placedPoolNames.length > 0) {
            warningParts.push(
                `Elle sera aussi retirée automatiquement du serpentin et des poules : ${placedPoolNames.join(', ')}.`
            );
        }

        if (finalStageUsesTeam) {
            warningParts.push(
                'Elle sera aussi retirée automatiquement de la phase finale et les scores concernés seront remis à zéro.'
            );
        }

        const confirmed = window.confirm(warningParts.join('\n\n'));
        if (!confirmed) return;

        const remainingTeams = allTeams.filter((item) => item.id !== team.id);

        setBaseTeams((prev) => prev.filter((item) => item.id !== team.id));

        setSerpentin((prev) => {
            const next = {};

            Object.keys(prev).forEach((poolId) => {
                next[poolId] = (prev[poolId] || []).map((entry) =>
                    entry.value === team.id ? { ...entry, value: '' } : entry
                );
            });

            return next;
        });

        setFinalStage((prev) =>
            syncFinalStageWithTeams(clearTeamFromFinalStage(prev || createEmptyFinalStage(), team.id), remainingTeams)
        );

        setEditingBaseTeamId(null);
        setEditingBaseDraft(null);
    }

    function handleNewBaseDraftChange(field, value) {
        setNewBaseDraft((prev) => ({
            ...prev,
            [field]: value,
        }));
    }

    function handleAddManualBaseTeam(event) {
        event.preventDefault();

        const player1Name = String(newBaseDraft.player1Name || '').trim();
        const player2Name = String(newBaseDraft.player2Name || '').trim();
        const displayName = String(newBaseDraft.displayName || '').trim();

        if (!displayName && !player1Name && !player2Name) {
            alert('Ajoute au moins un nom d’équipe ou un joueur.');
            return;
        }

        const existingNumbers = baseTeams
            .map((team) => Number(String(team.number || '').match(/(\d+)/)?.[1] || 0))
            .filter((number) => Number.isFinite(number));
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        const teamId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const normalizedDraft = {
            ...newBaseDraft,
            number: newBaseDraft.number || `Équipe ${nextNumber}`,
            displayName:
                displayName ||
                [player1Name, player2Name].filter(Boolean).join(' & ') ||
                `Équipe ${nextNumber}`,
        };

        setBaseTeams((prev) => [...prev, buildTeamFromDraft(normalizedDraft, teamId)]);
        setNewBaseDraft(getInitialDraftFromTeam({}));
    }

    function handleAutoFillSerpentin() {
        if (playableTeams.length === 0 || pools.length === 0) return;

        const confirmed = window.confirm(
            'Le remplissage serpentin va remplacer les lignes actuelles. Continuer ?'
        );

        if (!confirmed) return;

        setSerpentin(buildBalancedRandomSerpentin(playableTeams, pools));
    }


    function handleAddPool(event) {
        event.preventDefault();

        const cleanName = newPoolName.trim();
        if (!cleanName) return;

        const exists = pools.some((pool) => pool.name.toLowerCase() === cleanName.toLowerCase());
        if (exists) return;

        const newPool = createPool(cleanName, []);

        setPools((prev) => [...prev, newPool]);
        setSerpentin((prev) => ({
            ...prev,
            [newPool.id]: [
                createSerpentinEntry(''),
                createSerpentinEntry(''),
                createSerpentinEntry(''),
                createSerpentinEntry(''),
            ],
        }));
        setNewPoolName('');
    }

    function handleDeletePool(poolId) {
        if (pools.length <= 1) return;

        setPools((prev) => prev.filter((pool) => pool.id !== poolId));
        setSerpentin((prev) => {
            const next = { ...prev };
            delete next[poolId];
            return next;
        });

        if (activeTab === poolId) {
            setActiveTab('base');
        }
    }

    function handleAddSerpentinRow(poolId) {
        setSerpentin((prev) => ({
            ...prev,
            [poolId]: [...(prev[poolId] || []), createSerpentinEntry('')],
        }));
    }

    function handleDeleteSerpentinRow(poolId, entryId) {
        setSerpentin((prev) => ({
            ...prev,
            [poolId]: (prev[poolId] || []).filter((entry) => entry.id !== entryId),
        }));
    }

    function handleChangeSerpentinValue(poolId, entryId, teamId) {
        setSerpentin((prev) => {
            const next = {};

            Object.keys(prev).forEach((key) => {
                next[key] = (prev[key] || []).map((entry) => {
                    if (teamId && entry.value === teamId) {
                        return { ...entry, value: '' };
                    }
                    return entry;
                });
            });

            next[poolId] = (next[poolId] || []).map((entry) =>
                entry.id === entryId ? { ...entry, value: teamId } : entry
            );

            return next;
        });
    }

    function handleSerpentinDragEnd(poolId, event) {
        if (!event.over || event.active.id === event.over.id) return;

        setSerpentin((prev) => {
            const entries = prev[poolId] || [];
            const oldIndex = entries.findIndex((entry) => entry.id === event.active.id);
            const newIndex = entries.findIndex((entry) => entry.id === event.over.id);

            if (oldIndex === -1 || newIndex === -1) return prev;

            return {
                ...prev,
                [poolId]: arrayMove(entries, oldIndex, newIndex),
            };
        });
    }

    function handleMatchScoreChange(matchId, field, value, scoreDetail = null) {
        if (!activePool) return;

        setPools((prev) =>
            prev.map((pool) =>
                pool.id !== activePool.id
                    ? pool
                    : {
                        ...pool,
                        matches: pool.matches.map((match) => {
                            if (match.id !== matchId) return match;

                            if (field === 'scoreDetail') {
                                const detail = value || {};
                                const nextScoreA =
                                    detail.scoreA === undefined || detail.scoreA === null
                                        ? ''
                                        : String(detail.scoreA);
                                const nextScoreB =
                                    detail.scoreB === undefined || detail.scoreB === null
                                        ? ''
                                        : String(detail.scoreB);
                                const nextFormat =
                                    detail.formatKey ||
                                    detail.matchFormatKey ||
                                    detail.format ||
                                    match.format ||
                                    match.formatKey ||
                                    match.matchFormatKey ||
                                    '';

                                return {
                                    ...match,
                                    scoreA: nextScoreA,
                                    scoreB: nextScoreB,
                                    scoreDetail: {
                                        ...detail,
                                        scoreA: nextScoreA,
                                        scoreB: nextScoreB,
                                        formatKey: nextFormat,
                                        format: detail.format || nextFormat,
                                    },
                                    format: nextFormat,
                                    formatKey: nextFormat,
                                    matchFormatKey: nextFormat,
                                };
                            }

                            const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));

                            return {
                                ...match,
                                [field]: sanitized,
                                scoreDetail: scoreDetail || match.scoreDetail || null,
                                format:
                                    scoreDetail?.formatKey ||
                                    scoreDetail?.format ||
                                    match.format ||
                                    '',
                            };
                        }),
                    }
            )
        );
    }


    function handleMatchCourtOverrideChange(matchId, value) {
        if (!activePool) return;

        const sanitized = String(value || '').trim();

        setPools((prev) =>
            prev.map((pool) =>
                pool.id !== activePool.id
                    ? pool
                    : {
                        ...pool,
                        matches: pool.matches.map((match) =>
                            match.id === matchId ? { ...match, courtOverride: sanitized } : match
                        ),
                    }
            )
        );
    }

    function resetMatchCourtOverride(matchId) {
        handleMatchCourtOverrideChange(matchId, '');
        setEditingMatchCourtId(null);
    }

    function handleOptimizeMatches() {
        if (!activePool) return;

        setPools((prev) =>
            prev.map((pool) =>
                pool.id !== activePool.id
                    ? pool
                    : {
                        ...pool,
                        matches: normalizePoolMatchesToFftPadelRotation(pool, pool.matches),
                    }
            )
        );
    }

    function resetFinalProgress(baseStage) {
        return {
            ...baseStage,
            roundOf16: (baseStage.roundOf16 || []).map((match) => ({
                ...match,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            })),
            quarterFinals: baseStage.quarterFinals.map((match) => ({
                ...match,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            })),
            semiFinals: baseStage.semiFinals.map((match) => ({
                ...match,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            })),
            final: {
                ...baseStage.final,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            },
            thirdPlace: {
                ...baseStage.thirdPlace,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            },
            placement5to8Semis: (baseStage.placement5to8Semis || []).map((match) => ({
                ...match,
                teamAId: '',
                teamBId: '',
                scoreA: '',
                scoreB: '',
            })),
            placement5to8Finals: {
                place5: {
                    ...baseStage.placement5to8Finals.place5,
                    teamAId: '',
                    teamBId: '',
                    scoreA: '',
                    scoreB: '',
                },
                place7: {
                    ...baseStage.placement5to8Finals.place7,
                    teamAId: '',
                    teamBId: '',
                    scoreA: '',
                    scoreB: '',
                },
            },
        };
    }

    function handleAutoQuarterDraw() {
        const draw = buildAutoFinalDraw({
            rankedPools,
            allTeams,
            qualifierMode: safeFinalStage.settings.poolQualifierMode,
        });

        if (!draw?.matches?.length) {
            alert('Pas assez d’équipes qualifiées pour générer automatiquement la phase finale. Il faut au minimum 4 équipes qualifiées.');
            return;
        }

        setFinalStage((prev) => {
            const baseStage = resetFinalProgress(syncFinalStageWithTeams(prev || createEmptyFinalStage(), allTeams));
            const targetKey = draw.entryRound === 'round16'
                ? 'roundOf16'
                : draw.entryRound === 'semi'
                    ? 'semiFinals'
                    : 'quarterFinals';

            const nextStage = {
                ...baseStage,
                settings: {
                    ...baseStage.settings,
                    entryRound: draw.entryRound,
                },
                [targetKey]: baseStage[targetKey].map((match, index) => {
                    const source = draw.matches[index];

                    return {
                        ...match,
                        teamAId: source?.teamAId || '',
                        teamBId: source?.teamBId || '',
                        scoreA: '',
                        scoreB: '',
                    };
                }),
            };

            return syncFinalStageWithTeams(nextStage, allTeams);
        });
    }

    function handleFinalStageEntryRoundChange(value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(prev || createEmptyFinalStage(), 'entryRound', value),
                allTeams
            )
        );
    }

    function handleFinalQualifierModeChange(value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(prev || createEmptyFinalStage(), 'poolQualifierMode', value),
                allTeams
            )
        );
    }

    function handleFinalMatchFormatChange(value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(prev || createEmptyFinalStage(), 'finalMatchFormatKey', value),
                allTeams
            )
        );
    }

    function handleToggleThirdPlace() {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(
                    prev || createEmptyFinalStage(),
                    'enableThirdPlaceMatch',
                    !safeFinalStage.settings.enableThirdPlaceMatch
                ),
                allTeams
            )
        );
    }

    function handleToggleQuarterPlacement() {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                setFinalStageOption(
                    prev || createEmptyFinalStage(),
                    'enablePlacement5to8',
                    !safeFinalStage.settings.enablePlacement5to8
                ),
                allTeams
            )
        );
    }

    function getCurrentTournamentState() {
        return {
            baseTeams,
            pools,
            serpentin,
            activeTab,
            finalStage: safeFinalStage,
            courtCount,
            courtLabels,
            matchFormat: matchFormatKey,
            scoringVersion: 'fft-v2-sets-priority',
            savedSchemaVersion: 2,
        };
    }

    function applyTournamentState(nextState) {
        const nextMatchFormat = sanitizeMatchFormatKey(nextState.matchFormat || nextState.format || DEFAULT_MATCH_FORMAT);
        setMatchFormatKey(nextMatchFormat);
        setBaseTeams(nextState.baseTeams || []);
        setPools(nextState.pools || []);
        setSerpentin(nextState.serpentin || {});
        setActiveTab(nextState.activeTab || 'base');
        setFinalStage(nextState.finalStage || createEmptyFinalStage());
        setCourtCount(nextState.courtCount || 4);
        setCourtLabels(normalizeCourtLabels(nextState.courtLabels, nextState.courtCount || 4));
        storeMatchFormat(nextMatchFormat);
        setEditingBaseTeamId(null);
        setEditingBaseDraft(null);
        setEditingMatchCourtId(null);
    }

    function refreshSavedTournaments() {
        const saves = getSavedTournaments();
        setSavedTournaments(saves);

        if (selectedTournamentSaveId && !saves.some((save) => save.id === selectedTournamentSaveId)) {
            setSelectedTournamentSaveId('');
        }

        return saves;
    }

    function handleSaveNamedTournament(requestedName = null) {
        const fallbackName = `Tournoi du ${new Intl.DateTimeFormat('fr-FR').format(new Date())}`;
        const hasProvidedName = typeof requestedName === 'string';
        const rawName = hasProvidedName
            ? requestedName
            : window.prompt('Nom de cette sauvegarde de tournoi :', tournamentSaveName || fallbackName);

        if (rawName === null) return;

        const name = String(rawName || '').trim();

        if (!name) {
            alert('Ajoute un nom pour sauvegarder ce tournoi.');
            return;
        }

        try {
            const saved = saveNamedTournament(name, getCurrentTournamentState(), selectedTournamentSaveId || null);
            setTournamentSaveName(saved.name);
            setSelectedTournamentSaveId(saved.id);
            refreshSavedTournaments();
            setSaveNotice({
                type: 'success',
                title: 'Tournoi sauvegardé',
                message: `${saved.name} · ${formatSaveDate(saved.updatedAt)} · sauvegarde locale sans cookie.`,
            });
        } catch (error) {
            console.error(error);
            alert('Impossible de sauvegarder ce tournoi.');
        }
    }

    function handleLoadNamedTournament() {
        if (!selectedTournamentSaveId) {
            alert('Choisis une sauvegarde de tournoi à charger.');
            return;
        }

        const saved = getNamedTournament(selectedTournamentSaveId);

        if (!saved) {
            alert('Cette sauvegarde est introuvable.');
            refreshSavedTournaments();
            return;
        }

        const confirmed = window.confirm(
            `Charger "${saved.name}" ?

Les données actuellement affichées seront remplacées par cette sauvegarde.`
        );

        if (!confirmed) return;

        applyTournamentState(saved.state);
        setTournamentSaveName(saved.name);
        setSaveNotice({
            type: 'success',
            title: 'Tournoi chargé',
            message: `${saved.name} · dernière sauvegarde : ${formatSaveDate(saved.updatedAt)}.`,
        });
    }

    function handleDeleteNamedTournament() {
        if (!selectedTournamentSaveId) {
            alert('Choisis une sauvegarde de tournoi à supprimer.');
            return;
        }

        const saved = getNamedTournament(selectedTournamentSaveId);
        const confirmed = window.confirm(
            `Supprimer définitivement la sauvegarde "${saved?.name || 'sélectionnée'}" ?

Cette action ne supprime pas le tournoi actuellement ouvert.`
        );

        if (!confirmed) return;

        deleteNamedTournament(selectedTournamentSaveId);
        setSelectedTournamentSaveId('');
        setTournamentSaveName('');
        refreshSavedTournaments();
        setSaveNotice({
            type: 'success',
            title: 'Sauvegarde supprimée',
            message: 'La sauvegarde nommée a bien été supprimée de cet appareil.',
        });
    }

    function handleStartNewTournament() {
        const confirmed = window.confirm(
            'Réinitialiser le tournoi actuellement ouvert ?\n\nCela vide uniquement les données du tournoi en cours. Tes sauvegardes nommées restent conservées dans l’onglet Mes tournois.'
        );

        if (!confirmed) return;

        clearAppState();
        applyTournamentState({ ...createDefaultState(), activeTab: 'base' });
        setSelectedTournamentSaveId('');
        setTournamentSaveName('');
        setSaveNotice({
            type: 'success',
            title: 'Tournoi réinitialisé',
            message: 'Le tournoi en cours est vide. Tes sauvegardes nommées sont conservées sur cet appareil.',
        });
    }

    function handleExportJson() {
        exportTournamentToJSON(getCurrentTournamentState());
        setSaveNotice({
            type: 'success',
            title: 'Export JSON généré',
            message: 'Un fichier JSON téléchargeable a été créé pour ce tournoi.',
        });
    }

    async function handleImportFile(event) {
        const input = event?.currentTarget || event?.target || importInputRef.current;
        const file = input?.files?.[0];

        if (!input || !file) {
            return;
        }

        const signature = `${file.name}:${file.size}:${file.lastModified}`;
        const now = Date.now();
        const previousAttempt = lastImportAttemptRef.current;

        if (
            importInProgressRef.current ||
            (previousAttempt.signature === signature &&
                now - previousAttempt.timestamp < 1500)
        ) {
            return;
        }

        importInProgressRef.current = true;
        lastImportAttemptRef.current = {
            signature,
            timestamp: now,
        };

        const extension = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['json', 'xls', 'xlsx', 'csv'];

        if (!allowedExtensions.includes(extension)) {
            alert('Format non supporté. Utilise un fichier XLS, XLSX, CSV ou JSON.');
            input.value = '';
            importInProgressRef.current = false;
            return;
        }

        const confirmed = window.confirm(
            'Importer ce fichier va remplacer les données actuelles. Continuer ?'
        );

        if (!confirmed) {
            input.value = '';
            importInProgressRef.current = false;
            return;
        }

        try {
            // Give mobile browsers time to fully close the native file picker
            // before starting the XLS/XLSX parsing work.
            await new Promise((resolve) => window.setTimeout(resolve, 50));

            const imported =
                extension === 'json'
                    ? await importTournamentJsonFile(file)
                    : await importTournamentFile(file);

            const normalizedImportedState = {
                ...imported,
                baseTeams: Array.isArray(imported?.baseTeams)
                    ? imported.baseTeams
                    : [],
                pools: Array.isArray(imported?.pools)
                    ? imported.pools
                    : [],
                serpentin:
                    imported?.serpentin && typeof imported.serpentin === 'object'
                        ? imported.serpentin
                        : {},
                finalStage: imported?.finalStage || createEmptyFinalStage(),
                courtCount: Math.max(1, Number(imported?.courtCount) || 4),
                courtLabels: normalizeCourtLabels(
                    imported?.courtLabels,
                    imported?.courtCount || 4
                ),
                matchFormat:
                    imported?.matchFormat ||
                    imported?.format ||
                    DEFAULT_MATCH_FORMAT,
                scoringVersion:
                    imported?.scoringVersion || 'fft-v2-sets-priority',
                savedSchemaVersion:
                    Number(imported?.savedSchemaVersion) || 3,
                activeTab: 'base',
            };

            if (normalizedImportedState.baseTeams.length === 0) {
                throw new Error(
                    "Le fichier a été lu, mais aucune équipe exploitable n'a été trouvée."
                );
            }

            // Update React first so the imported teams appear immediately.
            applyTournamentState(normalizedImportedState);

            // Persist the same normalized state for refreshes and PWA restarts.
            const savedAt = saveAppState(normalizedImportedState);
            setLastSavedAt(savedAt);

            // Read the saved state back immediately. This catches storage problems
            // that can otherwise fail silently on some mobile/privacy configurations.
            const storedState = loadAppState();
            const storedTeamsCount = Array.isArray(storedState?.baseTeams)
                ? storedState.baseTeams.length
                : 0;

            if (storedTeamsCount !== normalizedImportedState.baseTeams.length) {
                throw new Error(
                    `La sauvegarde locale mobile est incomplète : ` +
                    `${storedTeamsCount}/${normalizedImportedState.baseTeams.length} équipe(s) retrouvée(s).`
                );
            }

            setActiveTab('base');
            setSelectedTournamentSaveId('');
            setTournamentSaveName('');
            setSaveNotice({
                type: 'success',
                title: 'Import terminé',
                message:
                    `${normalizedImportedState.baseTeams.length} équipe(s) et ` +
                    `${normalizedImportedState.pools.length} poule(s) chargée(s).`,
            });

            window.requestAnimationFrame(() => {
                window.setTimeout(() => {
                    const baseSection =
                        document.querySelector('.base-section-head') ||
                        document.querySelector('.base-section') ||
                        document.querySelector('.card.full-width');

                    if (baseSection?.scrollIntoView) {
                        baseSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                    }
                }, 100);
            });
        } catch (error) {
            console.error('Tournament import error:', error);

            const message =
                error?.message ||
                error?.toString?.() ||
                "Erreur inconnue pendant l'import.";

            alert(
                "Impossible d'importer ce fichier sur cet appareil.\n\n" +
                `Détail technique : ${message}`
            );
        } finally {
            input.value = '';

            window.setTimeout(() => {
                importInProgressRef.current = false;
            }, 250);
        }
    }

    importHandlerRef.current = handleImportFile;

    /*
     * Mobile fallback:
     * React's synthetic onChange is reliable on desktop, but some Android file
     * pickers and privacy-focused browsers can return to the page without
     * forwarding that event correctly. Native listeners plus focus/visibility
     * checks recover the selected File directly from the input element.
     */
    useEffect(() => {
        const input = importInputRef.current;

        if (!input) {
            return undefined;
        }

        let isDisposed = false;
        const pendingTimeouts = new Set();

        const scheduleFileCheck = (delay = 0) => {
            const timeoutId = window.setTimeout(() => {
                pendingTimeouts.delete(timeoutId);

                if (
                    isDisposed ||
                    importInProgressRef.current ||
                    !input.files?.length
                ) {
                    return;
                }

                importHandlerRef.current?.({
                    currentTarget: input,
                    target: input,
                    type: 'native-mobile-file-selection',
                });
            }, delay);

            pendingTimeouts.add(timeoutId);
        };

        const handleNativeFileEvent = () => {
            scheduleFileCheck(0);
        };

        const handlePickerReturn = () => {
            scheduleFileCheck(0);
            scheduleFileCheck(120);
            scheduleFileCheck(350);
        };

        const resetBeforePicker = () => {
            if (importInProgressRef.current) return;

            input.value = '';
            lastImportAttemptRef.current = {
                signature: '',
                timestamp: 0,
            };
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handlePickerReturn();
            }
        };

        input.addEventListener('change', handleNativeFileEvent);
        input.addEventListener('input', handleNativeFileEvent);
        input.addEventListener('cancel', handlePickerReturn);
        input.addEventListener('click', resetBeforePicker, true);
        window.addEventListener('focus', handlePickerReturn);
        window.addEventListener('pageshow', handlePickerReturn);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isDisposed = true;

            pendingTimeouts.forEach((timeoutId) => {
                window.clearTimeout(timeoutId);
            });
            pendingTimeouts.clear();

            input.removeEventListener('change', handleNativeFileEvent);
            input.removeEventListener('input', handleNativeFileEvent);
            input.removeEventListener('cancel', handlePickerReturn);
            input.removeEventListener('click', resetBeforePicker, true);
            window.removeEventListener('focus', handlePickerReturn);
            window.removeEventListener('pageshow', handlePickerReturn);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
        };
    });

    function triggerImport() {
        const input = importInputRef.current;

        if (!input || importInProgressRef.current) {
            return;
        }

        input.value = '';
        lastImportAttemptRef.current = {
            signature: '',
            timestamp: 0,
        };

        try {
            if (typeof input.showPicker === 'function') {
                input.showPicker();
                return;
            }
        } catch (error) {
            console.warn('Native file picker unavailable, using click fallback:', error);
        }

        input.click();
    }

    function handleResetLocalData() {
        handleStartNewTournament();
    }

    function handleFinalStageTeamChange(stageKey, matchIndex, field, teamId) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                assignStageTeam(prev || createEmptyFinalStage(), stageKey, matchIndex, field, teamId),
                allTeams
            )
        );
    }

    function handleQuarterTeamChange(matchIndex, field, teamId) {
        handleFinalStageTeamChange('quarterFinals', matchIndex, field, teamId);
    }

    function handleFinalMatchScore(stageKey, matchIndex, field, value) {
        setFinalStage((prev) =>
            syncFinalStageWithTeams(
                updateFinalStageMatch(prev || createEmptyFinalStage(), stageKey, matchIndex, field, value),
                allTeams
            )
        );
    }


    function handleMatchFormatChange(value) {
        const nextFormat = sanitizeMatchFormatKey(value);
        setMatchFormatKey(nextFormat);
        setStoredMatchFormat(nextFormat);
    }

    return {
        matchFormatKey,
        selectedMatchFormatKey: matchFormatKey,
        formatKey: matchFormatKey,
        handleMatchFormatChange,
        onMatchFormatChange: handleMatchFormatChange,
        setMatchFormatKey: handleMatchFormatChange,
        handleFinalMatchFormatChange,
        activePool,
        activeTab,
        allTeams,
        baseTeams,
        combinedPointsRanking,
        courtCount,
        courtLabels,
        displayBaseTeams,
        displayCourtLabel,
        displayMatchCourtLabel,
        editingBaseDraft,
        editingBaseTeamId,
        editingMatchCourtId,
        finalOnlyPointsRanking,
        finalOptionGroups,
        finalRanking,
        formatRank,
        formatSigned,
        getDisplayTeamNumber,
        getTeamLabelById,
        getTeamNameById,
        handleExportJson,
        handleSaveNamedTournament,
        handleLoadNamedTournament,
        handleDeleteNamedTournament,
        handleStartNewTournament,
        globalPlanning,
        handleAddManualBaseTeam,
        handleAddSerpentinRow,
        handleAutoFillSerpentin,
        handleAutoQuarterDraw,
        handleBaseDraftChange,
        handleCancelBaseEdit,
        handleChangeSerpentinValue,
        handleDeleteBaseTeam,
        handleDeletePool,
        handleDeleteSerpentinRow,
        handleFinalMatchScore,
        handleFinalQualifierModeChange,
        handleFinalStageEntryRoundChange,
        handleFinalStageTeamChange,
        handleMatchCourtOverrideChange,
        handleMatchScoreChange,
        handleNewBaseDraftChange,
        handleQuarterTeamChange,
        handleSaveBaseEdit,
        handleSerpentinDragEnd,
        handleStartBaseEdit,
        handleSwapPlayersInDraft,
        handleToggleQuarterPlacement,
        handleToggleSeedTeam,
        handleToggleThirdPlace,
        newBaseDraft,
        playableTeams,
        pools,
        rankedPools,
        ranking,
        safeFinalStage,
        starterFinalStageKey,
        seedTeamIds,
        seedTeamNumberById,
        seedTeams,
        selectedQuarterTeamIds,
        selectedStarterTeamIds,
        selectedSerpentinTeamIds,
        sensors,
        serpentin,
        setEditingMatchCourtId,
        handleAddPool,
        handleCourtLabelChange,
        handleImportFile,
        handleResetLocalData,
        importInputRef,
        lastSavedAt,
        savedTournaments,
        saveNotice,
        selectedTournamentSaveId,
        setSelectedTournamentSaveId,
        tournamentSaveName,
        setTournamentSaveName,
        isCourtSettingsOpen,
        newPoolName,
        resetCourtLabels,
        setActiveTab,
        setCourtCount,
        setIsCourtSettingsOpen,
        setNewPoolName,
        triggerImport,
    };

}
