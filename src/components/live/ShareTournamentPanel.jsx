import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    publishTournament,
    updatePublishedTournament,
    buildSerializableTournamentState,
} from '../../services/liveTournamentService';

const SHARE_STORAGE_KEY = 'padelingo-live-share-v1';

function getStoredShare() {
    try {
        const raw = localStorage.getItem(SHARE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveStoredShare(value) {
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(value));
}

function removeStoredShare() {
    localStorage.removeItem(SHARE_STORAGE_KEY);
}

function ShareTournamentPanel({ ctx }) {
    const [share, setShare] = useState(() => getStoredShare());
    const [status, setStatus] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const lastSyncedStateRef = useRef('');

    const hasFullAccess = Boolean(ctx.auth?.hasFullAccess);

    const publicUrl = useMemo(() => {
        if (!share?.publicId) return '';
        return `${window.location.origin}/live/${share.publicId}`;
    }, [share?.publicId]);

    const currentStateString = useMemo(() => {
        return JSON.stringify(buildSerializableTournamentState(ctx));
    }, [
        ctx.baseTeams,
        ctx.pools,
        ctx.serpentin,
        ctx.activeTab,
        ctx.finalStage,
        ctx.safeFinalStage,
        ctx.courtCount,
        ctx.courtLabels,
    ]);

    function requireFullAccessForLive() {
        if (hasFullAccess) return true;

        alert(
            'Le partage live spectateurs est réservé aux abonnés Padelingo.\n\n' +
            'Pendant l’essai gratuit, tu peux tester la création de tournoi, les poules, les scores et les classements, ' +
            'mais la publication live est disponible avec un abonnement.'
        );

        return false;
    }

    async function handlePublish() {
        if (!requireFullAccessForLive()) return;

        try {
            setIsPublishing(true);
            setStatus('Publication du tournoi en cours...');

            const name =
                window.prompt('Nom du tournoi à partager ?', 'Tournoi Padelingo') ||
                'Tournoi Padelingo';

            const result = await publishTournament(ctx, name);

            const nextShare = {
                publicId: result.public_id,
                adminToken: result.adminToken,
                name: result.name,
                createdAt: result.created_at,
            };

            saveStoredShare(nextShare);
            setShare(nextShare);
            lastSyncedStateRef.current = currentStateString;
            setStatus('Tournoi publié. Le lien public est prêt.');
        } catch (error) {
            console.error(error);
            setStatus(`Erreur publication : ${error.message}`);
        } finally {
            setIsPublishing(false);
        }
    }

    async function handleCopyLink() {
        if (!publicUrl) return;

        try {
            await navigator.clipboard.writeText(publicUrl);
            setStatus('Lien copié.');
        } catch {
            setStatus(publicUrl);
        }
    }

    function handleStopSharing() {
        removeStoredShare();
        setShare(null);
        setStatus('Partage désactivé sur cet appareil. Le tournoi reste en ligne dans Supabase.');
    }

    useEffect(() => {
        if (!share?.publicId || !share?.adminToken) return;
        if (!hasFullAccess) return;
        if (lastSyncedStateRef.current === currentStateString) return;

        const timeoutId = window.setTimeout(async () => {
            try {
                setIsSyncing(true);

                await updatePublishedTournament(
                    share.publicId,
                    share.adminToken,
                    ctx
                );

                lastSyncedStateRef.current = currentStateString;
                setStatus('Live synchronisé.');
            } catch (error) {
                console.error(error);
                setStatus(`Erreur synchronisation live : ${error.message}`);
            } finally {
                setIsSyncing(false);
            }
        }, 900);

        return () => window.clearTimeout(timeoutId);
    }, [share?.publicId, share?.adminToken, currentStateString, ctx, hasFullAccess]);

    return (
        <section className="card live-share-card">
            <div className="section-head">
                <div>
                    <h2>Partage live spectateurs</h2>
                    <p className="note">
                        Génère un lien public et un QR code pour suivre les matchs en direct,
                        sans connexion et sans modification possible côté spectateur.
                    </p>

                    {!hasFullAccess ? (
                        <p className="note">
                            Fonction premium : le partage live est réservé aux abonnés Padelingo.
                        </p>
                    ) : null}
                </div>

                {!share ? (
                    <button
                        type="button"
                        className="primary"
                        onClick={handlePublish}
                        disabled={isPublishing}
                    >
                        {isPublishing ? 'Publication...' : 'Partager le tournoi'}
                    </button>
                ) : (
                    <button type="button" className="danger" onClick={handleStopSharing}>
                        Désactiver sur cet appareil
                    </button>
                )}
            </div>

            {share ? (
                <div className="live-share-grid">
                    <div>
                        <label className="field">
                            <span>Lien public lecture seule</span>
                            <input value={publicUrl} readOnly />
                        </label>

                        <div className="team-actions">
                            <button type="button" className="icon-btn" onClick={handleCopyLink}>
                                Copier le lien
                            </button>

                            <a
                                className="icon-btn link-btn"
                                href={publicUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Ouvrir le live
                            </a>
                        </div>

                        <p className="note">
                            Statut : {isSyncing ? 'synchronisation...' : status || 'live actif'}
                        </p>
                    </div>

                    <div className="qr-box">
                        <QRCodeSVG value={publicUrl} size={180} />
                        <p>QR code spectateur</p>
                    </div>
                </div>
            ) : (
                <p className="note">
                    Clique sur “Partager le tournoi” quand ton tournoi est prêt.
                    Ensuite, chaque modification de score sera envoyée automatiquement en ligne.
                </p>
            )}
        </section>
    );
}

export default ShareTournamentPanel;