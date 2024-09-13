const bcrypt = require("bcryptjs");
const Post = require("../models/post.model");
const Artist = require("../models/artist.model");
const Comment = require("../models/comment.model");
const Like = require("../models/likes.model");

const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all posts",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching posts", error: error.message });
  }
};

const getAllLikes = async (req, res) => {
  try {
    const posts = await Like.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all posts",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching posts", error: error.message });
  }
};

const getAllComments = async (req, res) => {
  try {
    const posts = await Comment.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all posts",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching posts", error: error.message });
  }
};

const getCommentForPost = async (req, res) => {
  try {
    const comments = await Comment.aggregate([
      {
        $match: {
          $expr: {
            $eq: ["$postId", { $toObjectId: req.params.postId }],
          },
        },
      },
    ]);

    return res.status(200).json({
      message: "successfully get all comments",
      data: comments,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching comments", error: error.message });
  }
};

const getReplyForAComment = async (req, res) => {
  try {
    const posts = await Comment.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all posts",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching posts", error: error.message });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await Post.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.id,
              },
            ],
          },
        },
      },
      //   {
      //     $lookup: {
      //       from: "likes",
      //       localField: "_id",
      //       foreignField: "PostId",
      //       as: "likes",
      //     },
      //   },
    ]);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json({
      message: "successfully get Post",
      data: post[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching Post", error: error.message });
  }
};

const getAllPostByArtist = async (req, res) => {
  try {
    const post = await Post.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$artistId",
              {
                $toObjectId: req.params.artistId,
              },
            ],
          },
        },
      },
      // {
      //   $lookup: {
      //     from: "comments",
      //     localField: "_id",
      //     foreignField: "postId",
      //     as: "comments",
      //   },
      // },
      // {
      //   $lookup: {
      //     from: "likes",
      //     localField: "_id",
      //     foreignField: "postId",
      //     as: "likes",
      //   },
      // },
      // {
      //   $addFields: {
      //     commentCount: { $size: "$comments" }, // Add a new field with the size of the array
      //     likeCount: { $size: "$likes" },
      //   },
      // },
      // {
      //   $project: {
      //     comments: 0,
      //     likes: 0,
      //   },
      // },
    ]);

    if (!post) {
      return res.status(401).json({ message: "no post found" });
    }

    return res.status(200).json({
      message: "successfully gotten artist Post",
      data: post,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching Post", error: error.message });
  }
};

const createPost = async (req, res) => {
  try {
    const { title, description, image, artistId } = req.body;

    if (title == "" || description == "" || image == "" || artistId == "") {
      return res.status(401).json({ message: "All fields are required" });
    }

    const artist = await Artist.findById(artistId);

    if (!artist) {
      return res.status(400).json({ message: "Artist not found" });
    }

    const post = new Post({
      title,
      description,
      image,
      artistId,
    });

    await post.save();

    return res.status(200).json({
      message: "successfully created a Post",
      data: post,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating Post", error: error.message });
  }
};

const commentOnPost = async (req, res) => {
  try {
    const { userId, postId, itemType, content } = req.body;

    const post = await Post.findByIdAndUpdate(
      {
        _id: postId,
      },
      {
        $inc: { commentCount: 1 },
      },
      { new: true }
    );

    const comment = new Comment({
      userId,
      postId,
      itemType,
      content,
    });

    await comment.save();

    return res.status(200).json({
      message: "successfully created a comment",
      post,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error creating comment", error: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const { userId, postId, itemType } = req.body;

    if (userId == "" || postId == "" || itemType == "") {
      return res.status(401).json({ message: "All fields are required" });
    }

    const post = await Post.findById({ _id: postId });

    if (!post) {
      return res.status(400).json({ message: "Post not found" });
    }

    const hasLiked = await Like.findOne({ postId: postId, userId: userId });
    let like;

    if (hasLiked) {
      await Like.deleteOne({ postId: postId, userId: userId });
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
    } else {
      like = new Like({
        userId,
        postId,
        itemType,
      });
      await like.save();
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
    }

    return res.status(200).json({
      message: "success",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error liking a post", error: error.message });
  }
};

module.exports = {
  getAllPosts,
  getAllComments,
  getCommentForPost,
  getReplyForAComment,
  getAllLikes,
  getPost,
  getAllPostByArtist,
  createPost,
  likePost,
  commentOnPost,
};
