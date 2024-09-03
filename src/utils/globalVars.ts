export const SUPABASE_URL = process.env.APOLLO_DB_URL;
export const SUPABASE_KEY = process.env.APOLLO_DB_KEY;

export const STRIPE_KEY =
  process.env.NODE_ENV === "development"
    ? process.env.DEV_STRIPE_API_KEY
    : process.env.PROD_STRIPE_API_KEY;

export const APOLLO_PRICE_ID =
  process.env.NODE_ENV === "development"
    ? "price_1OpYvHEClFg6JFP3IhdfEKlf"
    : "price_1OpXQEEClFg6JFP3mJLQ8wKC";

export const webSocketUrl =
  process.env.NODE_ENV === "development"
    ? process.env.APOLLO_DEV_WEBSOCKET_URL
    : process.env.APOLLO_PROD_WEBSOCKET_URL;

export const enableTrial = true;

export const numberOfDaysForTrial = 7;

export const paymentLink =
  process.env.NODE_ENV === "development"
    ? "https://buy.stripe.com/test_fZe15y1ongZ9dLG9AG"
    : "https://buy.stripe.com/9AQ01S2579Cv7IsbIP";

export const couponId =
  process.env.NODE_ENV === "development" ? "yPQWHKP2" : "1bdZzEQm";

export const price = 117;

export const ACTIVE_CAMPAIGN_BASE_URL = process.env
  .ACTIVE_CAMPAIGN_BASE_URL as string;

export const ACTIVE_CAMPAIGN_API_KEY = process.env
  .ACTIVE_CAMPAIGN_API_KEY as string;

export const APOLLO_SECRET_KEY = process.env.APOLLO_SECRET_KEY as string;
