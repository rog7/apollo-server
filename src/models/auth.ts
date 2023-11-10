import Joi from "joi";

export const validateLogin = (loginInfo: any) => {
  const schema = Joi.object({
    usernameOrEmail: Joi.string().required(),
    password: Joi.string().required(),
  });

  return schema.validate(loginInfo);
};

export const validateNewPassword = (newPassword: any) => {
  const schema = Joi.object({
    resetCode: Joi.string(),
    email: Joi.string(),
    oldPassword: Joi.string(),
    password: Joi.string().trim().min(8).max(255).required(),
  });

  return schema.validate(newPassword);
};

export const validResetPassword = (email: any) => {
  const schema = Joi.object({
    email: Joi.string(),
  });

  return schema.validate(email);
};
