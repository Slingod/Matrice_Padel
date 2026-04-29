import { useState } from 'react';

const LEGAL_CONTENT = {
    privacy: {
        title: 'Confidentialité & données locales',
        body: [
            "Cette application fonctionne actuellement sans compte utilisateur et sans serveur de synchronisation.",
            "Les données du tournoi saisies dans l’application sont sauvegardées automatiquement dans le stockage local du navigateur/appareil afin de permettre la reprise du tournoi.",
            "Aucun cookie publicitaire ou traceur marketing n’est nécessaire pour cette sauvegarde locale. Les données restent sur l’appareil tant que l’utilisateur ne réinitialise pas l’application, ne vide pas son navigateur ou ne désinstalle pas l’application.",
            "L’utilisateur peut exporter une sauvegarde JSON, importer une sauvegarde JSON et réinitialiser les données locales depuis l’interface.",
        ],
    },
    terms: {
        title: 'Conditions générales d’utilisation',
        body: [
            "L’application Matrice Padel aide à organiser des tournois de padel : équipes, poules, planning, scores, phases finales et classements.",
            "L’utilisateur reste responsable de la vérification des résultats, des classements et de l’organisation réelle du tournoi.",
            "Les sauvegardes locales et exports JSON sont fournis pour éviter les pertes de données, mais il est conseillé d’exporter régulièrement une sauvegarde pendant un tournoi important.",
        ],
    },
    sales: {
        title: 'Conditions générales de vente',
        body: [
            "Cette section est une base de travail pour une future version payante.",
            "Avant toute mise en vente, il faudra préciser le prix, la durée de l’abonnement, l’essai gratuit éventuel, les modalités de paiement, de renouvellement, de résiliation et de remboursement.",
            "Pour une vente via Google Play, les achats numériques doivent être cohérents avec les règles de paiement applicables sur la plateforme.",
        ],
    },
};

function LegalFooter() {
    const [activeLegalKey, setActiveLegalKey] = useState(null);
    const activeContent = activeLegalKey ? LEGAL_CONTENT[activeLegalKey] : null;

    return (
        <>
            <footer className="legal-footer">
                <div>
                    <strong>Matrice Padel</strong>
                    <span>Outil de gestion de tournoi · sauvegarde locale sans cookie publicitaire.</span>
                </div>

                <nav aria-label="Liens légaux">
                    <button type="button" onClick={() => setActiveLegalKey('privacy')}>
                        Confidentialité
                    </button>
                    <button type="button" onClick={() => setActiveLegalKey('terms')}>
                        CGU
                    </button>
                    <button type="button" onClick={() => setActiveLegalKey('sales')}>
                        CGV
                    </button>
                </nav>
            </footer>

            {activeContent && (
                <div className="legal-modal-backdrop" role="presentation" onClick={() => setActiveLegalKey(null)}>
                    <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" onClick={(event) => event.stopPropagation()}>
                        <div className="legal-modal-head">
                            <h2 id="legal-modal-title">{activeContent.title}</h2>
                            <button type="button" onClick={() => setActiveLegalKey(null)}>
                                Fermer
                            </button>
                        </div>

                        <div className="legal-modal-body">
                            {activeContent.body.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

export default LegalFooter;
