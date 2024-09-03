import Joi from "joi";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dateWithoutTimestamp } from "../utils/dateUtils";
import { APOLLO_SECRET_KEY } from "../utils/globalVars";

const userSchema = new mongoose.Schema(
  {
    _id: Number,
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 5,
      maxlength: 255,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 255,
    },
    hasActiveSubscription: {
      type: Boolean,
      required: true,
    },
    profileImageObj: String,
    signUpDate: {
      type: Date,
      required: true,
    },
    currentLoginStreak: { type: Number, default: 1 },
    weeklyLoginStreak: { type: Number, default: 1 },
    daysInApolloThisYear: { type: Number, default: 1 },
    loggedDays: { type: Array, required: true },
  },
  {
    methods: {
      generateAuthToken() {
        const numberOfMinutesBeforeExpiration = 30;
        const token = jwt.sign(
          {
            _id: this._id,
            hasActiveSubscription: this.hasActiveSubscription,
            exp:
              Math.floor(Date.now() / 1000) +
              numberOfMinutesBeforeExpiration * 60,
          },
          APOLLO_SECRET_KEY
        );
        return token;
      },
      generateRefreshToken() {
        // token will expire after 30 days
        // const numberOfMinutesBeforeExpiration = 43200;
        const numberOfMinutesBeforeExpiration = 43200;
        const token = jwt.sign(
          {
            _id: this._id,
            hasActiveSubscription: this.hasActiveSubscription,
            exp:
              Math.floor(Date.now() / 1000) +
              numberOfMinutesBeforeExpiration * 60,
          },
          APOLLO_SECRET_KEY
        );
        return token;
      },
    },
  }
);

export const User = mongoose.model("User", userSchema);

export const validateUser = (user: any) => {
  const schema = Joi.object({
    username: Joi.string().trim().min(5).max(255).required(),
    email: Joi.string().trim().min(5).max(255).required().email(),
    password: Joi.string().trim().min(8).max(255).required(),
    profileImageObj: Joi.string(),
  });

  return schema.validate(user);
};

export const validateNewUsername = (username: any) => {
  const schema = Joi.object({
    username: Joi.string().trim().min(5).max(255).required(),
  });

  return schema.validate(username);
};

export const createUser = (
  maxUserId: number | undefined,
  user: any,
  hasActiveSubscription: boolean
) => {
  if (maxUserId === undefined) {
    return new User({
      _id: 1,
      username: user.username,
      email: user.email,
      password: user.password,
      profileImageObj: user.profileImageObj,
      hasActiveSubscription: hasActiveSubscription,
      signUpDate: new Date(),
      loggedDays: [dateWithoutTimestamp(new Date())],
    });
  } else {
    return new User({
      _id: maxUserId + 1,
      username: user.username,
      email: user.email,
      password: user.password,
      profileImageObj: user.profileImageObj,
      hasActiveSubscription: hasActiveSubscription,
      signUpDate: new Date(),
      loggedDays: [dateWithoutTimestamp(new Date())],
    });
  }
};
