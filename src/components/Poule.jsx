import { useEffect, useState } from 'react';
import { FaCog } from 'react-icons/fa';
import { getWinner } from '../utils/tournament';
import MatchScoreEditor from './MatchScoreEditor.jsx';
import { getStoredMatchScore } from '../utils/matchScoreStorage';

function isFilledRankingScore(value) {
    return value !== '' && value !== null && value !== undefined;
}

function computeStoredSetScoreForRanking(scoreDetail = {}) {
    if (isFilledRankingScore(scoreDetail.scoreA) && isFilledRankingScore(scoreDetail.scoreB)) {
        return {
            scoreA: scoreDetail.scoreA,
            scoreB: scoreDetail.scoreB,
        };
    }

    if (!Array.isArray(scoreDetail.sets)) {
        return {
            scoreA: '',
            scoreB: '',
        };
    }

    let wonA = 0;
    let wonB = 0;
    const requiredSets = scoreDetail.formatKey === 'D1' || scoreDetail.formatKey === 'D2' || scoreDetail.formatKey === 'E' ? 1 : 2;

    for (const set of scoreDetail.sets) {
        if (!isFilledRankingScore(set?.scoreA) || !isFilledRankingScore(set?.scoreB)) continue;

        const scoreA = Number(set.scoreA);
        const scoreB = Number(set.scoreB);

        if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) continue;

        if (scoreA > scoreB) {
            wonA += 1;
        } else {
            wonB += 1;
        }

        if (wonA >= requiredSets || wonB >= requiredSets) break;
    }

    return {
        scoreA: wonA >= requiredSets || wonB >= requiredSets ? String(wonA) : '',
        scoreB: wonA >= requiredSets || wonB >= requiredSets ? String(wonB) : '',
    };
}

function hydrateMatchForRanking(match) {
    const storedScore = getStoredMatchScore(match?.id);
    const scoreDetail = match?.scoreDetail || storedScore;

    if (!scoreDetail) return match;

    const globalScore = computeStoredSetScoreForRanking(scoreDetail);

    return {
        ...match,
        scoreA: isFilledRankingScore(match?.scoreA) ? match.scoreA : globalScore.scoreA,
        scoreB: isFilledRankingScore(match?.scoreB) ? match.scoreB : globalScore.scoreB,
        scoreDetail: {
            ...scoreDetail,
            scoreA: isFilledRankingScore(scoreDetail.scoreA) ? scoreDetail.scoreA : globalScore.scoreA,
            scoreB: isFilledRankingScore(scoreDetail.scoreB) ? scoreDetail.scoreB : globalScore.scoreB,
        },
        formatKey: scoreDetail.formatKey || match?.formatKey,
        matchFormatKey: scoreDetail.formatKey || match?.matchFormatKey,
    };
}

function hydratePoolMatchesForRanking(matches = []) {
    return (matches || []).map(hydrateMatchForRanking);
}


function sortMatchesForDisplay(matches) {
    return [...(matches || [])].sort((a, b) => {
        if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
        return (a.localCourt || 0) - (b.localCourt || 0);
    });
}

function Poule({ ctx }) {
    const [matchScoreRefreshKey, setMatchScoreRefreshKey] = useState(0);
    void matchScoreRefreshKey;


function getDisplayPointsDiff(match) {
    const detail = match?.scoreDetail || {};
    const pointsA = Number(detail.pointsA);
    const pointsB = Number(detail.pointsB);

    if (Number.isFinite(pointsA) && Number.isFinite(pointsB) && (pointsA !== 0 || pointsB !== 0)) {
        return {
            diffA: pointsA - pointsB,
            diffB: pointsB - pointsA,
        };
    }

    if (Array.isArray(detail.sets)) {
        const points = detail.sets.reduce(
            (acc, set) => {
                if (!isFilledRankingScore(set?.scoreA) || !isFilledRankingScore(set?.scoreB)) {
                    return acc;
                }

                const scoreA = Number(set.scoreA);
                const scoreB = Number(set.scoreB);

                if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
                    return acc;
                }

                return {
                    pointsA: acc.pointsA + scoreA,
                    pointsB: acc.pointsB + scoreB,
                };
            },
            { pointsA: 0, pointsB: 0 }
        );

        if (points.pointsA !== 0 || points.pointsB !== 0) {
            return {
                diffA: points.pointsA - points.pointsB,
                diffB: points.pointsB - points.pointsA,
            };
        }
    }

    return {
        diffA: '',
        diffB: '',
    };
}
    useEffect(() => {
        const handleMatchScoreChangeEvent = () => {
            setMatchScoreRefreshKey((value) => value + 1);
        };

        window.addEventListener('padelingo:match-score-change', handleMatchScoreChangeEvent);

        return () => {
            window.removeEventListener('padelingo:match-score-change', handleMatchScoreChangeEvent);
        };
    }, []);


    const {
        activePool,
        displayCourtLabel,
        displayMatchCourtLabel,
        editingMatchCourtId,
        formatRank,
        getTeamNameById,
        handleMatchCourtOverrideChange,
        handleMatchScoreChange,
        ranking,
        setEditingMatchCourtId,
    } = ctx;

    function resetMatchCourtOverride(matchId) {
        handleMatchCourtOverrideChange(matchId, '');
        setEditingMatchCourtId(null);
    }

    if (!activePool) {
        return (
            <main className="layout">
                <section className="card full-width">
                    <h2>Aucune poule sélectionnée</h2>
                    <p className="empty-text">Sélectionne ou crée une poule pour afficher les matchs.</p>
                </section>
            </main>
        );
    }

    return (
        <main className="layout">
            <section className="card">
                <h2>{activePool.name} — Équipes</h2>
                {activePool.teams.length === 0 ? (
                    <p className="empty-text">Aucune équipe placée dans cette poule via le serpentin.</p>
                ) : (
                    <div className="team-list">
                        {activePool.teams.map((team, index) => (
                            <div key={team.id} className="team-item team-item-advanced">
                                <div className="team-main">
                                    <span className="team-index">{index + 1}.</span>
                                    <span className="team-name">
                                        {team.name}
                                        {team.cumulativeRank
                                            ? ` — Rang cumulé: ${formatRank(team.cumulativeRank)}`
                                            : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="card">
                <h2>{activePool.name} — Matchs</h2>
                <p className="note">
                    Les formats A1 à E sont pris en charge. Le score global du match est calculé automatiquement
                    en sets gagnés : 2-0, 2-1, 1-2, etc.
                </p>

                {activePool.matches.length === 0 ? (
                    <p className="empty-text">
                        Place au moins 2 équipes dans le serpentin pour générer des matchs.
                    </p>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                            <tr>
                                <th>Rotation</th>
                                <th>Équipe 1</th>
                                <th>Terrain</th>
                                <th>Score / Sets</th>
                                <th>Équipe 2</th>
                                <th>Diff 1</th>
                                <th>Diff 2</th>
                            </tr>
                            </thead>
                            <tbody>
                            {sortMatchesForDisplay(activePool.matches).map((match) => {
                                const winner = getWinner(match);
                                const { diffA, diffB } = getDisplayPointsDiff(match);

                                return (
                                    <tr key={match.id}>
                                        <td>{match.round || 1}</td>
                                        <td className={winner === 'A' ? 'winner-text' : ''}>
                                            {getTeamNameById(match.teamAId)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <strong>{displayMatchCourtLabel(match)}</strong>
                                                <button
                                                    type="button"
                                                    className="small-btn"
                                                    title="Changer le terrain pour ce match uniquement"
                                                    onClick={() =>
                                                        setEditingMatchCourtId((currentId) =>
                                                            currentId === match.id ? null : match.id
                                                        )
                                                    }
                                                >
                                                    <FaCog />
                                                </button>
                                            </div>

                                            {editingMatchCourtId === match.id && (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '0.35rem',
                                                        alignItems: 'center',
                                                        marginTop: '0.45rem',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        value={match.courtOverride || ''}
                                                        onChange={(event) =>
                                                            handleMatchCourtOverrideChange(match.id, event.target.value)
                                                        }
                                                        placeholder={`Terrain ${displayCourtLabel(match.localCourt || 1)}`}
                                                        style={{ width: 110 }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="small-btn"
                                                        onClick={() => resetMatchCourtOverride(match.id)}
                                                        title="Revenir au terrain de base"
                                                    >
                                                        Base
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <MatchScoreEditor
                                                match={match}
                                                globalFormatKey={ctx.matchFormatKey || 'D1'}
                                                onScoreChange={(scoreA, scoreB, scoreDetail) =>
                                                    handleMatchScoreChange(
                                                        match.id,
                                                        'scoreDetail',
                                                        {
                                                            ...(scoreDetail || {}),
                                                            scoreA,
                                                            scoreB,
                                                        },
                                                        scoreDetail
                                                    )
                                                }
                                            />
                                        </td>
                                        <td className={winner === 'B' ? 'winner-text' : ''}>
                                            {getTeamNameById(match.teamBId)}
                                        </td>
                                        <td>{diffA === '' ? '' : diffA > 0 ? `+${diffA}` : diffA}</td>
                                        <td>{diffB === '' ? '' : diffB > 0 ? `+${diffB}` : diffB}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="card full-width">
                <h2>{activePool.name} — Classement</h2>
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
                        {ranking.length === 0 ? (
                            <tr>
                                <td colSpan="10">Aucun classement disponible pour le moment.</td>
                            </tr>
                        ) : (
                            ranking.map((team, index) => (
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
            </section>
        </main>
    );
}

export default Poule;
