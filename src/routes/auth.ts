import sendGridMailer from "@sendgrid/mail";
import { SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import express from "express";
import { rateLimit } from "express-rate-limit";
import jwt, { JwtPayload } from "jsonwebtoken";
import _ from "lodash";
import mongoose from "mongoose";
import Stripe from "stripe";
import {
  validResetPassword,
  validateLogin,
  validateNewPassword,
} from "../models/auth";
import { PasswordReset } from "../models/passwordReset";
import { RefreshToken, validateRefreshTokenId } from "../models/refreshToken";
import { SignUpCodeCheck } from "../models/SignUpCodeCheck";
import { User, createUser } from "../models/user";
import { addTagToContact, userHasPurchasedApollo } from "../utils/kitHelpers";
import { generateFutureDateTime } from "../utils/dateUtils";
import { generateAuthToken } from "../utils/generateAuthToken";
import { generateRandomCode } from "../utils/generateRandomCode";
import {
  APOLLO_SECRET_KEY,
  STRIPE_KEY,
  enableFreeVersion,
  enableTrial,
  numberOfDaysForTrial,
} from "../utils/globalVars";
import { userHasActiveSubscription } from "../utils/userHasActiveSubscription";
const stripe: Stripe = require("stripe")(STRIPE_KEY);

const router = express.Router();

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login account requests per `window`
  message: {
    message: "too many login attempts. please try again in 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Send auth code
 */
router.post("/send_auth_code", async (req: any, res: any) => {
  const email = req.body.email as string;
  const supabase = req.supabase as SupabaseClient;

  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("email", email.toLowerCase());

  const emails = data!.map((value) => value.email as string);
  const isProUser = await userHasPurchasedApollo(email);

  if (
    !emails.includes(email.toLowerCase()) &&
    (isProUser || enableTrial || enableFreeVersion)
  ) {
    // Send auth code to potential user
    const authCode = generateRandomCode(6);

    // Get the current date and time
    let expirationTimestamp = new Date();

    // Add 15 minutes
    expirationTimestamp.setMinutes(expirationTimestamp.getMinutes() + 10);

    const emailValue = email.toLowerCase();

    const { data, error } = await supabase.from("auth_codes").insert({
      email: emailValue,
      code: authCode,
      expiration_timestamp: expirationTimestamp,
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
          authCode,
        },
      };

      await sendGridMailer.send(msg);
      return res.send({ message: true });
    } catch (error: any) {
      return res.status(500).send({ message: error.message });
    }
  } else {
    return res.status(401).send({ message: "Unauthorized access" });
  }
});

/**
 * Auth code check
 */
router.post("/auth_code_check", async (req: any, res: any) => {
  const email = req.body.email as string;
  const authCode = req.body.authCode;

  const supabase = req.supabase as SupabaseClient;

  const { data, error } = await supabase
    .from("auth_codes")
    .select("code")
    .eq("email", email.toLowerCase())
    .gt("expiration_timestamp", new Date().toISOString())
    .order("id", { ascending: false })
    .limit(1);

  const code = data?.map((value) => value.code)[0] as string | null;

  if (authCode === code) {
    const emailValue = email.toLowerCase();
    // Add user to auth table
    const { data, error } = await supabase.auth.signUp({
      email: emailValue,
      password: "abc123",
    });

    const isProUser = await userHasPurchasedApollo(email.toLowerCase());

    // Add Apollo User tag to email
    await addTagToContact(email, "apolloUser");

    const username = "user" + generateRandomCode(10);

    await supabase
      .from("users")
      .insert({ email: emailValue, is_pro_user: isProUser, username });

    if (enableTrial && !isProUser) {
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
        .eq("email", emailValue);

      // Create customer in stripe
      await stripe.customers.create({
        email: emailValue,
      });

      const token = generateAuthToken(emailValue, true, true, false);
      res.header("Authorization", "Bearer " + token);

      return res.send({
        message: true,
        username,
        expirationDate,
      });
    } else {
      if (!isProUser) {
        // Create customer in stripe
        await stripe.customers.create({
          email: emailValue,
        });
      }

      const token = generateAuthToken(emailValue, isProUser, false, false);
      res.header("Authorization", "Bearer " + token);

      return res.send({
        message: true,
        username,
      });
    }
  } else {
    return res.status(400).send({ message: "Invalid code" });
  }
});

/**
 * Logs in
 */
router.post("/login", loginAccountLimiter, async (req, res) => {
  const { error } = validateLogin(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  // If user didn't provide unique user identifier, check to see if they have purchased.

  // If they purchased, they already have an account and purchasedSuite == false,
  // update the unique user identifier and pass this value back to the client

  const userByUsername = await User.findOne({
    username: req.body.usernameOrEmail,
  });

  const userByEmail = await User.findOne({
    email: req.body.usernameOrEmail,
  });

  if (!userByUsername && !userByEmail)
    return res.status(400).send({ message: "invalid login credentials" });

  let user = new User();

  if (userByUsername !== null) {
    user = userByUsername;
  } else {
    user = userByEmail!;
  }

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword)
    return res.status(400).send({ message: "invalid login credentials" });

  const hasActiveSubscription = await userHasActiveSubscription(user.email);

  await user.updateOne({
    hasActiveSubscription,
  });

  const refreshToken = new RefreshToken({
    refreshToken: user.generateRefreshToken(),
  });

  const refreshTokenId = await refreshToken.save();

  const token = user.generateAuthToken();
  res.header("Authorization", "Bearer " + token);
  res.header("Refresh-Token-Id", refreshTokenId._id.toString());
  res.send({ message: true });
});

/**
 * Logs out
 */

/**
 * Resets password
 */
router.post("/reset_password", async (req, res) => {
  const { error } = validResetPassword(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });
  if (!req.body.email)
    return res.status(400).send({ message: "email is required" });

  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.send({ message: true });

  const resetCode = generateRandomCode(6);
  const passwordReset = new PasswordReset({
    resetCode: resetCode,
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
      templateId: "d-d6aea1b02ee7418ab9f828b1247dca2e",
      asm: {
        groupId: 21779,
      },
      dynamicTemplateData: {
        resetCode: resetCode,
      },
    };

    await sendGridMailer.send(msg);
    await passwordReset.save();
    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send(error.message);
  }
});

/**
 * Updates password
 */
router.put("/update_password", async (req, res) => {
  const { error } = validateNewPassword(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  if (!req.body.resetCode) {
    if (!req.body.email)
      return res.status(400).send({ message: "email is required" });

    if (!req.body.oldPassword)
      return res.status(400).send("previous password is required");

    const user = await User.findOne({ email: req.body.email });

    if (!user) return res.status(400).send({ message: "invalid password" });

    const validPassword = await bcrypt.compare(
      req.body.oldPassword,
      user.password
    );
    if (!validPassword)
      return res.status(400).send({ message: "invalid password" });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    await user.updateOne({ password: hashedPassword });

    const token = user.generateAuthToken();
    res.header("Authorization", "Bearer " + token);

    const refreshToken = new RefreshToken({
      refreshToken: user.generateRefreshToken(),
    });

    const refreshTokenId = await refreshToken.save();
    res.header("Refresh-Token-Id", refreshTokenId._id.toString());

    res.send({ message: true });
  } else {
    const resetInfo = await PasswordReset.findOne({
      resetCode: req.body.resetCode,
      expired: { $gt: Date.now() },
    });

    if (!resetInfo) return res.status(400).send({ message: "Invalid code" });

    const user = await User.findOne({ email: resetInfo.email });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    if (!user)
      return res
        .status(400)
        .send({ message: "something went wrong. please try again later." });

    const token = user.generateAuthToken();
    res.header("Authorization", "Bearer " + token);

    const refreshToken = new RefreshToken({
      refreshToken: user.generateRefreshToken(),
    });

    const refreshTokenId = await refreshToken.save();
    res.header("Refresh-Token-Id", refreshTokenId._id.toString());

    await user.updateOne({ password: hashedPassword });
    res.send({ message: true });
  }
});

/**
 * Checks if password reset code is valid
 */

router.post("/password_reset_code_check", async (req, res) => {
  if (!req.body.resetCode)
    return res.status(400).send({ message: "reset code is required" });

  const resetInfo = await PasswordReset.findOne({
    resetCode: req.body.resetCode,
    expired: { $gt: Date.now() },
  });

  if (resetInfo !== null) {
    res.send({ message: true });
  } else {
    res.status(400).send({ message: "Invalid code" });
  }
});

/**
 * Checks if sign up code is valid
 */
router.post("/sign_up_code_check", async (req, res) => {
  if (!req.body.signUpCode)
    return res.status(400).send({ message: "sign up code is required" });

  const resetInfoOpt = await SignUpCodeCheck.findOne({
    signUpCode: req.body.signUpCode,
    email: req.body.email,
    expired: { $gt: Date.now() },
  });

  if (resetInfoOpt !== null) {
    const maxUserIdOpt = (await User.findOne().sort({ _id: -1 }).limit(1))?._id;

    const createdUser = createUser(maxUserIdOpt, req.body, false);

    // Check to see if user has active subscription
    const hasActiveSubscription = await userHasActiveSubscription(
      createdUser.email
    );
    if (hasActiveSubscription) {
      createdUser.hasActiveSubscription = true;
    }

    const salt = await bcrypt.genSalt();
    createdUser.password = await bcrypt.hash(createdUser.password, salt);

    try {
      const result = await createdUser.save();

      const token = createdUser.generateAuthToken();
      res.header("Authorization", "Bearer " + token);

      const refreshToken = new RefreshToken({
        refreshToken: createdUser.generateRefreshToken(),
      });

      const refreshTokenId = await refreshToken.save();
      res.header("Refresh-Token-Id", refreshTokenId._id.toString());

      res.send(_.pick(result, ["_id", "username", "email"]));
    } catch (error: any) {
      return res.status(500).send({ message: error.message });
    }
  } else {
    res.status(400).send({ message: "Invalid code" });
  }
});

router.post("/check_refresh", async (req, res) => {
  const { error } = validateRefreshTokenId(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  try {
    const refreshTokenObj = await RefreshToken.findById(
      new mongoose.Types.ObjectId(req.body.refreshTokenId)
    );

    if (!refreshTokenObj) return res.status(200).send({ message: false });

    // Verify and decode the refresh token
    const decodedToken = jwt.verify(
      refreshTokenObj.refreshToken,
      APOLLO_SECRET_KEY
    ) as JwtPayload;

    // Get the expiration time from the decoded token
    const expirationTime = decodedToken.exp as number;
    // Get the current server time
    const currentServerTime = Math.floor(Date.now() / 1000); // Current time in seconds

    // Calculate the time one hour from now
    // This is done because the client will call this API every hour
    const oneHourFromNow = currentServerTime + 3600;

    if (oneHourFromNow < expirationTime) {
      const userId = decodedToken._id;
      const user = await User.findById(userId);

      const token = user!.generateAuthToken();
      res.header("Authorization", "Bearer " + token);
    }
    res.status(200).send({ message: oneHourFromNow < expirationTime });
  } catch (error) {
    res.status(200).send({ message: false });
  }
});

export default router;
