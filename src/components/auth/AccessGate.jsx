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

function PricingCard({
                         title,
                         audience,
                         price,
                         billing,
                         highlight,
                         features,
                         badge,
                     }) {
    function handleUnavailablePayment() {
        alert(
            'Le paiement PayPal sera ajouté à la prochaine étape.\n\n' +
            `Offre sélectionnée : ${title}`
        );
    }

    return (
        <article className={`pricing-card ${highlight ? 'featured' : ''}`}>
            {badge ? <span className="pricing-badge">{badge}</span> : null}

            <h3>{title}</h3>
            <p className="pricing-audience">{audience}</p>

            <div className="pricing-price">
                <strong>{price}</strong>
                <span>{billing}</span>
            </div>

            <ul>
                {features.map((feature) => (
                    <li key={feature}>{feature}</li>
                ))}
            </ul>

            <button type="button" className="primary" onClick={handleUnavailablePayment}>
                Choisir cette offre
            </button>
        </article>
    );
}

function SubscriptionRequiredPage({ auth }) {
    const trialEnd = formatTrialDate(auth.accessStatus?.trialEndsAt);

    const pricingPlans = [
        {
            title: 'Juge-arbitre',
            audience: 'Pour les juges-arbitres indépendants et organisateurs ponctuels.',
            price: '29,99 €',
            billing: '/ mois · sans engagement',
            badge: 'Individuel',
            features: [
                'Accès complet à Padelingo',
                'Exports PDF / CSV / XLSX / JSON',
                'Partage live spectateurs',
                'Sauvegardes étendues',
                'Résiliation possible chaque mois',
            ],
        },
        {
            title: 'Club mensuel',
            audience: 'Pour les clubs, associations et structures qui veulent rester flexibles.',
            price: '44,99 €',
            billing: '/ mois · sans engagement',
            badge: 'Club',
            features: [
                'Accès complet à Padelingo',
                'Exports complets',
                'Partage live spectateurs',
                'Sauvegardes étendues',
                'Sans engagement',
            ],
        },
        {
            title: 'Club semestriel',
            audience: 'Pour les clubs qui utilisent Padelingo régulièrement sur la saison.',
            price: '209,94 €',
            billing: '/ 6 mois · équivalent 34,99 € / mois',
            badge: 'Économie',
            features: [
                'Accès complet pendant 6 mois',
                'Prix réduit par rapport au mensuel',
                'Exports et live inclus',
                'Sauvegardes étendues',
                'Facturation semestrielle',
            ],
        },
        {
            title: 'Club annuel',
            audience: 'Pour les clubs qui veulent le meilleur tarif sur l’année.',
            price: '359,88 €',
            billing: '/ an · équivalent 29,99 € / mois',
            badge: 'Meilleur tarif',
            highlight: true,
            features: [
                'Accès complet pendant 1 an',
                'Meilleur prix mensuel équivalent',
                'Exports et live inclus',
                'Sauvegardes étendues',
                'Facturation annuelle',
            ],
        },
    ];

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

                <div className="pricing-grid">
                    {pricingPlans.map((plan) => (
                        <PricingCard key={plan.title} {...plan} />
                    ))}
                </div>

                <p className="note">
                    Le paiement PayPal sécurisé sera branché à la prochaine étape. Une fois le paiement actif,
                    l’accès complet sera automatiquement débloqué.
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