import jwt from "jsonwebtoken";
import { APOLLO_SECRET_KEY } from "./globalVars";

export const generateAuthToken = (
  email: string,
  isProUser: boolean,
  isTrialing: boolean | null,
  completedTrial: boolean | null
) => {
  const numberOfMinutesBeforeExpiration = 30;
  const token = jwt.sign(
    {
      email,
      isProUser,
      isTrialing,
      completedTrial,
      exp: Math.floor(Date.now() / 1000) + numberOfMinutesBeforeExpiration * 60,
    },
    APOLLO_SECRET_KEY
  );
  return token;
};
