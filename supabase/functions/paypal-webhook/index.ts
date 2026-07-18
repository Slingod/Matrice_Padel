import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PayPalWebhookEvent = {
    id?: string;
    event_type?: string;
    create_time?: string;
    resource?: Record<string, any>;
};

type PayPalSubscriptionDetails = {
    id?: string;
    plan_id?: string;
    status?: string;
    start_time?: string;
    create_time?: string;
    update_time?: string;
    billing_info?: {
        last_payment?: {
            time?: string;
            status?: string;
            amount?: {
                currency_code?: string;
                value?: string;
            };
        };
        next_billing_time?: string;
        final_payment_time?: string;
        failed_payments_count?: number;
        outstanding_balance?: {
            currency_code?: string;
            value?: string;
        };
    };
    plan?: {
        billing_cycles?: Array<{
            tenure_type?: string;
            frequency?: {
                interval_unit?: string;
                interval_count?: number;
            };
        }>;
    };
};

const PAYPAL_ENV = Deno.env.get("PAYPAL_ENV") || "sandbox";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const PAYPAL_API_BASE =
    PAYPAL_ENV === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

const CONFIGURED_PLANS = [
    {
        id: Deno.env.get("PAYPAL_JA_MONTHLY_PLAN_ID") || "",
        key: "ja_monthly",
    },
    {
        id: Deno.env.get("PAYPAL_JA_6_MONTHS_PLAN_ID") || "",
        key: "ja_6_months",
    },
    {
        id: Deno.env.get("PAYPAL_JA_YEARLY_PLAN_ID") || "",
        key: "ja_yearly",
    },
    {
        id: Deno.env.get("PAYPAL_CLUB_MONTHLY_PLAN_ID") || "",
        key: "club_monthly",
    },
    {
        id: Deno.env.get("PAYPAL_CLUB_6_MONTHS_PLAN_ID") || "",
        key: "club_6_months",
    },
    {
        id: Deno.env.get("PAYPAL_CLUB_YEARLY_PLAN_ID") || "",
        key: "club_yearly",
    },
] as const;

const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

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

function getVerifiedPlanKey(paypalPlanId: string) {
    const matchingPlan = CONFIGURED_PLANS.find(
        (plan) => plan.id && plan.id === paypalPlanId
    );

    return matchingPlan?.key || "";
}

function getMissingPlanSecretNames() {
    const names = [
        "PAYPAL_JA_MONTHLY_PLAN_ID",
        "PAYPAL_JA_6_MONTHS_PLAN_ID",
        "PAYPAL_JA_YEARLY_PLAN_ID",
        "PAYPAL_CLUB_MONTHLY_PLAN_ID",
        "PAYPAL_CLUB_6_MONTHS_PLAN_ID",
        "PAYPAL_CLUB_YEARLY_PLAN_ID",
    ];

    return CONFIGURED_PLANS
        .map((plan, index) => (plan.id ? "" : names[index]))
        .filter(Boolean);
}

async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("Missing PayPal credentials.");
    }

    const credentials = btoa(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    );

    const response = await fetch(
        `${PAYPAL_API_BASE}/v1/oauth2/token`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: "grant_type=client_credentials",
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Unable to get PayPal access token: ${text}`
        );
    }

    const data = await response.json();

    if (!data.access_token) {
        throw new Error(
            "PayPal access token missing from response."
        );
    }

    return String(data.access_token);
}

async function verifyPayPalWebhook(
    request: Request,
    webhookEvent: PayPalWebhookEvent,
    accessToken: string
) {
    if (!PAYPAL_WEBHOOK_ID) {
        throw new Error("Missing PAYPAL_WEBHOOK_ID secret.");
    }

    if (!hasRequiredPayPalHeaders(request)) {
        throw new Error(
            "Missing PayPal webhook signature headers."
        );
    }

    const verificationPayload = {
        auth_algo: request.headers.get("paypal-auth-algo"),
        cert_url: request.headers.get("paypal-cert-url"),
        transmission_id: request.headers.get(
            "paypal-transmission-id"
        ),
        transmission_sig: request.headers.get(
            "paypal-transmission-sig"
        ),
        transmission_time: request.headers.get(
            "paypal-transmission-time"
        ),
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
                Accept: "application/json",
            },
            body: JSON.stringify(verificationPayload),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `PayPal webhook verification failed: ${text}`
        );
    }

    const data = await response.json();

    return data.verification_status === "SUCCESS";
}

function getSubscriptionId(event: PayPalWebhookEvent) {
    const resource = event?.resource || {};

    const candidates = [
        resource.subscription_id,
        resource.billing_agreement_id,
        resource.supplementary_data?.related_ids?.subscription_id,
        resource.supplementary_data?.related_ids?.billing_agreement_id,
        resource.id,
    ];

    return (
        candidates.find(
            (value) =>
                typeof value === "string" && value.startsWith("I-")
        ) || ""
    );
}

async function getPayPalSubscriptionDetails(
    paypalSubscriptionId: string,
    accessToken: string
): Promise<PayPalSubscriptionDetails> {
    const response = await fetch(
        `${PAYPAL_API_BASE}/v1/billing/subscriptions/` +
        `${encodeURIComponent(paypalSubscriptionId)}?fields=plan`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Unable to retrieve PayPal subscription details: ${text}`
        );
    }

    return await response.json();
}

function resolveSubscriptionStatus(
    eventType: string,
    paypalStatus: string
) {
    if (
        eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
        eventType === "PAYMENT.SALE.REFUNDED" ||
        eventType === "PAYMENT.SALE.REVERSED"
    ) {
        return "past_due";
    }

    switch (paypalStatus) {
        case "APPROVAL_PENDING":
        case "APPROVED":
            return "pending";
        case "ACTIVE":
            return "active";
        case "SUSPENDED":
            return "suspended";
        case "CANCELLED":
            return "cancelled";
        case "EXPIRED":
            return "expired";
        default:
            return null;
    }
}

function addUtcMonths(source: Date, months: number) {
    const result = new Date(source.getTime());
    const originalDay = result.getUTCDate();

    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);

    const finalDayOfTargetMonth = new Date(
        Date.UTC(
            result.getUTCFullYear(),
            result.getUTCMonth() + 1,
            0
        )
    ).getUTCDate();

    result.setUTCDate(Math.min(originalDay, finalDayOfTargetMonth));
    return result;
}

function addBillingInterval(
    isoDate: string,
    intervalUnit: string,
    intervalCount: number
) {
    const parsedDate = new Date(isoDate);

    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    const count = Math.max(1, Number(intervalCount) || 1);

    switch (intervalUnit) {
        case "DAY":
            parsedDate.setUTCDate(parsedDate.getUTCDate() + count);
            break;
        case "WEEK":
            parsedDate.setUTCDate(parsedDate.getUTCDate() + count * 7);
            break;
        case "MONTH":
            return addUtcMonths(parsedDate, count).toISOString();
        case "YEAR":
            parsedDate.setUTCFullYear(
                parsedDate.getUTCFullYear() + count
            );
            break;
        default:
            return null;
    }

    return parsedDate.toISOString();
}

function getPeriodDates(details: PayPalSubscriptionDetails) {
    const currentPeriodStart =
        details.billing_info?.last_payment?.time ||
        details.start_time ||
        details.create_time ||
        null;

    let currentPeriodEnd =
        details.billing_info?.next_billing_time || null;

    if (!currentPeriodEnd && currentPeriodStart) {
        const regularCycle = details.plan?.billing_cycles?.find(
            (cycle) => cycle.tenure_type === "REGULAR"
        );

        currentPeriodEnd = addBillingInterval(
            currentPeriodStart,
            regularCycle?.frequency?.interval_unit || "",
            regularCycle?.frequency?.interval_count || 1
        );
    }

    return {
        currentPeriodStart,
        currentPeriodEnd,
    };
}

function wait(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function updateSubscriptionWithRetry(params: {
    paypalSubscriptionId: string;
    verifiedPlanKey: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    rawPayload: Record<string, unknown>;
}) {
    const maximumAttempts = 5;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        const { data, error } = await supabaseAdmin.rpc(
            "activate_paypal_subscription_from_webhook",
            {
                p_paypal_subscription_id: params.paypalSubscriptionId,
                p_verified_plan_key: params.verifiedPlanKey,
                p_status: params.status,
                p_current_period_start: params.currentPeriodStart,
                p_current_period_end: params.currentPeriodEnd,
                p_raw_payload: params.rawPayload,
            }
        );

        if (!error) {
            return data;
        }

        const subscriptionNotFound = error.message?.includes(
            "Subscription not found for PayPal ID"
        );

        if (!subscriptionNotFound || attempt === maximumAttempts) {
            throw new Error(error.message);
        }

        console.warn(
            "Pending subscription row not available yet. Retrying...",
            {
                paypalSubscriptionId: params.paypalSubscriptionId,
                attempt,
            }
        );

        await wait(1000);
    }

    throw new Error("Unable to update the PayPal subscription.");
}

serve(async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase server credentials.");
        }

        const missingPlanSecrets = getMissingPlanSecretNames();

        if (missingPlanSecrets.length > 0) {
            throw new Error(
                `Missing PayPal plan secrets: ${missingPlanSecrets.join(", ")}`
            );
        }

        const event = (await request.json()) as PayPalWebhookEvent;
        const accessToken = await getPayPalAccessToken();

        const isVerified = await verifyPayPalWebhook(
            request,
            event,
            accessToken
        );

        if (!isVerified) {
            return jsonResponse(
                { error: "Invalid PayPal webhook signature." },
                400
            );
        }

        const eventType = event?.event_type || "";
        const paypalSubscriptionId = getSubscriptionId(event);

        if (!paypalSubscriptionId) {
            console.warn(
                "PayPal event ignored because no subscription ID was found.",
                {
                    eventId: event?.id || "",
                    eventType,
                }
            );

            return jsonResponse({
                received: true,
                ignored: true,
                reason: "Missing PayPal subscription ID.",
                eventType,
            });
        }

        const subscriptionDetails = await getPayPalSubscriptionDetails(
            paypalSubscriptionId,
            accessToken
        );

        const paypalPlanId = subscriptionDetails.plan_id || "";
        const verifiedPlanKey = getVerifiedPlanKey(paypalPlanId);

        if (!verifiedPlanKey) {
            throw new Error(
                `Unknown or unauthorized PayPal plan ID: ${paypalPlanId}`
            );
        }

        const paypalStatus = subscriptionDetails.status || "";
        const nextStatus = resolveSubscriptionStatus(
            eventType,
            paypalStatus
        );

        if (!nextStatus) {
            return jsonResponse({
                received: true,
                ignored: true,
                reason: "Unsupported PayPal subscription status.",
                eventType,
                paypalSubscriptionId,
                paypalStatus,
            });
        }

        const { currentPeriodStart, currentPeriodEnd } =
            getPeriodDates(subscriptionDetails);

        const rawPayload = {
            source: "paypal_webhook_verified",
            event_id: event?.id || null,
            event_type: eventType,
            event_create_time: event?.create_time || null,
            received_at: new Date().toISOString(),
            paypal_subscription_id: paypalSubscriptionId,
            paypal_plan_id: paypalPlanId,
            verified_plan_key: verifiedPlanKey,
            paypal_subscription_status: paypalStatus,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            final_payment_time:
                subscriptionDetails.billing_info?.final_payment_time || null,
            last_payment:
                subscriptionDetails.billing_info?.last_payment || null,
            failed_payments_count:
                subscriptionDetails.billing_info?.failed_payments_count ?? null,
            outstanding_balance:
                subscriptionDetails.billing_info?.outstanding_balance || null,
        };

        console.log("Verified PayPal webhook received:", {
            eventId: event?.id || "",
            eventType,
            paypalSubscriptionId,
            paypalPlanId,
            verifiedPlanKey,
            paypalStatus,
            nextStatus,
            currentPeriodStart,
            currentPeriodEnd,
        });

        const data = await updateSubscriptionWithRetry({
            paypalSubscriptionId,
            verifiedPlanKey,
            status: nextStatus,
            currentPeriodStart,
            currentPeriodEnd,
            rawPayload,
        });

        return jsonResponse({
            received: true,
            verified: true,
            eventType,
            paypalSubscriptionId,
            paypalPlanId,
            planKey: verifiedPlanKey,
            paypalStatus,
            status: nextStatus,
            data,
        });
    } catch (error) {
        console.error("PayPal webhook handler error:", error);

        return jsonResponse(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            500
        );
    }
});
