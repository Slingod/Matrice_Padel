import { getDisplayWinner } from '../utils/finalStage';

function FinalMatchCard({
                            title,
                            match,
                            getTeamNameById,
                            getTeamLabelById,
                            onScoreChange,
                            allGroups,
                            unavailableTeamIds = new Set(),
                            accent = '',
                            editableTeams = false,
                            onTeamChange,
                        }) {
    const winner = getDisplayWinner(match);

    const renderTeamOptions = (currentValue) =>
        allGroups.map((group) => {
            const availableTeams = group.teams.filter(
                (team) => team.id === currentValue || !unavailableTeamIds.has(team.id)
            );

            if (availableTeams.length === 0) return null;

            return (
                <optgroup key={group.id} label={group.name}>
                    {availableTeams.map((team, teamIndex) => (
                        <option key={team.id} value={team.id}>
                            {group.name} #{teamIndex + 1} — {getTeamLabelById(team.id)}
                        </option>
                    ))}
                </optgroup>
            );
        });

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
                        {renderTeamOptions(match.teamAId)}
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
                        {renderTeamOptions(match.teamBId)}
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

export default FinalMatchCard;
