import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import {
  FaFileCsv,
  FaFileExcel,
  FaPlus,
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
  syncFinalStageWithTeams,
  updateFinalStageMatch,
} from './utils/finalStage';

function SortableSerpentinRow({
                                entry,
                                index,
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

        <select
            value={entry.value}
            onChange={(event) => onChange(event.target.value)}
        >
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

    const teams = uniqueIds
        .map((teamId) => teamMap.get(teamId))
        .filter(Boolean);

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

function App() {
  const initialState = useMemo(() => loadAppState(), []);
  const [baseTeams, setBaseTeams] = useState(initialState.baseTeams || []);
  const [pools, setPools] = useState(initialState.pools);
  const [serpentin, setSerpentin] = useState(initialState.serpentin);
  const [activeTab, setActiveTab] = useState(initialState.activeTab);

  const [newPoolName, setNewPoolName] = useState('');

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
      const aNum = Number(String(a.number).match(/(\d+)/)?.[1] || 0);
      const bNum = Number(String(b.number).match(/(\d+)/)?.[1] || 0);
      return aNum - bNum;
    });
  }, [baseTeams]);

  const [finalStage, setFinalStage] = useState(() =>
      syncFinalStageWithTeams(initialState.finalStage || createEmptyFinalStage(), allTeams)
  );

  useEffect(() => {
    setPools((prev) => syncPoolsFromSerpentin(baseTeams, prev, serpentin));
  }, [baseTeams, serpentin]);

  useEffect(() => {
    setFinalStage((prev) => syncFinalStageWithTeams(prev, allTeams));
  }, [allTeams]);

  useEffect(() => {
    saveAppState({ baseTeams, pools, serpentin, activeTab, finalStage });
  }, [baseTeams, pools, serpentin, activeTab, finalStage]);

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
      () => buildFinalRanking(finalStage, rankedPools, allTeams),
      [finalStage, rankedPools, allTeams]
  );

  const combinedPointsRanking = useMemo(() => {
    const statMap = new Map(allTeams.map((team) => [team.id, createCombinedStatRow(team)]));

    pools.forEach((pool) => {
      pool.matches.forEach((match) => {
        applyMatchToStats(
            statMap,
            match.teamAId,
            match.teamBId,
            match.scoreA,
            match.scoreB
        );
      });
    });

    finalStage.quarterFinals.forEach((match) => {
      applyMatchToStats(
          statMap,
          match.teamAId,
          match.teamBId,
          match.scoreA,
          match.scoreB
      );
    });

    finalStage.semiFinals.forEach((match) => {
      applyMatchToStats(
          statMap,
          match.teamAId,
          match.teamBId,
          match.scoreA,
          match.scoreB
      );
    });

    applyMatchToStats(
        statMap,
        finalStage.final.teamAId,
        finalStage.final.teamBId,
        finalStage.final.scoreA,
        finalStage.final.scoreB
    );

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
  }, [allTeams, pools, finalStage]);

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

  function handleAddPool(event) {
    event.preventDefault();

    const cleanName = newPoolName.trim();
    if (!cleanName) return;

    const exists = pools.some(
        (pool) => pool.name.toLowerCase() === cleanName.toLowerCase()
    );
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

    localStorage.removeItem('matrice-padel-v7');
    window.location.reload();
  }

  function handleQuarterTeamChange(matchIndex, field, teamId) {
    setFinalStage((prev) =>
        syncFinalStageWithTeams(assignQuarterTeam(prev, matchIndex, field, teamId), allTeams)
    );
  }

  function handleFinalMatchScore(stageKey, matchIndex, field, value) {
    setFinalStage((prev) =>
        syncFinalStageWithTeams(
            updateFinalStageMatch(prev, stageKey, matchIndex, field, value),
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
              Import XLSX / CSV, base joueurs, serpentin manuel, poules automatiques depuis le serpentin, phase finale et classement final.
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

              <button
                  type="button"
                  onClick={() => exportTournamentToCSV(baseTeams, pools, serpentin)}
              >
                <FaFileCsv />
                Exporter CSV
              </button>

              <button
                  type="button"
                  onClick={() => exportTournamentToXLSX(baseTeams, pools, serpentin)}
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
                Cette page regroupe toutes les équipes importées, y compris les têtes de poule ou équipes hors poules.
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
                  </tr>
                  </thead>
                  <tbody>
                  {allTeams.length === 0 ? (
                      <tr>
                        <td colSpan="7">Aucune donnée importée pour le moment.</td>
                      </tr>
                  ) : (
                      allTeams.map((team) => (
                          <tr key={team.id}>
                            <td>{team.number}</td>
                            <td>{team.name}</td>
                            <td>{team.players?.[0]?.name || ''}</td>
                            <td>{team.players?.[0]?.rank ? formatRank(team.players[0].rank) : ''}</td>
                            <td>{team.players?.[1]?.name || ''}</td>
                            <td>{team.players?.[1]?.rank ? formatRank(team.players[1].rank) : ''}</td>
                            <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                          </tr>
                      ))
                  )}
                  </tbody>
                </table>
              </div>
            </section>
        ) : activeTab === 'serpentin' ? (
            <section className="card full-width">
              <h2>Serpentin</h2>
              <p className="note">
                L’arbitre place ici les équipes manuellement. Les poules se remplissent automatiquement à partir de ces choix.
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
                            {(serpentin[pool.id] || []).map((entry, index) => (
                                <SortableSerpentinRow
                                    key={entry.id}
                                    entry={entry}
                                    index={index}
                                    baseTeams={allTeams}
                                    getTeamLabelById={getTeamLabelById}
                                    onChange={(value) =>
                                        handleChangeSerpentinValue(pool.id, entry.id, value)
                                    }
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
        ) : activeTab === 'finals' ? (
            <section className="card full-width">
              <div className="section-head">
                <div>
                  <h2>Phase finale</h2>
                  <p className="note">
                    Sélectionne qui joue contre qui, puis saisis les scores pour faire avancer automatiquement les vainqueurs.
                  </p>
                </div>
              </div>

              <div className="bracket-board">
                <div className="bracket-column">
                  <div className="bracket-column-title">Quarts de finale</div>

                  {finalStage.quarterFinals.map((match, index) => (
                      <FinalMatchCard
                          key={match.id}
                          title={`Quart ${index + 1}`}
                          match={match}
                          editableTeams={true}
                          allGroups={finalOptionGroups}
                          getTeamNameById={getTeamNameById}
                          getTeamLabelById={getTeamLabelById}
                          onTeamChange={(field, value) =>
                              handleQuarterTeamChange(index, field, value)
                          }
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('quarterFinals', index, field, value)
                          }
                      />
                  ))}
                </div>

                <div className="bracket-column bracket-column-middle">
                  <div className="bracket-column-title">Demi-finales</div>

                  {finalStage.semiFinals.map((match, index) => (
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
                      match={finalStage.final}
                      accent="accent-gold"
                      allGroups={finalOptionGroups}
                      getTeamNameById={getTeamNameById}
                      getTeamLabelById={getTeamLabelById}
                      onScoreChange={(field, value) =>
                          handleFinalMatchScore('final', 0, field, value)
                      }
                  />
                </div>
              </div>

              <div className="card" style={{ marginTop: '1.5rem' }}>
                <h2>Cumuls points poules + phase finale</h2>
                <p className="note">
                  Ce tableau additionne tous les matchs joués en poules et en phase finale pour aider au départage si nécessaire.
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
                Le classement final affiche l’ordre de sortie du tournoi et le rang cumulé des équipes.
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
                    <div className="matches">
                      {activePool.matches.map((match, index) => {
                        const winner = getWinner(match);
                        const teamAClass =
                            winner === 'A' ? 'winner' : winner === 'draw' ? 'draw' : '';
                        const teamBClass =
                            winner === 'B' ? 'winner' : winner === 'draw' ? 'draw' : '';

                        return (
                            <div key={match.id} className="match-row">
                              <div className="match-number">Match {index + 1}</div>

                              <div className={`match-team ${teamAClass}`}>
                                <span>{getTeamNameById(match.teamAId)}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={match.scoreA}
                                    onChange={(event) =>
                                        handleMatchScoreChange(match.id, 'scoreA', event.target.value)
                                    }
                                />
                              </div>

                              <div className="vs">vs</div>

                              <div className={`match-team ${teamBClass}`}>
                                <input
                                    type="number"
                                    min="0"
                                    value={match.scoreB}
                                    onChange={(event) =>
                                        handleMatchScoreChange(match.id, 'scoreB', event.target.value)
                                    }
                                />
                                <span>{getTeamNameById(match.teamBId)}</span>
                              </div>
                            </div>
                        );
                      })}
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