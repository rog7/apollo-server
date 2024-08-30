import {
  ACTIVE_CAMPAIGN_API_KEY,
  ACTIVE_CAMPAIGN_BASE_URL,
} from "./globalVars";

export const addTagToContact = async (email: string, tag: string) => {
  try {
    // Get contact id
    const url = `${ACTIVE_CAMPAIGN_BASE_URL}/contacts?email=${email}`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
      },
    };

    const response = await fetch(url, options);

    const data = await response.json();

    const contactId = data.contacts[0].id;

    const addContactUrl = `${ACTIVE_CAMPAIGN_BASE_URL}/contactTags`;

    if (tag === "apolloPurchaser") {
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
        },
        body: JSON.stringify({ contactTag: { contact: contactId, tag: "30" } }),
      };

      await fetch(addContactUrl, options);
    } else if (tag === "apolloTrialUser") {
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
        },
        body: JSON.stringify({ contactTag: { contact: contactId, tag: "34" } }),
      };

      await fetch(addContactUrl, options);
    } else if (tag === "apolloUser") {
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
        },
        body: JSON.stringify({ contactTag: { contact: contactId, tag: "42" } }),
      };

      await fetch(addContactUrl, options);
    } else if (tag === "apolloPromoCode") {
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
        },
        body: JSON.stringify({ contactTag: { contact: contactId, tag: "43" } }),
      };

      await fetch(addContactUrl, options);
    }
  } catch (error) {
    console.log("error: ", error);
  }
};

export const userHasPurchasedApollo = async (email: string) => {
  try {
    const url = `${ACTIVE_CAMPAIGN_BASE_URL}/contacts?email=${email}`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
      },
    };
    const response = await fetch(url, options);

    const data = await response.json();

    if (data.contacts.length === 0) {
      // Contact does not exist. Will create it here
      try {
        const url = `${ACTIVE_CAMPAIGN_BASE_URL}/contacts?email=${email}`;
        const options = {
          method: "POST",
          headers: {
            accept: "application/json",
            "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
          },
          body: JSON.stringify({ contact: { email } }),
        };

        const response = await fetch(url, options);

        const data = await response.json();

        const contactId = data.contact.id;

        // Add contact to list
        const addContactToListUrl = `${ACTIVE_CAMPAIGN_BASE_URL}/contactLists`;
        const addContactToListOptions = {
          method: "POST",
          headers: {
            accept: "application/json",
            "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
          },
          body: JSON.stringify({
            contactList: { list: 1, contact: contactId, status: 1 },
          }),
        };

        await fetch(addContactToListUrl, addContactToListOptions);
        await addTagToContact(email, "apolloUser");
      } catch (error) {
        console.log("error: ", error);
      }
      return false;
    } else {
      try {
        const url = `${ACTIVE_CAMPAIGN_BASE_URL}/contacts?tagid=30&email=${email}`;
        const options = {
          method: "GET",
          headers: {
            accept: "application/json",
            "Api-Token": ACTIVE_CAMPAIGN_API_KEY,
          },
        };

        // Check to see if user has purchased by looking at tag
        const response = await fetch(url, options);

        const result = await response.json();

        const hasPurchased = result.contacts
          .map((contact: any) => contact.email)
          .includes(email);

        if (!hasPurchased) {
          await addTagToContact(email, "apolloUser");
        }

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
