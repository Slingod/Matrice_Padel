import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function normalizeAccessStatus(data) {
    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
        return {
            hasAccess: false,
            hasFullAccess: false,
            isTrialActive: false,
            isSubscriptionActive: false,
            accountStatus: 'unknown',
            trialEndsAt: null,
            savedTournamentsCount: 0,
            savedTournamentsLimit: 2,
            exportsTodayLimit: 0,
            liveLinksTodayLimit: 0,
        };
    }

    return {
        userId: row.user_id,
        accountType: row.account_type,
        accountStatus: row.account_status,
        trialEndsAt: row.trial_ends_at,
        isTrialActive: Boolean(row.is_trial_active),
        isSubscriptionActive: Boolean(row.is_subscription_active),
        hasAccess: Boolean(row.has_access),
        hasFullAccess: Boolean(row.has_full_access),
        riskScore: Number(row.risk_score || 0),
        savedTournamentsCount: Number(row.saved_tournaments_count || 0),
        savedTournamentsLimit: Number(row.saved_tournaments_limit || 2),
        importsTodayCount: Number(row.imports_today_count || 0),
        importsTodayLimit: Number(row.imports_today_limit || 10),
        exportsTodayCount: Number(row.exports_today_count || 0),
        exportsTodayLimit: Number(row.exports_today_limit || 0),
        liveLinksTodayCount: Number(row.live_links_today_count || 0),
        liveLinksTodayLimit: Number(row.live_links_today_limit || 0),
    };
}

function getAuthRedirectUrl() {
    if (typeof window === 'undefined') {
        return 'https://app-padelingo.com/';
    }

    return `${window.location.origin}/`;
}

export function useAuthAccess() {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [accessStatus, setAccessStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadAccessStatus = useCallback(async (currentSession) => {
        if (!currentSession?.user) {
            setAccessStatus(null);
            return null;
        }

        const { data, error } = await supabase.rpc('get_my_access_status');

        if (error) {
            console.error('Access status error:', error);
            setErrorMessage(error.message || 'Unable to load access status.');
            return null;
        }

        const normalized = normalizeAccessStatus(data);
        setAccessStatus(normalized);
        return normalized;
    }, []);

    const refreshAuthState = useCallback(
        async ({ blockInterface = false } = {}) => {
            if (blockInterface) {
                setIsLoading(true);
            } else {
                setIsRefreshing(true);
            }

            setErrorMessage('');

            try {
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Session error:', error);
                    setErrorMessage(error.message || 'Unable to load session.');
                    setSession(null);
                    setUser(null);
                    setAccessStatus(null);
                    return null;
                }

                const currentSession = data.session || null;

                setSession(currentSession);
                setUser(currentSession?.user || null);

                await loadAccessStatus(currentSession);
                return currentSession;
            } catch (error) {
                console.error('Unexpected auth error:', error);
                setErrorMessage(error?.message || 'Unexpected authentication error.');
                setSession(null);
                setUser(null);
                setAccessStatus(null);
                return null;
            } finally {
                if (blockInterface) {
                    setIsLoading(false);
                }

                setIsRefreshing(false);
            }
        },
        [loadAccessStatus]
    );

    const reloadAccessStatus = useCallback(
        () => refreshAuthState({ blockInterface: false }),
        [refreshAuthState]
    );

    const signInWithGoogle = useCallback(async () => {
        setErrorMessage('');

        const redirectTo = getAuthRedirectUrl();

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) {
            console.error('Google login error:', error);
            setErrorMessage(error.message || 'Google login failed.');
        }
    }, []);

    const signOut = useCallback(async () => {
        setErrorMessage('');

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout error:', error);
            setErrorMessage(error.message || 'Logout failed.');
            return;
        }

        setSession(null);
        setUser(null);
        setAccessStatus(null);
        setIsRefreshing(false);
    }, []);

    useEffect(() => {
        refreshAuthState({ blockInterface: true });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user || null);
            setErrorMessage('');

            if (!nextSession?.user) {
                setAccessStatus(null);
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            }

            /*
             * TOKEN_REFRESHED and other background auth events can happen when a
             * mobile file picker sends the browser to the background. Never switch
             * the whole application back to the loading screen here: doing so would
             * unmount the <input type="file"> before Android returns the selected
             * File object to the page.
             */
            window.setTimeout(async () => {
                setIsRefreshing(true);

                try {
                    await loadAccessStatus(nextSession);
                } catch (error) {
                    console.error('Auth state access reload error:', error);
                    setErrorMessage(error?.message || 'Unable to refresh access status.');
                } finally {
                    setIsRefreshing(false);
                    setIsLoading(false);
                }
            }, 0);

            if (event === 'SIGNED_OUT') {
                setAccessStatus(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [refreshAuthState, loadAccessStatus]);

    return useMemo(
        () => ({
            session,
            user,
            accessStatus,
            isLoading,
            isRefreshing,
            errorMessage,
            isAuthenticated: Boolean(user),
            hasAccess: Boolean(accessStatus?.hasAccess),
            hasFullAccess: Boolean(accessStatus?.hasFullAccess),
            signInWithGoogle,
            signOut,
            reloadAccessStatus,
        }),
        [
            session,
            user,
            accessStatus,
            isLoading,
            isRefreshing,
            errorMessage,
            signInWithGoogle,
            signOut,
            reloadAccessStatus,
        ]
    );
}