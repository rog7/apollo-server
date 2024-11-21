export const SUPABASE_URL = process.env.APOLLO_DB_URL;
export const SUPABASE_KEY = process.env.APOLLO_DB_KEY;

export const STRIPE_KEY =
  process.env.NODE_ENV === "development"
    ? process.env.DEV_STRIPE_API_KEY
    : process.env.PROD_STRIPE_API_KEY;

export const APOLLO_PRICE_ID =
  process.env.NODE_ENV === "development"
    ? "price_1QLCOQEClFg6JFP3i5rNrdp9"
    : "price_1QLCLuEClFg6JFP3RI9KCc9z";

export const webSocketUrl =
  process.env.NODE_ENV === "development"
    ? process.env.APOLLO_DEV_WEBSOCKET_URL
    : process.env.APOLLO_PROD_WEBSOCKET_URL;

export const enableTrial = false;

export const numberOfDaysForTrial = 7;

export const paymentLink =
  process.env.NODE_ENV === "development"
    ? "https://buy.stripe.com/test_8wMcOg3wv5gr22Y9AH"
    : "https://buy.stripe.com/7sI3e4dNP15Z5Ak6oy";

export const couponId =
  process.env.NODE_ENV === "development" ? "wXT3oPFA" : "r4N6xFgZ";

export const price = 99;

export const ACTIVE_CAMPAIGN_BASE_URL = process.env
  .ACTIVE_CAMPAIGN_BASE_URL as string;

export const ACTIVE_CAMPAIGN_API_KEY = process.env
  .ACTIVE_CAMPAIGN_API_KEY as string;

export const KIT_BASE_URL = process.env.KIT_BASE_URL as string;

export const KIT_API_KEY = process.env.KIT_API_KEY as string;

export const KIT_API_SECRET = process.env.KIT_API_SECRET as string;

export const apolloPurchasersTagId = 5504022;

export const apolloTrialUsersTagId = 5504025;

export const apolloPromoCodeReceiversTagId = 5504029;

export const apolloUsersTagId = 5504028;

export const newsletterFormId = 7291861;

export const APOLLO_SECRET_KEY = process.env.APOLLO_SECRET_KEY as string;

// This will allow whether they can use the free version if they're not a pro user
export const enableFreeVersion = true;
