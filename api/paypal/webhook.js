import { createClient } from '@supabase/supabase-js';

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_API_BASE =
    PAYPAL_ENV === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        })
        : null;

function sendJson(response, statusCode, payload) {
    response.status(statusCode).json(payload);
}

async function readJsonBody(request) {
    if (request.body && typeof request.body === 'object') {
        return request.body;
    }

    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');

    if (!rawBody) {
        return {};
    }

    return JSON.parse(rawBody);
}

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error('Missing PayPal server credentials.');
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('PayPal access token error:', data);
        throw new Error('Unable to get PayPal access token.');
    }

    return data.access_token;
}

async function verifyPayPalWebhookSignature(request, webhookEvent) {
    if (!PAYPAL_WEBHOOK_ID) {
        console.warn('PAYPAL_WEBHOOK_ID is not configured yet. Signature verification skipped.');
        return {
            verified: false,
            skipped: true,
        };
    }

    const accessToken = await getPayPalAccessToken();

    const verificationPayload = {
        auth_algo: request.headers['paypal-auth-algo'],
        cert_url: request.headers['paypal-cert-url'],
        transmission_id: request.headers['paypal-transmission-id'],
        transmission_sig: request.headers['paypal-transmission-sig'],
        transmission_time: request.headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent,
    };

    const response = await fetch(
        `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(verificationPayload),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error('PayPal webhook verification error:', data);
        throw new Error('Unable to verify PayPal webhook signature.');
    }

    return {
        verified: data.verification_status === 'SUCCESS',
        skipped: false,
        raw: data,
    };
}

function getSubscriptionIdFromEvent(event) {
    return (
        event?.resource?.id ||
        event?.resource?.billing_agreement_id ||
        event?.resource?.subscription_id ||
        event?.resource?.supplementary_data?.related_ids?.subscription_id ||
        ''
    );
}

function mapPayPalEventToStatus(eventType) {
    const statusByEventType = {
        'BILLING.SUBSCRIPTION.ACTIVATED': 'active',
        'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled',
        'BILLING.SUBSCRIPTION.SUSPENDED': 'suspended',
        'BILLING.SUBSCRIPTION.EXPIRED': 'expired',
        'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'payment_failed',
        'PAYMENT.SALE.COMPLETED': 'active',
    };

    return statusByEventType[eventType] || null;
}

function buildProfileStatus(subscriptionStatus) {
    if (subscriptionStatus === 'active') return 'active';

    if (
        subscriptionStatus === 'cancelled' ||
        subscriptionStatus === 'canceled' ||
        subscriptionStatus === 'suspended' ||
        subscriptionStatus === 'expired' ||
        subscriptionStatus === 'payment_failed'
    ) {
        return 'expired';
    }

    return null;
}

async function logSecurityEvent(eventType, payload) {
    if (!supabaseAdmin) return;

    try {
        await supabaseAdmin.from('security_events').insert({
            event_type: eventType,
            severity: payload?.severity || 'info',
            metadata: payload,
        });
    } catch (error) {
        console.error('Unable to write security event:', error);
    }
}

async function updateSubscriptionFromWebhook(webhookEvent) {
    if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not configured.');
    }

    const eventType = webhookEvent.event_type;
    const paypalSubscriptionId = getSubscriptionIdFromEvent(webhookEvent);
    const nextStatus = mapPayPalEventToStatus(eventType);

    if (!paypalSubscriptionId) {
        await logSecurityEvent('paypal_webhook_missing_subscription_id', {
            severity: 'warning',
            eventType,
            webhookEventId: webhookEvent.id,
            resource: webhookEvent.resource,
        });

        return {
            updated: false,
            reason: 'missing_subscription_id',
        };
    }

    if (!nextStatus) {
        await logSecurityEvent('paypal_webhook_ignored_event', {
            severity: 'info',
            eventType,
            paypalSubscriptionId,
            webhookEventId: webhookEvent.id,
        });

        return {
            updated: false,
            reason: 'ignored_event_type',
            paypalSubscriptionId,
        };
    }

    const { data: subscription, error: readError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, user_id, status, raw_payload')
        .eq('paypal_subscription_id', paypalSubscriptionId)
        .maybeSingle();

    if (readError) {
        throw readError;
    }

    if (!subscription) {
        await logSecurityEvent('paypal_webhook_unmatched_subscription', {
            severity: 'warning',
            eventType,
            paypalSubscriptionId,
            webhookEventId: webhookEvent.id,
        });

        return {
            updated: false,
            reason: 'subscription_not_found',
            paypalSubscriptionId,
        };
    }

    const nextRawPayload = {
        ...(subscription.raw_payload || {}),
        last_paypal_webhook: {
            event_id: webhookEvent.id,
            event_type: eventType,
            received_at: new Date().toISOString(),
            resource: webhookEvent.resource,
        },
    };

    const { error: updateSubscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .update({
            status: nextStatus,
            raw_payload: nextRawPayload,
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

    if (updateSubscriptionError) {
        throw updateSubscriptionError;
    }

    const nextProfileStatus = buildProfileStatus(nextStatus);

    if (nextProfileStatus) {
        const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({
                account_status: nextProfileStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.user_id);

        if (updateProfileError) {
            throw updateProfileError;
        }
    }

    return {
        updated: true,
        paypalSubscriptionId,
        status: nextStatus,
        profileStatus: nextProfileStatus,
    };
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return sendJson(response, 405, {
            error: 'Method not allowed',
        });
    }

    try {
        const webhookEvent = await readJsonBody(request);

        if (!webhookEvent?.event_type) {
            return sendJson(response, 400, {
                error: 'Invalid PayPal webhook payload',
            });
        }

        const verification = await verifyPayPalWebhookSignature(request, webhookEvent);

        if (!verification.verified && !verification.skipped) {
            await logSecurityEvent('paypal_webhook_invalid_signature', {
                severity: 'critical',
                eventType: webhookEvent.event_type,
                webhookEventId: webhookEvent.id,
            });

            return sendJson(response, 401, {
                error: 'Invalid PayPal webhook signature',
            });
        }

        const result = await updateSubscriptionFromWebhook(webhookEvent);

        return sendJson(response, 200, {
            received: true,
            verification,
            result,
        });
    } catch (error) {
        console.error('PayPal webhook handler error:', error);

        return sendJson(response, 500, {
            error: 'PayPal webhook handler failed',
        });
    }
}