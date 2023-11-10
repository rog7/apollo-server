import Joi from "joi";
import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  _id: Number,
  postCreatorId: { type: Number, required: true },
  description: { type: String, required: true, trim: true },
  chords: Array,
  voicings: Array,
  usersLiked: { type: Array, required: true },
  usersBookmarked: { type: Array, required: true },
  visibility: { type: Boolean, default: true },
  dateCreated: { type: Date, default: new Date() },
});

export const Post = mongoose.model("Post", postSchema);

export const validateNewPost = (post: any) => {
  const schema = Joi.object({
    description: Joi.string().required(),
    chords: Joi.array(),
    voicings: Joi.array(),
  });

  return schema.validate(post);
};

export const createPost = (
  maxPostId: number | undefined,
  body: any,
  postCreatorId: number
) => {
  if (maxPostId === undefined) {
    return new Post({
      _id: 1,
      postCreatorId: postCreatorId,
      description: body.description,
      chords: body.chords,
      voicings: body.voicings,
      usersLiked: [],
      usersBookmarked: [],
    });
  } else {
    return new Post({
      _id: maxPostId + 1,
      postCreatorId: postCreatorId,
      description: body.description,
      chords: body.chords,
      voicings: body.voicings,
      usersLiked: [],
      usersBookmarked: [],
    });
  }
};
