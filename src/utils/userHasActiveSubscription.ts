import { STRIPE_KEY } from "./globalVars";

const stripe = require("stripe")(STRIPE_KEY);

export const userHasActiveSubscription = async (email: string) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      price: "priceId",
      status: "active", // Only active subscriptions
    });

    const emailList = [];

    for (const subscription of subscriptions.data) {
      const customer = await stripe.customers.retrieve(subscription.customer);
      emailList.push(customer.email);
    }

    return emailList.includes(email);
  } catch (error) {
    console.error("Error:", error);
    return false; // Return false in case of an error
  }
};
