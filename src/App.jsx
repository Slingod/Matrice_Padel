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
          {baseTeams.map((team) => (
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
                          accent = '',
                          editableTeams = false,
                          onTeamChange,
                        }) {
  const winner = getDisplayWinner(match);

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
                {allGroups.map((group) => (
                    <optgroup key={group.id} label={group.name}>
                      {group.teams.map((team, teamIndex) => (
                          <option key={team.id} value={team.id}>
                            {group.name} #{teamIndex + 1} — {getTeamLabelById(team.id)}
                          </option>
                      ))}
                    </optgroup>
                ))}
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
                {allGroups.map((group) => (
                    <optgroup key={group.id} label={group.name}>
                      {group.teams.map((team, teamIndex) => (
                          <option key={team.id} value={team.id}>
                            {group.name} #{teamIndex + 1} — {getTeamLabelById(team.id)}
                          </option>
                      ))}
                    </optgroup>
                ))}
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

function buildAutoQuarterDraw({ rankedPools, allTeams, pools }) {
  const placedIds = new Set(pools.flatMap((pool) => pool.teams.map((team) => team.id)));

  const tsTeams = allTeams
      .filter((team) => !placedIds.has(team.id))
      .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999))
      .slice(0, 2)
      .map((team, index) => ({
        teamId: team.id,
        teamName: team.name,
        cumulativeRank: team.cumulativeRank || 0,
        poolId: null,
        poolName: 'TS',
        type: 'ts',
        label: `TS #${index + 1}`,
      }));

  const winners = rankedPools
      .flatMap((pool) =>
          pool.ranking.slice(0, 1).map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            cumulativeRank: team.cumulativeRank || 0,
            poolId: pool.id,
            poolName: pool.name,
            type: 'winner',
          }))
      )
      .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999));

  const seconds = rankedPools
      .flatMap((pool) =>
          pool.ranking.slice(1, 2).map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            cumulativeRank: team.cumulativeRank || 0,
            poolId: pool.id,
            poolName: pool.name,
            type: 'second',
          }))
      )
      .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999));

  const extras = rankedPools
      .flatMap((pool) =>
          pool.ranking.slice(2).map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            cumulativeRank: team.cumulativeRank || 0,
            poolId: pool.id,
            poolName: pool.name,
            type: 'extra',
          }))
      )
      .sort((a, b) => (a.cumulativeRank || 999999999) - (b.cumulativeRank || 999999999));

  const entrants = [...tsTeams, ...winners, ...seconds, ...extras].slice(0, 8);
  if (entrants.length < 8) return [];

  const strongestTs = tsTeams[0] || null;
  const secondTs = tsTeams[1] || null;

  const remainingWinners = winners.filter(
      (item) => item.teamId !== strongestTs?.teamId && item.teamId !== secondTs?.teamId
  );

  const seedSlots = [
    secondTs || remainingWinners.shift(),
    remainingWinners.shift(),
    remainingWinners.shift(),
    strongestTs || remainingWinners.shift(),
  ].filter(Boolean);

  const usedSeedIds = new Set(seedSlots.map((item) => item.teamId));
  const opponentPool = entrants.filter((item) => !usedSeedIds.has(item.teamId));

  const secondPool = shuffleArray(opponentPool.filter((item) => item.type === 'second'));
  const otherPool = shuffleArray(opponentPool.filter((item) => item.type !== 'second'));
  const orderedOpponents = [...secondPool, ...otherPool].slice(0, seedSlots.length);

  const pairs = pairSeedsWithOpponents(seedSlots, orderedOpponents);
  if (pairs.length !== seedSlots.length) return [];

  return pairs.map(([teamA, teamB]) => ({
    teamAId: teamA.teamId,
    teamBId: teamB.teamId,
    scoreA: '',
    scoreB: '',
  }));
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

  const [finalStage, setFinalStage] = useState(
      initialState.finalStage || createEmptyFinalStage()
  );

  const safeFinalStage = useMemo(
      () => syncFinalStageWithTeams(finalStage || createEmptyFinalStage(), allTeams),
      [finalStage, allTeams]
  );

  useEffect(() => {
    setPools((prev) => syncPoolsFromSerpentin(baseTeams, prev, serpentin));
  }, [baseTeams, serpentin]);

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
          if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
          if (b.diff !== a.diff) return b.diff - a.diff;
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

  const globalPlanning = useMemo(
      () => buildGlobalPlanning(pools, Math.max(1, Number(courtCount) || 1)),
      [pools, courtCount]
  );

  function formatRank(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('fr-FR');
  }

  function getTeamNameById(teamId) {
    return allTeams.find((team) => team.id === teamId)?.name || '';
  }

  function getTeamLabelById(teamId) {
    const team = allTeams.find((item) => item.id === teamId);
    if (!team) return '';
    return `${team.number} — ${team.name}${
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
    const draw = buildAutoQuarterDraw({ rankedPools, allTeams, pools });

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
              <h2>Base équipes / joueurs</h2>
              <p className="note">
                Tu peux modifier les joueurs, leurs rangs, le nom affiché, ou inverser Joueur 1 / Joueur 2.
                Le rang cumulé sera recalculé automatiquement.
              </p>

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
                  {allTeams.length === 0 ? (
                      <tr>
                        <td colSpan="8">Aucune donnée importée pour le moment.</td>
                      </tr>
                  ) : (
                      allTeams.map((team) => {
                        const isEditing = editingBaseTeamId === team.id;
                        const liveTotal = isEditing
                            ? (Number(editingBaseDraft?.player1Rank) || 0) +
                            (Number(editingBaseDraft?.player2Rank) || 0)
                            : team.cumulativeRank;

                        return (
                            <tr key={team.id}>
                              <td>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingBaseDraft.number}
                                        onChange={(event) => handleBaseDraftChange('number', event.target.value)}
                                    />
                                ) : (
                                    team.number
                                )}
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
            </section>
        ) : activeTab === 'serpentin' ? (
            <section className="card full-width">
              <h2>Serpentin</h2>
              <p className="note">
                L’arbitre place ici les équipes manuellement. Les poules se remplissent automatiquement
                à partir de ces choix.
              </p>

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
                                    baseTeams={allTeams}
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
                  Ce tableau sert au départage quand il n’y a pas de petite finale ou de matchs 5-8.
                  Il n’écrase jamais le parcours du tournoi : une équipe sortie en quart restera
                  derrière une équipe sortie en demi.
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
              </p>

              <div className="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Place</th>
                    <th>Équipe</th>
                    <th>Rang cumulé</th>
                  </tr>
                  </thead>
                  <tbody>
                  {finalRanking.length === 0 ? (
                      <tr>
                        <td colSpan="3">Aucun classement final disponible pour le moment.</td>
                      </tr>
                  ) : (
                      finalRanking.map((row) => (
                          <tr key={`${row.position}-${row.teamId}`}>
                            <td>{row.position}</td>
                            <td>{row.teamName}</td>
                            <td>{row.cumulativeRank ? formatRank(row.cumulativeRank) : ''}</td>
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