import LoginPage from './LoginPage.jsx';

function formatTrialDate(value) {
    if (!value) return '';

    try {
        return new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
        }).format(new Date(value));
    } catch {
        return '';
    }
}

function LoadingAccessPage() {
    return (
        <main className="app auth-page">
            <section className="card full-width auth-card">
                <h1>Chargement de Padelingo...</h1>
                <p className="note">Vérification de ton accès en cours.</p>
            </section>
        </main>
    );
}

function BlockedAccountPage({ auth }) {
    return (
        <main className="app auth-page">
            <section className="card full-width auth-card">
                <h1>Compte en vérification</h1>
                <p className="note">
                    Ton compte est actuellement limité ou bloqué par sécurité.
                    Si tu penses qu’il s’agit d’une erreur, contacte le support Padelingo.
                </p>

                <button type="button" className="danger" onClick={auth.signOut}>
                    Se déconnecter
                </button>
            </section>
        </main>
    );
}

function SubscriptionRequiredPage({ auth }) {
    const trialEnd = formatTrialDate(auth.accessStatus?.trialEndsAt);

    return (
        <main className="app auth-page">
            <section className="card full-width auth-card">
                <p className="badge">Padelingo</p>

                <h1>Abonnement requis</h1>

                <p className="note">
                    Ton essai gratuit de 7 jours est terminé.
                    Pour continuer à utiliser Padelingo, tu devras activer un abonnement.
                </p>

                {trialEnd ? (
                    <p className="note">
                        Fin de l’essai : <strong>{trialEnd}</strong>
                    </p>
                ) : null}

                <div className="auth-pricing-preview">
                    <article>
                        <h3>Juge-arbitre</h3>
                        <p>29,99 € / mois</p>
                    </article>

                    <article>
                        <h3>Club / Entreprise</h3>
                        <p>44,99 € / mois ou forfaits 6 / 12 mois</p>
                    </article>
                </div>

                <p className="note">
                    Le paiement PayPal sera branché à la prochaine étape.
                </p>

                <button type="button" className="danger" onClick={auth.signOut}>
                    Se déconnecter
                </button>
            </section>
        </main>
    );
}

function AccessGate({ auth, children }) {
    if (auth.isLoading) {
        return <LoadingAccessPage />;
    }

    if (!auth.isAuthenticated) {
        return <LoginPage auth={auth} />;
    }

    if (auth.accessStatus?.accountStatus === 'blocked' || auth.accessStatus?.accountStatus === 'suspicious') {
        return <BlockedAccountPage auth={auth} />;
    }

    if (!auth.hasAccess) {
        return <SubscriptionRequiredPage auth={auth} />;
    }

    return children;
}

export default AccessGate;