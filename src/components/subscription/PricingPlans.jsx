import { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { supabase } from '../../lib/supabaseClient';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

const PLAN_IDS = {
    ja_monthly: import.meta.env.VITE_PAYPAL_JA_MONTHLY_PLAN_ID,
    club_monthly: import.meta.env.VITE_PAYPAL_CLUB_MONTHLY_PLAN_ID,
    club_6_months: import.meta.env.VITE_PAYPAL_CLUB_6_MONTHS_PLAN_ID,
    club_yearly: import.meta.env.VITE_PAYPAL_CLUB_YEARLY_PLAN_ID,
};

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

async function registerPendingSubscription(subscriptionId, planKey) {
    const { data, error } = await supabase.rpc(
        'register_pending_paypal_subscription',
        {
            p_paypal_subscription_id: subscriptionId,
            p_plan_key: planKey,
        }
    );

    if (error) {
        console.error('Supabase pending subscription error:', error);
        throw error;
    }

    return Array.isArray(data) ? data[0] : data;
}

function PricingCard({ plan }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const planId = PLAN_IDS[plan.id];

    async function handleApprove(data) {
        const subscriptionId = data?.subscriptionID || data?.subscription_id || '';

        console.log('PayPal subscription approved:', {
            planId,
            planKey: plan.id,
            subscriptionId,
            rawData: data,
        });

        if (!subscriptionId) {
            window.setTimeout(() => {
                alert(
                    'PayPal a validé le paiement, mais aucun Subscription ID n’a été reçu.\n\n' +
                    'Regarde la console navigateur pour voir le détail.'
                );
            }, 0);

            return;
        }

        try {
            setIsRegistering(true);

            const pendingSubscription = await registerPendingSubscription(
                subscriptionId,
                plan.id
            );

            console.log('Pending subscription registered in Supabase:', pendingSubscription);

            window.setTimeout(() => {
                alert(
                    'Abonnement PayPal Sandbox créé avec succès.\n\n' +
                    `Offre : ${plan.title}\n` +
                    `Subscription ID : ${subscriptionId}\n\n` +
                    'Ton abonnement est enregistré en attente dans Supabase.\n' +
                    'Prochaine étape : le webhook PayPal passera automatiquement cet abonnement en actif.'
                );
            }, 0);
        } catch (error) {
            console.error('Unable to register pending subscription:', error);

            window.setTimeout(() => {
                alert(
                    'L’abonnement PayPal a bien été créé, mais Padelingo n’a pas réussi à l’enregistrer dans Supabase.\n\n' +
                    `Subscription ID : ${subscriptionId}\n\n` +
                    'Regarde la console navigateur pour voir le détail.'
                );
            }, 0);
        } finally {
            setIsRegistering(false);
        }
    }

    function handleError(error) {
        console.error('PayPal subscription error:', error);

        window.setTimeout(() => {
            alert(
                'Une erreur est survenue avec PayPal Sandbox.\n\n' +
                'Regarde la console navigateur pour voir le détail.'
            );
        }, 0);
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

            <div className="paypal-button-zone">
                {isRegistering ? (
                    <button type="button" className="primary" disabled>
                        Enregistrement Supabase...
                    </button>
                ) : !planId ? (
                    <button
                        type="button"
                        className="primary"
                        onClick={() => {
                            alert(
                                `Plan PayPal manquant pour : ${plan.title}\n\n` +
                                'Vérifie tes variables VITE_PAYPAL_...PLAN_ID dans ton fichier .env, puis redémarre Vite.'
                            );
                        }}
                    >
                        Plan PayPal non configuré
                    </button>
                ) : (
                    <PayPalButtons
                        style={{
                            layout: 'vertical',
                            shape: 'pill',
                            label: 'subscribe',
                            color: 'gold',
                        }}
                        createSubscription={(_data, actions) => {
                            return actions.subscription.create({
                                plan_id: planId,
                            });
                        }}
                        onApprove={handleApprove}
                        onError={handleError}
                        disabled={isRegistering}
                    />
                )}
            </div>
        </article>
    );
}

function PricingPlans() {
    if (!PAYPAL_CLIENT_ID) {
        return (
            <div className="empty-state">
                <strong>PayPal Sandbox n’est pas configuré.</strong>
                <span>
                    Ajoute VITE_PAYPAL_CLIENT_ID dans ton fichier .env, puis redémarre Vite.
                </span>
            </div>
        );
    }

    return (
        <PayPalScriptProvider
            options={{
                clientId: PAYPAL_CLIENT_ID,
                vault: true,
                intent: 'subscription',
                currency: 'EUR',
            }}
        >
            <div className="pricing-grid">
                {PRICING_PLANS.map((plan) => (
                    <PricingCard key={plan.id} plan={plan} />
                ))}
            </div>
        </PayPalScriptProvider>
    );
}

export { PRICING_PLANS };
export default PricingPlans;