import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_ENV = Deno.env.get("PAYPAL_ENV") || "sandbox";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const PAYPAL_API_BASE =
    PAYPAL_ENV === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function hasRequiredPayPalHeaders(request: Request) {
    return Boolean(
        request.headers.get("paypal-auth-algo") &&
        request.headers.get("paypal-cert-url") &&
        request.headers.get("paypal-transmission-id") &&
        request.headers.get("paypal-transmission-sig") &&
        request.headers.get("paypal-transmission-time")
    );
}

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("Missing PayPal credentials.");
    }

    const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Unable to get PayPal access token: ${text}`);
    }

    const data = await response.json();

    if (!data.access_token) {
        throw new Error("PayPal access token missing from response.");
    }

    return data.access_token;
}

async function verifyPayPalWebhook(request: Request, webhookEvent: unknown) {
    if (!PAYPAL_WEBHOOK_ID) {
        throw new Error("Missing PAYPAL_WEBHOOK_ID secret.");
    }

    if (!hasRequiredPayPalHeaders(request)) {
        throw new Error("Missing PayPal webhook signature headers.");
    }

    const accessToken = await getPayPalAccessToken();

    const verificationPayload = {
        auth_algo: request.headers.get("paypal-auth-algo"),
        cert_url: request.headers.get("paypal-cert-url"),
        transmission_id: request.headers.get("paypal-transmission-id"),
        transmission_sig: request.headers.get("paypal-transmission-sig"),
        transmission_time: request.headers.get("paypal-transmission-time"),
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent,
    };

    const response = await fetch(
        `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(verificationPayload),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`PayPal webhook verification failed: ${text}`);
    }

    const data = await response.json();

    return data.verification_status === "SUCCESS";
}

function getSubscriptionId(event: any) {
    const candidates = [
        event?.resource?.subscription_id,
        event?.resource?.billing_agreement_id,
        event?.resource?.supplementary_data?.related_ids?.subscription_id,
        event?.resource?.id,
    ];

    return (
        candidates.find((value) => {
            return typeof value === "string" && value.startsWith("I-");
        }) || ""
    );
}

function mapPayPalEventToStatus(eventType: string) {
    switch (eventType) {
        case "BILLING.SUBSCRIPTION.ACTIVATED":
            return "active";

        case "BILLING.SUBSCRIPTION.CANCELLED":
            return "cancelled";

        case "BILLING.SUBSCRIPTION.SUSPENDED":
            return "suspended";

        case "BILLING.SUBSCRIPTION.EXPIRED":
            return "expired";

        case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
            return "past_due";

        case "PAYMENT.CAPTURE.COMPLETED":
            return "active";

        default:
            return null;
    }
}

serve(async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase server credentials.");
        }

        const event = await request.json();

        const isVerified = await verifyPayPalWebhook(request, event);

        if (!isVerified) {
            return jsonResponse(
                {
                    error: "Invalid PayPal webhook signature.",
                },
                400
            );
        }

        const eventType = event?.event_type || "";
        const nextStatus = mapPayPalEventToStatus(eventType);
        const paypalSubscriptionId = getSubscriptionId(event);

        console.log("PayPal webhook received:", {
            eventType,
            nextStatus,
            paypalSubscriptionId,
        });

        if (!nextStatus) {
            return jsonResponse({
                received: true,
                ignored: true,
                reason: "Unsupported PayPal event type.",
                eventType,
            });
        }

        if (!paypalSubscriptionId) {
            return jsonResponse({
                received: true,
                ignored: true,
                reason: "Missing PayPal subscription ID.",
                eventType,
            });
        }

        const { data, error } = await supabaseAdmin.rpc(
            "activate_paypal_subscription_from_webhook",
            {
                p_paypal_subscription_id: paypalSubscriptionId,
                p_status: nextStatus,
                p_raw_payload: {
                    source: "paypal_webhook",
                    event_type: eventType,
                    paypal_subscription_id: paypalSubscriptionId,
                    received_at: new Date().toISOString(),
                    payload: event,
                },
            }
        );

        if (error) {
            console.error("Supabase RPC error:", error);

            return jsonResponse(
                {
                    error: "Unable to update subscription in Supabase.",
                    details: error.message,
                    eventType,
                    paypalSubscriptionId,
                },
                500
            );
        }

        return jsonResponse({
            received: true,
            eventType,
            paypalSubscriptionId,
            status: nextStatus,
            data,
        });
    } catch (error) {
        console.error("PayPal webhook handler error:", error);

        return jsonResponse(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            500
        );
    }
});