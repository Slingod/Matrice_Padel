import {
    FaCog,
    FaFileCsv,
    FaFileExcel,
    FaFileImport,
    FaSave,
} from 'react-icons/fa';
import {
    exportTournamentToCSV,
    exportTournamentToXLS,
    exportTournamentToXLSX,
} from '../../utils/importExport';

function AppToolbar({ ctx }) {
    const {
        activeTab,
        baseTeams,
        combinedPointsRanking,
        courtCount,
        courtLabels,
        finalRanking,
        matchFormatKey,
        handleAddPool,
        handleCourtLabelChange,
        handleExportJson,
        handleImportFile,
        importInputRef,
        isCourtSettingsOpen,
        newPoolName,
        pools,
        resetCourtLabels,
        safeFinalStage,
        saveNotice,
        serpentin,
        setActiveTab,
        setCourtCount,
        setIsCourtSettingsOpen,
        setNewPoolName,
    } = ctx;

    const hasFullAccess = Boolean(ctx.auth?.hasFullAccess);

    function requireFullAccess(featureName) {
        if (hasFullAccess) return true;

        alert(
            `${featureName} est réservé aux abonnés Padelingo.\n\n` +
            `Pendant l’essai gratuit, tu peux importer, créer et tester un tournoi, ` +
            `mais les exports complets sont disponibles avec un abonnement.`
        );

        return false;
    }

    function handleProtectedJsonExport() {
        if (!requireFullAccess('L’export JSON')) return;
        handleExportJson();
    }

    function handleProtectedCsvExport() {
        if (!requireFullAccess('L’export CSV')) return;

        exportTournamentToCSV(
            baseTeams,
            pools,
            serpentin,
            safeFinalStage,
            finalRanking,
            combinedPointsRanking,
            courtCount,
            {
                activeTab,
                courtLabels,
                matchFormatKey,
            }
        );
    }

    function handleProtectedXlsExport() {
        if (!requireFullAccess('L’export XLS')) return;

        exportTournamentToXLS(
            baseTeams,
            pools,
            serpentin,
            safeFinalStage,
            finalRanking,
            combinedPointsRanking,
            courtCount,
            {
                activeTab,
                courtLabels,
                matchFormatKey,
            }
        );
    }

    function handleProtectedXlsxExport() {
        if (!requireFullAccess('L’export XLSX')) return;

        exportTournamentToXLSX(
            baseTeams,
            pools,
            serpentin,
            safeFinalStage,
            finalRanking,
            combinedPointsRanking,
            courtCount,
            {
                activeTab,
                courtLabels,
                matchFormatKey,
            }
        );
    }

    return (
        <section className="tabs-card">
            <div className="tabs">
                <button
                    type="button"
                    className={`tab-button ${activeTab === 'base' ? 'active' : ''}`}
                    onClick={() => setActiveTab('base')}
                >
                    Base
                </button>

                <button
                    type="button"
                    className={`tab-button ${activeTab === 'serpentin' ? 'active' : ''}`}
                    onClick={() => setActiveTab('serpentin')}
                >
                    Serpentin
                </button>

                <button
                    type="button"
                    className={`tab-button ${activeTab === 'planning' ? 'active' : ''}`}
                    onClick={() => setActiveTab('planning')}
                >
                    Planning
                </button>

                {pools.map((pool) => (
                    <button
                        key={pool.id}
                        type="button"
                        className={`tab-button ${activeTab === pool.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(pool.id)}
                    >
                        {pool.name}
                    </button>
                ))}

                <button
                    type="button"
                    className={`tab-button ${activeTab === 'finals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('finals')}
                >
                    Phase finale
                </button>

                <button
                    type="button"
                    className={`tab-button ${activeTab === 'final-ranking' ? 'active' : ''}`}
                    onClick={() => setActiveTab('final-ranking')}
                >
                    Classement final
                </button>

                <button
                    type="button"
                    className={`tab-button tab-button-save ${activeTab === 'saves' ? 'active' : ''}`}
                    onClick={() => setActiveTab('saves')}
                >
                    Mes tournois
                </button>

                <button
                    type="button"
                    className={`tab-button ${activeTab === 'subscription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subscription')}
                >
                    Offres
                </button>
            </div>

            <div className="top-actions-grid">
                <form className="add-pool-form" onSubmit={handleAddPool}>
                    <input
                        type="text"
                        placeholder="Nouvelle poule"
                        value={newPoolName}
                        onChange={(event) => setNewPoolName(event.target.value)}
                    />
                    <button type="submit">Ajouter une Poule</button>
                </form>

                <div className="export-actions">
                    <div className="native-import-zone">
                        <label htmlFor="padelingo-import-file" className="native-import-label">
                            <FaFileImport />
                            Importer un tournoi
                        </label>

                        <input
                            id="padelingo-import-file"
                            ref={importInputRef}
                            type="file"
                            accept=".xls,.xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
                            onClick={(event) => {
                                event.currentTarget.value = '';
                            }}
                            onChange={handleImportFile}
                        />

                        <small>Formats acceptés : XLS, XLSX, CSV ou JSON</small>
                    </div>

                    <label
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'white',
                        }}
                    >
                        Terrains dispo
                        <input
                            type="number"
                            min="1"
                            value={courtCount}
                            onChange={(event) =>
                                setCourtCount(Math.max(1, Number(event.target.value) || 1))
                            }
                            style={{ width: 90 }}
                        />
                    </label>

                    <button
                        type="button"
                        title="Modifier la numérotation des terrains"
                        onClick={() => setIsCourtSettingsOpen((prev) => !prev)}
                    >
                        <FaCog />
                        Terrains
                    </button>

                    <button type="button" onClick={handleProtectedJsonExport}>
                        <FaSave />
                        Exporter JSON
                    </button>

                    <button type="button" onClick={handleProtectedCsvExport}>
                        <FaFileCsv />
                        Exporter CSV
                    </button>

                    <button type="button" onClick={handleProtectedXlsExport}>
                        <FaFileExcel />
                        Exporter XLS
                    </button>

                    <button type="button" onClick={handleProtectedXlsxExport}>
                        <FaFileExcel />
                        Exporter XLSX
                    </button>
                </div>

                {saveNotice && (
                    <div
                        className={`autosave-info ${saveNotice.type || 'success'}`}
                        role="status"
                        aria-live="polite"
                    >
                        <strong>{saveNotice.title}</strong>
                        <span>{saveNotice.message}</span>
                    </div>
                )}
            </div>

            {isCourtSettingsOpen && (
                <div
                    className="card"
                    style={{
                        marginTop: '1rem',
                        background: 'rgba(255,255,255,0.08)',
                    }}
                >
                    <div className="section-head">
                        <div>
                            <h2>Numérotation manuelle des terrains</h2>
                            <p className="note">
                                Modifie ici le numéro affiché pour chaque terrain. Exemple : le terrain interne 1 peut devenir le terrain réel 3, selon l’organisation du complexe. Dans le tableau des matchs, l’engrenage de chaque ligne permet aussi de changer le terrain uniquement pour ce match.
                            </p>
                        </div>
                        <button type="button" onClick={resetCourtLabels}>
                            Réinitialiser
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.75rem',
                        }}
                    >
                        {courtLabels.map((label, index) => (
                            <label
                                key={`court-label-${index}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                    color: 'white',
                                }}
                            >
                                Terrain interne {index + 1}
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(event) =>
                                        handleCourtLabelChange(index, event.target.value)
                                    }
                                    placeholder={`Terrain ${index + 1}`}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

export default AppToolbar;
