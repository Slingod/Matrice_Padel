import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Variables Supabase manquantes. Vérifie ton fichier .env : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function createAdminClient(adminToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                'x-admin-token': adminToken,
            },
        },
    });
}

function randomString(length = 24) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const values = crypto.getRandomValues(new Uint32Array(length));

    return Array.from(values)
        .map((value) => chars[value % chars.length])
        .join('');
}

function slugId() {
    return `padel-${randomString(10).toLowerCase()}`;
}

async function sha256(value) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function buildSerializableTournamentState(ctx) {
    return {
        baseTeams: ctx.baseTeams || [],
        pools: ctx.pools || [],
        serpentin: ctx.serpentin || {},
        activeTab: ctx.activeTab || 'base',
        finalStage: ctx.finalStage || ctx.safeFinalStage || null,
        courtCount: ctx.courtCount || 1,
        courtLabels: ctx.courtLabels || [],
        savedAt: new Date().toISOString(),
    };
}

export async function publishTournament(ctx, name = 'Tournoi Padelingo') {
    const adminToken = randomString(48);
    const publicId = slugId();
    const adminTokenHash = await sha256(adminToken);
    const state = buildSerializableTournamentState(ctx);

    const { data, error } = await supabase
        .from('live_tournaments')
        .insert({
            public_id: publicId,
            name,
            state,
            admin_token_hash: adminTokenHash,
        })
        .select('public_id, name, state, created_at, updated_at')
        .single();

    if (error) {
        throw error;
    }

    return {
        ...data,
        adminToken,
    };
}

export async function updatePublishedTournament(publicId, adminToken, ctx) {
    const adminClient = createAdminClient(adminToken);
    const state = buildSerializableTournamentState(ctx);

    const { data, error } = await adminClient
        .from('live_tournaments')
        .update({
            state,
            updated_at: new Date().toISOString(),
        })
        .eq('public_id', publicId)
        .select('public_id, name, state, created_at, updated_at')
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function getLiveTournament(publicId) {
    const { data, error } = await supabase
        .from('live_tournaments')
        .select('public_id, name, state, created_at, updated_at')
        .eq('public_id', publicId)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export function subscribeToLiveTournament(publicId, onChange) {
    const channel = supabase
        .channel(`live-tournament-${publicId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'live_tournaments',
                filter: `public_id=eq.${publicId}`,
            },
            (payload) => {
                onChange(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
