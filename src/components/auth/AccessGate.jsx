import LoginPage from './LoginPage.jsx';
import PricingPlans from '../subscription/PricingPlans.jsx';

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
                <p className="badge">Padelingo</p>
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
            <section className="card full-width auth-card subscription-required-card">
                <p className="badge">Padelingo</p>

                <h1>Abonnement requis</h1>

                <p className="note">
                    Ton essai gratuit de 7 jours est terminé. Pour continuer à utiliser Padelingo,
                    choisis une offre adaptée à ton usage.
                </p>

                {trialEnd ? (
                    <p className="note">
                        Fin de l’essai : <strong>{trialEnd}</strong>
                    </p>
                ) : null}

                <PricingPlans onSubscriptionRegistered={auth.reloadAccessStatus} />

                <p className="note">
                    Le paiement PayPal sécurisé débloque automatiquement l’accès complet après
                    confirmation du webhook PayPal. Si l’accès ne se met pas à jour immédiatement,
                    attends quelques secondes puis actualise la page.
                </p>

                <button type="button" className="danger" onClick={auth.signOut}>
                    Se déconnecter
                </button>
            </section>
        </main>
    );
}

function AccessGate({ auth, children }) {
    const isInitialAccessCheck =
        auth.isLoading &&
        (!auth.isAuthenticated || !auth.accessStatus);

    if (isInitialAccessCheck) {
        return <LoadingAccessPage />;
    }

    if (!auth.isAuthenticated) {
        return <LoginPage auth={auth} />;
    }

    if (
        auth.accessStatus?.accountStatus === 'blocked' ||
        auth.accessStatus?.accountStatus === 'suspicious'
    ) {
        return <BlockedAccountPage auth={auth} />;
    }

    if (!auth.hasAccess) {
        return <SubscriptionRequiredPage auth={auth} />;
    }

    return children;
}

export default AccessGate;