import PricingPlans from './PricingPlans.jsx';

function SubscriptionPage({ ctx }) {
    const auth = ctx?.auth;
    const hasFullAccess = Boolean(auth?.hasFullAccess);
    const isTrialActive = Boolean(auth?.accessStatus?.isTrialActive);

    function handleSelectPlan(plan) {
        alert(
            'Le paiement PayPal sera branché à la prochaine étape.\n\n' +
            `Offre sélectionnée : ${plan.title}\n` +
            `${plan.price} ${plan.billing}`
        );
    }

    return (
        <section className="card full-width subscription-page">
            <div className="section-head">
                <div>
                    <p className="badge">Offres Padelingo</p>
                    <h2>Choisis l’offre adaptée à ton usage</h2>

                    <p className="note">
                        Pendant l’essai gratuit, tu peux tester l’application. Les exports complets,
                        les sauvegardes étendues et le partage live spectateurs sont réservés aux abonnés.
                    </p>

                    {hasFullAccess ? (
                        <p className="note">
                            Ton compte est actuellement en accès premium : exports, live spectateurs
                            et sauvegardes étendues sont activés.
                        </p>
                    ) : isTrialActive ? (
                        <p className="note">
                            Ton essai gratuit est actif. Tu peux choisir une offre maintenant ou attendre
                            la fin de l’essai.
                        </p>
                    ) : (
                        <p className="note">
                            Ton essai est terminé. Choisis une offre pour retrouver l’accès complet.
                        </p>
                    )}
                </div>
            </div>

            <PricingPlans onSelectPlan={handleSelectPlan} />

            <p className="note subscription-legal-note">
                Les paiements PayPal sécurisés seront ajoutés à la prochaine étape.
                Les offres Club semestrielle et annuelle sont facturées en une seule fois.
            </p>
        </section>
    );
}

export default SubscriptionPage;