const PRICING_PLANS = [
    {
        id: 'ja_monthly',
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
        id: 'club_monthly',
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
        id: 'club_6_months',
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
        id: 'club_yearly',
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

function PricingCard({ plan, onSelectPlan }) {
    function handleSelectPlan() {
        if (typeof onSelectPlan === 'function') {
            onSelectPlan(plan);
            return;
        }

        alert(
            'Le paiement PayPal sera ajouté à la prochaine étape.\n\n' +
            `Offre sélectionnée : ${plan.title}`
        );
    }

    return (
        <article className={`pricing-card ${plan.highlight ? 'featured' : ''}`}>
            {plan.badge ? <span className="pricing-badge">{plan.badge}</span> : null}

            <h3>{plan.title}</h3>
            <p className="pricing-audience">{plan.audience}</p>

            <div className="pricing-price">
                <strong>{plan.price}</strong>
                <span>{plan.billing}</span>
            </div>

            <ul>
                {plan.features.map((feature) => (
                    <li key={`${plan.id}-${feature}`}>{feature}</li>
                ))}
            </ul>

            <button type="button" className="primary" onClick={handleSelectPlan}>
                Choisir cette offre
            </button>
        </article>
    );
}

function PricingPlans({ onSelectPlan = null }) {
    return (
        <div className="pricing-grid">
            {PRICING_PLANS.map((plan) => (
                <PricingCard
                    key={plan.id}
                    plan={plan}
                    onSelectPlan={onSelectPlan}
                />
            ))}
        </div>
    );
}

export { PRICING_PLANS };
export default PricingPlans;