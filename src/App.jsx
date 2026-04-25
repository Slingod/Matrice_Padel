import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import {
  FaEdit,
  FaExchangeAlt,
  FaFileCsv,
  FaFileExcel,
  FaPlus,
  FaRandom,
  FaSave,
  FaStar,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  computeRanking,
  createPool,
  createSerpentinEntry,
  getWinner,
  loadAppState,
  optimizeMatchOrder,
  saveAppState,
  syncMatchesPreserveScores,
} from './utils/tournament';
import {
  exportTournamentToCSV,
  exportTournamentToXLSX,
  importTournamentFile,
} from './utils/importExport';
import {
  assignQuarterTeam,
  buildFinalRanking,
  createEmptyFinalStage,
  getDisplayWinner,
  setFinalStageOption,
  syncFinalStageWithTeams,
  updateFinalStageMatch,
} from './utils/finalStage';

function SortableSerpentinRow({
                                entry,
                                baseTeams,
                                unavailableTeamIds,
                                getTeamLabelById,
                                onChange,
                                onDelete,
                              }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
      <div
          ref={setNodeRef}
          style={style}
          className={`serpentin-row ${isDragging ? 'dragging' : ''}`}
      >
        <button
            ref={setActivatorNodeRef}
            type="button"
            className="drag-handle"
            title="Glisser-déposer"
            {...attributes}
            {...listeners}
        >
          ↕
        </button>

        <select value={entry.value} onChange={(event) => onChange(event.target.value)}>
          <option value="">-- Sélectionner une équipe --</option>
          {baseTeams
              .filter((team) => team.id === entry.value || !unavailableTeamIds.has(team.id))
              .map((team) => (
                  <option key={team.id} value={team.id}>
                    {getTeamLabelById(team.id)}
                  </option>
              ))}
        </select>

        <button type="button" className="danger small-btn" onClick={onDelete}>
          <FaTrash />
        </button>
      </div>
  );
}

function FinalMatchCard({
                          title,
                          match,
                          getTeamNameById,
                          getTeamLabelById,
                          onScoreChange,
                          allGroups,
                          unavailableTeamIds = new Set(),
                          accent = '',
                          editableTeams = false,
                          onTeamChange,
                        }) {
  const winner = getDisplayWinner(match);

  const renderTeamOptions = (currentValue) =>
      allGroups.map((group) => {
        const availableTeams = group.teams.filter(
            (team) => team.id === currentValue || !unavailableTeamIds.has(team.id)
        );

        if (availableTeams.length === 0) return null;

        return (
            <optgroup key={group.id} label={group.name}>
              {availableTeams.map((team, teamIndex) => (
                  <option key={team.id} value={team.id}>
                    {group.name} #{teamIndex + 1} — {getTeamLabelById(team.id)}
                  </option>
              ))}
            </optgroup>
        );
      });

  return (
      <div className={`bracket-match ${accent}`}>
        <div className="bracket-match-header">{title}</div>

        <div className={`bracket-team-row ${winner === 'A' ? 'winner' : ''}`}>
          {editableTeams ? (
              <select
                  value={match.teamAId}
                  onChange={(event) => onTeamChange('teamAId', event.target.value)}
              >
                <option value="">-- Sélectionner une équipe --</option>
                {renderTeamOptions(match.teamAId)}
              </select>
          ) : (
              <span className="bracket-team-name">
            {getTeamNameById(match.teamAId) || 'À définir'}
          </span>
          )}

          <input
              type="number"
              min="0"
              value={match.scoreA}
              onChange={(event) => onScoreChange('scoreA', event.target.value)}
          />
        </div>

        <div className="bracket-vs">vs</div>

        <div className={`bracket-team-row ${winner === 'B' ? 'winner' : ''}`}>
          {editableTeams ? (
              <select
                  value={match.teamBId}
                  onChange={(event) => onTeamChange('teamBId', event.target.value)}
              >
                <option value="">-- Sélectionner une équipe --</option>
                {renderTeamOptions(match.teamBId)}
              </select>
          ) : (
              <span className="bracket-team-name">
            {getTeamNameById(match.teamBId) || 'À définir'}
          </span>
          )}

          <input
              type="number"
              min="0"
              value={match.scoreB}
              onChange={(event) => onScoreChange('scoreB', event.target.value)}
          />
        </div>
      </div>
  );
}

function syncPoolsFromSerpentin(baseTeams, previousPools, serpentinMap) {
  const teamMap = new Map(baseTeams.map((team) => [team.id, team]));

  return previousPools.map((pool) => {
    const selectedIds = (serpentinMap[pool.id] || [])
        .map((entry) => entry.value)
        .filter(Boolean);

    const uniqueIds = [...new Set(selectedIds)];
    const teams = uniqueIds.map((teamId) => teamMap.get(teamId)).filter(Boolean);

    return {
      ...pool,
      teams,
      matches: syncMatchesPreserveScores(teams, pool.matches),
    };
  });
}

function createCombinedStatRow(team) {
  return {
    teamId: team.id,
    teamName: team.name,
    cumulativeRank: team.cumulativeRank || 0,
    played: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    totalScore: 0,
  };
}

function applyMatchToStats(statMap, teamAId, teamBId, scoreAValue, scoreBValue) {
  const scoreA = Number(scoreAValue);
  const scoreB = Number(scoreBValue);

  const isValid =
      teamAId &&
      teamBId &&
      scoreAValue !== '' &&
      scoreBValue !== '' &&
      Number.isFinite(scoreA) &&
      Number.isFinite(scoreB);

  if (!isValid) return;

  const teamA = statMap.get(teamAId);
  const teamB = statMap.get(teamBId);

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
}

function buildTeamFromDraft(draft, existingId) {
  const player1Rank = Number(draft.player1Rank) || 0;
  const player2Rank = Number(draft.player2Rank) || 0;

  return {
    id: existingId,
    number: String(draft.number || '').trim(),
    name: String(draft.displayName || '').trim(),
    fullName: String(draft.displayName || '').trim(),
    matchLabel: String(draft.displayName || '').trim(),
    players: [
      {
        id: `${existingId}-p1`,
        slot: 'J1',
        name: String(draft.player1Name || '').trim(),
        rank: player1Rank,
      },
      {
        id: `${existingId}-p2`,
        slot: 'J2',
        name: String(draft.player2Name || '').trim(),
        rank: player2Rank,
      },
    ],
    cumulativeRank: player1Rank + player2Rank,
    isSeed: Boolean(draft.isSeed),
  };
}

function getInitialDraftFromTeam(team) {
  return {
    number: team.number || '',
    displayName: team.name || '',
    player1Name: team.players?.[0]?.name || '',
    player1Rank: String(team.players?.[0]?.rank ?? ''),
    player2Name: team.players?.[1]?.name || '',
    player2Rank: String(team.players?.[1]?.rank ?? ''),
    isSeed: Boolean(team.isSeed),
  };
}


function clearTeamFromFinalStage(stage, teamId) {
  const clearMatch = (match = {}) => {
    const hasTeamA = match.teamAId === teamId;
    const hasTeamB = match.teamBId === teamId;

    if (!hasTeamA && !hasTeamB) return match;

    return {
      ...match,
      teamAId: hasTeamA ? '' : match.teamAId,
      teamBId: hasTeamB ? '' : match.teamBId,
      scoreA: '',
      scoreB: '',
    };
  };

  const baseStage = stage || createEmptyFinalStage();

  return {
    ...baseStage,
    quarterFinals: (baseStage.quarterFinals || []).map(clearMatch),
    semiFinals: (baseStage.semiFinals || []).map(clearMatch),
    final: clearMatch(baseStage.final),
    thirdPlace: clearMatch(baseStage.thirdPlace),
    placement5to8Semis: (baseStage.placement5to8Semis || []).map(clearMatch),
    placement5to8Finals: {
      place5: clearMatch(baseStage.placement5to8Finals?.place5),
      place7: clearMatch(baseStage.placement5to8Finals?.place7),
    },
  };
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

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


function getOriginalTeamOrderNumber(team) {
  return Number(String(team?.number || '').match(/(\d+)/)?.[1] || 0);
}

function getSeedTeams(teams) {
  return [...teams]
      .filter((team) => Boolean(team.isSeed))
      .sort((a, b) => {
        const aRank = Number(a.cumulativeRank) || 999999999;
        const bRank = Number(b.cumulativeRank) || 999999999;
        if (aRank !== bRank) return aRank - bRank;

        const aNum = getOriginalTeamOrderNumber(a);
        const bNum = getOriginalTeamOrderNumber(b);
        if (aNum !== bNum) return aNum - bNum;

        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });
}

function buildBalancedRandomSerpentin(playableTeams, pools) {
  if (!pools.length) return {};

  const sortedTeams = [...playableTeams].sort((a, b) => {
    const aRank = Number(a.cumulativeRank) || 999999999;
    const bRank = Number(b.cumulativeRank) || 999999999;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  });

  const poolIds = pools.map((pool) => pool.id);
  const assignments = Object.fromEntries(poolIds.map((poolId) => [poolId, []]));

  sortedTeams.forEach((team, index) => {
    const block = Math.floor(index / poolIds.length);
    const position = index % poolIds.length;
    const poolIndex = block % 2 === 0 ? position : poolIds.length - 1 - position;
    assignments[poolIds[poolIndex]].push(createSerpentinEntry(team.id));
  });

  return Object.fromEntries(
      pools.map((pool) => {
        const rows = assignments[pool.id] || [];
        return [pool.id, rows.length > 0 ? rows : [createSerpentinEntry('')]];
      })
  );
}

function pairSeedsWithOpponents(seedSlots, opponents) {
  const recurse = (index, remainingOpponents, acc) => {
    if (index >= seedSlots.length) return acc;

    const seed = seedSlots[index];

    const preferred = remainingOpponents.filter(
        (candidate) => !seed.poolId || !candidate.poolId || seed.poolId !== candidate.poolId
    );

    const ordered = [
      ...preferred,
      ...remainingOpponents.filter((item) => !preferred.includes(item)),
    ];

    for (const opponent of ordered) {
      const nextRemaining = remainingOpponents.filter((item) => item.teamId !== opponent.teamId);
      const result = recurse(index + 1, nextRemaining, [...acc, [seed, opponent]]);
      if (result) return result;
    }

    return null;
  };

  return recurse(0, opponents, []) || [];
}

function buildAutoQuarterDraw({ rankedPools, allTeams }) {
  const tsTeams = getSeedTeams(allTeams)
      .slice(0, 4)
      .map((team, index) => ({
        teamId: team.id,
        teamName: team.name,
        cumulativeRank: team.cumulativeRank || 0,
        poolId: null,
        poolName: 'TS',
        type: 'ts',
        tsNumber: index + 1,
      }));

  const usedTsIds = new Set(tsTeams.map((team) => team.teamId));

  const qualifiedFromPools = rankedPools
      .flatMap((pool) =>
          pool.ranking
              .filter((team) => !usedTsIds.has(team.teamId))
              .map((team, rankIndex) => ({
                teamId: team.teamId,
                teamName: team.teamName,
                cumulativeRank: team.cumulativeRank || 0,
                poolId: pool.id,
                poolName: pool.name,
                poolRank: rankIndex + 1,
                wins: team.wins || 0,
                totalScore: team.totalScore || 0,
                diff: team.diff || 0,
                pointsFor: team.pointsFor || 0,
                type: rankIndex === 0 ? 'winner' : rankIndex === 1 ? 'second' : 'extra',
              }))
      )
      .sort((a, b) => {
        if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
      });

  const tsByNumber = {
    1: tsTeams.find((team) => team.tsNumber === 1) || null,
    2: tsTeams.find((team) => team.tsNumber === 2) || null,
    3: tsTeams.find((team) => team.tsNumber === 3) || null,
    4: tsTeams.find((team) => team.tsNumber === 4) || null,
  };

  // Ordre FÉDÉ figé :
  // Quart 1 = TS2 en haut
  // Quart 2 = TS3 en haut
  // Quart 3 = TS4 en bas
  // Quart 4 = TS1 en bas
  const fixedSeedSlots = [
    { seed: tsByNumber[2], seedPosition: 'A' }, // Q1
    { seed: tsByNumber[3], seedPosition: 'A' }, // Q2
    { seed: tsByNumber[4], seedPosition: 'B' }, // Q3
    { seed: tsByNumber[1], seedPosition: 'B' }, // Q4
  ];

  const qualifiedQueue = [...qualifiedFromPools];
  const seededSlots = fixedSeedSlots.map((slot) => {
    if (slot.seed) return slot;
    const fallback = qualifiedQueue.shift() || null;
    return fallback ? { seed: fallback, seedPosition: slot.seedPosition } : null;
  });

  if (seededSlots.some((slot) => !slot?.seed)) return [];

  const seededIds = new Set(seededSlots.map((slot) => slot.seed.teamId));
  const remainingOpponents = qualifiedQueue.filter((team) => !seededIds.has(team.teamId));

  if (remainingOpponents.length < 4) return [];

  const findOpponent = (seed, available) => {
    const differentPool = available.find(
        (candidate) => !seed.poolId || !candidate.poolId || candidate.poolId !== seed.poolId
    );

    return differentPool || available[0] || null;
  };

  const pickedOpponents = [];
  let availableOpponents = [...remainingOpponents];

  for (const slot of seededSlots) {
    const opponent = findOpponent(slot.seed, availableOpponents);
    if (!opponent) return [];

    pickedOpponents.push(opponent);
    availableOpponents = availableOpponents.filter((item) => item.teamId !== opponent.teamId);
  }

  return seededSlots.map((slot, index) => {
    const opponent = pickedOpponents[index];

    if (slot.seedPosition === 'B') {
      return {
        teamAId: opponent?.teamId || '',
        teamBId: slot.seed.teamId,
        scoreA: '',
        scoreB: '',
      };
    }

    return {
      teamAId: slot.seed.teamId,
      teamBId: opponent?.teamId || '',
      scoreA: '',
      scoreB: '',
    };
  });
}

function App() {
  const initialState = useMemo(() => loadAppState(), []);
  const [baseTeams, setBaseTeams] = useState(initialState.baseTeams || []);
  const [pools, setPools] = useState(initialState.pools);
  const [serpentin, setSerpentin] = useState(initialState.serpentin);
  const [activeTab, setActiveTab] = useState(initialState.activeTab);
  const [courtCount, setCourtCount] = useState(initialState.courtCount || 4);

  const [newPoolName, setNewPoolName] = useState('');
  const [editingBaseTeamId, setEditingBaseTeamId] = useState(null);
  const [editingBaseDraft, setEditingBaseDraft] = useState(null);
  const [newBaseDraft, setNewBaseDraft] = useState(() => getInitialDraftFromTeam({}));

  const importInputRef = useRef(null);

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
    saveAppState({
      baseTeams,
      pools,
      serpentin,
      activeTab,
      finalStage: safeFinalStage,
      courtCount,
    });
  }, [baseTeams, pools, serpentin, activeTab, safeFinalStage, courtCount]);

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
        applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
      });
    });

    safeFinalStage.quarterFinals.forEach((match) => {
      applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
    });

    safeFinalStage.semiFinals.forEach((match) => {
      applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
    });

    applyMatchToStats(
        statMap,
        safeFinalStage.final.teamAId,
        safeFinalStage.final.teamBId,
        safeFinalStage.final.scoreA,
        safeFinalStage.final.scoreB
    );

    if (safeFinalStage.settings.enableThirdPlaceMatch) {
      applyMatchToStats(
          statMap,
          safeFinalStage.thirdPlace.teamAId,
          safeFinalStage.thirdPlace.teamBId,
          safeFinalStage.thirdPlace.scoreA,
          safeFinalStage.thirdPlace.scoreB
      );
    }

    if (safeFinalStage.settings.enablePlacement5to8) {
      safeFinalStage.placement5to8Semis.forEach((match) => {
        applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
      });

      applyMatchToStats(
          statMap,
          safeFinalStage.placement5to8Finals.place5.teamAId,
          safeFinalStage.placement5to8Finals.place5.teamBId,
          safeFinalStage.placement5to8Finals.place5.scoreA,
          safeFinalStage.placement5to8Finals.place5.scoreB
      );

      applyMatchToStats(
          statMap,
          safeFinalStage.placement5to8Finals.place7.teamAId,
          safeFinalStage.placement5to8Finals.place7.teamBId,
          safeFinalStage.placement5to8Finals.place7.scoreA,
          safeFinalStage.placement5to8Finals.place7.scoreB
      );
    }

    return [...statMap.values()]
        .filter(
            (team) =>
                team.played > 0 ||
                team.pointsFor > 0 ||
                team.pointsAgainst > 0 ||
                team.totalScore !== 0
        )
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          if (b.diff !== a.diff) return b.diff - a.diff;
          return b.pointsFor - a.pointsFor;
        });
  }, [allTeams, pools, safeFinalStage]);

  const finalOnlyPointsRanking = useMemo(() => {
    const statMap = new Map(allTeams.map((team) => [team.id, createCombinedStatRow(team)]));

    safeFinalStage.quarterFinals.forEach((match) => {
      applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
    });

    safeFinalStage.semiFinals.forEach((match) => {
      applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
    });

    applyMatchToStats(
        statMap,
        safeFinalStage.final.teamAId,
        safeFinalStage.final.teamBId,
        safeFinalStage.final.scoreA,
        safeFinalStage.final.scoreB
    );

    if (safeFinalStage.settings.enableThirdPlaceMatch) {
      applyMatchToStats(
          statMap,
          safeFinalStage.thirdPlace.teamAId,
          safeFinalStage.thirdPlace.teamBId,
          safeFinalStage.thirdPlace.scoreA,
          safeFinalStage.thirdPlace.scoreB
      );
    }

    if (safeFinalStage.settings.enablePlacement5to8) {
      safeFinalStage.placement5to8Semis.forEach((match) => {
        applyMatchToStats(statMap, match.teamAId, match.teamBId, match.scoreA, match.scoreB);
      });

      applyMatchToStats(
          statMap,
          safeFinalStage.placement5to8Finals.place5.teamAId,
          safeFinalStage.placement5to8Finals.place5.teamBId,
          safeFinalStage.placement5to8Finals.place5.scoreA,
          safeFinalStage.placement5to8Finals.place5.scoreB
      );

      applyMatchToStats(
          statMap,
          safeFinalStage.placement5to8Finals.place7.teamAId,
          safeFinalStage.placement5to8Finals.place7.teamBId,
          safeFinalStage.placement5to8Finals.place7.scoreA,
          safeFinalStage.placement5to8Finals.place7.scoreB
      );
    }

    return [...statMap.values()]
        .filter(
            (team) =>
                team.played > 0 ||
                team.pointsFor > 0 ||
                team.pointsAgainst > 0 ||
                team.totalScore !== 0
        )
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.diff !== a.diff) return b.diff - a.diff;
          if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
          return (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999);
        });
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

  function handleMatchScoreChange(matchId, field, value) {
    if (!activePool) return;

    const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));

    setPools((prev) =>
        prev.map((pool) =>
            pool.id !== activePool.id
                ? pool
                : {
                  ...pool,
                  matches: pool.matches.map((match) =>
                      match.id === matchId ? { ...match, [field]: sanitized } : match
                  ),
                }
        )
    );
  }

  function handleOptimizeMatches() {
    if (!activePool) return;

    setPools((prev) =>
        prev.map((pool) =>
            pool.id !== activePool.id
                ? pool
                : {
                  ...pool,
                  matches: optimizeMatchOrder(pool.matches),
                }
        )
    );
  }

  function handleAutoQuarterDraw() {
    const draw = buildAutoQuarterDraw({ rankedPools, allTeams });

    if (!draw.length) {
      alert('Pas assez d’équipes qualifiées pour générer automatiquement la phase finale.');
      return;
    }

    setFinalStage((prev) => {
      const baseStage = syncFinalStageWithTeams(prev || createEmptyFinalStage(), allTeams);

      const nextQuarterFinals = baseStage.quarterFinals.map((match, index) => {
        const source = draw[index];

        return {
          ...match,
          teamAId: source?.teamAId || '',
          teamBId: source?.teamBId || '',
          scoreA: '',
          scoreB: '',
        };
      });

      const nextStage = {
        ...baseStage,
        quarterFinals: nextQuarterFinals,
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

      return syncFinalStageWithTeams(nextStage, allTeams);
    });
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

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
        'Importer ce fichier va remplacer les données actuelles. Continuer ?'
    );

    if (!confirmed) {
      event.target.value = '';
      return;
    }

    try {
      const imported = await importTournamentFile(file);
      setBaseTeams(imported.baseTeams || []);
      setPools(imported.pools || []);
      setSerpentin(imported.serpentin || {});
      setActiveTab(imported.activeTab || 'base');
      setFinalStage(imported.finalStage || createEmptyFinalStage());
      setCourtCount(imported.courtCount || 4);
      setEditingBaseTeamId(null);
      setEditingBaseDraft(null);
    } catch (error) {
      console.error(error);
      alert("Impossible d'importer ce fichier.");
    }

    event.target.value = '';
  }

  function triggerImport() {
    importInputRef.current?.click();
  }

  function handleResetLocalData() {
    const confirmed = window.confirm(
        'Réinitialiser l’application et repartir sur une base propre ?'
    );

    if (!confirmed) return;

    localStorage.removeItem('matrice-padel-v8');
    window.location.reload();
  }

  function handleQuarterTeamChange(matchIndex, field, teamId) {
    setFinalStage((prev) =>
        syncFinalStageWithTeams(
            assignQuarterTeam(prev || createEmptyFinalStage(), matchIndex, field, teamId),
            allTeams
        )
    );
  }

  function handleFinalMatchScore(stageKey, matchIndex, field, value) {
    setFinalStage((prev) =>
        syncFinalStageWithTeams(
            updateFinalStageMatch(prev || createEmptyFinalStage(), stageKey, matchIndex, field, value),
            allTeams
        )
    );
  }

  return (
      <div className="app">
        <header className="hero">
          <div>
            <p className="badge">Matrice PADEL</p>
            <h1>Gestion des matchs et classement automatique</h1>
            <p className="subtitle">
              Import XLSX / CSV, base joueurs modifiable, serpentin manuel, poules automatiques,
              rotations simultanées, phase finale et classement final.
            </p>
          </div>
        </header>

        <section className="tabs-card">
          <div className="tabs">
            <button
                type="button"
                className={`tab-button ${activeTab === 'base' ? 'active' : ''}`}
                onClick={() => setActiveTab('base')}
            >
              Base
            </button>

            <button
                type="button"
                className={`tab-button ${activeTab === 'serpentin' ? 'active' : ''}`}
                onClick={() => setActiveTab('serpentin')}
            >
              Serpentin
            </button>

            <button
                type="button"
                className={`tab-button ${activeTab === 'planning' ? 'active' : ''}`}
                onClick={() => setActiveTab('planning')}
            >
              Planning
            </button>

            {pools.map((pool) => (
                <button
                    key={pool.id}
                    type="button"
                    className={`tab-button ${activeTab === pool.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(pool.id)}
                >
                  {pool.name}
                </button>
            ))}

            <button
                type="button"
                className={`tab-button ${activeTab === 'finals' ? 'active' : ''}`}
                onClick={() => setActiveTab('finals')}
            >
              Phase finale
            </button>

            <button
                type="button"
                className={`tab-button ${activeTab === 'final-ranking' ? 'active' : ''}`}
                onClick={() => setActiveTab('final-ranking')}
            >
              Classement final
            </button>
          </div>

          <div className="top-actions-grid">
            <form className="add-pool-form" onSubmit={handleAddPool}>
              <input
                  type="text"
                  placeholder="Nouvelle poule"
                  value={newPoolName}
                  onChange={(event) => setNewPoolName(event.target.value)}
              />
              <button type="submit">
                <FaPlus />
                Ajouter une Poule
              </button>
            </form>

            <div className="export-actions">
              <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleImportFile}
                  hidden
              />

              <button type="button" onClick={triggerImport}>
                Importer XLSX / CSV
              </button>

              <label
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}
              >
                Terrains dispo
                <input
                    type="number"
                    min="1"
                    value={courtCount}
                    onChange={(event) => setCourtCount(Math.max(1, Number(event.target.value) || 1))}
                    style={{ width: 90 }}
                />
              </label>

              <button
                  type="button"
                  onClick={() =>
                      exportTournamentToCSV(
                          baseTeams,
                          pools,
                          serpentin,
                          safeFinalStage,
                          finalRanking,
                          combinedPointsRanking,
                          courtCount
                      )
                  }
              >
                <FaFileCsv />
                Exporter CSV
              </button>

              <button
                  type="button"
                  onClick={() =>
                      exportTournamentToXLSX(
                          baseTeams,
                          pools,
                          serpentin,
                          safeFinalStage,
                          finalRanking,
                          combinedPointsRanking,
                          courtCount
                      )
                  }
              >
                <FaFileExcel />
                Exporter XLSX
              </button>

              <button type="button" className="danger" onClick={handleResetLocalData}>
                <FaTrash />
                Réinitialiser
              </button>
            </div>
          </div>
        </section>

        {activeTab === 'base' ? (
            <section className="card full-width">
              <div className="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Équipe</th>
                    <th>Nom affiché</th>
                    <th>Joueur 1</th>
                    <th>Rang 1</th>
                    <th>Joueur 2</th>
                    <th>Rang 2</th>
                    <th>Rang cumulé</th>
                    <th>Actions</th>
                  </tr>
                  </thead>
                  <tbody>
                  {displayBaseTeams.length === 0 ? (
                      <tr>
                        <td colSpan="8">Aucune donnée importée pour le moment.</td>
                      </tr>
                  ) : (
                      displayBaseTeams.map((team) => {
                        const isEditing = editingBaseTeamId === team.id;
                        const liveTotal = isEditing
                            ? (Number(editingBaseDraft?.player1Rank) || 0) +
                            (Number(editingBaseDraft?.player2Rank) || 0)
                            : team.cumulativeRank;

                        return (
                            <tr key={team.id}>
                              <td>
                                <div className="team-number-with-seed">
                                  <button
                                      type="button"
                                      className={`icon-btn seed-star ${team.isSeed ? 'active' : ''}`}
                                      title={team.isSeed ? 'Retirer cette équipe des têtes de série / VIP' : 'Marquer cette équipe en tête de série / VIP'}
                                      onClick={() => handleToggleSeedTeam(team)}
                                  >
                                    <FaStar />
                                  </button>
                                  {isEditing ? (
                                      <input
                                          type="text"
                                          value={editingBaseDraft.number}
                                          onChange={(event) => handleBaseDraftChange('number', event.target.value)}
                                      />
                                  ) : (
                                      <span>{getDisplayTeamNumber(team)}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingBaseDraft.displayName}
                                        onChange={(event) =>
                                            handleBaseDraftChange('displayName', event.target.value)
                                        }
                                    />
                                ) : (
                                    team.name
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingBaseDraft.player1Name}
                                        onChange={(event) =>
                                            handleBaseDraftChange('player1Name', event.target.value)
                                        }
                                    />
                                ) : (
                                    team.players?.[0]?.name || ''
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingBaseDraft.player1Rank}
                                        onChange={(event) =>
                                            handleBaseDraftChange('player1Rank', event.target.value)
                                        }
                                    />
                                ) : team.players?.[0]?.rank ? (
                                    formatRank(team.players[0].rank)
                                ) : (
                                    ''
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingBaseDraft.player2Name}
                                        onChange={(event) =>
                                            handleBaseDraftChange('player2Name', event.target.value)
                                        }
                                    />
                                ) : (
                                    team.players?.[1]?.name || ''
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingBaseDraft.player2Rank}
                                        onChange={(event) =>
                                            handleBaseDraftChange('player2Rank', event.target.value)
                                        }
                                    />
                                ) : team.players?.[1]?.rank ? (
                                    formatRank(team.players[1].rank)
                                ) : (
                                    ''
                                )}
                              </td>
                              <td>{liveTotal ? formatRank(liveTotal) : ''}</td>
                              <td>
                                <div className="team-actions">
                                  {isEditing ? (
                                      <>
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            title="Inverser Joueur 1 / Joueur 2"
                                            onClick={handleSwapPlayersInDraft}
                                        >
                                          <FaExchangeAlt />
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn"
                                            title="Enregistrer"
                                            onClick={() => handleSaveBaseEdit(team.id)}
                                        >
                                          <FaSave />
                                        </button>
                                        <button
                                            type="button"
                                            className="danger small-btn"
                                            title="Supprimer cette équipe de la base, des poules et de la phase finale"
                                            onClick={() => handleDeleteBaseTeam(team)}
                                        >
                                          <FaTrash />
                                        </button>
                                        <button
                                            type="button"
                                            className="danger small-btn"
                                            title="Annuler"
                                            onClick={handleCancelBaseEdit}
                                        >
                                          <FaTimes />
                                        </button>
                                      </>
                                  ) : (
                                      <button
                                          type="button"
                                          className="icon-btn"
                                          title="Modifier"
                                          onClick={() => handleStartBaseEdit(team)}
                                      >
                                        <FaEdit />
                                      </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                        );
                      })
                  )}
                  </tbody>
                </table>
              </div>

              <hr style={{ margin: '28px 0', opacity: 0.18 }} />

              <h2>Base équipes / joueurs</h2>
              <p className="note">
                Tu peux modifier les joueurs, leurs rangs, le nom affiché, inverser Joueur 1 / Joueur 2, ou cliquer sur l’étoile devant une équipe pour la passer en TS / VIP.
                Les équipes classiques sont renumérotées automatiquement, et les têtes de série sont affichées en TS 1, TS 2, etc.
              </p>

              <form className="manual-team-form" onSubmit={handleAddManualBaseTeam}>
                <input
                    type="text"
                    placeholder="N° équipe (optionnel)"
                    value={newBaseDraft.number}
                    onChange={(event) => handleNewBaseDraftChange('number', event.target.value)}
                />
                <input
                    type="text"
                    placeholder="Nom affiché / équipe"
                    value={newBaseDraft.displayName}
                    onChange={(event) => handleNewBaseDraftChange('displayName', event.target.value)}
                />
                <input
                    type="text"
                    placeholder="Joueur 1"
                    value={newBaseDraft.player1Name}
                    onChange={(event) => handleNewBaseDraftChange('player1Name', event.target.value)}
                />
                <input
                    type="number"
                    min="0"
                    placeholder="Rang 1"
                    value={newBaseDraft.player1Rank}
                    onChange={(event) => handleNewBaseDraftChange('player1Rank', event.target.value)}
                />
                <input
                    type="text"
                    placeholder="Joueur 2"
                    value={newBaseDraft.player2Name}
                    onChange={(event) => handleNewBaseDraftChange('player2Name', event.target.value)}
                />
                <input
                    type="number"
                    min="0"
                    placeholder="Rang 2"
                    value={newBaseDraft.player2Rank}
                    onChange={(event) => handleNewBaseDraftChange('player2Rank', event.target.value)}
                />
                <button type="submit">
                  <FaPlus />
                  Ajouter manuellement
                </button>
              </form>

            </section>
        ) : activeTab === 'serpentin' ? (
            <section className="card full-width">
              <h2>Serpentin</h2>
              <p className="note">
                L’arbitre peut placer les équipes manuellement ou remplir le serpentin automatiquement selon l’ordre officiel.
                Les têtes de série restent hors poules et ne sont jamais proposées dans le serpentin.
              </p>

              <div className="serpentin-toolbar">
                <button type="button" onClick={handleAutoFillSerpentin} disabled={playableTeams.length === 0}>
                  <FaRandom />
                  Remplir serpentin
                </button>


                <span className="serpentin-summary">
                  {playableTeams.length} équipe(s) à répartir dans {pools.length} poule(s)
                </span>
              </div>

              <div className="serpentin-grid">
                {pools.map((pool) => (
                    <div key={pool.id} className="serpentin-column">
                      <div className="pool-header">
                        <h3>{pool.name}</h3>
                        <div className="pool-header-actions">
                          <button
                              type="button"
                              className="danger small-btn"
                              title="Supprimer la poule"
                              onClick={() => handleDeletePool(pool.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>

                      <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleSerpentinDragEnd(pool.id, event)}
                      >
                        <SortableContext
                            items={(serpentin[pool.id] || []).map((entry) => entry.id)}
                            strategy={verticalListSortingStrategy}
                        >
                          <div className="serpentin-list">
                            {(serpentin[pool.id] || []).map((entry) => (
                                <SortableSerpentinRow
                                    key={entry.id}
                                    entry={entry}
                                    baseTeams={playableTeams}
                                    unavailableTeamIds={selectedSerpentinTeamIds}
                                    getTeamLabelById={getTeamLabelById}
                                    onChange={(value) => handleChangeSerpentinValue(pool.id, entry.id, value)}
                                    onDelete={() => handleDeleteSerpentinRow(pool.id, entry.id)}
                                />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>

                      <button type="button" onClick={() => handleAddSerpentinRow(pool.id)}>
                        Ajouter une ligne
                      </button>
                    </div>
                ))}
              </div>

              <div className="seed-table-block">
                <h3>Têtes de série / VIP hors serpentin</h3>
                <p className="note">
                  Ces équipes ont été marquées avec l’étoile TS / VIP dans la Base. Elles restent disponibles pour la phase finale,
                  mais ne sont pas placées dans les poules ni proposées dans le serpentin.
                </p>
                <div className="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>TS</th>
                      <th>Équipe</th>
                      <th>Joueur 1</th>
                      <th>Joueur 2</th>
                      <th>Rang cumulé</th>
                    </tr>
                    </thead>
                    <tbody>
                    {seedTeams.length === 0 ? (
                        <tr>
                          <td colSpan="5">Aucune tête de série définie.</td>
                        </tr>
                    ) : (
                        seedTeams.map((team, index) => (
                            <tr key={team.id}>
                              <td>TS{index + 1}</td>
                              <td>{team.name}</td>
                              <td>{team.players?.[0]?.name || ''}</td>
                              <td>{team.players?.[1]?.name || ''}</td>
                              <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
        ) : activeTab === 'planning' ? (
            <section className="card full-width">
              <h2>Planning global des rotations</h2>
              <p className="note">
                Ce planning répartit les matchs de chaque poule sur les terrains disponibles.
                Les rotations restent respectées en arrière-plan, mais l’affichage est présenté ici match par match.
              </p>

              <div className="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Match</th>
                    <th>Poule</th>
                    <th>Terrain</th>
                    <th>Équipe 1</th>
                    <th>Équipe 2</th>
                  </tr>
                  </thead>
                  <tbody>
                  {globalPlanning.length === 0 ? (
                      <tr>
                        <td colSpan="5">Aucun planning disponible pour le moment.</td>
                      </tr>
                  ) : (
                      globalPlanning.map((row, index) => (
                          <tr key={`${row.slot}-${row.terrain}-${index}`}>
                            <td>{index + 1}</td>
                            <td>{row.poolName}</td>
                            <td>{row.terrain}</td>
                            <td>{getTeamNameById(row.match.teamAId)}</td>
                            <td>{getTeamNameById(row.match.teamBId)}</td>
                          </tr>
                      ))
                  )}
                  </tbody>
                </table>
              </div>
            </section>
        ) : activeTab === 'finals' ? (
            <section className="card full-width">
              <div className="section-head">
                <div>
                  <h2>Quarts/Demi/Final</h2>
                  <p className="note">
                    Sélectionne qui joue contre qui, puis saisis les scores pour faire avancer
                    automatiquement les vainqueurs.
                  </p>
                </div>

                <div className="team-actions">
                  <button type="button" className="icon-btn" onClick={handleAutoQuarterDraw}>
                    <FaRandom />
                    Tirage automatique
                  </button>
                  <button type="button" className="icon-btn" onClick={handleToggleThirdPlace}>
                    {safeFinalStage.settings.enableThirdPlaceMatch
                        ? 'Petite finale: ON'
                        : 'Petite finale: OFF'}
                  </button>
                  <button type="button" className="icon-btn" onClick={handleToggleQuarterPlacement}>
                    {safeFinalStage.settings.enablePlacement5to8
                        ? 'Classement 5-8: ON'
                        : 'Classement 5-8: OFF'}
                  </button>
                </div>
              </div>

              <div className="bracket-board">
                <div className="bracket-column">
                  <div className="bracket-column-title">Quarts de finale</div>
                  {safeFinalStage.quarterFinals.map((match, index) => (
                      <FinalMatchCard
                          key={match.id}
                          title={`Quart ${index + 1}`}
                          match={match}
                          editableTeams={true}
                          allGroups={finalOptionGroups}
                          unavailableTeamIds={selectedQuarterTeamIds}
                          getTeamNameById={getTeamNameById}
                          getTeamLabelById={getTeamLabelById}
                          onTeamChange={(field, value) => handleQuarterTeamChange(index, field, value)}
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('quarterFinals', index, field, value)
                          }
                      />
                  ))}
                </div>

                <div className="bracket-column bracket-column-middle">
                  <div className="bracket-column-title">Demi-finales</div>
                  {safeFinalStage.semiFinals.map((match, index) => (
                      <FinalMatchCard
                          key={match.id}
                          title={`Demi ${index + 1}`}
                          match={match}
                          accent="accent-blue"
                          allGroups={finalOptionGroups}
                          getTeamNameById={getTeamNameById}
                          getTeamLabelById={getTeamLabelById}
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('semiFinals', index, field, value)
                          }
                      />
                  ))}
                </div>

                <div className="bracket-column bracket-column-finals">
                  <div className="bracket-column-title">Finale</div>
                  <FinalMatchCard
                      title="Finale"
                      match={safeFinalStage.final}
                      accent="accent-gold"
                      allGroups={finalOptionGroups}
                      getTeamNameById={getTeamNameById}
                      getTeamLabelById={getTeamLabelById}
                      onScoreChange={(field, value) => handleFinalMatchScore('final', 0, field, value)}
                  />
                </div>
              </div>

              {safeFinalStage.settings.enableThirdPlaceMatch ? (
                  <div className="card planning-card">
                    <h2>Petite finale (3e / 4e place)</h2>
                    <FinalMatchCard
                        title="Petite finale"
                        match={safeFinalStage.thirdPlace}
                        accent="accent-blue"
                        allGroups={finalOptionGroups}
                        getTeamNameById={getTeamNameById}
                        getTeamLabelById={getTeamLabelById}
                        onScoreChange={(field, value) =>
                            handleFinalMatchScore('thirdPlace', 0, field, value)
                        }
                    />
                  </div>
              ) : null}

              {safeFinalStage.settings.enablePlacement5to8 ? (
                  <div className="card planning-card">
                    <h2>Classement 5e à 8e</h2>
                    <p className="note">
                      Les perdants des quarts jouent des matchs de classement. Sans match supplémentaire,
                      ils seront départagés uniquement sur leurs points de phase finale puis sur la
                      différence de points.
                    </p>

                    <div
                        className="bracket-board"
                        style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1rem' }}
                    >
                      {safeFinalStage.placement5to8Semis.map((match, index) => (
                          <FinalMatchCard
                              key={match.id}
                              title={`Classement ${index + 1}`}
                              match={match}
                              accent="accent-blue"
                              allGroups={finalOptionGroups}
                              getTeamNameById={getTeamNameById}
                              getTeamLabelById={getTeamLabelById}
                              onScoreChange={(field, value) =>
                                  handleFinalMatchScore('placement5to8Semis', index, field, value)
                              }
                          />
                      ))}
                    </div>

                    <div
                        className="bracket-board"
                        style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1rem' }}
                    >
                      <FinalMatchCard
                          title="Match place 5"
                          match={safeFinalStage.placement5to8Finals.place5}
                          accent="accent-blue"
                          allGroups={finalOptionGroups}
                          getTeamNameById={getTeamNameById}
                          getTeamLabelById={getTeamLabelById}
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('placement5to8Finals', 'place5', field, value)
                          }
                      />

                      <FinalMatchCard
                          title="Match place 7"
                          match={safeFinalStage.placement5to8Finals.place7}
                          accent="accent-blue"
                          allGroups={finalOptionGroups}
                          getTeamNameById={getTeamNameById}
                          getTeamLabelById={getTeamLabelById}
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('placement5to8Finals', 'place7', field, value)
                          }
                      />
                    </div>
                  </div>
              ) : null}

              <div className="card planning-card">
                <h2>Points phase finale uniquement</h2>
                <p className="note">
                  Ce tableau sert au <strong>départage</strong> lorsqu’il n’y a pas de petite finale ou de matchs de classement (5–8).
                  Il ne remplace jamais le <strong>parcours dans le tableau final</strong> :
                  une équipe éliminée en quart restera derrière une équipe éliminée en demi.
                </p>

                <div className="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>#</th>
                      <th>Équipe</th>
                      <th>Rang cumulé</th>
                      <th>J</th>
                      <th>V</th>
                      <th>D</th>
                      <th>PF</th>
                      <th>PA</th>
                      <th>Diff</th>
                      <th>Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {finalOnlyPointsRanking.length === 0 ? (
                        <tr>
                          <td colSpan="10">Aucun score de phase finale pour le moment.</td>
                        </tr>
                    ) : (
                        finalOnlyPointsRanking.map((team, index) => (
                            <tr key={team.teamId}>
                              <td>{index + 1}</td>
                              <td>{team.teamName}</td>
                              <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                              <td>{team.played}</td>
                              <td>{team.wins}</td>
                              <td>{team.losses}</td>
                              <td>{team.pointsFor}</td>
                              <td>{team.pointsAgainst}</td>
                              <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                              <td>{team.totalScore > 0 ? `+${team.totalScore}` : team.totalScore}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card planning-card">
                <h2>Cumuls points poules + phase finale</h2>
                <p className="note">
                  Ce tableau additionne tous les matchs joués en poules et en phase finale pour donner
                  une vue d’ensemble. Il reste purement indicatif et ne décide pas du placement final
                  devant le parcours de phase finale.
                </p>

                <div className="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>#</th>
                      <th>Équipe</th>
                      <th>Rang cumulé</th>
                      <th>J</th>
                      <th>V</th>
                      <th>D</th>
                      <th>PF</th>
                      <th>PA</th>
                      <th>Diff</th>
                      <th>Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {combinedPointsRanking.length === 0 ? (
                        <tr>
                          <td colSpan="10">Aucun cumul disponible pour le moment.</td>
                        </tr>
                    ) : (
                        combinedPointsRanking.map((team, index) => (
                            <tr key={team.teamId}>
                              <td>{index + 1}</td>
                              <td>{team.teamName}</td>
                              <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                              <td>{team.played}</td>
                              <td>{team.wins}</td>
                              <td>{team.losses}</td>
                              <td>{team.pointsFor}</td>
                              <td>{team.pointsAgainst}</td>
                              <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                              <td>{team.totalScore > 0 ? `+${team.totalScore}` : team.totalScore}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
        ) : activeTab === 'final-ranking' ? (
            <section className="card full-width">
              <h2>Classement final</h2>
              <p className="note">
                Le classement final respecte d’abord le parcours dans le tableau final :
                vainqueur, finaliste, demi, quart. Les points de phase finale ne servent qu’à départager
                les équipes d’un même niveau quand aucun match de classement n’est joué.
                <br /><br />
                <strong>Signification des colonnes :</strong>
                <br />
                • <strong>J</strong> : matchs joués<br />
                • <strong>V</strong> : victoires<br />
                • <strong>D</strong> : défaites<br />
                • <strong>PF</strong> : points marqués<br />
                • <strong>PA</strong> : points encaissés<br />
                • <strong>Diff</strong> : différence de points (PF - PA)<br />
                • <strong>Total</strong> : valeur utilisée pour le classement
              </p>

              <div className="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Place</th>
                    <th>Équipe</th>
                    <th>Rang cumulé</th>
                    <th>J</th>
                    <th>V</th>
                    <th>D</th>
                    <th>PF</th>
                    <th>PA</th>
                    <th>Diff</th>
                    <th>Total</th>
                  </tr>
                  </thead>
                  <tbody>
                  {finalRanking.length === 0 ? (
                      <tr>
                        <td colSpan="10">Aucun classement final disponible pour le moment.</td>
                      </tr>
                  ) : (
                      finalRanking.map((row) => (
                          <tr key={`${row.position}-${row.teamId}`}>
                            <td>{row.position}</td>
                            <td>{row.teamName}</td>
                            <td>{row.cumulativeRank ? formatRank(row.cumulativeRank) : ''}</td>
                            <td>{row.played || 0}</td>
                            <td>{row.wins || 0}</td>
                            <td>{row.losses || 0}</td>
                            <td>{row.pointsFor || 0}</td>
                            <td>{row.pointsAgainst || 0}</td>
                            <td>{formatSigned(row.diff || 0)}</td>
                            <td>{formatSigned(row.totalScore || 0)}</td>
                          </tr>
                      ))
                  )}
                  </tbody>
                </table>
              </div>
            </section>
        ) : (
            <main className="layout">
              <section className="card">
                <h2>{activePool?.name} — Équipes</h2>
                {activePool?.teams.length === 0 ? (
                    <p className="empty-text">Aucune équipe placée dans cette poule via le serpentin.</p>
                ) : (
                    <div className="team-list">
                      {activePool.teams.map((team, index) => (
                          <div key={team.id} className="team-item team-item-advanced">
                            <div className="team-main">
                              <span className="team-index">{index + 1}.</span>
                              <span className="team-name">
                        {team.name}
                                {team.cumulativeRank
                                    ? ` — Rang cumulé: ${formatRank(team.cumulativeRank)}`
                                    : ''}
                      </span>
                            </div>
                          </div>
                      ))}
                    </div>
                )}

                <div className="actions">
                  <button type="button" onClick={handleOptimizeMatches}>
                    Optimiser l’ordre des matchs
                  </button>
                </div>
              </section>

              <section className="card">
                <h2>{activePool?.name} — Matchs</h2>
                {activePool?.matches.length === 0 ? (
                    <p className="empty-text">
                      Place au moins 2 équipes dans le serpentin pour générer des matchs.
                    </p>
                ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                        <tr>
                          <th>Rotation</th>
                          <th>Équipe 1</th>
                          <th>Terrain</th>
                          <th>Score 1</th>
                          <th>Score 2</th>
                          <th>Équipe 2</th>
                          <th>Diff 1</th>
                          <th>Diff 2</th>
                        </tr>
                        </thead>
                        <tbody>
                        {optimizeMatchOrder(activePool.matches).map((match) => {
                          const winner = getWinner(match);
                          const scoreA = Number(match.scoreA);
                          const scoreB = Number(match.scoreB);
                          const diffA =
                              match.scoreA !== '' &&
                              match.scoreB !== '' &&
                              Number.isFinite(scoreA) &&
                              Number.isFinite(scoreB)
                                  ? scoreA - scoreB
                                  : '';
                          const diffB =
                              match.scoreA !== '' &&
                              match.scoreB !== '' &&
                              Number.isFinite(scoreA) &&
                              Number.isFinite(scoreB)
                                  ? scoreB - scoreA
                                  : '';

                          return (
                              <tr key={match.id}>
                                <td>{match.round || 1}</td>
                                <td className={winner === 'A' ? 'winner-text' : ''}>
                                  {getTeamNameById(match.teamAId)}
                                </td>
                                <td>{match.localCourt || 1}</td>
                                <td>
                                  <input
                                      type="number"
                                      min="0"
                                      value={match.scoreA}
                                      onChange={(event) =>
                                          handleMatchScoreChange(match.id, 'scoreA', event.target.value)
                                      }
                                  />
                                </td>
                                <td>
                                  <input
                                      type="number"
                                      min="0"
                                      value={match.scoreB}
                                      onChange={(event) =>
                                          handleMatchScoreChange(match.id, 'scoreB', event.target.value)
                                      }
                                  />
                                </td>
                                <td className={winner === 'B' ? 'winner-text' : ''}>
                                  {getTeamNameById(match.teamBId)}
                                </td>
                                <td>{diffA === '' ? '' : diffA > 0 ? `+${diffA}` : diffA}</td>
                                <td>{diffB === '' ? '' : diffB > 0 ? `+${diffB}` : diffB}</td>
                              </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                )}
              </section>

              <section className="card full-width">
                <h2>{activePool?.name} — Classement</h2>
                <div className="table-wrapper">
                  <table>
                    <thead>
                    <tr>
                      <th>#</th>
                      <th>Équipe</th>
                      <th>Rang cumulé</th>
                      <th>J</th>
                      <th>V</th>
                      <th>D</th>
                      <th>PF</th>
                      <th>PA</th>
                      <th>Diff</th>
                      <th>Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {ranking.length === 0 ? (
                        <tr>
                          <td colSpan="10">Aucun classement disponible pour le moment.</td>
                        </tr>
                    ) : (
                        ranking.map((team, index) => (
                            <tr key={team.teamId}>
                              <td>{index + 1}</td>
                              <td>{team.teamName}</td>
                              <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                              <td>{team.played}</td>
                              <td>{team.wins}</td>
                              <td>{team.losses}</td>
                              <td>{team.pointsFor}</td>
                              <td>{team.pointsAgainst}</td>
                              <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                              <td>{team.totalScore > 0 ? `+${team.totalScore}` : team.totalScore}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
              </section>
            </main>
        )}
      </div>
  );
}

export default App;
