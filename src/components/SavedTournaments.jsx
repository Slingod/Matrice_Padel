import { FaFolderOpen, FaPlus, FaSave, FaTrash } from 'react-icons/fa';
import { formatSaveDate } from '../utils/persistence';

function countScoredPoolMatches(state) {
    return (state?.pools || []).reduce((total, pool) => (
        total + (pool.matches || []).filter((match) => match.scoreA !== '' && match.scoreB !== '').length
    ), 0);
}

function countTeams(state) {
    return (state?.baseTeams || []).length;
}

function getSaveSummary(save) {
    const state = save?.state || {};
    const poolsCount = (state.pools || []).length;
    const teamsCount = countTeams(state);
    const scoredMatches = countScoredPoolMatches(state);
    const format = state.matchFormat || state.format || 'D1';

    return `${poolsCount} poule${poolsCount > 1 ? 's' : ''} · ${teamsCount} équipe${teamsCount > 1 ? 's' : ''} · ${scoredMatches} score${scoredMatches > 1 ? 's' : ''} · Format poules ${format}`;
}


function SavedTournaments({ ctx }) {
    const {
        handleDeleteNamedTournament,
        handleLoadNamedTournament,
        handleSaveNamedTournament,
        handleStartNewTournament,
        savedTournaments,
        selectedTournamentSaveId,
        setSelectedTournamentSaveId,
        setTournamentSaveName,
        tournamentSaveName,
    } = ctx;

    const selectedSave = savedTournaments.find((save) => save.id === selectedTournamentSaveId) || null;

    function submitSave(event) {
        event.preventDefault();
        handleSaveNamedTournament(tournamentSaveName);
    }

    function selectSave(save) {
        setSelectedTournamentSaveId(save.id);
        setTournamentSaveName(save.name || '');
    }

    return (
        <section className="card saved-tournaments-page">
            <div className="section-head">
                <div>
                    <h2>Mes tournois sauvegardés</h2>
                    <p className="note">
                        Ici tu peux enregistrer plusieurs tournois, repartir sur un nouveau tournoi vide, puis revenir sur une ancienne sauvegarde quand tu veux.
                        Tout reste stocké uniquement sur cet appareil, sans cookie.
                        Les scores détaillés sont sauvegardés ; la colonne S, PF, PA, Diff et Total sont recalculées automatiquement au chargement.
                    </p>
                </div>
            </div>

            <div className="saved-tournaments-layout">
                <form className="saved-tournament-card saved-tournament-form" onSubmit={submitSave}>
                    <span className="saved-tournament-kicker">Tournoi actuel</span>
                    <h3>Sauvegarder le tournoi ouvert</h3>
                    <p>
                        Donne un nom clair à ta sauvegarde, par exemple “Tournoi Padel Club avril” ou “Open du dimanche matin”.
                    </p>

                    <label>
                        Nom de la sauvegarde
                        <input
                            type="text"
                            value={tournamentSaveName}
                            onChange={(event) => setTournamentSaveName(event.target.value)}
                            placeholder="Ex : Tournoi du 29/04/2026"
                        />
                    </label>

                    <button type="submit">
                        <FaSave />
                        Sauvegarder ce tournoi
                    </button>
                </form>

                <div className="saved-tournament-card saved-tournament-new">
                    <span className="saved-tournament-kicker">Nouveau départ</span>
                    <h3>Créer un nouveau tournoi</h3>
                    <p>
                        Vide le tournoi actuellement affiché, sans supprimer tes sauvegardes nommées. Tu pourras les recharger ensuite depuis cette page.
                    </p>
                    <button type="button" className="danger" onClick={handleStartNewTournament}>
                        <FaPlus />
                        Nouveau tournoi vide
                    </button>
                </div>
            </div>

            <div className="saved-tournaments-list-head">
                <div>
                    <h3>Sauvegardes disponibles</h3>
                    <p className="note">
                        {savedTournaments.length > 0
                            ? `${savedTournaments.length} sauvegarde${savedTournaments.length > 1 ? 's' : ''} trouvée${savedTournaments.length > 1 ? 's' : ''} sur cet appareil.`
                            : 'Aucune sauvegarde nommée pour le moment.'}
                    </p>
                </div>
            </div>

            {savedTournaments.length > 0 ? (
                <div className="saved-tournaments-list">
                    {savedTournaments.map((save) => {
                        const isSelected = save.id === selectedTournamentSaveId;

                        return (
                            <article key={save.id} className={`saved-tournament-row ${isSelected ? 'selected' : ''}`}>
                                <label className="saved-tournament-radio">
                                    <input
                                        type="radio"
                                        name="selected-tournament-save"
                                        checked={isSelected}
                                        onChange={() => selectSave(save)}
                                    />
                                    <span>
                    <strong>{save.name}</strong>
                    <small>Dernière sauvegarde : {formatSaveDate(save.updatedAt)}</small>
                    <small>{getSaveSummary(save)}</small>
                  </span>
                                </label>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state saved-empty-state">
                    <strong>Aucun tournoi sauvegardé</strong>
                    <span>Renseigne un nom, puis clique sur “Sauvegarder ce tournoi”.</span>
                </div>
            )}

            <div className="saved-tournament-actions">
                <div>
                    <strong>{selectedSave ? selectedSave.name : 'Aucune sauvegarde sélectionnée'}</strong>
                    <span>{selectedSave ? `Mise à jour : ${formatSaveDate(selectedSave.updatedAt)}` : 'Sélectionne une sauvegarde pour la charger ou la supprimer.'}</span>
                </div>

                <button type="button" onClick={handleLoadNamedTournament} disabled={!selectedTournamentSaveId}>
                    <FaFolderOpen />
                    Charger
                </button>

                <button type="button" className="danger" onClick={handleDeleteNamedTournament} disabled={!selectedTournamentSaveId}>
                    <FaTrash />
                    Supprimer
                </button>
            </div>
        </section>
    );
}

export default SavedTournaments;
