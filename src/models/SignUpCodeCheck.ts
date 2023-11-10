import mongoose from "mongoose";

const signUpCodeCheckSchema = new mongoose.Schema({
  signUpCode: {
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

export const SignUpCodeCheck = mongoose.model(
  "SignUpCodeCheck",
  signUpCodeCheckSchema
);
