import sendGridMailer from "@sendgrid/mail";
import { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { auth } from "../middleware/auth";
import { SignUpCodeCheck } from "../models/SignUpCodeCheck";
import { User, validateUser } from "../models/user";
import { generateFutureDateTime } from "../utils/dateUtils";
import { generateRandomCode } from "../utils/generateRandomCode";
import {
  APOLLO_PRICE_ID,
  couponId,
  enableTrial,
  numberOfDaysForTrial,
  paymentLink,
  price,
  STRIPE_KEY,
} from "../utils/globalVars";
import { isArrayEmpty } from "../utils/isArrayEmpty";

import Stripe from "stripe";
import { generateAuthToken } from "../utils/generateAuthToken";
import {
  addTagToContact,
  userHasPurchasedApollo,
} from "../utils/activeCampaignHelpers";
const stripe: Stripe = require("stripe")(STRIPE_KEY);

const router = express.Router();

/**
 * Initiates the process of creating new user
 */
router.post("/", async (req, res) => {
  if (isArrayEmpty(Object.values(req.body)))
    return res
      .status(400)
      .send({ message: "the above parameters are required" });

  const userByEmail = await User.findOne({ email: req.body.email });
  if (userByEmail)
    return res.status(400).send({ message: "email already exists" });

  const userByUsername = await User.findOne({ username: req.body.username });
  if (userByUsername)
    return res.status(400).send({ message: "username already exists" });

  const { error } = validateUser(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  const signUpCode = generateRandomCode(6);
  const signUpCodeCheck = new SignUpCodeCheck({
    signUpCode: signUpCode,
    email: req.body.email,
    expired: generateFutureDateTime(10),
  });

  try {
    sendGridMailer.setApiKey(process.env.SENDGRID_API_KEY as string);
    const msg = {
      to: req.body.email,
      from: {
        name: "Roger",
        email: "roger@suavekeys.com",
      },
      templateId: "d-5c76de59d734464192aa227add434f0f",
      asm: {
        groupId: 21779,
      },
      dynamicTemplateData: {
        signUpCode: signUpCode,
      },
    };

    await sendGridMailer.send(msg);
    await signUpCodeCheck.save();
    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Retrieves user information
 */
router.get("/me", async (req: any, res: any) => {
  const email = req.query.email;
  const supabase = req.supabase as SupabaseClient;

  const { data, error } = await supabase
    .from("users")
    .select(
      "username, profile_image_url, is_pro_user, trial_exp_date, promo_code, promo_code_expires_at, created_at"
    )
    .eq("email", email);

  if (error !== null)
    return res.status(500).send({ message: "something went wrong." });

  if (data?.length === 0 || data === null)
    return res.status(400).send({ message: "invalid parameter" });

  const userInfo = data![0];

  let isProUser: boolean;
  if (!userInfo.is_pro_user) {
    isProUser = await userHasPurchasedApollo(email);
    if (isProUser) {
      await supabase
        .from("users")
        .update({ is_pro_user: true })
        .eq("email", email);

      const token = generateAuthToken(email, (isProUser = true), null, null);
      res.header("Authorization", "Bearer " + token);
    } else {
      if (userInfo.trial_exp_date !== null) {
        const currentServerTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const trialExpDate = Math.floor(
          new Date(userInfo.trial_exp_date).getTime() / 1000
        );

        const token = generateAuthToken(
          email,
          enableTrial && trialExpDate > currentServerTime ? true : false,
          trialExpDate > currentServerTime,
          trialExpDate < currentServerTime
        );

        isProUser = false;
        res.header("Authorization", "Bearer " + token);
      } else {
        // Trial is for 7 days
        const expirationDate = new Date();
        expirationDate.setUTCDate(
          expirationDate.getUTCDate() + numberOfDaysForTrial
        );

        await supabase
          .from("users")
          .update({
            trial_exp_date: expirationDate,
          })
          .eq("email", email);

        const token = generateAuthToken(
          email,
          (isProUser = false),
          true,
          false
        );
        res.header("Authorization", "Bearer " + token);
      }
    }
  } else {
    const token = generateAuthToken(email, (isProUser = true), null, null);
    res.header("Authorization", "Bearer " + token);
  }

  // Create a promo code when
  // user is not pro user, has been 24 hours since they've created their account, and they don't already have a promo code set
  const currentTime = Math.floor(Date.now() / 1000);
  const createdAt = Math.floor(new Date(userInfo.created_at).getTime() / 1000);
  const timeDiff = currentTime - createdAt;

  let paymentLinkUpdated = paymentLink;

  if (
    !isProUser &&
    timeDiff > 24 * 60 * 60 &&
    userInfo.promo_code_expires_at === null
  ) {
    // User gets 24 hours to redeem discount
    const expirationDate = Math.floor(Date.now() / 1000) + 86400;

    // Create promo code
    const promotionCode = await stripe.promotionCodes.create({
      coupon: couponId,
      expires_at: expirationDate,
      max_redemptions: 1,
    });

    await addTagToContact(email, "apolloPromoCode");

    await supabase
      .from("users")
      .update({
        promo_code: promotionCode.code,
        promo_code_expires_at: new Date(expirationDate * 1000),
      })
      .eq("email", email);

    // This will trigger a popup that will notify the user that they have a discount.
    paymentLinkUpdated = `${paymentLink}?prefilled_promo_code=${promotionCode.code}`;
  } else {
    if (userInfo.promo_code_expires_at !== null) {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = Math.floor(
        new Date(userInfo.promo_code_expires_at).getTime() / 1000
      );
      if (expiresAt > currentTime) {
        paymentLinkUpdated = `${paymentLink}?prefilled_promo_code=${userInfo.promo_code}`;
      }
    }
  }

  return res.send({
    username: userInfo.username,
    profileImageUrl: userInfo.profile_image_url,
    paymentLink: paymentLinkUpdated,
    apolloPrice: price,
    expirationDate: isProUser
      ? undefined
      : userInfo.trial_exp_date === null
      ? undefined
      : userInfo.trial_exp_date,
  });
});

router.get("/charge_expired_trials", async (req: any, res: any) => {
  const supabase = req.supabase as SupabaseClient;

  // Get all users who have not cancelled and trial has expired
  const { data } = await supabase
    .from("users")
    .select("email, trial_exp_date")
    .eq("cancelled_trial", false)
    .eq("is_pro_user", false)
    .lt("trial_exp_date", new Date().toISOString());

  const emails = data!.map((data) => data.email as string);

  emails.map(async (email) => {
    const customers = await stripe.customers.list({
      email,
    });

    const customerId = customers.data[0].id;
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer;

    // payment method is set, so initiate payment
    if (customer.invoice_settings.default_payment_method !== null) {
      const setupPaymentIntent = await stripe.paymentIntents.create({
        amount: 11700,
        currency: "usd",
        customer: customerId,
        payment_method: customer.invoice_settings
          .default_payment_method as string,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        statement_descriptor_suffix: "ROGER-APOLLO",
      });

      const confirmPaymentIntent = await stripe.paymentIntents.confirm(
        setupPaymentIntent.id
      );

      // payment was successful
      if (confirmPaymentIntent.status === "succeeded") {
        await supabase
          .from("users")
          .update({ is_pro_user: true })
          .eq("email", email);

        // Add Apollo Purchasers tag to email
        await addTagToContact(email, "apolloPurchaser");
      }
    }
  });

  res.send({ success: true });
});

router.get("/payment_check", auth, async (req: any, res: any) => {
  const email = req.user.email;
  const supabase = req.supabase as SupabaseClient;

  const sessions = await stripe.checkout.sessions.list({
    customer_details: {
      email,
    },
  });

  const sessionIds = sessions.data.map((session) => session.id);

  let index = 0;
  const userHasPurchasedApollo = async (sessionId: string) => {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);

    const priceIds = lineItems.data.map((result) => result.price!.id);
    if (priceIds.includes(APOLLO_PRICE_ID)) {
      return true;
    } else {
      if (index < sessionIds.length) {
        userHasPurchasedApollo(sessionIds[index]);
        index += 1;
      } else {
        return false;
      }
    }
  };

  if (sessionIds.length > 0) {
    const purchasedApollo = (await userHasPurchasedApollo(
      sessionIds[0]
    )) as boolean;

    if (purchasedApollo) {
      await supabase
        .from("users")
        .update({ is_pro_user: true })
        .eq("email", email);

      await addTagToContact(email, "apolloPurchaser");
    }
  }

  res.send({ success: true });
});
/**
 * Updates username
 */
router.put("/update_username", async (req: any, res: any) => {
  const username = req.body.username;
  const email = req.body.email;
  const supabase = req.supabase as SupabaseClient;

  const { data, error } = await supabase
    .from("users")
    .update({ username })
    .eq("email", email)
    .select("username");

  if (error !== null)
    return res.status(400).send({ message: "username already in use" });

  res.send({ username: data![0].username });
});

router.get("/payment_methods", auth, async (req: any, res: any) => {
  const email = req.user.email;

  // Retrieve customer id
  const customers = await stripe.customers.list({
    email,
  });

  if (customers.data[0] == undefined)
    return res.send({ paymentMethodSet: false });

  const customerId = customers.data[0].id;
  const customer = (await stripe.customers.retrieve(
    customerId
  )) as Stripe.Customer;

  res.send({
    paymentMethodSet: customer.invoice_settings.default_payment_method !== null,
  });
});

router.post("/start_trial", auth, async (req: any, res: any) => {
  const email = req.user.email;
  const supabase = req.supabase as SupabaseClient;

  const { data } = await supabase
    .from("users")
    .select("trial_exp_date")
    .eq("email", email);

  if (data === null) return;
  const userInfo = data[0];

  if (userInfo.trial_exp_date !== null)
    return res
      .status(400)
      .send({ message: "Trial is in progress or has ended" });

  // Trial is for 3 days
  const expirationDate = new Date();
  expirationDate.setUTCDate(expirationDate.getUTCDate() + 3);

  await supabase
    .from("users")
    .update({
      trial_exp_date: expirationDate,
    })
    .eq("email", email);

  // Add Started Apollo Trial tag to email
  await addTagToContact(email, "apolloTrialUser");

  const token = generateAuthToken(email, false, true, false);
  res.header("Authorization", "Bearer " + token);

  res.send({
    success: true,
  });
});
/**
 * Sets profile image
 */
router.post("/profile_image", async (req: any, res: any) => {
  // const base64String = req.body.base64String;
  const email = req.body.email;
  const profileImageUrl = req.body.profileImageUrl;
  const supabase = req.supabase as SupabaseClient;

  // Upload the file to Supabase Storage
  // const { data, error } = await supabase.storage
  //   .from("profile-pictures") // Replace with your storage bucket name
  //   .upload(`${uuidv4()}.png`, decode(base64String), {
  //     contentType: "image/png",
  //   });

  // if (data === null)
  //   return res
  //     .stats(400)
  //     .send({ message: "error uploading profile picture. please try again." });

  // const profileImageUrl = `${SUPABASE_URL}/storage/v1/object/public/profile-pictures/${data.path}`;
  await supabase
    .from("users")
    .update({
      profile_image_url: profileImageUrl,
    })
    .eq("email", email);

  res.send({ profileImageUrl });
});

/**
 * Returns if given username is already taken
 */
// router.post("/check_username", async (req, res) => {
//   if (!req.body.username)
//     return res.status(400).send({ message: "username is required" });

//   const userByUsername = await User.findOne({ username: req.body.username });

//   if (userByUsername) {
//     res.status(400).send({ message: "username already exists" });
//   } else {
//     res.send({ message: true });
//   }
// });

/**
 * Returns if given email is already taken
 */
// router.post("/check_email", async (req, res) => {
//   if (!req.body.email)
//     return res.status(400).send({ message: "email is required" });

//   const userByEmail = await User.findOne({ email: req.body.email });

//   if (userByEmail !== null) {
//     res.status(400).send({ message: "email already exists" });
//   } else {
//     res.send({ message: true });
//   }
// });

// router.post("/login_streak", async (req, res) => {
//   if (!req.body.refreshTokenId)
//     return res.status(400).send({ message: "missing refresh token id" });

//   let timezone: string;

//   if (!req.body.timeZone) {
//     timezone = "America/Chicago";
//   } else {
//     timezone = req.body.timezone;
//   }

//   const currentDate = moment.tz(timezone).format("YYYY-MM-DD");

//   try {
//     const refreshTokenObj = await RefreshToken.findById(
//       new mongoose.Types.ObjectId(req.body.refreshTokenId)
//     );

//     if (!refreshTokenObj) return res.status(200).send({ message: false });

//     // Verify and decode the refresh token
//     const decodedToken = jwt.verify(
//       refreshTokenObj.refreshToken,
//       config.get("jwtSecret")
//     ) as JwtPayload;

//     // Get the expiration time from the decoded token
//     const expirationTime = decodedToken.exp as number;
//     // Get the current server time
//     const currentServerTime = Math.floor(Date.now() / 1000); // Current time in seconds

//     if (currentServerTime < expirationTime) {
//       const userId = decodedToken._id;
//       let user = await User.findById(userId);

//       let datesDiff = numberOfDaysBetweenDates(
//         user!.loggedDays[user!.loggedDays.length - 1],
//         currentDate,
//         timezone
//       );

//       if (datesDiff === 1) {
//         // Increment current login streak and update logged days
//         await User.findByIdAndUpdate(userId, {
//           currentLoginStreak: user!.currentLoginStreak + 1,
//           loggedDays: user!.loggedDays.concat(currentDate),
//         });
//       } else if (datesDiff > 1) {
//         // Set current login streak to 1 and update logged days
//         await User.findByIdAndUpdate(userId, {
//           currentLoginStreak: 1,
//           loggedDays: user!.loggedDays.concat(currentDate),
//         });
//       }

//       const weeksDiff = numberOfWeeksBetweenDates(
//         user!.loggedDays[user!.loggedDays.length - 1],
//         currentDate,
//         timezone
//       );

//       if (weeksDiff == 1) {
//         // Increment weekly login streak
//         await User.findByIdAndUpdate(userId, {
//           weeklyLoginStreak: user!.weeklyLoginStreak + 1,
//         });
//       } else if (weeksDiff > 1) {
//         // Set weekly login streak to 1
//         await User.findByIdAndUpdate(userId, {
//           weeklyLoginStreak: 1,
//         });
//       }

//       user = await User.findById(userId);

//       const daysInApolloThisYear = getNumberOfDaysInCurrentYear(
//         user!.loggedDays,
//         timezone
//       );

//       if (daysInApolloThisYear !== user!.daysInApolloThisYear) {
//         // Update db with daysInApolloThisYear
//         await User.findByIdAndUpdate(userId, {
//           daysInApolloThisYear: daysInApolloThisYear,
//         });
//       }

//       const token = user!.generateAuthToken();
//       res.header("Authorization", "Bearer " + token);

//       const currentWeekStartDate = moment.tz(timezone).startOf("week");

//       const currentWeekDays = [];

//       for (let i = 0; i < 7; i++) {
//         const currentDay = moment(currentWeekStartDate).add(i, "days");
//         currentWeekDays.push(currentDay.format("DD"));
//       }

//       const updatedUser = await User.findById(user).select({
//         currentLoginStreak: 1,
//         weeklyLoginStreak: 1,
//         daysInApolloThisYear: 1,
//         loggedDays: 1,
//         _id: 0,
//       });

//       updatedUser!.loggedDays = updatedUser!.loggedDays
//         .filter((loggedDay) =>
//           moment(loggedDay).isSame(currentWeekStartDate, "week")
//         )
//         .map((loggedDate) => loggedDate.split("-")[2]);

//       return res.send({ ...updatedUser!.toObject(), currentWeekDays });
//     }

//     res.status(400).send({ message: "refresh token expired" });
//   } catch (error) {
//     res
//       .status(400)
//       .send({ message: "something went wrong. please try again later." });
//   }
// });

/**
 * Retrieves status of subscription
 */
// router.get("/subscription_status", auth, async (req: any, res: any) => {
//   const user = await User.findById(parseInt(req.user._id));

//   const hasActiveSubscription = await userHasActiveSubscription(user!.email);

//   await user!.updateOne({
//     hasActiveSubscription,
//   });

//   const token = user!.generateAuthToken();
//   res.header("Authorization", "Bearer " + token);

//   res.send({ hasActiveSubscription });
// });

/**
 * Retrieves details of subscription
 */
// router.get("/subscription_details", auth, async (req: any, res: any) => {
//   const user = await User.findById(parseInt(req.user._id));

//   // Grab all customer ids associated with this email address
//   const customers = await stripe.customers.search({
//     query: `email: '${user!.email}'`,
//   });

//   const customerIds = customers.data.map((data: any) => data.id);

//   // Check to see if customers list is non-empty first
//   let subscriptions = [];
//   let billingPortalUrl = "";
//   if (customerIds.length > 0) {
//     const customerId = customerIds[0];
//     subscriptions = await stripe.subscriptions.list({
//       customer: customerId,
//       price: "priceId",
//       status: "all",
//     });

//     const sessionData = await stripe.billingPortal.sessions.create({
//       customer: customerId,
//     });
//     billingPortalUrl = sessionData.url;
//   }

//   // Check to see if subscriptions list is non-empty first
//   if (subscriptions.data.length > 0) {
//     const recentSubscription = subscriptions.data[0];

//     const subscriptionId = recentSubscription.id;

//     let isRenewing: boolean;

//     if (recentSubscription.canceled_at === null) {
//       isRenewing = true;
//     } else {
//       isRenewing = false;
//     }

//     let renewalDate = "";
//     let expirationDate = "";

//     if (isRenewing) {
//       renewalDate = convertUnixTimestamp(recentSubscription.current_period_end);
//     } else {
//       expirationDate = convertUnixTimestamp(
//         recentSubscription.current_period_end
//       );
//     }

//     let currentPlan = "";

//     if (recentSubscription.status === "active") {
//       currentPlan = "Suite";
//     } else {
//       currentPlan = "Lite";
//     }

//     const token = user!.generateAuthToken();
//     res.header("Authorization", "Bearer " + token);

//     res.send({
//       currentPlan,
//       subscriptionId,
//       renewalDate,
//       expirationDate,
//       billingPortalUrl,
//     });
//   } else {
//     const token = user!.generateAuthToken();
//     res.header("Authorization", "Bearer " + token);

//     res.send({
//       currentPlan: "Lite",
//     });
//   }
// });

/**
 * Continue subscription
 */
// router.post("/continue_subscription", auth, async (req: any, res: any) => {
//   try {
//     // Update the subscription to reschedule cancellation
//     await stripe.subscriptions.update(req.body.subscriptionId, {
//       cancel_at: null, // Set cancel_at to null to remove the scheduled cancellation
//     });
//   } catch (error) {
//     console.error("Error:", error);
//   }

//   res.send({ success: true });
// });

/**
 * Cancel subscription
 */
// router.post("/cancel_subscription", auth, async (req: any, res: any) => {
//   try {
//     // Cancels the subscription
//     await stripe.subscriptions.update(req.body.subscriptionId, {
//       cancel_at_period_end: true,
//     });
//   } catch (error) {
//     console.error("Error:", error);
//   }

//   res.send({ success: true });
// });

export default router;
