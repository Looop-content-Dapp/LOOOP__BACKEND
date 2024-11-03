const bcrypt = require("bcryptjs");
const Post = require("../models/post.model");
const Artist = require("../models/artist.model");
const Comment = require("../models/comment.model");
const Like = require("../models/likes.model");

const getAllPosts = async (req, res) => {
    try {
      const { page = 1, limit = 10, category, artistId, status, genre } = req.query;
      const query = {};

      // Add filters if provided
      if (category) query.category = category;
      if (artistId) query.artistId = artistId;
      if (status) query.status = status;
      if (genre) query.genre = genre;

      // First get the posts with artist details
      const posts = await Post.find(query)
        .populate('artistId', 'name email profileImage genre verified')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Then get comments and likes for each post
      const postsWithDetails = await Promise.all(posts.map(async (post) => {
        // Get comments for this post
        const comments = await Comment.find({
          postId: post._id,
          itemType: "comment" // Only get parent comments, not replies
        })
          .populate({
            path: 'userId',
            model: 'users',
            select: 'email profileImage bio'
          })
          .sort({ createdAt: -1 })
          .limit(3);

        // Get comment counts
        const commentCount = await Comment.countDocuments({
          postId: post._id,
          itemType: "comment"
        });

        // Get replies for these comments
        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
          const replies = await Comment.find({
            postId: post._id,
            itemType: "reply",
            parentCommentId: comment._id
          })
            .populate({
              path: 'userId',
              model: 'users',
              select: 'email profileImage bio'
            })
            .sort({ createdAt: -1 })
            .limit(2);

          return {
            ...comment.toObject(),
            replies
          };
        }));

        // Get likes
        const likes = await Like.find({ postId: post._id })
          .populate({
            path: 'userId',
            model: 'users',
            select: 'email profileImage bio'
          })
          .limit(3);

        const likeCount = await Like.countDocuments({ postId: post._id });

        const postObject = post.toObject();

        return {
          ...postObject,
          comments: commentsWithReplies,
          commentCount,
          likes,
          likeCount
        };
      }));

      const total = await Post.countDocuments(query);

      return res.status(200).json({
        message: "Successfully retrieved posts",
        data: {
          posts: postsWithDetails,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPosts: total
        }
      });
    } catch (error) {
      console.error("Error in getAllPosts:", error);
      res
        .status(500)
        .json({ message: "Error fetching posts", error: error.message });
    }
  };

const getAllLikes = async (req, res) => {
  try {
    const posts = await Like.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all like",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching likes", error: error.message });
  }
};

const getAllComments = async (req, res) => {
  try {
    const posts = await Comment.find({}, "-password");

    return res.status(200).json({
      message: "successfully get all comments",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching comments", error: error.message });
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
      message: "successfully get all replies",
      data: posts,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching replies", error: error.message });
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
      message: "successfully gotten a Post",
      data: post[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching a Post", error: error.message });
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
      const {
        content,
        media,
        artistId,
        tags,
        category,
        visibility,
        status,
        type,
        genre
      } = req.body;

      // Validation
      if (!content || !artistId) {
        return res.status(400).json({
          message: "Required fields missing",
          required: ['content', 'artistId']
        });
      }

      // Validate media array
      if (!Array.isArray(media) || media.length === 0) {
        return res.status(400).json({
          message: "Media must be an array with at least one item"
        });
      }

      // Validate each media item
      for (const item of media) {
        if (!item.type || !item.url) {
          return res.status(400).json({
            message: "Each media item must have type and url",
            mediaFormat: {
              type: "Required - image/video/audio/gif",
              url: "Required - media URL",
              thumbnailUrl: "Optional - for videos",
              duration: "Optional - for audio/video",
              mimeType: "Optional",
              size: "Optional",
              width: "Optional",
              height: "Optional"
            }
          });
        }
      }

      const artist = await Artist.findById(artistId);
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const post = new Post({
        content,
        media,
        artistId,
        tags: tags || [],
        category,
        visibility: visibility || 'public',
        status: status || 'published',
        type: type || (media.length > 1 ? 'multiple' : 'single'),
        genre: genre || artist.genre // Use artist's genre if not provided
      });

      await post.save();
      await post.populate('artistId', 'name email profileImage genre verified');

      return res.status(201).json({
        message: "Successfully created post",
        data: post
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Error creating post", error: error.message });
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
