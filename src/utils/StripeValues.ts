export const priceId =
  process.env.NODE_ENV == "development"
    ? "price_1Ni4nZEClFg6JFP3tXw6zCWx"
    : "price_1Ni3cgEClFg6JFP3S0XB8sKV";
export const stripeSecretKey =
  process.env.NODE_ENV == "development"
    ? "sk_test_51HosJEEClFg6JFP3y9MHCwP5F2PBiKVSjj7aEQaHXdWW3CXH5yyb36oLZWZkuXTRc0DNSlPxoeR9aHkTOXPdfS7J002bWKxcYc"
    : "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";
