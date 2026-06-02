function formatTrialDate(value) {
    if (!value) return '';

    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
        }).format(new Date(value));
    } catch {
        return '';
    }
}

function getAccessLabel(auth) {
    if (auth?.hasFullAccess) {
        return 'Premium actif';
    }

    if (auth?.accessStatus?.isTrialActive) {
        return 'Essai gratuit actif';
    }

    return 'Accès limité';
}

function getAccessDetails(auth) {
    if (auth?.hasFullAccess) {
        return 'Exports, sauvegardes étendues et live spectateurs activés.';
    }

    if (auth?.accessStatus?.isTrialActive) {
        const trialEnd = formatTrialDate(auth.accessStatus.trialEndsAt);

        return trialEnd
            ? `Essai gratuit jusqu’au ${trialEnd}.`
            : 'Essai gratuit de 7 jours en cours.';
    }

    return 'Abonnement requis pour continuer.';
}

function AppHeader({ auth }) {
    const userEmail = auth?.user?.email || '';
    const accessLabel = getAccessLabel(auth);
    const accessDetails = getAccessDetails(auth);

    return (
        <header className="hero">
            <div>
                <p className="badge">Padelingo</p>
                <h1>Gestion des matchs et classement automatique</h1>
                <p className="subtitle">
                    Import XLSX / CSV, base joueurs modifiable, serpentin manuel, poules automatiques,
                    rotations simultanées, phase finale et classement final.
                </p>
            </div>

            {auth?.isAuthenticated ? (
                <aside className="account-card">
                    <span className={`account-status ${auth.hasFullAccess ? 'premium' : 'trial'}`}>
                        {accessLabel}
                    </span>

                    <strong>{userEmail}</strong>

                    <p>{accessDetails}</p>

                    <button type="button" className="small-btn" onClick={auth.signOut}>
                        Se déconnecter
                    </button>
                </aside>
            ) : null}
        </header>
    );
}

export default AppHeader;