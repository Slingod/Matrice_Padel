import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function cleanEnvValue(value) {
    return String(value || '').replace(/\s/g, '');
}

const PAYPAL_CLIENT_ID = cleanEnvValue(import.meta.env.VITE_PAYPAL_CLIENT_ID);

const PLAN_IDS = {
    padelingo_monthly: cleanEnvValue(import.meta.env.VITE_PAYPAL_MONTHLY_PLAN_ID),
    padelingo_yearly: cleanEnvValue(import.meta.env.VITE_PAYPAL_YEARLY_PLAN_ID),
};

const PRICING_PLANS = [
    {
        id: 'padelingo_monthly',
        title: 'Padelingo Mensuel',
        audience: 'Pour tester Padelingo sans engagement et gérer tes tournois simplement.',
        price: '9,90 €',
        billing: '/ mois · sans engagement',
        badge: 'Offre lancement',
        features: [
            'Accès complet à Padelingo',
            'Création des équipes, poules, matchs et classements',
            'Gestion des scores et phases finales',
            'Exports PDF, CSV, XLSX, XLS et JSON',
            'Partage live spectateurs avec lien public et QR code',
            'Résiliation possible chaque mois',
        ],
    },
    {
        id: 'padelingo_yearly',
        title: 'Padelingo Annuel',
        audience: 'Pour les clubs, organisateurs et juges-arbitres qui veulent le meilleur tarif.',
        price: '99,90 €',
        billing: '/ an · soit environ 8,33 € / mois',
        badge: 'Meilleur tarif',
        highlight: true,
        features: [
            'Toutes les fonctionnalités de Padelingo',
            'Accès complet pendant 12 mois',
            'Environ 2 mois offerts par rapport au mensuel',
            'Exports et partage live inclus',
            'Sauvegarde, importation et restauration des tournois',
            'Idéal pour une saison complète',
        ],
    },
];

let paypalScriptPromise = null;

function buildPayPalScriptUrl() {
    if (!PAYPAL_CLIENT_ID) {
        throw new Error('Missing VITE_PAYPAL_CLIENT_ID.');
    }

    const params = new URLSearchParams({
        'client-id': PAYPAL_CLIENT_ID,
        vault: 'true',
        intent: 'subscription',
        currency: 'EUR',
    });

    return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

function removeOldPayPalScripts() {
    Array.from(document.scripts).forEach((script) => {
        if (script.src.includes('paypal.com/sdk/js')) {
            script.remove();
        }
    });
}

function loadPayPalScript() {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('PayPal SDK can only be loaded in the browser.'));
    }

    if (window.paypal?.Buttons) {
        return Promise.resolve(window.paypal);
    }

    if (paypalScriptPromise) {
        return paypalScriptPromise;
    }

    paypalScriptPromise = new Promise((resolve, reject) => {
        removeOldPayPalScripts();

        const script = document.createElement('script');
        script.src = buildPayPalScriptUrl();
        script.async = true;
        script.dataset.sdkIntegrationSource = 'padelingo-react-live';

        script.addEventListener(
            'load',
            () => {
                if (window.paypal?.Buttons) {
                    resolve(window.paypal);
                    return;
                }

                reject(new Error('PayPal SDK loaded, but window.paypal.Buttons is unavailable.'));
            },
            { once: true }
        );

        script.addEventListener(
            'error',
            () => {
                paypalScriptPromise = null;
                reject(new Error('Unable to load the PayPal SDK script.'));
            },
            { once: true }
        );

        document.body.appendChild(script);
    });

    return paypalScriptPromise;
}

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

function PayPalSubscriptionButton({
                                      plan,
                                      planId,
                                      isRegistering,
                                      onApprove,
                                      onError,
                                  }) {
    const containerRef = useRef(null);
    const paypalButtonsRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function renderButton() {
            if (!containerRef.current || !planId) return;

            try {
                setIsLoading(true);

                const paypal = await loadPayPalScript();

                if (!isMounted || !containerRef.current) return;

                containerRef.current.innerHTML = '';

                const buttons = paypal.Buttons({
                    style: {
                        layout: 'vertical',
                        shape: 'pill',
                        label: 'subscribe',
                        color: 'gold',
                    },
                    createSubscription: (_data, actions) =>
                        actions.subscription.create({
                            plan_id: planId,
                        }),
                    onApprove,
                    onError,
                });

                paypalButtonsRef.current = buttons;

                if (buttons.isEligible && !buttons.isEligible()) {
                    throw new Error(`PayPal Buttons are not eligible for ${plan.title}.`);
                }

                await buttons.render(containerRef.current);
            } catch (error) {
                console.error('Unable to render PayPal button:', error);
                onError(error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        renderButton();

        return () => {
            isMounted = false;

            try {
                paypalButtonsRef.current?.close?.();
            } catch {
                // PayPal can throw if the button was already removed.
            }

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [plan, planId, onApprove, onError]);

    return (
        <>
            {isLoading || isRegistering ? (
                <button type="button" className="primary" disabled>
                    {isRegistering ? 'Enregistrement sécurisé...' : 'Chargement PayPal...'}
                </button>
            ) : null}

            <div
                ref={containerRef}
                style={{
                    display: isLoading || isRegistering ? 'none' : 'block',
                }}
            />
        </>
    );
}

function PricingCard({ plan, onSubscriptionRegistered }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const planId = PLAN_IDS[plan.id];

    function scheduleAccessRefresh() {
        if (typeof onSubscriptionRegistered !== 'function') return;

        window.setTimeout(() => {
            onSubscriptionRegistered();
        }, 3000);

        window.setTimeout(() => {
            onSubscriptionRegistered();
        }, 8000);
    }

    async function handleApprove(data) {
        const subscriptionId =
            data?.subscriptionID ||
            data?.subscription_id ||
            '';

        console.log('PayPal subscription approved:', {
            planId,
            planKey: plan.id,
            subscriptionId,
            rawData: data,
        });

        if (!subscriptionId) {
            window.setTimeout(() => {
                alert(
                    'PayPal a validé la souscription, mais aucun identifiant ' +
                    'd’abonnement n’a été reçu.\n\nConsulte la console du navigateur.'
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

            console.log(
                'Pending subscription registered in Supabase:',
                pendingSubscription
            );

            scheduleAccessRefresh();

            window.setTimeout(() => {
                alert(
                    'Abonnement PayPal créé avec succès.\n\n' +
                    `Offre : ${plan.title}\n` +
                    `Subscription ID : ${subscriptionId}\n\n` +
                    'Padelingo attend maintenant la confirmation sécurisée du webhook PayPal. ' +
                    'L’activation peut prendre quelques secondes.'
                );
            }, 0);
        } catch (error) {
            console.error(
                'Unable to register pending subscription:',
                error
            );

            window.setTimeout(() => {
                alert(
                    'L’abonnement PayPal a été créé, mais Padelingo n’a pas réussi ' +
                    'à l’enregistrer dans Supabase.\n\n' +
                    `Subscription ID : ${subscriptionId}\n\n` +
                    'Consulte la console du navigateur et les journaux de la fonction webhook.'
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
                'Une erreur est survenue pendant la souscription PayPal.\n\n' +
                'Consulte la console du navigateur pour obtenir le détail.'
            );
        }, 0);
    }

    return (
        <article className={`pricing-card ${plan.highlight ? 'featured' : ''}`}>
            {plan.badge ? (
                <span className="pricing-badge">{plan.badge}</span>
            ) : null}

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
                {!planId ? (
                    <button
                        type="button"
                        className="primary"
                        onClick={() => {
                            alert(
                                `Plan PayPal manquant pour : ${plan.title}\n\n` +
                                'Vérifie la variable VITE_PAYPAL correspondante, ' +
                                'puis redémarre Vite ou redéploie Vercel.'
                            );
                        }}
                    >
                        Plan PayPal non configuré
                    </button>
                ) : (
                    <PayPalSubscriptionButton
                        plan={plan}
                        planId={planId}
                        isRegistering={isRegistering}
                        onApprove={handleApprove}
                        onError={handleError}
                    />
                )}
            </div>
        </article>
    );
}

function PricingPlans({ onSubscriptionRegistered }) {
    if (!PAYPAL_CLIENT_ID) {
        return (
            <div className="empty-state">
                <strong>PayPal n’est pas configuré.</strong>
                <span>
                    Ajoute VITE_PAYPAL_CLIENT_ID dans ton environnement,
                    puis redémarre Vite ou redéploie Vercel.
                </span>
            </div>
        );
    }

    return (
        <section className="pricing-group">
            <h3>Offre lancement Padelingo</h3>

            <div className="pricing-grid">
                {PRICING_PLANS.map((plan) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        onSubscriptionRegistered={onSubscriptionRegistered}
                    />
                ))}
            </div>
        </section>
    );
}

export { PLAN_IDS, PRICING_PLANS };
export default PricingPlans;