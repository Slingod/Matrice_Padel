import { FaEdit, FaExchangeAlt, FaPlus, FaSave, FaStar, FaTimes, FaTrash } from 'react-icons/fa';

function Base({ ctx }) {
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
    );
}

export default Base;
