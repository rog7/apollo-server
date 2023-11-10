import mongoose from "mongoose";
import Joi from "joi";

const refreshTokenSchema = new mongoose.Schema({
  refreshToken: {
    type: String,
    required: true,
  },
  created: {
    type: Date,
    default: new Date(),
  },
});

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

export const validateRefreshTokenId = (tokenId: any) => {
  const schema = Joi.object({
    refreshTokenId: Joi.string().required(),
  });

  return schema.validate(tokenId);
};
