import mongoose from "mongoose";

const validateSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
});

export const Validate = mongoose.model("Validate", validateSchema);
