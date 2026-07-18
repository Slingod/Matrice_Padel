import PricingPlans from './PricingPlans.jsx';

function SubscriptionPage({ ctx }) {
    const auth = ctx?.auth;
    const hasFullAccess = Boolean(auth?.hasFullAccess);
    const isTrialActive = Boolean(auth?.accessStatus?.isTrialActive);

    async function handleSubscriptionRegistered() {
        if (typeof auth?.refreshAuthState === 'function') {
            await auth.refreshAuthState();
            return;
        }

        if (typeof auth?.refreshAccessStatus === 'function') {
            await auth.refreshAccessStatus();
        }
    }

    return (
        <section className="card full-width subscription-page">
            <div className="section-head">
                <div>
                    <p className="badge">Offres Padelingo</p>
                    <h2>Choisis l’offre adaptée à ton usage</h2>

                    <p className="note">
                        Pendant l’essai gratuit, tu peux découvrir Padelingo.
                        Les exports complets, les sauvegardes étendues et le partage
                        live spectateurs sont réservés aux abonnés.
                    </p>

                    {hasFullAccess ? (
                        <p className="note">
                            Ton compte dispose actuellement d’un accès premium :
                            exports, live spectateurs et sauvegardes étendues sont activés.
                        </p>
                    ) : isTrialActive ? (
                        <p className="note">
                            Ton essai gratuit est actif. Tu peux souscrire maintenant
                            ou attendre la fin de la période d’essai.
                        </p>
                    ) : (
                        <p className="note">
                            Ton essai est terminé. Choisis une offre pour retrouver
                            l’accès complet à Padelingo.
                        </p>
                    )}
                </div>
            </div>

            <PricingPlans
                onSubscriptionRegistered={handleSubscriptionRegistered}
            />

            <div className="subscription-legal-note">
                <p className="note">
                    Les paiements sont sécurisés par PayPal.
                    Les formules sans engagement sont renouvelées chaque mois jusqu’à résiliation.
                </p>

                <p className="note">
                    Les formules avec engagement sont prélevées mensuellement pendant
                    6 ou 12 mois, puis prennent fin après le dernier cycle, sous réserve
                    que les plans PayPal soient configurés avec un nombre de cycles limité.
                </p>

                <p className="note">
                    Les prix sont affichés en euros. Les informations fiscales applicables
                    et les conditions de facturation doivent figurer dans les conditions
                    générales de vente et sur les factures.
                </p>
            </div>
        </section>
    );
}

export default SubscriptionPage;
