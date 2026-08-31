import { useState } from 'react';

const LEGAL_CONTENT = {
    privacy: {
        title: 'Confidentialité & données',
        body: [
            "Padelingo respecte la confidentialité des utilisateurs et limite la collecte de données au strict nécessaire pour faire fonctionner l’application.",
            "L’application permet d’organiser des tournois de padel : équipes, poules, planning, scores, phases finales, classements, sauvegardes et exports.",
            "Certaines données peuvent être conservées localement dans le navigateur ou sur l’appareil de l’utilisateur afin de permettre la reprise d’un tournoi en cours, même après fermeture de l’application.",
            "Lorsque l’utilisateur se connecte avec Google, Padelingo peut enregistrer les informations nécessaires à l’identification du compte, comme l’adresse e-mail, l’identifiant utilisateur et les informations liées au statut d’accès : essai gratuit, abonnement actif, expiration ou limitation d’accès.",
            "Les données liées aux tournois, aux sauvegardes, aux exports et à l’utilisation de l’application peuvent être utilisées uniquement pour fournir le service, sécuriser l’accès et améliorer le fonctionnement de Padelingo.",
            "Padelingo n’a pas vocation à utiliser des cookies publicitaires ou des traceurs marketing. Des données techniques nécessaires au fonctionnement de l’application peuvent toutefois être utilisées pour assurer la connexion, la sécurité, la sauvegarde et l’accès aux fonctionnalités.",
            "L’utilisateur peut exporter ses données de tournoi, importer une sauvegarde JSON et réinitialiser les données locales depuis l’interface lorsque ces fonctionnalités sont disponibles.",
            "L’utilisateur reste responsable de la conservation de ses sauvegardes, notamment lors d’un tournoi important.",
        ],
    },
    terms: {
        title: 'Conditions générales d’utilisation',
        body: [
            "Padelingo est une application destinée à aider les clubs, organisateurs et juges-arbitres à gérer des tournois de padel.",
            "L’application permet notamment de gérer les équipes, les poules, les matchs, les scores, les phases finales, les classements, les sauvegardes, les exports et le partage d’informations liées au tournoi.",
            "Padelingo est un outil d’aide à l’organisation. L’utilisateur reste seul responsable de la vérification des inscriptions, des scores, des classements, des règles sportives applicables et du bon déroulement réel du tournoi.",
            "Les résultats générés par l’application doivent être vérifiés avant toute validation officielle ou communication définitive.",
            "L’utilisateur s’engage à utiliser l’application de manière normale, loyale et conforme à sa destination. Il s’interdit notamment toute tentative de contournement des limitations d’accès, d’abonnement, de sécurité ou de fonctionnement technique.",
            "Padelingo peut proposer un essai gratuit limité dans le temps et/ou dans certaines fonctionnalités. À l’issue de cette période, l’accès complet peut nécessiter un abonnement payant.",
            "Certaines fonctionnalités, comme les exports avancés, le partage live ou les sauvegardes étendues, peuvent être réservées aux utilisateurs abonnés.",
            "Padelingo fait ses meilleurs efforts pour assurer la disponibilité et le bon fonctionnement du service, mais ne peut garantir une absence totale d’interruption, d’erreur ou de perte de données.",
            "Il est recommandé d’exporter régulièrement une sauvegarde pendant un tournoi important.",
        ],
    },
    sales: {
        title: 'Conditions générales de vente',
        body: [
            "Les présentes conditions générales de vente s’appliquent aux abonnements proposés par Padelingo.",
            "Padelingo est édité par Julien Sicard, entrepreneur individuel, immatriculé sous le numéro SIRET 105875736 00016, dont l’activité a été créée le 03/06/2026, domicilié au 7 allée des Écus, 91090 Lisses, France.",
            "Padelingo propose des abonnements permettant d’accéder à des fonctionnalités avancées de l’application, notamment selon l’offre choisie : gestion étendue des tournois, sauvegardes supplémentaires, exports, partage live et accès complet aux fonctionnalités réservées aux utilisateurs abonnés.",
            "Les prix des abonnements sont indiqués en euros. Lorsque Padelingo bénéficie de la franchise en base de TVA, la TVA n’est pas applicable conformément à l’article 293 B du Code général des impôts. Si Padelingo devient redevable de la TVA, les prix pourront être indiqués toutes taxes comprises selon le taux applicable. Les tarifs peuvent varier selon l’offre sélectionnée : abonnement mensuel, abonnement de plusieurs mois ou abonnement annuel.",
            "Le paiement est effectué via un prestataire de paiement sécurisé, notamment PayPal. Padelingo ne stocke pas directement les informations bancaires de l’utilisateur.",
            "L’abonnement donne accès aux fonctionnalités payantes pendant la durée prévue par l’offre choisie. En cas d’abonnement récurrent, celui-ci peut être renouvelé automatiquement selon les conditions affichées au moment de la souscription.",
            "L’utilisateur peut résilier son abonnement selon les modalités prévues par le prestataire de paiement ou depuis les outils mis à disposition par Padelingo lorsque cette fonctionnalité est disponible.",
            "En cas de résiliation, l’accès aux fonctionnalités payantes reste actif jusqu’à la fin de la période déjà payée, sauf indication contraire.",
            "Lorsque l’utilisateur est un consommateur, il peut bénéficier d’un droit de rétractation de 14 jours dans les conditions prévues par la loi. Toutefois, si l’utilisateur demande l’accès immédiat au service numérique avant la fin du délai de rétractation, il peut reconnaître que l’exécution du service commence immédiatement et que son droit de rétractation peut être limité ou perdu selon les règles applicables.",
            "Aucun remboursement n’est automatiquement dû pour une période d’abonnement déjà commencée, sauf obligation légale contraire ou geste commercial accordé par Padelingo.",
            "En cas de problème de paiement, de suspension, d’annulation ou d’expiration de l’abonnement, l’accès aux fonctionnalités payantes peut être limité ou désactivé.",
            "Pour toute question relative à l’abonnement, au paiement, à l’accès au service ou aux présentes conditions générales de vente, l’utilisateur peut contacter Padelingo à l’adresse suivante : slingo.drisca1@gmail.com.",
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
                    <strong>Padelingo</strong>
                    <span>Outil de gestion de tournoi · sauvegarde locale · accès sécurisé.</span>
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
                <div
                    className="legal-modal-backdrop"
                    role="presentation"
                    onClick={() => setActiveLegalKey(null)}
                >
                    <section
                        className="legal-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="legal-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
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