// controllers/post.controller.js

const bcrypt = require("bcryptjs");
const Post = require("../models/post.model");
const Artist = require("../models/artist.model");
const Comment = require("../models/comment.model");
const Like = require("../models/likes.model");
const Community = require("../models/community.model");

// Helper function to populate post details
const populatePostDetails = async (post) => {
  try {
    const comments = await Comment.find({
      postId: post._id,
      itemType: "comment"
    })
      .populate({
        path: 'userId',
        model: 'users',
        select: 'email profileImage bio'
      })
      .sort({ createdAt: -1 })
      .limit(3);

    const commentCount = await Comment.countDocuments({
      postId: post._id,
      itemType: "comment"
    });

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

    const likes = await Like.find({ postId: post._id })
      .populate({
        path: 'userId',
        model: 'users',
        select: 'email profileImage bio'
      })
      .limit(3);

    const likeCount = await Like.countDocuments({ postId: post._id });

    return {
      ...post.toObject(),
      comments: commentsWithReplies,
      commentCount,
      likes,
      likeCount
    };
  } catch (error) {
    console.error("Error in populatePostDetails:", error);
    throw error;
  }
};

// Get all posts with filters
const getAllPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      artistId,
      communityId,
      status,
      genre,
      postType
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (artistId) query.artistId = artistId;
    if (communityId) query.communityId = communityId;
    if (status) query.status = status;
    if (genre) query.genre = genre;
    if (postType) query.postType = postType;

    const posts = await Post.find(query)
      .populate('artistId', 'name email profileImage genre verified')
      .populate('communityId', 'name description coverImage')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const postsWithDetails = await Promise.all(
      posts.map(post => populatePostDetails(post))
    );

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
    res.status(500).json({
      message: "Error fetching posts",
      error: error.message
    });
  }
};

// Get single post
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('artistId', 'name email profileImage genre verified')
      .populate('communityId', 'name description coverImage');

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const postWithDetails = await populatePostDetails(post);

    return res.status(200).json({
      message: "Successfully retrieved post",
      data: postWithDetails
    });
  } catch (error) {
    console.error("Error in getPost:", error);
    return res.status(500).json({
      message: "Error fetching post",
      error: error.message
    });
  }
};

// Get posts by artist
const getAllPostByArtist = async (req, res) => {
  try {
    const { page = 1, limit = 10, postType } = req.query;
    const query = {
      artistId: req.params.artistId,
      ...(postType && { postType })
    };

    const posts = await Post.find(query)
      .populate('artistId', 'name email profileImage genre verified')
      .populate('communityId', 'name description coverImage')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const postsWithDetails = await Promise.all(
      posts.map(post => populatePostDetails(post))
    );

    const total = await Post.countDocuments(query);

    return res.status(200).json({
      message: "Successfully retrieved artist posts",
      data: {
        posts: postsWithDetails,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total
      }
    });
  } catch (error) {
    console.error("Error in getAllPostByArtist:", error);
    return res.status(500).json({
      message: "Error fetching artist posts",
      error: error.message
    });
  }
};

// Get posts by community
const getAllPostsByCommunity = async (req, res) => {
  try {
    const { page = 1, limit = 10, postType } = req.query;
    const query = {
      communityId: req.params.communityId,
      ...(postType && { postType })
    };

    const posts = await Post.find(query)
      .populate('artistId', 'name email profileImage genre verified')
      .populate('communityId', 'name description coverImage')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const postsWithDetails = await Promise.all(
      posts.map(post => populatePostDetails(post))
    );

    const total = await Post.countDocuments(query);

    return res.status(200).json({
      message: "Successfully retrieved community posts",
      data: {
        posts: postsWithDetails,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPosts: total
      }
    });
  } catch (error) {
    console.error("Error in getAllPostsByCommunity:", error);
    return res.status(500).json({
      message: "Error fetching community posts",
      error: error.message
    });
  }
};

// Create post
const createPost = async (req, res) => {
  try {
    const {
      content,
      title,
      postType,
      media,
      artistId,
      communityId,
      eventDetails,
      announcementDetails,
      tags,
      category,
      visibility,
      status,
      type,
      genre
    } = req.body;

    // Base validation
    if (!content || !artistId || !communityId || !postType) {
      return res.status(400).json({
        message: "Required fields missing",
        required: ['content', 'artistId', 'communityId', 'postType']
      });
    }

    // Type-specific validation
    if (postType === 'event') {
      if (!eventDetails?.startDate || !eventDetails?.endDate || !eventDetails?.location || !title) {
        return res.status(400).json({
          message: "Required event fields missing",
          required: ['title', 'startDate', 'endDate', 'location']
        });
      }

      if (new Date(eventDetails.startDate) > new Date(eventDetails.endDate)) {
        return res.status(400).json({
          message: "Event end date must be after start date"
        });
      }

      if (new Date(eventDetails.startDate) < new Date()) {
        return res.status(400).json({
          message: "Event start date must be in the future"
        });
      }
    }

    if (postType === 'announcement' && !title) {
      return res.status(400).json({
        message: "Title is required for announcements"
      });
    }

    // Validate media array if provided
    if (media) {
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
    }

    // Check if artist and community exist
    const [artist, community] = await Promise.all([
      Artist.findById(artistId),
      Community.findById(communityId)
    ]);

    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Create post data
    const postData = {
      content,
      title,
      postType,
      media: media || [],
      artistId,
      communityId,
      tags: tags || [],
      category: category || 'other',
      visibility: visibility || 'public',
      status: status || 'published',
      type: type || (media?.length > 1 ? 'multiple' : 'single'),
      genre: genre || artist.genre
    };

    // Add type-specific details
    if (postType === 'event') {
      postData.eventDetails = {
        ...eventDetails,
        attendees: [],
        isFullyBooked: false
      };
    } else if (postType === 'announcement') {
      postData.announcementDetails = {
        ...announcementDetails,
        notificationSent: false
      };
    }

    const post = new Post(postData);
    await post.save();

    await post.populate('artistId', 'name email profileImage genre verified');
    await post.populate('communityId', 'name description coverImage');

    return res.status(201).json({
      message: "Successfully created post",
      data: post
    });
  } catch (error) {
    console.error("Error in createPost:", error);
    return res.status(500).json({
      message: "Error creating post",
      error: error.message
    });
  }
};

// Update post
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.likeCount;
    delete updateData.commentCount;
    delete updateData.shareCount;

    const post = await Post.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('artistId', 'name email profileImage genre verified')
    .populate('communityId', 'name description coverImage');

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json({
      message: "Successfully updated post",
      data: post
    });
  } catch (error) {
    console.error("Error in updatePost:", error);
    return res.status(500).json({
      message: "Error updating post",
      error: error.message
    });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByIdAndDelete(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Clean up related data
    await Promise.all([
      Comment.deleteMany({ postId: id }),
      Like.deleteMany({ postId: id })
    ]);

    return res.status(200).json({
      message: "Successfully deleted post and related data"
    });
  } catch (error) {
    console.error("Error in deletePost:", error);
    return res.status(500).json({
      message: "Error deleting post",
      error: error.message
    });
  }
};

// Like/Unlike post
const likePost = async (req, res) => {
  try {
    const { userId, postId } = req.body;

    if (!userId || !postId) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ['userId', 'postId']
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await Like.findOne({ postId, userId });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
      return res.status(200).json({ message: "Post unliked successfully" });
    } else {
      // Like
      const like = new Like({ userId, postId });
      await like.save();
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
      return res.status(200).json({ message: "Post liked successfully" });
    }
  } catch (error) {
    console.error("Error in likePost:", error);
    return res.status(500).json({
      message: "Error processing like/unlike",
      error: error.message
    });
  }
};

// Add comment
const commentOnPost = async (req, res) => {
  try {
    const { userId, postId, content, parentCommentId } = req.body;

    if (!userId || !postId || !content) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ['userId', 'postId', 'content']
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = new Comment({
      userId,
      postId,
      content,
      itemType: parentCommentId ? 'reply' : 'comment',
      parentCommentId
    });

    await comment.save();
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    const populatedComment = await Comment.findById(comment._id)
          .populate('userId', 'email profileImage bio')
          .populate('parentCommentId');

        return res.status(201).json({
          message: "Comment added successfully",
          data: populatedComment
        });
      } catch (error) {
        console.error("Error in commentOnPost:", error);
        return res.status(500).json({
          message: "Error adding comment",
          error: error.message
        });
      }
    };

    // Get post comments
    const getPostComments = async (req, res) => {
      try {
        const { postId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const comments = await Comment.find({
          postId,
          itemType: 'comment'
        })
          .populate('userId', 'email profileImage bio')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit);

        // Get replies for each comment
        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
          const replies = await Comment.find({
            postId,
            itemType: 'reply',
            parentCommentId: comment._id
          })
            .populate('userId', 'email profileImage bio')
            .sort({ createdAt: -1 })
            .limit(5);

          return {
            ...comment.toObject(),
            replies
          };
        }));

        const total = await Comment.countDocuments({
          postId,
          itemType: 'comment'
        });

        return res.status(200).json({
          message: "Successfully retrieved comments",
          data: {
            comments: commentsWithReplies,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalComments: total
          }
        });
      } catch (error) {
        console.error("Error in getPostComments:", error);
        return res.status(500).json({
          message: "Error fetching comments",
          error: error.message
        });
      }
    };

    // Get event attendees
    const getEventAttendees = async (req, res) => {
      try {
        const { postId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const post = await Post.findById(postId);

        if (!post || post.postType !== 'event') {
          return res.status(404).json({
            message: "Event post not found"
          });
        }

        const attendees = await User.find({
          _id: { $in: post.eventDetails.attendees }
        })
          .select('email profileImage bio')
          .skip((page - 1) * limit)
          .limit(limit);

        const total = post.eventDetails.attendees.length;

        return res.status(200).json({
          message: "Successfully retrieved attendees",
          data: {
            attendees,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalAttendees: total,
            maxAttendees: post.eventDetails.maxAttendees,
            isFullyBooked: post.eventDetails.isFullyBooked
          }
        });
      } catch (error) {
        console.error("Error in getEventAttendees:", error);
        return res.status(500).json({
          message: "Error fetching attendees",
          error: error.message
        });
      }
    };

    // Join/Leave event
    const toggleEventAttendance = async (req, res) => {
      try {
        const { postId, userId } = req.body;

        if (!postId || !userId) {
          return res.status(400).json({
            message: "Missing required fields",
            required: ['postId', 'userId']
          });
        }

        const post = await Post.findById(postId);

        if (!post || post.postType !== 'event') {
          return res.status(404).json({
            message: "Event post not found"
          });
        }

        const isAttending = post.eventDetails.attendees.includes(userId);

        if (isAttending) {
          // Leave event
          post.eventDetails.attendees = post.eventDetails.attendees.filter(
            id => id.toString() !== userId
          );
          post.eventDetails.isFullyBooked = false;
        } else {
          // Join event
          if (post.eventDetails.maxAttendees &&
              post.eventDetails.attendees.length >= post.eventDetails.maxAttendees) {
            return res.status(400).json({
              message: "Event is fully booked"
            });
          }

          post.eventDetails.attendees.push(userId);

          if (post.eventDetails.maxAttendees &&
              post.eventDetails.attendees.length >= post.eventDetails.maxAttendees) {
            post.eventDetails.isFullyBooked = true;
          }
        }

        await post.save();

        return res.status(200).json({
          message: isAttending ? "Left event successfully" : "Joined event successfully",
          data: {
            isAttending: !isAttending,
            attendeeCount: post.eventDetails.attendees.length,
            isFullyBooked: post.eventDetails.isFullyBooked
          }
        });
      } catch (error) {
        console.error("Error in toggleEventAttendance:", error);
        return res.status(500).json({
          message: "Error updating event attendance",
          error: error.message
        });
      }
    };

    // Get upcoming events
    const getUpcomingEvents = async (req, res) => {
      try {
        const {
          communityId,
          page = 1,
          limit = 10,
          eventType,
          isVirtual,
          minDate = new Date(),
          maxDate
        } = req.query;

        const query = {
          postType: 'event',
          'eventDetails.startDate': {
            $gt: new Date(minDate),
            ...(maxDate && { $lt: new Date(maxDate) })
          },
          ...(communityId && { communityId }),
          ...(eventType && { 'eventDetails.eventType': eventType }),
          ...(isVirtual !== undefined && { 'eventDetails.isVirtual': isVirtual })
        };

        const events = await Post.find(query)
          .populate('artistId', 'name email profileImage genre verified')
          .populate('communityId', 'name description coverImage')
          .sort({ 'eventDetails.startDate': 1 })
          .skip((page - 1) * limit)
          .limit(limit);

        const total = await Post.countDocuments(query);

        return res.status(200).json({
          message: "Successfully retrieved upcoming events",
          data: {
            events,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalEvents: total
          }
        });
      } catch (error) {
        console.error("Error in getUpcomingEvents:", error);
        return res.status(500).json({
          message: "Error fetching upcoming events",
          error: error.message
        });
      }
    };

    // Get active announcements
    const getActiveAnnouncements = async (req, res) => {
      try {
        const {
          communityId,
          importance,
          page = 1,
          limit = 10,
          targetAudience
        } = req.query;

        const query = {
          postType: 'announcement',
          $or: [
            { 'announcementDetails.expiryDate': { $gt: new Date() } },
            { 'announcementDetails.expiryDate': null }
          ],
          ...(communityId && { communityId }),
          ...(importance && { 'announcementDetails.importance': importance }),
          ...(targetAudience && { 'announcementDetails.targetAudience': targetAudience })
        };

        const announcements = await Post.find(query)
          .populate('artistId', 'name email profileImage genre verified')
          .populate('communityId', 'name description coverImage')
          .sort({
            'announcementDetails.isPinned': -1,
            'announcementDetails.importance': -1,
            createdAt: -1
          })
          .skip((page - 1) * limit)
          .limit(limit);

        const total = await Post.countDocuments(query);

        return res.status(200).json({
          message: "Successfully retrieved active announcements",
          data: {
            announcements,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalAnnouncements: total
          }
        });
      } catch (error) {
        console.error("Error in getActiveAnnouncements:", error);
        return res.status(500).json({
          message: "Error fetching announcements",
          error: error.message
        });
      }
    };

    // Export all controllers
    module.exports = {
      getAllPosts,
      getPost,
      getAllPostByArtist,
      getAllPostsByCommunity,
      createPost,
      updatePost,
      deletePost,
      likePost,
      commentOnPost,
      getPostComments,
      getEventAttendees,
      toggleEventAttendance,
      getUpcomingEvents,
      getActiveAnnouncements
    };
