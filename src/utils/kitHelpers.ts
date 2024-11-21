import {
  KIT_API_KEY,
  KIT_BASE_URL,
  KIT_API_SECRET,
  apolloPurchasersTagId,
  apolloTrialUsersTagId,
  apolloPromoCodeReceiversTagId,
  newsletterFormId,
  apolloUsersTagId,
} from "./globalVars";

export const addTagToContact = async (email: string, tag: string) => {
  const baseUrl = `${KIT_BASE_URL}/tags`;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_secret: KIT_API_SECRET, email }),
  };

  try {
    if (tag === "apolloPurchaser") {
      await fetch(`${baseUrl}/${apolloPurchasersTagId}/subscribe`, options);
    } else if (tag === "apolloTrialUser") {
      await fetch(`${baseUrl}/${apolloTrialUsersTagId}/subscribe`, options);
    } else if (tag === "apolloPromoCode") {
      await fetch(
        `${baseUrl}/${apolloPromoCodeReceiversTagId}/subscribe`,
        options
      );
    } else if (tag === "apolloUser") {
      await fetch(`${baseUrl}/${apolloUsersTagId}/subscribe`, options);
    }
  } catch (error) {
    console.log("error: ", error);
  }
};

export const userHasPurchasedApollo = async (email: string) => {
  try {
    // Get subscriber id
    const url = `${KIT_BASE_URL}/subscribers?api_secret=${KIT_API_SECRET}&email_address=${email}`;
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };
    const response = await fetch(url, options);

    const data = await response.json();

    if (data.subscribers.length === 0) {
      // Contact does not exist. Will create it here
      try {
        const url = `${KIT_BASE_URL}/forms/${newsletterFormId}/subscribe`;
        const options = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ api_key: KIT_API_KEY, email }),
        };

        const response = await fetch(url, options);
      } catch (error) {
        console.log("error: ", error);
      }
      return false;
    } else {
      const subscriberId = data.subscribers[0].id;
      try {
        const url = `${KIT_BASE_URL}/subscribers/${subscriberId}/tags?api_key=${KIT_API_KEY}`;
        const options = {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        };

        // Check to see if user has purchased by looking at tag
        const response = await fetch(url, options);

        const result = await response.json();

        const hasPurchased = result.tags
          .map((tag: any) => tag.id)
          .includes(apolloPurchasersTagId);

        return hasPurchased;
      } catch (error) {
        console.log("error: ", error);
        return false;
      }
    }
  } catch (error) {
    console.log("error: ", error);
    return false;
  }
};
