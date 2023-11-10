export const userHasPurchasedApollo = async (email: string) => {
  try {
    const response = await fetch(
      "https://suavekeys.api-us1.com/api/3/contacts?tagid=30",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Api-Token":
            process.env.ACTIVE_CAMPAIGN_API_KEY as string,
        },
      }
    );

    const data = await response.json();

    if (response.status === 200) {
      const apolloPurchasers: string[] = data.contacts.map(
        (contact: any) => contact.email
      );

      return apolloPurchasers.includes(email);
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }

  // try {
  //   const response = await fetch(
  //     "https://suave-keys.myshopify.com/admin/api/2023-04/orders.json?status=any&financial_status=paid&fulfillment_status=shipped&status=closed&fields=line_items,email&created_at_min=2023-05-01&limit=250",
  //     {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN as string,
  //       },
  //     }
  //   );
  //   const data = await response.json();

  //   if (response.status === 200) {
  //     const premiumUsers: string[] = data.orders
  //       .filter((obj: any) => {
  //         return obj.line_items.some(
  //           (item: any) => item.price > 20 && item.name.includes("Apollo")
  //         );
  //       })
  //       .map((obj: any) => obj.email)
  //       .concat("roger.simon96@gmail.com");

  //     return premiumUsers.includes(email);
  //   } else {
  //     return false;
  //   }
  // } catch (error) {
  //   return false;
  // }
};
