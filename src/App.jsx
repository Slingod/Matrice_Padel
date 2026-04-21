import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import {
  FaArrowDown,
  FaArrowUp,
  FaCog,
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
  createTeam,
  getWinner,
  loadAppState,
  optimizeMatchOrder,
  saveAppState,
  syncMatchesPreserveScores,
} from './utils/tournament';
import {
  exportPoolsToCSV,
  exportPoolsToXLSX,
  importTournamentFile,
} from './utils/importExport';
import {
  assignTeamToFinalSlot,
  buildFinalRanking,
  createEmptyFinalStage,
  getDisplayWinner,
  syncFinalStageWithTeams,
  updateFinalStageMatch,
} from './utils/finalStage';

function SortableTeamRow({
                           team,
                           index,
                           isEditing,
                           editingValue,
                           onEditValueChange,
                           onStartEdit,
                           onSaveEdit,
                           onDelete,
                           onMoveUp,
                           onMoveDown,
                         }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
      <div
          ref={setNodeRef}
          style={style}
          className={`team-item team-item-advanced ${isDragging ? 'dragging' : ''}`}
      >
        <div className="team-main">
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

          <span className="team-index">{index + 1}.</span>

          {isEditing ? (
              <input
                  type="text"
                  value={editingValue}
                  onChange={(event) => onEditValueChange(event.target.value)}
              />
          ) : (
              <span className="team-name">{team.name}</span>
          )}
        </div>

        <div className="team-actions">
          <button type="button" className="icon-btn" onClick={onMoveUp} title="Monter">
            <FaArrowUp />
          </button>

          <button
              type="button"
              className="icon-btn"
              onClick={onMoveDown}
              title="Descendre"
          >
            <FaArrowDown />
          </button>

          {isEditing ? (
              <button type="button" className="edit-btn" onClick={onSaveEdit}>
                Enregistrer
              </button>
          ) : (
              <button
                  type="button"
                  className="icon-btn"
                  onClick={onStartEdit}
                  title="Modifier"
              >
                <FaCog />
              </button>
          )}

          <button type="button" className="danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>
  );
}

function SortableSerpentinRow({ entry, index, onChange, onDelete }) {
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

        <input
            type="text"
            value={entry.value}
            placeholder={`Position ${index + 1}`}
            onChange={(event) => onChange(event.target.value)}
        />

        <button type="button" className="danger small-btn" onClick={onDelete}>
          <FaTrash />
        </button>
      </div>
  );
}

function FinalMatchCard({ title, match, getTeamNameById, onScoreChange, accent = '' }) {
  const winner = getDisplayWinner(match);

  return (
      <div className={`bracket-match ${accent}`}>
        <div className="bracket-match-header">{title}</div>

        <div className={`bracket-team-row ${winner === 'A' ? 'winner' : ''}`}>
        <span className="bracket-team-name">
          {getTeamNameById(match.teamAId) || 'À définir'}
        </span>
          <input
              type="number"
              min="0"
              value={match.scoreA}
              onChange={(event) => onScoreChange('scoreA', event.target.value)}
          />
        </div>

        <div className="bracket-vs">vs</div>

        <div className={`bracket-team-row ${winner === 'B' ? 'winner' : ''}`}>
        <span className="bracket-team-name">
          {getTeamNameById(match.teamBId) || 'À définir'}
        </span>
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

function App() {
  const initialState = useMemo(() => loadAppState(), []);
  const [pools, setPools] = useState(initialState.pools);
  const [serpentin, setSerpentin] = useState(initialState.serpentin);
  const [activeTab, setActiveTab] = useState(initialState.activeTab);

  const [newPoolName, setNewPoolName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  const [editingPoolId, setEditingPoolId] = useState(null);
  const [editingPoolValue, setEditingPoolValue] = useState('');

  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamValue, setEditingTeamValue] = useState('');

  const importInputRef = useRef(null);

  const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allTeams = useMemo(() => pools.flatMap((pool) => pool.teams), [pools]);

  const rankedPools = useMemo(
      () =>
          pools.map((pool) => ({
            ...pool,
            ranking: computeRanking(pool.teams, pool.matches),
          })),
      [pools]
  );

  const [finalStage, setFinalStage] = useState(() =>
      syncFinalStageWithTeams(initialState.finalStage || createEmptyFinalStage(), allTeams)
  );

  useEffect(() => {
    setFinalStage((prev) => syncFinalStageWithTeams(prev, allTeams));
  }, [allTeams]);

  useEffect(() => {
    saveAppState({ pools, serpentin, activeTab, finalStage });
  }, [pools, serpentin, activeTab, finalStage]);

  const activePool = pools.find((pool) => pool.id === activeTab) || null;

  const ranking = useMemo(() => {
    if (!activePool) return [];
    return computeRanking(activePool.teams, activePool.matches);
  }, [activePool]);

  const finalRanking = useMemo(
      () => buildFinalRanking(finalStage, rankedPools, allTeams),
      [finalStage, rankedPools, allTeams]
  );

  function updatePool(poolId, updater) {
    setPools((prevPools) =>
        prevPools.map((pool) => (pool.id === poolId ? updater(pool) : pool))
    );
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
      [newPool.id]: [],
    }));
    setNewPoolName('');
  }

  function handleDeletePool(poolId) {
    const pool = pools.find((item) => item.id === poolId);
    if (!pool) return;
    if (pools.length <= 1) return;

    setPools((prev) => prev.filter((item) => item.id !== poolId));
    setSerpentin((prev) => {
      const next = { ...prev };
      delete next[poolId];
      return next;
    });

    if (activeTab === poolId) {
      setActiveTab('serpentin');
    }
  }

  function handleStartPoolEdit(pool) {
    setEditingPoolId(pool.id);
    setEditingPoolValue(pool.name);
  }

  function handleSavePoolEdit(poolId) {
    const cleanName = editingPoolValue.trim();
    if (!cleanName) return;

    const alreadyExists = pools.some(
        (pool) =>
            pool.id !== poolId && pool.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (alreadyExists) return;

    updatePool(poolId, (pool) => ({
      ...pool,
      name: cleanName,
    }));

    setEditingPoolId(null);
    setEditingPoolValue('');
  }

  function handleAddTeam(event) {
    event.preventDefault();
    if (!activePool) return;

    const cleanName = newTeamName.trim();
    if (!cleanName) return;

    updatePool(activePool.id, (pool) => {
      const teams = [...pool.teams, createTeam(cleanName)];

      return {
        ...pool,
        teams,
        matches: syncMatchesPreserveScores(teams, pool.matches),
      };
    });

    setNewTeamName('');
  }

  function handleDeleteTeam(teamId) {
    if (!activePool) return;

    updatePool(activePool.id, (pool) => {
      const teams = pool.teams.filter((team) => team.id !== teamId);

      return {
        ...pool,
        teams,
        matches: syncMatchesPreserveScores(teams, pool.matches),
      };
    });
  }

  function handleStartTeamEdit(team) {
    setEditingTeamId(team.id);
    setEditingTeamValue(team.name);
  }

  function handleSaveTeamEdit(teamId) {
    if (!activePool) return;

    const cleanValue = editingTeamValue.trim();
    if (!cleanValue) return;

    updatePool(activePool.id, (pool) => ({
      ...pool,
      teams: pool.teams.map((team) =>
          team.id === teamId ? { ...team, name: cleanValue } : team
      ),
    }));

    setEditingTeamId(null);
    setEditingTeamValue('');
  }

  function moveTeam(teamId, direction) {
    if (!activePool) return;

    updatePool(activePool.id, (pool) => {
      const oldIndex = pool.teams.findIndex((team) => team.id === teamId);
      if (oldIndex === -1) return pool;

      const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1;
      if (newIndex < 0 || newIndex >= pool.teams.length) return pool;

      return {
        ...pool,
        teams: arrayMove(pool.teams, oldIndex, newIndex),
      };
    });
  }

  function handleTeamDragEnd(event) {
    if (!activePool || !event.over || event.active.id === event.over.id) return;

    updatePool(activePool.id, (pool) => {
      const oldIndex = pool.teams.findIndex((team) => team.id === event.active.id);
      const newIndex = pool.teams.findIndex((team) => team.id === event.over.id);

      if (oldIndex === -1 || newIndex === -1) return pool;

      return {
        ...pool,
        teams: arrayMove(pool.teams, oldIndex, newIndex),
      };
    });
  }

  function handleMatchScoreChange(matchId, field, value) {
    if (!activePool) return;

    const sanitized = value === '' ? '' : String(Math.max(0, Number(value) || 0));

    updatePool(activePool.id, (pool) => ({
      ...pool,
      matches: pool.matches.map((match) =>
          match.id === matchId ? { ...match, [field]: sanitized } : match
      ),
    }));
  }

  function handleOptimizeMatches() {
    if (!activePool) return;

    updatePool(activePool.id, (pool) => ({
      ...pool,
      matches: optimizeMatchOrder(pool.matches),
    }));
  }

  function getTeamNameById(teamId) {
    return allTeams.find((team) => team.id === teamId)?.name || '';
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

  function handleChangeSerpentinValue(poolId, entryId, value) {
    setSerpentin((prev) => ({
      ...prev,
      [poolId]: (prev[poolId] || []).map((entry) =>
          entry.id === entryId ? { ...entry, value } : entry
      ),
    }));
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
      setPools(imported.pools);
      setSerpentin(imported.serpentin);
      setActiveTab(imported.activeTab);
      setFinalStage(createEmptyFinalStage());
      setEditingPoolId(null);
      setEditingTeamId(null);
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

    localStorage.removeItem('matrice-padel-v3');
    window.location.reload();
  }

  function handleAssignFinalSlot(slotIndex, teamId) {
    setFinalStage((prev) =>
        syncFinalStageWithTeams(assignTeamToFinalSlot(prev, slotIndex, teamId), allTeams)
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
              Import XLSX / CSV, sauvegarde locale, drag & drop, serpentin, poules,
              phase finale et classement final.
            </p>
          </div>
        </header>

        <section className="tabs-card">
          <div className="tabs">
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

              <button type="button" onClick={() => exportPoolsToCSV(pools, serpentin)}>
                <FaFileCsv />
                CSV
              </button>

              <button type="button" onClick={() => exportPoolsToXLSX(pools, serpentin)}>
                <FaFileExcel />
                XLSX
              </button>

              <button type="button" className="danger" onClick={handleResetLocalData}>
                <FaTrash />
                Réinitialiser
              </button>
            </div>
          </div>
        </section>

        {activeTab === 'serpentin' ? (
            <section className="card full-width">
              <h2>Serpentin</h2>
              <p className="note">
                Tu peux renommer une poule, la supprimer, ajouter des lignes et
                réordonner le serpentin par glisser-déposer.
              </p>

              <div className="serpentin-grid">
                {pools.map((pool) => (
                    <div key={pool.id} className="serpentin-column">
                      <div className="pool-header">
                        {editingPoolId === pool.id ? (
                            <>
                              <input
                                  type="text"
                                  value={editingPoolValue}
                                  onChange={(event) => setEditingPoolValue(event.target.value)}
                              />
                              <button type="button" onClick={() => handleSavePoolEdit(pool.id)}>
                                Enregistrer
                              </button>
                            </>
                        ) : (
                            <>
                              <h3>{pool.name}</h3>

                              <div className="pool-header-actions">
                                <button
                                    type="button"
                                    className="icon-btn"
                                    title="Renommer"
                                    onClick={() => handleStartPoolEdit(pool)}
                                >
                                  <FaCog />
                                </button>

                                <button
                                    type="button"
                                    className="danger small-btn"
                                    title="Supprimer la poule"
                                    onClick={() => handleDeletePool(pool.id)}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </>
                        )}
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
                    Place manuellement les équipes dans les 8 cases. Les gagnants avancent
                    automatiquement vers les demi-finales, la finale et la petite finale.
                  </p>
                </div>
              </div>

              <div className="final-slots-panel">
                <h3>Placement des équipes</h3>

                <div className="final-slots-grid">
                  {finalStage.slots.map((slot, index) => (
                      <div key={slot.id} className="final-slot-card">
                        <label>{slot.label}</label>
                        <select
                            value={slot.teamId}
                            onChange={(event) => handleAssignFinalSlot(index, event.target.value)}
                        >
                          <option value="">-- Sélectionner une équipe --</option>
                          {rankedPools.map((pool) => (
                              <optgroup key={pool.id} label={pool.name}>
                                {pool.ranking.map((teamRow, teamIndex) => (
                                    <option key={teamRow.teamId} value={teamRow.teamId}>
                                      {pool.name} #{teamIndex + 1} — {teamRow.teamName}
                                    </option>
                                ))}
                              </optgroup>
                          ))}
                        </select>
                      </div>
                  ))}
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
                          getTeamNameById={getTeamNameById}
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
                          getTeamNameById={getTeamNameById}
                          onScoreChange={(field, value) =>
                              handleFinalMatchScore('semiFinals', index, field, value)
                          }
                      />
                  ))}
                </div>

                <div className="bracket-column bracket-column-finals">
                  <div className="bracket-column-title">Finales</div>

                  <FinalMatchCard
                      title="Petite finale"
                      match={finalStage.thirdPlace}
                      accent="accent-bronze"
                      getTeamNameById={getTeamNameById}
                      onScoreChange={(field, value) =>
                          handleFinalMatchScore('thirdPlace', 0, field, value)
                      }
                  />

                  <FinalMatchCard
                      title="Finale"
                      match={finalStage.final}
                      accent="accent-gold"
                      getTeamNameById={getTeamNameById}
                      onScoreChange={(field, value) =>
                          handleFinalMatchScore('final', 0, field, value)
                      }
                  />
                </div>
              </div>
            </section>
        ) : activeTab === 'final-ranking' ? (
            <section className="card full-width">
              <h2>Classement final</h2>
              <p className="note">
                Le top 4 vient directement de la phase finale. Les places 5 à 8 sont
                ordonnées ici selon l’élimination en quart puis le classement de poule.
              </p>

              <div className="table-wrapper">
                <table>
                  <thead>
                  <tr>
                    <th>Place</th>
                    <th>Équipe</th>
                    <th>Motif</th>
                    <th>Poule</th>
                    <th>Rang poule</th>
                  </tr>
                  </thead>
                  <tbody>
                  {finalRanking.length === 0 ? (
                      <tr>
                        <td colSpan="5">Aucun classement final disponible pour le moment.</td>
                      </tr>
                  ) : (
                      finalRanking.map((row) => (
                          <tr key={`${row.position}-${row.teamId}`}>
                            <td>{row.position}</td>
                            <td>{row.teamName}</td>
                            <td>{row.reason}</td>
                            <td>{row.poolName}</td>
                            <td>{row.poolRank}</td>
                          </tr>
                      ))
                  )}
                  </tbody>
                </table>
              </div>

              <div className="global-summary-grid">
                {rankedPools.map((pool) => (
                    <div key={pool.id} className="summary-card">
                      <h3>{pool.name}</h3>
                      <ol>
                        {pool.ranking.map((team, index) => (
                            <li key={team.teamId}>
                              #{index + 1} — {team.teamName} ({team.wins}V / {team.losses}D /{' '}
                              {team.totalScore > 0 ? `+${team.totalScore}` : team.totalScore})
                            </li>
                        ))}
                      </ol>
                    </div>
                ))}
              </div>
            </section>
        ) : (
            <main className="layout">
              <section className="card">
                <h2>{activePool?.name} — Équipes</h2>

                <form className="team-form" onSubmit={handleAddTeam}>
                  <input
                      type="text"
                      placeholder="Nom de l’équipe"
                      value={newTeamName}
                      onChange={(event) => setNewTeamName(event.target.value)}
                  />
                  <button type="submit">Ajouter</button>
                </form>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTeamDragEnd}
                >
                  <SortableContext
                      items={(activePool?.teams || []).map((team) => team.id)}
                      strategy={verticalListSortingStrategy}
                  >
                    <div className="team-list">
                      {activePool?.teams.length === 0 ? (
                          <p className="empty-text">Aucune équipe dans cette poule.</p>
                      ) : (
                          activePool.teams.map((team, index) => (
                              <SortableTeamRow
                                  key={team.id}
                                  team={team}
                                  index={index}
                                  isEditing={editingTeamId === team.id}
                                  editingValue={editingTeamValue}
                                  onEditValueChange={setEditingTeamValue}
                                  onStartEdit={() => handleStartTeamEdit(team)}
                                  onSaveEdit={() => handleSaveTeamEdit(team.id)}
                                  onDelete={() => handleDeleteTeam(team.id)}
                                  onMoveUp={() => moveTeam(team.id, 'up')}
                                  onMoveDown={() => moveTeam(team.id, 'down')}
                              />
                          ))
                      )}
                    </div>
                  </SortableContext>
                </DndContext>

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
                      Ajoute au moins 2 équipes pour générer des matchs.
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
                    {ranking.map((team, index) => (
                        <tr key={team.teamId}>
                          <td>{index + 1}</td>
                          <td>{team.teamName}</td>
                          <td>{team.played}</td>
                          <td>{team.wins}</td>
                          <td>{team.losses}</td>
                          <td>{team.pointsFor}</td>
                          <td>{team.pointsAgainst}</td>
                          <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                          <td>{team.totalScore > 0 ? `+${team.totalScore}` : team.totalScore}</td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>

                <p className="note">
                  Les matchs déjà saisis sont conservés quand tu renommes ou réorganises
                  les équipes. Si tu ajoutes ou supprimes une équipe, seuls les matchs
                  nécessaires sont recalculés.
                </p>
              </section>
            </main>
        )}
      </div>
  );
}

export default App;