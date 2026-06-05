import { FaRandom } from 'react-icons/fa';
import FinalMatchCard from './FinalMatchCard.jsx';
import FinalMatchFormatSelector from './FinalMatchFormatSelector.jsx';

const ENTRY_ROUND_LABELS = {
    round16: 'Huitièmes de finale',
    quarter: 'Quarts de finale',
    semi: 'Demi-finales',
};

const QUALIFIER_MODE_LABELS = {
    winners: 'Meilleur de chaque poule',
    top2: '2 meilleurs de chaque poule',
    all: 'Toutes les équipes classées',
};

function RankingTable({ title, rows, formatRank }) {
    return (
        <div className="card planning-card">
            <h2>{title}</h2>

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
                        <th>S</th>
                        <th>JG</th>
                        <th>JE</th>
                        <th>Diff</th>
                        <th>Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(rows || []).length === 0 ? (
                        <tr>
                            <td colSpan="11">Aucune donnée disponible pour le moment.</td>
                        </tr>
                    ) : (
                        rows.map((team, index) => (
                            <tr key={`${title}-${team.teamId || index}`}>
                                <td>{team.position || index + 1}</td>
                                <td>{team.teamName}</td>
                                <td>{team.cumulativeRank ? formatRank(team.cumulativeRank) : ''}</td>
                                <td>{team.played || team.finalPlayed || 0}</td>
                                <td>{team.wins || team.finalWins || 0}</td>
                                <td>{team.losses || team.finalLosses || 0}</td>
                                <td>{team.pointsFor || team.finalPointsFor || 0}</td>
                                <td>{team.pointsAgainst || team.finalPointsAgainst || 0}</td>
                                <td>{(team.diff || team.finalDiff || 0) > 0 ? `+${team.diff || team.finalDiff}` : team.diff || team.finalDiff || 0}</td>
                                <td>{(team.totalScore || team.finalTotal || 0) > 0 ? `+${team.totalScore || team.finalTotal}` : team.totalScore || team.finalTotal || 0}</td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PhasesFinal({ ctx }) {
    const {
        combinedPointsRanking,
        finalOnlyPointsRanking,
        finalOptionGroups,
        formatRank,
        getTeamLabelById,
        getTeamNameById,
        handleAutoQuarterDraw,
        handleFinalMatchFormatChange,
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
    const finalMatchFormatKey =
        safeFinalStage.settings.finalMatchFormatKey ||
        safeFinalStage.settings.matchFormatKey ||
        'D1';

    const showRoundOf16 = entryRound === 'round16';
    const showQuarterFinals = entryRound === 'round16' || entryRound === 'quarter';
    const firstEditableStageKey = showRoundOf16
        ? 'roundOf16'
        : entryRound === 'semi'
            ? 'semiFinals'
            : 'quarterFinals';
    const firstEditableIds = firstEditableStageKey === 'quarterFinals'
        ? selectedQuarterTeamIds
        : selectedStarterTeamIds;
    const gridColumns = showRoundOf16
        ? '1.25fr 1fr 1fr 1fr'
        : showQuarterFinals
            ? '1.2fr 1fr 1fr'
            : '1.1fr 1fr';

    const commonFinalCardProps = {
        allGroups: finalOptionGroups,
        getTeamNameById,
        getTeamLabelById,
        matchFormatKey: finalMatchFormatKey,
    };

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

                <FinalMatchFormatSelector
                    value={finalMatchFormatKey}
                    onChange={handleFinalMatchFormatChange}
                />

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
                                    unavailableTeamIds={firstEditableIds}
                                    onTeamChange={(field, value) => handleFinalStageTeamChange('roundOf16', index, field, value)}
                                    onScoreChange={(field, value) => handleFinalMatchScore('roundOf16', index, field, value)}
                                    {...commonFinalCardProps}
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
                                    unavailableTeamIds={entryRound === 'quarter' ? firstEditableIds : undefined}
                                    onTeamChange={(field, value) => handleQuarterTeamChange(index, field, value)}
                                    onScoreChange={(field, value) => handleFinalMatchScore('quarterFinals', index, field, value)}
                                    {...commonFinalCardProps}
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
                                unavailableTeamIds={entryRound === 'semi' ? firstEditableIds : undefined}
                                onTeamChange={(field, value) => handleFinalStageTeamChange('semiFinals', index, field, value)}
                                onScoreChange={(field, value) => handleFinalMatchScore('semiFinals', index, field, value)}
                                {...commonFinalCardProps}
                            />
                        ))}
                    </div>

                    <div className={`bracket-column ${showQuarterFinals ? 'bracket-column-finals' : 'bracket-column-middle'}`}>
                        <div className="bracket-column-title">Finale</div>
                        <FinalMatchCard
                            title="Finale"
                            match={safeFinalStage.final}
                            accent="accent-gold"
                            onScoreChange={(field, value) => handleFinalMatchScore('final', 0, field, value)}
                            {...commonFinalCardProps}
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
                        onScoreChange={(field, value) => handleFinalMatchScore('thirdPlace', 0, field, value)}
                        {...commonFinalCardProps}
                    />
                </div>
            ) : null}

            {safeFinalStage.settings.enablePlacement5to8 && entryRound !== 'semi' ? (
                <div className="card planning-card">
                    <h2>Classement 5e à 8e</h2>

                    <div className="bracket-board" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="bracket-column">
                            <div className="bracket-column-title">Demi-finales 5-8</div>
                            {safeFinalStage.placement5to8Semis.map((match, index) => (
                                <FinalMatchCard
                                    key={match.id}
                                    title={`Classement 5-8 / Demi ${index + 1}`}
                                    match={match}
                                    accent="accent-blue"
                                    onScoreChange={(field, value) => handleFinalMatchScore('placement5to8Semis', index, field, value)}
                                    {...commonFinalCardProps}
                                />
                            ))}
                        </div>

                        <div className="bracket-column">
                            <div className="bracket-column-title">Places 5 et 7</div>
                            <FinalMatchCard
                                title="Match place 5"
                                match={safeFinalStage.placement5to8Finals.place5}
                                accent="accent-gold"
                                onScoreChange={(field, value) => handleFinalMatchScore('placement5to8Finals', 'place5', field, value)}
                                {...commonFinalCardProps}
                            />
                            <FinalMatchCard
                                title="Match place 7"
                                match={safeFinalStage.placement5to8Finals.place7}
                                onScoreChange={(field, value) => handleFinalMatchScore('placement5to8Finals', 'place7', field, value)}
                                {...commonFinalCardProps}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

export default PhasesFinal;
