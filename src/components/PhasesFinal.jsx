import { FaRandom } from 'react-icons/fa';
import FinalMatchCard from './FinalMatchCard.jsx';

function PhasesFinal({ ctx }) {
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
    );
}

export default PhasesFinal;
