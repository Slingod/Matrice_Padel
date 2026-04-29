
function ClassementFinal({ ctx }) {
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
            <h2>Classement final</h2>
            <p className="note">
                Le classement final respecte d’abord le parcours dans le tableau final :
                vainqueur, finaliste, demi, quart.
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
    );
}

export default ClassementFinal;
