import { closestCenter, DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FaRandom, FaTrash } from 'react-icons/fa';
import SortableSerpentinRow from './SortableSerpentinRow.jsx';

function Serpentin({ ctx }) {
    const {
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
        seedTeamIds,
        seedTeamNumberById,
        seedTeams,
        selectedQuarterTeamIds,
        selectedSerpentinTeamIds,
        sensors,
        serpentin,
        setEditingMatchCourtId,

    } = ctx;

    return (
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
    );
}

export default Serpentin;
