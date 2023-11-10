import express from "express";
import {
  validResetPassword,
  validateLogin,
  validateNewPassword,
} from "../models/auth";
import { User, createUser } from "../models/user";
import bcrypt from "bcrypt";
import { generateRandomCode } from "../utils/generateRandomCode";
import { PasswordReset } from "../models/passwordReset";
import sendGridMailer from "@sendgrid/mail";
import { SignUpCodeCheck } from "../models/SignUpCodeCheck";
import _ from "lodash";
import { generateFutureDateTime } from "../utils/dateUtils";
import { rateLimit } from "express-rate-limit";
import { RefreshToken, validateRefreshTokenId } from "../models/refreshToken";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "config";
import mongoose from "mongoose";
import { userHasActiveSubscription } from "../utils/userHasActiveSubscription";
import { Validate } from "../models/validate";
import { userHasPurchasedApollo } from "../utils/userHasPurchasedApollo";

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
 * Authorize user
 */
router.post("/authorize", loginAccountLimiter, async (req, res) => {
  const email = req.body.email;

  const validation = await Validate.findOne({
    email,
  });

  // Check to see if user has already been authorized
  if (!validation) {
    // Check to see if Apollo was purchased with provided email
    const purchasedApollo = await userHasPurchasedApollo(email);

    if (purchasedApollo) {
      const validate = new Validate({
        email,
      });

      await validate.save();

      return res.send({ message: true });
    } else {
      return res.status(401).send({ message: "unauthorized access" });
    }
  }

  res.status(401).send({ message: "unauthorized access" });
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

    if (!resetInfo) return res.status(400).send({ message: "invalid code" });

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
    res.status(400).send({ message: "invalid code" });
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
    res.status(400).send({ message: "invalid code" });
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
      config.get("jwtSecret")
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
