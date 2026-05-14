import MatchScoreEditor from './MatchScoreEditor.jsx';

function normalizeUnavailableIds(value) {
    if (!value) return new Set();
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value);
    return new Set();
}

function getWinner(match) {
    const scoreA = Number(match?.scoreA);
    const scoreB = Number(match?.scoreB);

    const isValid =
        match?.scoreA !== '' &&
        match?.scoreA !== null &&
        match?.scoreA !== undefined &&
        match?.scoreB !== '' &&
        match?.scoreB !== null &&
        match?.scoreB !== undefined &&
        Number.isFinite(scoreA) &&
        Number.isFinite(scoreB);

    if (!isValid) return null;
    if (scoreA === scoreB) return 'draw';
    return scoreA > scoreB ? 'A' : 'B';
}

function TeamSelect({
                        value,
                        field,
                        allGroups = [],
                        unavailableTeamIds,
                        getTeamLabelById,
                        onTeamChange,
                    }) {
    return (
        <select
            value={value || ''}
            onChange={(event) => onTeamChange?.(field, event.target.value)}
        >
            <option value="">À sélectionner</option>

            {(allGroups || []).map((group) => (
                <optgroup key={group.id || group.name} label={group.name}>
                    {(group.teams || []).map((team) => {
                        const isUnavailable =
                            team.id !== value && unavailableTeamIds.has(team.id);

                        return (
                            <option
                                key={team.id}
                                value={team.id}
                                disabled={isUnavailable}
                            >
                                {getTeamLabelById?.(team.id) || team.name}
                            </option>
                        );
                    })}
                </optgroup>
            ))}
        </select>
    );
}

function FinalTeamRow({
                          match,
                          field,
                          editableTeams,
                          allGroups,
                          unavailableTeamIds,
                          getTeamNameById,
                          getTeamLabelById,
                          onTeamChange,
                          isWinner,
                      }) {
    const teamId = match?.[field] || '';

    return (
        <div className={`bracket-team-row ${isWinner ? 'winner' : ''}`}>
            <div className="bracket-team-name">
                {editableTeams ? (
                    <TeamSelect
                        value={teamId}
                        field={field}
                        allGroups={allGroups}
                        unavailableTeamIds={unavailableTeamIds}
                        getTeamLabelById={getTeamLabelById}
                        onTeamChange={onTeamChange}
                    />
                ) : (
                    getTeamNameById?.(teamId) || 'À déterminer'
                )}
            </div>
        </div>
    );
}

function FinalMatchCard({
                            title,
                            match,
                            accent = '',
                            editableTeams = false,
                            allGroups = [],
                            unavailableTeamIds,
                            getTeamNameById,
                            getTeamLabelById,
                            onTeamChange,
                            onScoreChange,
                            matchFormatKey = 'D1',
                        }) {
    const unavailableIds = normalizeUnavailableIds(unavailableTeamIds);
    const winner = getWinner(match);

    function handleScoreChange(scoreA, scoreB, metadata = {}) {
        const formatKey = metadata.formatKey || matchFormatKey || 'D1';

        onScoreChange?.('scoreDetail', {
            ...metadata,
            scoreA,
            scoreB,
            formatKey,
        });
    }

    return (
        <article className={`bracket-match ${accent || ''}`}>
            <div className="bracket-match-header">{title}</div>

            <FinalTeamRow
                match={match}
                field="teamAId"
                editableTeams={editableTeams}
                allGroups={allGroups}
                unavailableTeamIds={unavailableIds}
                getTeamNameById={getTeamNameById}
                getTeamLabelById={getTeamLabelById}
                onTeamChange={onTeamChange}
                isWinner={winner === 'A'}
            />

            <div className="bracket-vs">VS</div>

            <FinalTeamRow
                match={match}
                field="teamBId"
                editableTeams={editableTeams}
                allGroups={allGroups}
                unavailableTeamIds={unavailableIds}
                getTeamNameById={getTeamNameById}
                getTeamLabelById={getTeamLabelById}
                onTeamChange={onTeamChange}
                isWinner={winner === 'B'}
            />

            <MatchScoreEditor
                match={match}
                globalFormatKey={matchFormatKey || 'D1'}
                onScoreChange={handleScoreChange}
            />
        </article>
    );
}

export default FinalMatchCard;
