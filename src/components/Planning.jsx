
function Planning({ ctx }) {
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
            <h2>Planning global des rotations</h2>
            <p className="note">
                Ce planning répartit les matchs de chaque poule sur les terrains disponibles.
                Les rotations FFT/Padel sont respectées, et les terrains affichés utilisent ta numérotation manuelle.
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
                                <td>{displayMatchCourtLabel(row.match, row.terrain)}</td>
                                <td>{getTeamNameById(row.match.teamAId)}</td>
                                <td>{getTeamNameById(row.match.teamBId)}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default Planning;
