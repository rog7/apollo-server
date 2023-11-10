import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
  resetCode: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  expired: {
    type: Date,
    required: true,
  },
});

export const PasswordReset = mongoose.model(
  "PasswordReset",
  passwordResetSchema
);
