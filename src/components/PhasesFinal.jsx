import { FaRandom } from 'react-icons/fa';
import FinalMatchCard from './FinalMatchCard.jsx';

const ENTRY_ROUND_LABELS = {
    round16: 'Huitièmes de finale',
    quarter: 'Quarts de finale',
    semi: 'Demi-finales',
};

const QUALIFIER_MODE_LABELS = {
    winners: 'Meilleur de chaque poule',
    top2: '2 meilleurs de chaque poule',
    best4: '4 meilleurs globaux',
    all: 'Toutes les équipes classées',
};

function PhasesFinal({ ctx }) {
    const {
        allTeams,
        combinedPointsRanking,
        finalOnlyPointsRanking,
        finalOptionGroups,
        formatRank,
        getTeamLabelById,
        getTeamNameById,
        handleAutoQuarterDraw,
        handleFinalMatchScore,
        handleFinalQualifierModeChange,
        handleFinalStageEntryRoundChange,
        handleFinalStageTeamChange,
        handleQuarterTeamChange,
        handleToggleQuarterPlacement,
        handleToggleThirdPlace,
        safeFinalStage,
        selectedQuarterTeamIds,
        selectedStarterTeamIds,
    } = ctx;

    const entryRound = safeFinalStage.settings.entryRound || 'quarter';
    const qualifierMode = safeFinalStage.settings.poolQualifierMode || 'top2';
    const showRoundOf16 = entryRound === 'round16';
    const showQuarterFinals = entryRound === 'round16' || entryRound === 'quarter';
    const firstEditableStageKey = showRoundOf16 ? 'roundOf16' : entryRound === 'semi' ? 'semiFinals' : 'quarterFinals';
    const firstEditableIds = firstEditableStageKey === 'quarterFinals' ? selectedQuarterTeamIds : selectedStarterTeamIds;
    const gridColumns = showRoundOf16 ? '1.25fr 1fr 1fr 1fr' : showQuarterFinals ? '1.2fr 1fr 1fr' : '1.1fr 1fr';

    const renderScoreCell = (team) => (
        <tr key={team.teamId}>
            <td>{team.position || ''}</td>
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
    );

    return (
        <section className="card full-width">
            <div className="section-head">
                <div>
                    <h2>Phase finale</h2>
                    <p className="note">
                        Le tableau s’adapte automatiquement : huitièmes si tu as assez de qualifiés,
                        quarts si le tableau démarre à 8 équipes, ou directement demi-finales avec 4 qualifiés.
                        Les TS gardent leurs emplacements fixes.
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
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={handleToggleQuarterPlacement}
                        disabled={entryRound === 'semi'}
                        title={entryRound === 'semi' ? 'Le classement 5-8 commence à partir des quarts.' : ''}
                    >
                        {safeFinalStage.settings.enablePlacement5to8
                            ? 'Classement 5-8: ON'
                            : 'Classement 5-8: OFF'}
                    </button>
                </div>
            </div>

            <div className="final-settings-grid">
                <label className="field final-settings-field">
                    <span>Équipes qualifiées depuis les poules</span>
                    <select
                        value={qualifierMode}
                        onChange={(event) => handleFinalQualifierModeChange(event.target.value)}
                    >
                        {Object.entries(QUALIFIER_MODE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>

                <label className="field final-settings-field">
                    <span>Départ manuel du tableau</span>
                    <select
                        value={entryRound}
                        onChange={(event) => handleFinalStageEntryRoundChange(event.target.value)}
                    >
                        {Object.entries(ENTRY_ROUND_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>

                <div className="final-settings-help">
                    <strong>Logique auto :</strong> TS &gt; meilleurs de poule &gt; équipes plus faibles.
                    Le tirage évite autant que possible les matchs entre équipes d’une même poule au premier tour.
                </div>
            </div>

            <div className="bracket-scroll">
                <div className="bracket-board bracket-board-final" style={{ gridTemplateColumns: gridColumns }}>
                    {showRoundOf16 ? (
                        <div className="bracket-column bracket-column-round16">
                            <div className="bracket-column-title">Huitièmes de finale</div>
                            {safeFinalStage.roundOf16.map((match, index) => (
                                <FinalMatchCard
                                    key={match.id}
                                    title={`Huitième ${index + 1}`}
                                    match={match}
                                    editableTeams={true}
                                    allGroups={finalOptionGroups}
                                    unavailableTeamIds={firstEditableIds}
                                    getTeamNameById={getTeamNameById}
                                    getTeamLabelById={getTeamLabelById}
                                    onTeamChange={(field, value) => handleFinalStageTeamChange('roundOf16', index, field, value)}
                                    onScoreChange={(field, value) =>
                                        handleFinalMatchScore('roundOf16', index, field, value)
                                    }
                                />
                            ))}
                        </div>
                    ) : null}

                    {showQuarterFinals ? (
                        <div className="bracket-column bracket-column-quarters">
                            <div className="bracket-column-title">Quarts de finale</div>
                            {safeFinalStage.quarterFinals.map((match, index) => (
                                <FinalMatchCard
                                    key={match.id}
                                    title={`Quart ${index + 1}`}
                                    match={match}
                                    editableTeams={entryRound === 'quarter'}
                                    allGroups={finalOptionGroups}
                                    unavailableTeamIds={entryRound === 'quarter' ? firstEditableIds : undefined}
                                    getTeamNameById={getTeamNameById}
                                    getTeamLabelById={getTeamLabelById}
                                    onTeamChange={(field, value) => handleQuarterTeamChange(index, field, value)}
                                    onScoreChange={(field, value) =>
                                        handleFinalMatchScore('quarterFinals', index, field, value)
                                    }
                                />
                            ))}
                        </div>
                    ) : null}

                    <div className={`bracket-column ${showQuarterFinals ? 'bracket-column-middle' : ''}`}>
                        <div className="bracket-column-title">Demi-finales</div>
                        {safeFinalStage.semiFinals.map((match, index) => (
                            <FinalMatchCard
                                key={match.id}
                                title={`Demi ${index + 1}`}
                                match={match}
                                accent="accent-blue"
                                editableTeams={entryRound === 'semi'}
                                allGroups={finalOptionGroups}
                                unavailableTeamIds={entryRound === 'semi' ? firstEditableIds : undefined}
                                getTeamNameById={getTeamNameById}
                                getTeamLabelById={getTeamLabelById}
                                onTeamChange={(field, value) => handleFinalStageTeamChange('semiFinals', index, field, value)}
                                onScoreChange={(field, value) =>
                                    handleFinalMatchScore('semiFinals', index, field, value)
                                }
                            />
                        ))}
                    </div>

                    <div className={`bracket-column ${showQuarterFinals ? 'bracket-column-finals' : 'bracket-column-middle'}`}>
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

            {safeFinalStage.settings.enablePlacement5to8 && entryRound !== 'semi' ? (
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
                    Il ne remplace jamais le <strong>parcours dans le tableau final</strong>.
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
                            finalOnlyPointsRanking.map((team, index) => renderScoreCell({ ...team, position: index + 1 }))
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
                            combinedPointsRanking.map((team, index) => renderScoreCell({ ...team, position: index + 1 }))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

export default PhasesFinal;
