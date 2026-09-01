function LoginPage({ auth }) {
    function handleGoogleSignIn() {
        if (typeof auth.signInWithGoogle !== 'function') return;

        auth.signInWithGoogle();
    }

    return (
        <main className="app auth-page">
            <section className="card full-width auth-card">
                <p className="badge">Padelingo</p>

                <h1>Connexion à Padelingo</h1>

                <p className="note">
                    Connecte-toi avec Google pour démarrer ton essai gratuit de 7 jours,
                    sans carte bancaire. L’accès complet sera ensuite disponible avec un abonnement.
                </p>

                {auth.errorMessage ? (
                    <p className="error-text">{auth.errorMessage}</p>
                ) : null}

                <button
                    type="button"
                    className="primary auth-google-btn"
                    onClick={handleGoogleSignIn}
                >
                    Continuer avec Google
                </button>

                <p className="note">
                    Pendant l’essai : import autorisé, sauvegardes limitées, exports et partage live réservés aux abonnés.
                </p>
            </section>
        </main>
    );
}

export default LoginPage;