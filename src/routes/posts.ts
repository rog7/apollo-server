import express from "express";
import { Post, createPost, validateNewPost } from "../models/post";
import { auth } from "../middleware/auth";
import _ from "lodash";

const router = express.Router();

/**
 * Creates a new post
 */
router.post("/", auth, async (req: any, res: any) => {
  const { error } = validateNewPost(req.body);
  if (error) return res.status(400).send({ message: error.details[0].message });

  const postCreatorId = parseInt(req.user._id);

  const maxPostIdOpt = (await Post.findOne().sort({ _id: -1 }).limit(1))?._id;

  const createdPost = createPost(maxPostIdOpt, req.body, postCreatorId);

  try {
    const result = await createdPost.save();

    res.send(
      _.pick(result, [
        "_id",
        "description",
        "chords",
        "voicings",
        "dateCreated",
      ])
    );
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Deletes a post
 */
router.delete("/:id", auth, async (req: any, res: any) => {
  const postCreatorIdOpt = (await Post.findById(parseInt(req.params.id)))
    ?.postCreatorId;

  if (!postCreatorIdOpt)
    return res.status(400).send({ message: "Invalid request" });

  if (postCreatorIdOpt !== parseInt(req.user._id))
    return res.status(401).send({ message: "unauthorized access" });

  try {
    await Post.findByIdAndUpdate(parseInt(req.params.id), {
      visibility: false,
    });

    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Get posts
 */
router.get("/", auth, async (req: any, res) => {
  const pageNumber = parseInt(req.query.pageNumber);
  let limit = parseInt(req.query.limit);
  if (!limit) {
    limit = 10;
  } else {
    if (limit > 20) {
      limit = 20;
    }
  }
  try {
    if (!req.query.showBookmarked) {
      const posts = await Post.find({
        visibility: true,
      })
        .sort({
          dateCreated: -1,
        })
        .skip((pageNumber - 1) * limit)
        .limit(limit)
        .select(["-__v", "-visibility"]);

      return res.send({ posts });
    }

    const posts = await Post.find({
      visibility: true,
      usersBookmarked: { $in: req.user._id },
    })
      .sort({
        dateCreated: -1,
      })
      .skip((parseInt(req.query.pageNumber) - 1) * parseInt(req.query.limit))
      .limit(parseInt(req.query.limit))
      .select(["-__v", "-visibility"]);

    return res.send({ posts });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Likes a post
 */
router.put("/:id/like", auth, async (req: any, res: any) => {
  const post = await Post.findOne({
    _id: parseInt(req.params.id),
    visibility: true,
  });

  if (!post) return res.status(400).send({ message: "post does not exist" });

  if (post.usersLiked.includes(req.user._id))
    return res.status(400).send({ message: "invalid request" });

  try {
    await Post.updateOne(
      { _id: parseInt(req.params.id) },
      { $push: { usersLiked: { $each: [parseInt(req.user._id)] } } }
    );

    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Removes like from post
 */
router.delete("/:id/like", auth, async (req: any, res: any) => {
  const post = await Post.findOne({
    _id: parseInt(req.params.id),
    visibility: true,
  });

  if (!post) return res.status(400).send({ message: "post does not exist" });

  if (!post.usersLiked.includes(req.user._id))
    return res.status(400).send({ message: "invalid request" });

  try {
    await Post.updateOne(
      { _id: parseInt(req.params.id) },
      { $pull: { usersLiked: parseInt(req.user._id) } }
    );

    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Search posts
 */
router.get("/search", auth, async (req: any, res: any) => {
  let pageNumber = parseInt(req.query.pageNumber);
  if (!pageNumber) pageNumber = 1;

  let limit = parseInt(req.query.limit);
  if (!limit) {
    limit = 10;
  } else {
    if (limit > 20) {
      limit = 20;
    }
  }

  try {
    const posts = await Post.find({
      chords: { $in: req.query.query },
    })
      .skip((pageNumber - 1) * limit)
      .limit(limit)
      .select(["-__v", "-visibility"])
      .sort({ dateCreated: -1 });

    res.send({ posts });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Bookmark post
 */
router.put("/:id/bookmark", auth, async (req: any, res: any) => {
  const post = await Post.findOne({
    _id: parseInt(req.params.id),
    visibility: true,
  });

  if (!post) return res.status(400).send({ message: "post does not exist" });

  if (post.usersBookmarked.includes(req.user._id))
    return res.status(400).send({ message: "invalid request" });

  try {
    await Post.updateOne(
      { _id: parseInt(req.params.id) },
      { $push: { usersBookmarked: { $each: [parseInt(req.user._id)] } } }
    );

    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

/**
 * Unbookmark post
 */
router.delete("/:id/bookmark", auth, async (req: any, res: any) => {
  const post = await Post.findOne({
    _id: parseInt(req.params.id),
    visibility: true,
  });

  if (!post) return res.status(400).send({ message: "post does not exist" });

  if (!post.usersBookmarked.includes(req.user._id))
    return res.status(400).send({ message: "invalid request" });

  try {
    await Post.updateOne(
      { _id: parseInt(req.params.id) },
      { $pull: { usersBookmarked: parseInt(req.user._id) } }
    );

    res.send({ message: true });
  } catch (error: any) {
    return res.status(500).send({ message: error.message });
  }
});

export default router;
