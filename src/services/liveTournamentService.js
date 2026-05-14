import { createClient } from '@supabase/supabase-js';
import { getStoredMatchScore } from '../utils/matchScoreStorage';

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

function isFilled(value) {
    return value !== '' && value !== null && value !== undefined;
}

function getRequiredSets(formatKey, sets = []) {
    if (formatKey === 'D1' || formatKey === 'D2' || formatKey === 'E') return 1;
    if (sets.length <= 1) return 1;
    return 2;
}

function computeScoreFromSets(sets = [], formatKey = 'D1') {
    const requiredSets = getRequiredSets(formatKey, sets);
    let wonA = 0;
    let wonB = 0;

    for (const set of sets) {
        if (!isFilled(set?.scoreA) || !isFilled(set?.scoreB)) continue;

        const scoreA = Number(set.scoreA);
        const scoreB = Number(set.scoreB);

        if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) continue;

        if (scoreA > scoreB) {
            wonA += 1;
        } else {
            wonB += 1;
        }

        if (wonA >= requiredSets || wonB >= requiredSets) {
            break;
        }
    }

    const isComplete = wonA >= requiredSets || wonB >= requiredSets;

    return {
        scoreA: isComplete ? String(wonA) : '',
        scoreB: isComplete ? String(wonB) : '',
    };
}

function getNormalizedMatchScore(match = {}, detail = null) {
    if (isFilled(match.scoreA) && isFilled(match.scoreB)) {
        return {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
        };
    }

    if (isFilled(detail?.scoreA) && isFilled(detail?.scoreB)) {
        return {
            scoreA: detail.scoreA,
            scoreB: detail.scoreB,
        };
    }

    if (Array.isArray(detail?.sets)) {
        return computeScoreFromSets(detail.sets, detail.formatKey || match.formatKey || match.matchFormatKey || 'D1');
    }

    return {
        scoreA: match.scoreA ?? '',
        scoreB: match.scoreB ?? '',
    };
}

function hydrateMatchForLive(match = {}) {
    const storedScore = getStoredMatchScore(match.id);
    const detail = match.scoreDetail || storedScore || null;
    const normalizedScore = getNormalizedMatchScore(match, detail);

    return {
        ...match,
        scoreA: normalizedScore.scoreA,
        scoreB: normalizedScore.scoreB,
        scoreDetail: detail
            ? {
                ...detail,
                scoreA: normalizedScore.scoreA,
                scoreB: normalizedScore.scoreB,
            }
            : match.scoreDetail || null,
        formatKey: detail?.formatKey || match.formatKey || match.matchFormatKey || undefined,
        matchFormatKey: detail?.formatKey || match.matchFormatKey || match.formatKey || undefined,
    };
}

function hydratePoolsForLive(pools = []) {
    return pools.map((pool) => ({
        ...pool,
        matches: (pool.matches || []).map(hydrateMatchForLive),
    }));
}

function hydrateFinalStageForLive(stage) {
    if (!stage) return null;

    const hydrateList = (matches = []) => matches.map(hydrateMatchForLive);

    return {
        ...stage,
        roundOf16: hydrateList(stage.roundOf16 || []),
        quarterFinals: hydrateList(stage.quarterFinals || []),
        semiFinals: hydrateList(stage.semiFinals || []),
        final: stage.final ? hydrateMatchForLive(stage.final) : stage.final,
        thirdPlace: stage.thirdPlace ? hydrateMatchForLive(stage.thirdPlace) : stage.thirdPlace,
        placement5to8Semis: hydrateList(stage.placement5to8Semis || []),
        placement5to8Finals: {
            place5: stage.placement5to8Finals?.place5
                ? hydrateMatchForLive(stage.placement5to8Finals.place5)
                : stage.placement5to8Finals?.place5,
            place7: stage.placement5to8Finals?.place7
                ? hydrateMatchForLive(stage.placement5to8Finals.place7)
                : stage.placement5to8Finals?.place7,
        },
    };
}

export function buildSerializableTournamentState(ctx) {
    return {
        baseTeams: ctx.baseTeams || [],
        pools: hydratePoolsForLive(ctx.pools || []),
        serpentin: ctx.serpentin || {},
        activeTab: ctx.activeTab || 'base',
        finalStage: hydrateFinalStageForLive(ctx.finalStage || ctx.safeFinalStage || null),
        matchFormatKey: ctx.matchFormatKey || ctx.selectedMatchFormatKey || ctx.formatKey || 'D1',
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
