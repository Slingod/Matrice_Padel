import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    getLiveTournament,
    subscribeToLiveTournament,
} from '../services/liveTournamentService';
import { computeRanking } from '../utils/tournament';

function isFilled(value) {
    return value !== '' && value !== null && value !== undefined;
}

function getRequiredSets(formatKey, sets = []) {
    if (formatKey === 'D1' || formatKey === 'D2' || formatKey === 'E') return 1;
    if (sets.length <= 1) return 1;
    return 2;
}

function computeScoreFromSets(sets = [], formatKey = 'D1') {
    const requiredSets = getRequiredSets(formatKey, sets);
    let wonA = 0;
    let wonB = 0;

    for (const set of sets) {
        if (!isFilled(set?.scoreA) || !isFilled(set?.scoreB)) continue;

        const scoreA = Number(set.scoreA);
        const scoreB = Number(set.scoreB);

        if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) continue;

        if (scoreA > scoreB) {
            wonA += 1;
        } else {
            wonB += 1;
        }

        if (wonA >= requiredSets || wonB >= requiredSets) {
            break;
        }
    }

    const isComplete = wonA >= requiredSets || wonB >= requiredSets;

    return {
        scoreA: isComplete ? String(wonA) : '',
        scoreB: isComplete ? String(wonB) : '',
    };
}

function getNormalizedMatchScore(match = {}) {
    if (isFilled(match.scoreA) && isFilled(match.scoreB)) {
        return {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
        };
    }

    const detail = match.scoreDetail || {};

    if (isFilled(detail.scoreA) && isFilled(detail.scoreB)) {
        return {
            scoreA: detail.scoreA,
            scoreB: detail.scoreB,
        };
    }

    if (Array.isArray(detail.sets)) {
        return computeScoreFromSets(detail.sets, detail.formatKey || match.formatKey || match.matchFormatKey || 'D1');
    }

    return {
        scoreA: '',
        scoreB: '',
    };
}

function normalizeMatchForLive(match = {}) {
    const normalizedScore = getNormalizedMatchScore(match);

    return {
        ...match,
        scoreA: normalizedScore.scoreA,
        scoreB: normalizedScore.scoreB,
    };
}

function getTeamNameById(state, teamId) {
    const allTeams = state?.baseTeams || [];
    const team = allTeams.find((item) => item.id === teamId);

    if (team?.name) return team.name;

    for (const pool of state?.pools || []) {
        const found = (pool.teams || []).find((item) => item.id === teamId);
        if (found?.name) return found.name;
    }

    return teamId ? 'Équipe inconnue' : 'À déterminer';
}

function formatScore(value) {
    return value === '' || value === null || value === undefined ? '-' : value;
}

function formatSetsDetail(match = {}) {
    const sets = match?.scoreDetail?.sets;

    if (!Array.isArray(sets) || sets.length === 0) {
        return '-';
    }

    const parts = sets
        .map((set) => {
            const hasA = isFilled(set?.scoreA);
            const hasB = isFilled(set?.scoreB);

            if (!hasA && !hasB) return null;

            return `${formatScore(set?.scoreA)}-${formatScore(set?.scoreB)}`;
        })
        .filter(Boolean);

    return parts.length > 0 ? parts.join(' / ') : '-';
}

function LiveMatchRow({ state, match, label }) {
    const normalizedMatch = normalizeMatchForLive(match);
    const scoreA = formatScore(normalizedMatch.scoreA);
    const scoreB = formatScore(normalizedMatch.scoreB);
    const setsDetail = formatSetsDetail(match);

    return (
        <tr>
            <td>{label}</td>
            <td>{getTeamNameById(state, match.teamAId)}</td>
            <td className="live-score">{scoreA}</td>
            <td className="live-score">{scoreB}</td>
            <td className="live-sets-detail">{setsDetail}</td>
            <td>{getTeamNameById(state, match.teamBId)}</td>
        </tr>
    );
}

function PoolLiveBlock({ state, pool }) {
    const normalizedMatches = useMemo(() => {
        return (pool.matches || []).map(normalizeMatchForLive);
    }, [pool.matches]);

    const ranking = useMemo(() => {
        return computeRanking(pool.teams || [], normalizedMatches);
    }, [pool.teams, normalizedMatches]);

    return (
        <section className="card full-width live-section">
            <h2>{pool.name}</h2>

            <h3>Matchs</h3>
            <p className="note">
                Le score affiché correspond aux sets gagnés. Le détail affiche les jeux/points saisis par set.
            </p>

            <div className="table-wrapper">
                <table>
                    <thead>
                    <tr>
                        <th>Rotation</th>
                        <th>Équipe 1</th>
                        <th>Score</th>
                        <th>Score</th>
                        <th>Détail sets</th>
                        <th>Équipe 2</th>
                    </tr>
                    </thead>
                    <tbody>
                    {normalizedMatches.length === 0 ? (
                        <tr>
                            <td colSpan="6">Aucun match pour le moment.</td>
                        </tr>
                    ) : (
                        [...normalizedMatches]
                            .sort((a, b) => {
                                if ((a.round || 0) !== (b.round || 0)) return (a.round || 0) - (b.round || 0);
                                return (a.localCourt || 0) - (b.localCourt || 0);
                            })
                            .map((match, index) => (
                                <LiveMatchRow
                                    key={match.id || index}
                                    state={state}
                                    match={match}
                                    label={`R${match.round || 1} / T${match.localCourt || 1}`}
                                />
                            ))
                    )}
                    </tbody>
                </table>
            </div>

            <h3>Classement</h3>
            <div className="table-wrapper">
                <table>
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>Équipe</th>
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
                            <td colSpan="9">Aucun classement pour le moment.</td>
                        </tr>
                    ) : (
                        ranking.map((team, index) => (
                            <tr key={team.teamId}>
                                <td>{index + 1}</td>
                                <td>{team.teamName}</td>
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
    );
}

function FinalStageLiveBlock({ state }) {
    const stage = state?.finalStage;
    if (!stage) return null;

    const rows = [];

    if (stage.settings?.entryRound === 'round16') {
        (stage.roundOf16 || []).forEach((match, index) => {
            rows.push({ label: `Huitième ${index + 1}`, match });
        });
    }

    if (stage.settings?.entryRound === 'round16' || stage.settings?.entryRound === 'quarter') {
        (stage.quarterFinals || []).forEach((match, index) => {
            rows.push({ label: `Quart ${index + 1}`, match });
        });
    }

    (stage.semiFinals || []).forEach((match, index) => {
        rows.push({ label: `Demi ${index + 1}`, match });
    });

    if (stage.settings?.enableThirdPlaceMatch && stage.thirdPlace) {
        rows.push({ label: 'Petite finale', match: stage.thirdPlace });
    }

    if (stage.settings?.enablePlacement5to8) {
        (stage.placement5to8Semis || []).forEach((match, index) => {
            rows.push({ label: `Classement 5-8 / Demi ${index + 1}`, match });
        });

        if (stage.placement5to8Finals?.place5) {
            rows.push({ label: 'Match place 5', match: stage.placement5to8Finals.place5 });
        }

        if (stage.placement5to8Finals?.place7) {
            rows.push({ label: 'Match place 7', match: stage.placement5to8Finals.place7 });
        }
    }

    if (stage.final) {
        rows.push({ label: 'Finale', match: stage.final });
    }

    return (
        <section className="card full-width live-section">
            <h2>Phase finale</h2>

            <div className="table-wrapper">
                <table>
                    <thead>
                    <tr>
                        <th>Phase</th>
                        <th>Équipe 1</th>
                        <th>Score</th>
                        <th>Score</th>
                        <th>Détail sets</th>
                        <th>Équipe 2</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan="6">Phase finale non disponible pour le moment.</td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <LiveMatchRow
                                key={`${row.label}-${index}`}
                                state={state}
                                match={normalizeMatchForLive(row.match)}
                                label={row.label}
                            />
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function LiveTournamentPage() {
    const { publicId } = useParams();
    const [liveTournament, setLiveTournament] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);
                const data = await getLiveTournament(publicId);

                if (mounted) {
                    setLiveTournament(data);
                    setError('');
                }
            } catch (err) {
                console.error(err);
                if (mounted) setError('Impossible de charger le tournoi live.');
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();

        const unsubscribe = subscribeToLiveTournament(publicId, (nextData) => {
            setLiveTournament(nextData);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [publicId]);

    const state = liveTournament?.state;

    return (
        <div className="app live-app">
            <header className="hero live-hero">
                <div>
                    <p className="badge">Padelingo Live</p>
                    <h1>{liveTournament?.name || 'Tournoi en direct'}</h1>
                    <p className="subtitle">
                        Suivi public des matchs, scores, poules et phase finale.
                        Cette page est en lecture seule.
                    </p>
                </div>
            </header>

            {loading ? (
                <section className="card">
                    <p>Chargement du tournoi...</p>
                </section>
            ) : error ? (
                <section className="card">
                    <h2>Erreur</h2>
                    <p className="note">{error}</p>
                </section>
            ) : (
                <>
                    <section className="card live-status-card">
                        <strong>Dernière mise à jour :</strong>{' '}
                        {liveTournament?.updated_at
                            ? new Intl.DateTimeFormat('fr-FR', {
                                dateStyle: 'short',
                                timeStyle: 'medium',
                            }).format(new Date(liveTournament.updated_at))
                            : 'en attente'}
                    </section>

                    {(state?.pools || []).map((pool) => (
                        <PoolLiveBlock key={pool.id} state={state} pool={pool} />
                    ))}

                    <FinalStageLiveBlock state={state} />
                </>
            )}
        </div>
    );
}

export default LiveTournamentPage;
