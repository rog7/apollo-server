import express from "express";
import _ from "lodash";
import { User, validateNewUsername, validateUser } from "../models/user";
import { auth } from "../middleware/auth";
import { generateRandomCode } from "../utils/generateRandomCode";
import { SignUpCodeCheck } from "../models/SignUpCodeCheck";
import sendGridMailer from "@sendgrid/mail";
import {
  generateFutureDateTime,
  getNumberOfDaysInCurrentYear,
  numberOfDaysBetweenDates,
  numberOfWeeksBetweenDates,
} from "../utils/dateUtils";
import { isArrayEmpty } from "../utils/isArrayEmpty";
import { RefreshToken } from "../models/refreshToken";
import mongoose from "mongoose";
import config from "config";
import jwt, { JwtPayload } from "jsonwebtoken";
import moment from "moment-timezone";
import { userHasActiveSubscription } from "../utils/userHasActiveSubscription";
import { convertUnixTimestamp } from "../utils/convertUnixTimestamp";
import { priceId, stripeSecretKey } from "../utils/StripeValues";

const stripe = require("stripe")(stripeSecretKey);

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
router.get("/me", auth, async (req: any, res: any) => {
  const user = await User.findById(parseInt(req.user._id)).select({
    _id: 1,
    username: 1,
    email: 1,
    profileImageObj: 1,
  });
  res.send(user);
});

/**
 * Sets profile image
 */
router.post("/profile_image", auth, async (req: any, res: any) => {
  if (!req.user._id)
    return res.status(401).send({ message: "unauthorized access" });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profileImageObj: req.body.profileImageObj },
    { new: true }
  ).select({ profileImageObj: 1, _id: 0 });

  res.send(user);
});

/**
 * Updates username
 */
router.put("/update_username", auth, async (req: any, res: any) => {
  const { error } = validateNewUsername(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  const userByUsername = await User.findOne({ username: req.body.username });

  if (userByUsername) {
    res.status(400).send({ message: "username already exists" });
  } else {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username: req.body.username },
      { new: true }
    ).select({ username: 1 });

    const token = user!.generateAuthToken();
    res.header("Authorization", "Bearer " + token);

    res.send(user);
  }
});

/**
 * Returns if given username is already taken
 */
router.post("/check_username", async (req, res) => {
  if (!req.body.username)
    return res.status(400).send({ message: "username is required" });

  const userByUsername = await User.findOne({ username: req.body.username });

  if (userByUsername) {
    res.status(400).send({ message: "username already exists" });
  } else {
    res.send({ message: true });
  }
});

/**
 * Returns if given email is already taken
 */
router.post("/check_email", async (req, res) => {
  if (!req.body.email)
    return res.status(400).send({ message: "email is required" });

  const userByEmail = await User.findOne({ email: req.body.email });

  if (userByEmail !== null) {
    res.status(400).send({ message: "email already exists" });
  } else {
    res.send({ message: true });
  }
});

router.post("/login_streak", async (req, res) => {
  if (!req.body.refreshTokenId)
    return res.status(400).send({ message: "missing refresh token id" });

  let timezone: string;

  if (!req.body.timeZone) {
    timezone = "America/Chicago";
  } else {
    timezone = req.body.timezone;
  }

  const currentDate = moment.tz(timezone).format("YYYY-MM-DD");

  try {
    const refreshTokenObj = await RefreshToken.findById(
      new mongoose.Types.ObjectId(req.body.refreshTokenId)
    );

    if (!refreshTokenObj) return res.status(200).send({ message: false });

    // Verify and decode the refresh token
    const decodedToken = jwt.verify(
      refreshTokenObj.refreshToken,
      config.get("jwtSecret")
    ) as JwtPayload;

    // Get the expiration time from the decoded token
    const expirationTime = decodedToken.exp as number;
    // Get the current server time
    const currentServerTime = Math.floor(Date.now() / 1000); // Current time in seconds

    if (currentServerTime < expirationTime) {
      const userId = decodedToken._id;
      let user = await User.findById(userId);

      let datesDiff = numberOfDaysBetweenDates(
        user!.loggedDays[user!.loggedDays.length - 1],
        currentDate,
        timezone
      );

      if (datesDiff === 1) {
        // Increment current login streak and update logged days
        await User.findByIdAndUpdate(userId, {
          currentLoginStreak: user!.currentLoginStreak + 1,
          loggedDays: user!.loggedDays.concat(currentDate),
        });
      } else if (datesDiff > 1) {
        // Set current login streak to 1 and update logged days
        await User.findByIdAndUpdate(userId, {
          currentLoginStreak: 1,
          loggedDays: user!.loggedDays.concat(currentDate),
        });
      }

      const weeksDiff = numberOfWeeksBetweenDates(
        user!.loggedDays[user!.loggedDays.length - 1],
        currentDate,
        timezone
      );

      if (weeksDiff == 1) {
        // Increment weekly login streak
        await User.findByIdAndUpdate(userId, {
          weeklyLoginStreak: user!.weeklyLoginStreak + 1,
        });
      } else if (weeksDiff > 1) {
        // Set weekly login streak to 1
        await User.findByIdAndUpdate(userId, {
          weeklyLoginStreak: 1,
        });
      }

      user = await User.findById(userId);

      const daysInApolloThisYear = getNumberOfDaysInCurrentYear(
        user!.loggedDays,
        timezone
      );

      if (daysInApolloThisYear !== user!.daysInApolloThisYear) {
        // Update db with daysInApolloThisYear
        await User.findByIdAndUpdate(userId, {
          daysInApolloThisYear: daysInApolloThisYear,
        });
      }

      const token = user!.generateAuthToken();
      res.header("Authorization", "Bearer " + token);

      const currentWeekStartDate = moment.tz(timezone).startOf("week");

      const currentWeekDays = [];

      for (let i = 0; i < 7; i++) {
        const currentDay = moment(currentWeekStartDate).add(i, "days");
        currentWeekDays.push(currentDay.format("DD"));
      }

      const updatedUser = await User.findById(user).select({
        currentLoginStreak: 1,
        weeklyLoginStreak: 1,
        daysInApolloThisYear: 1,
        loggedDays: 1,
        _id: 0,
      });

      updatedUser!.loggedDays = updatedUser!.loggedDays
        .filter((loggedDay) =>
          moment(loggedDay).isSame(currentWeekStartDate, "week")
        )
        .map((loggedDate) => loggedDate.split("-")[2]);

      return res.send({ ...updatedUser!.toObject(), currentWeekDays });
    }

    res.status(400).send({ message: "refresh token expired" });
  } catch (error) {
    res
      .status(400)
      .send({ message: "something went wrong. please try again later." });
  }
});

/**
 * Retrieves status of subscription
 */
router.get("/subscription_status", auth, async (req: any, res: any) => {
  const user = await User.findById(parseInt(req.user._id));

  const hasActiveSubscription = await userHasActiveSubscription(user!.email);

  await user!.updateOne({
    hasActiveSubscription,
  });

  const token = user!.generateAuthToken();
  res.header("Authorization", "Bearer " + token);

  res.send({ hasActiveSubscription });
});

/**
 * Retrieves details of subscription
 */
router.get("/subscription_details", auth, async (req: any, res: any) => {
  const user = await User.findById(parseInt(req.user._id));

  // Grab all customer ids associated with this email address
  const customers = await stripe.customers.search({
    query: `email: '${user!.email}'`,
  });

  const customerIds = customers.data.map((data: any) => data.id);

  // Check to see if customers list is non-empty first
  let subscriptions = [];
  let billingPortalUrl = "";
  if (customerIds.length > 0) {
    const customerId = customerIds[0];
    subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      price: priceId,
      status: "all",
    });

    const sessionData = await stripe.billingPortal.sessions.create({
      customer: customerId,
    });
    billingPortalUrl = sessionData.url;
  }

  // Check to see if subscriptions list is non-empty first
  if (subscriptions.data.length > 0) {
    const recentSubscription = subscriptions.data[0];

    const subscriptionId = recentSubscription.id;

    let isRenewing: boolean;

    if (recentSubscription.canceled_at === null) {
      isRenewing = true;
    } else {
      isRenewing = false;
    }

    let renewalDate = "";
    let expirationDate = "";

    if (isRenewing) {
      renewalDate = convertUnixTimestamp(recentSubscription.current_period_end);
    } else {
      expirationDate = convertUnixTimestamp(
        recentSubscription.current_period_end
      );
    }

    let currentPlan = "";

    if (recentSubscription.status === "active") {
      currentPlan = "Suite";
    } else {
      currentPlan = "Lite";
    }

    const token = user!.generateAuthToken();
    res.header("Authorization", "Bearer " + token);

    res.send({
      currentPlan,
      subscriptionId,
      renewalDate,
      expirationDate,
      billingPortalUrl,
    });
  } else {
    const token = user!.generateAuthToken();
    res.header("Authorization", "Bearer " + token);

    res.send({
      currentPlan: "Lite",
    });
  }
});

/**
 * Continue subscription
 */
router.post("/continue_subscription", auth, async (req: any, res: any) => {
  try {
    // Update the subscription to reschedule cancellation
    await stripe.subscriptions.update(req.body.subscriptionId, {
      cancel_at: null, // Set cancel_at to null to remove the scheduled cancellation
    });
  } catch (error) {
    console.error("Error:", error);
  }

  res.send({ success: true });
});

/**
 * Cancel subscription
 */
router.post("/cancel_subscription", auth, async (req: any, res: any) => {
  try {
    // Cancels the subscription
    await stripe.subscriptions.update(req.body.subscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (error) {
    console.error("Error:", error);
  }

  res.send({ success: true });
});

export default router;
