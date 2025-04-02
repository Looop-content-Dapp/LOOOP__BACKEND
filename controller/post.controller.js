import { Post } from "../models/post.model.js";
import { Artist } from "../models/artist.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/likes.model.js";
import { Community } from "../models/community.model.js";
import { User } from "../models/user.model.js";
import { CommunityMember } from "../models/communitymembers.model.js";

// Helper function to populate post details
const populatePostDetails = async (post) => {
  try {
    const comments = await Comment.find({
      postId: post._id,
      parentCommentId: null  // Get only top-level comments
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
      parentCommentId: null  // Count only top-level comments
    });

    const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
      const replies = await Comment.find({
        postId: post._id,
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
export const getAllPosts = async (req, res) => {
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
export const getPost = async (req, res) => {
    try {
      const { userId } = req.query; 

      const post = await Post.findById(req.params.id)
        .populate({
          path: 'artistId',
          select: 'name email profileImage genre verified bio socialLinks stats createdAt'
        })
        .populate({
          path: 'communityId',
          select: 'communityName description coverImage tribePass members admins owner createdAt stats'
        });

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Get all likes with user details
      const likes = await Like.find({ postId: post._id })
        .populate({
          path: 'userId',
          select: 'email profileImage bio name username'
        });

      const commentCount = await Comment.countDocuments({
        postId: post._id,
        parentCommentId: null
      });

      // Get recent comments with replies
      const comments = await Comment.find({
        postId: post._id,
        parentCommentId: null
      })
        .populate({
          path: 'userId',
          select: 'email profileImage bio name username'
        })
        .sort({ createdAt: -1 })
        .limit(3);

      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            postId: post._id,
            parentCommentId: comment._id
          })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            })
            .sort({ createdAt: -1 })
            .limit(2);

          const replyCount = await Comment.countDocuments({
            postId: post._id,
            parentCommentId: comment._id
          });

          return {
            ...comment.toObject(),
            replies,
            replyCount,
            hasLiked: userId ? likes.some(like =>
              like.userId._id.toString() === userId &&
              like.itemId?.toString() === comment._id.toString()
            ) : false
          };
        })
      );

      const enhancedPost = {
        ...post.toObject(),
        likes,
        likeCount: likes.length,
        hasLiked: userId ? likes.some(like => like.userId._id.toString() === userId) : false,
        comments: commentsWithReplies,
        commentCount
      };

      return res.status(200).json({
        message: "Successfully retrieved post",
        data: enhancedPost
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
export const getAllPostByArtist = async (req, res) => {
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
export const getAllPostsByCommunity = async (req, res) => {
    try {
      const { page = 1, limit = 10, postType } = req.query;

      // First get the community details
      const community = await Community.findById(req.params.communityId)
        .select('communityName description coverImage tribePass createdBy status memberCount createdAt NFTToken')
        .populate('createdBy', 'name email profileImage genre verified');

      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const baseQuery = {
        communityId: req.params.communityId,
        status: 'published'
      };

      // Get all post types if no specific type is requested
      let posts = [], announcements = [], events = [];

      if (!postType || postType === 'regular') {
        posts = await Post.find({ ...baseQuery, postType: 'regular' })
          .populate('artistId', 'name email profileImage genre verified bio socialLinks stats createdAt')
          .populate('communityId', 'communityName description coverImage tribePass')
          .sort({ createdAt: -1 })
          .skip(postType ? (page - 1) * limit : 0)
          .limit(postType ? limit : 5);
      }

      if (!postType || postType === 'announcement') {
        announcements = await Post.find({ ...baseQuery, postType: 'announcement' })
          .populate('artistId', 'name email profileImage genre verified bio socialLinks stats createdAt')
          .populate('communityId', 'communityName description coverImage tribePass')
          .sort({
            'announcementDetails.isPinned': -1,
            'announcementDetails.importance': -1,
            createdAt: -1
          })
          .skip(postType ? (page - 1) * limit : 0)
          .limit(postType ? limit : 3);
      }

      if (!postType || postType === 'event') {
        const now = new Date();
        events = await Post.find({
          ...baseQuery,
          postType: 'event',
          'eventDetails.endDate': { $gte: now }
        })
          .populate('artistId', 'name email profileImage genre verified bio socialLinks stats createdAt')
          .populate('communityId', 'name description coverImage members admins owner createdAt stats')
          .sort({ 'eventDetails.startDate': 1 })
          .skip(postType ? (page - 1) * limit : 0)
          .limit(postType ? limit : 3);
      }

      // Add details to each post type with enhanced details
      const [
        postsWithDetails,
        announcementsWithDetails,
        eventsWithDetails
      ] = await Promise.all([
        Promise.all(posts.map(async (post) => {
          const likes = await Like.find({ postId: post._id })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            });

          const commentCount = await Comment.countDocuments({
            postId: post._id,
            parentCommentId: null
          });

          const comments = await Comment.find({
            postId: post._id,
            parentCommentId: null
          })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            })
            .sort({ createdAt: -1 })
            .limit(3);

          const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
              const replies = await Comment.find({
                postId: post._id,
                parentCommentId: comment._id
              })
                .populate({
                  path: 'userId',
                  select: 'email profileImage bio name username'
                })
                .sort({ createdAt: -1 })
                .limit(2);

              return {
                ...comment.toObject(),
                replies
              };
            })
          );

          return {
            ...post.toObject(),
            likes,
            likeCount: likes.length,
            comments: commentsWithReplies,
            commentCount
          };
        })),
        Promise.all(announcements.map(async (post) => {
          // Same enhanced details for announcements
          const likes = await Like.find({ postId: post._id })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            });

          const commentCount = await Comment.countDocuments({
            postId: post._id,
            parentCommentId: null
          });

          const comments = await Comment.find({
            postId: post._id,
            parentCommentId: null
          })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            })
            .sort({ createdAt: -1 })
            .limit(3);

          const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
              const replies = await Comment.find({
                postId: post._id,
                parentCommentId: comment._id
              })
                .populate({
                  path: 'userId',
                  select: 'email profileImage bio name username'
                })
                .sort({ createdAt: -1 })
                .limit(2);

              return {
                ...comment.toObject(),
                replies
              };
            })
          );

          return {
            ...post.toObject(),
            likes,
            likeCount: likes.length,
            comments: commentsWithReplies,
            commentCount
          };
        })),
        Promise.all(events.map(async (post) => {
          // Same enhanced details for events
          const likes = await Like.find({ postId: post._id })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            });

          const commentCount = await Comment.countDocuments({
            postId: post._id,
            parentCommentId: null
          });

          const comments = await Comment.find({
            postId: post._id,
            parentCommentId: null
          })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            })
            .sort({ createdAt: -1 })
            .limit(3);

          const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
              const replies = await Comment.find({
                postId: post._id,
                parentCommentId: comment._id
              })
                .populate({
                  path: 'userId',
                  select: 'email profileImage bio name username'
                })
                .sort({ createdAt: -1 })
                .limit(2);

              return {
                ...comment.toObject(),
                replies
              };
            })
          );

          return {
            ...post.toObject(),
            likes,
            likeCount: likes.length,
            comments: commentsWithReplies,
            commentCount
          };
        }))
      ]);

      // Get counts for different post types
      const [totalPosts, totalAnnouncements, totalEvents] = await Promise.all([
        Post.countDocuments({ ...baseQuery, postType: 'regular' }),
        Post.countDocuments({ ...baseQuery, postType: 'announcement' }),
        Post.countDocuments({
          ...baseQuery,
          postType: 'event',
          'eventDetails.endDate': { $gte: new Date() }
        })
      ]);

      const total = postType ?
        (postType === 'regular' ? totalPosts :
          postType === 'announcement' ? totalAnnouncements :
            totalEvents) :
        totalPosts + totalAnnouncements + totalEvents;

      return res.status(200).json({
        message: "Successfully retrieved community content",
        data: {
          community: {
            ...community.toObject(),
            memberCount: community.memberCount || 0
          },
          posts: postsWithDetails,
          announcements: announcementsWithDetails,
          events: eventsWithDetails,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          counts: {
            posts: totalPosts,
            announcements: totalAnnouncements,
            events: totalEvents,
            total
          }
        }
      });
    } catch (error) {
      console.error("Error in getAllPostsByCommunity:", error);
      return res.status(500).json({
        message: "Error fetching community content",
        error: error.message
      });
    }
  };

// Create post
export const createPost = async (req, res) => {
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
export const updatePost = async (req, res) => {
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
export const deletePost = async (req, res) => {
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
export const likePost = async (req, res) => {
  try {
    const { userId, postId } = req.body;

    if (!userId || !postId) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["userId", "postId"],
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await Like.findOne({ postId, userId, itemType: "post" });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
      return res.status(200).json({ message: "Post unliked successfully" });
    } else {
      // Like
      const like = new Like({ userId, postId, itemType: "post" });
      await like.save();
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
      return res.status(200).json({ message: "Post liked successfully" });
    }
  } catch (error) {
    console.error("Error in likePost:", error);
    return res.status(500).json({
      message: "Error processing like/unlike",
      error: error.message,
    });
  }
};


// Add comment
export const commentOnPost = async (req, res) => {
  try {
    const { userId, postId, content, parentCommentId } = req.body;

    if (!userId || !postId || !content) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["userId", "postId", "content"],
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // If parentCommentId is provided, check if it exists and is a top-level comment
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      if (parentComment.parentCommentId) {
        return res.status(400).json({ message: "Cannot reply to a reply" });
      }
    }
// note that to use parentCommentID, the _id gotten from the comment creation is what is passed as parentCommentID
// parentCommentId are meant for replies
    const comment = new Comment({
      userId,
      postId,
      content,
      parentCommentId: parentCommentId || null
    });

    await comment.save();

    // Increment comment count on Post
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "email profileImage bio")
      .populate({
        path: "parentCommentId",
        populate: {
          path: "userId",
          select: "email profileImage bio"
        }
      });

    return res.status(201).json({
      message: "Comment added successfully",
      data: populatedComment,
    });
  } catch (error) {
    console.error("Error in commentOnPost:", error);
    return res.status(500).json({
      message: "Error adding comment",
      error: error.message,
    });
  }
};


// Get comment replies
export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify the parent comment exists and is a top-level comment
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (parentComment.parentCommentId) {
      return res.status(400).json({ message: "Can only get replies for top-level comments" });
    }

    // Get replies
    const replies = await Comment.find({
      parentCommentId: commentId
    })
      .populate('userId', 'email profileImage bio')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Comment.countDocuments({
      parentCommentId: commentId
    });

    return res.status(200).json({
      message: "Successfully retrieved replies",
      data: {
        replies,
        parentComment,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReplies: total
      }
    });
  } catch (error) {
    console.error("Error in getCommentReplies:", error);
    return res.status(500).json({
      message: "Error fetching replies",
      error: error.message
    });
  }
};

// Get post comments
export const getPostComments = async (req, res) => {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Get top-level comments with full user details
      const comments = await Comment.find({
        postId,
        parentCommentId: null
      })
        .populate({
          path: 'userId',
          model: 'users',
          select: 'username profileImage email bio isVerified fullname gender age location socialLinks isPremium'
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Get replies for each comment with nested structure
      const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
        // Get first-level replies for this comment
        const firstLevelReplies = await Comment.find({
          postId,
          parentCommentId: comment._id
        })
          .populate({
            path: 'userId',
            model: 'users',
            select: 'username profileImage email bio isVerified fullname gender age location socialLinks isPremium'
          })
          .sort({ createdAt: -1 })
          .lean();

        // Get likes count for the comment
        const commentLikes = await Like.countDocuments({
          itemId: comment._id,
          itemType: 'comment'
        });

        // Process first-level replies with full user details
        const processedReplies = await Promise.all(firstLevelReplies.map(async (reply) => {
          const replyLikes = await Like.countDocuments({
            itemId: reply._id,
            itemType: 'comment'
          });

          return {
            id: reply._id.toString(),
            user: {
              username: reply.userId?.username || '',
              profileImage: reply.userId?.profileImage || '',
              isVerified: reply.userId?.isVerified || false,
              email: reply.userId?.email || '',
              bio: reply.userId?.bio || '',
              fullname: reply.userId?.fullname || '',
              gender: reply.userId?.gender || '',
              age: reply.userId?.age || '',
              location: reply.userId?.location || '',
              socialLinks: reply.userId?.socialLinks || {},
              isPremium: reply.userId?.isPremium || false
            },
            createdAt: reply.createdAt,
            text: reply.content,
            likes: replyLikes,
            replies: [],
            isEdited: reply.updatedAt > reply.createdAt
          };
        }));

        // Format the main comment with full user details
        return {
          id: comment._id.toString(),
          user: {
            username: comment.userId?.username || '',
            profileImage: comment.userId?.profileImage || '',
            isVerified: comment.userId?.isVerified || false,
            email: comment.userId?.email || '',
            bio: comment.userId?.bio || '',
            fullname: comment.userId?.fullname || '',
            gender: comment.userId?.gender || '',
            age: comment.userId?.age || '',
            location: comment.userId?.location || '',
            socialLinks: comment.userId?.socialLinks || {},
            isPremium: comment.userId?.isPremium || false
          },
          timestamp: comment.createdAt,
          text: comment.content,
          likes: commentLikes,
          replies: processedReplies,
          isEdited: comment.updatedAt > comment.createdAt
        };
      }));

      const total = await Comment.countDocuments({
        postId,
        parentCommentId: null
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


// Get user feed (posts from communities user is part of)
export const getUserFeed = async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 100, postType } = req.query;

      // First check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get communities user is part of through CommunityMember collection
      const userCommunityMemberships = await CommunityMember.find({
        userId: userId
      }).select('communityId');

      if (!userCommunityMemberships.length) {
        return res.status(200).json({
          message: "User is not part of any communities",
          data: {
            posts: [],
            currentPage: 1,
            totalPages: 0,
            totalPosts: 0
          }
        });
      }

      const communityIds = userCommunityMemberships.map(membership => membership.communityId);

      // Build query
      const query = {
        communityId: { $in: communityIds },
        status: 'published',
        ...(postType && { postType })
      };

      // Get posts with pagination
      const [posts, total] = await Promise.all([
        Post.find(query)
          .populate('artistId', 'name email profileImage genre verified')
          .populate('communityId', 'name description coverImage')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Post.countDocuments(query)
      ]);

      // Add details to each post including all likes
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          // Get all likes for the post with user details
          const likes = await Like.find({ postId: post._id })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username' // Added more user fields
            });

          const commentCount = await Comment.countDocuments({
            postId: post._id,
            parentCommentId: null
          });

          // Get recent comments with replies
          const comments = await Comment.find({
            postId: post._id,
            parentCommentId: null
          })
            .populate({
              path: 'userId',
              select: 'email profileImage bio name username'
            })
            .sort({ createdAt: -1 })
            .limit(3);

          const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
              const replies = await Comment.find({
                postId: post._id,
                parentCommentId: comment._id
              })
                .populate({
                  path: 'userId',
                  select: 'email profileImage bio name username'
                })
                .sort({ createdAt: -1 })
                .limit(2);

              return {
                ...comment.toObject(),
                replies
              };
            })
          );

          return {
            ...post.toObject(),
            likes, // Full array of likes with user details
            likeCount: likes.length,
            hasLiked: likes.some(like => like.userId._id.toString() === userId), // Check if current user liked
            comments: commentsWithReplies,
            commentCount
          };
        })
      );

      return res.status(200).json({
        message: postsWithDetails.length ? "Successfully retrieved user feed" : "No posts found",
        data: {
          posts: postsWithDetails,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPosts: total
        }
      });
    } catch (error) {
      console.error("Error in getUserFeed:", error);
      return res.status(500).json({
        message: "Error fetching user feed",
        error: error.message
      });
    }
  };

// Get event attendees
export const getEventAttendees = async (req, res) => {
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
export const toggleEventAttendance = async (req, res) => {
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
export const getUpcomingEvents = async (req, res) => {
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
export const getActiveAnnouncements = async (req, res) => {
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

// Get comment by ID
export const getCommentById = async (req, res) => {
    try {
      const { commentId } = req.params;
      const { userId } = req.query;

      const comment = await Comment.findById(commentId)
        .populate({
          path: 'userId',
          select: 'username profileImage email bio isVerified fullname gender age location socialLinks isPremium'
        })
        .populate({
          path: 'parentCommentId',
          populate: {
            path: 'userId',
            select: 'username profileImage email bio isVerified'
          }
        })
        .lean();

      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Get likes for the comment
      const likes = await Like.find({
        itemId: comment._id,
        itemType: 'comment'
      }).populate({
        path: 'userId',
        select: 'username profileImage email'
      });

      // If it's a parent comment, get its replies
      let replies = [];
      if (!comment.parentCommentId) {
        replies = await Comment.find({ parentCommentId: comment._id })
          .populate({
            path: 'userId',
            select: 'username profileImage email bio isVerified fullname'
          })
          .sort({ createdAt: -1 })
          .lean();
      }

      const enhancedComment = {
        ...comment,
        likes,
        likeCount: likes.length,
        hasLiked: userId ? likes.some(like => like.userId._id.toString() === userId) : false,
        replies,
        replyCount: replies.length,
        isEdited: comment.updatedAt > comment.createdAt
      };

      return res.status(200).json({
        message: "Successfully retrieved comment",
        data: enhancedComment
      });
    } catch (error) {
      console.error("Error in getCommentById:", error);
      return res.status(500).json({
        message: "Error fetching comment",
        error: error.message
      });
    }
  };

  // Reply to a comment
export const replyToComment = async (req, res) => {
    try {
      const { userId, postId, content, parentCommentId } = req.body;

      if (!userId || !postId || !content || !parentCommentId) {
        return res.status(400).json({
          message: "Missing required fields",
          required: ["userId", "postId", "content", "parentCommentId"],
        });
      }

      // Verify parent comment exists and is a top-level comment
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }

      if (parentComment.parentCommentId) {
        return res.status(400).json({ message: "Cannot reply to a reply" });
      }

      // Create the reply
      const reply = new Comment({
        userId,
        postId,
        content,
        parentCommentId
      });

      await reply.save();

      // Increment comment count on Post
      await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

      // Populate reply with user details
      const populatedReply = await Comment.findById(reply._id)
        .populate({
          path: 'userId',
          select: 'username profileImage email bio isVerified fullname gender age location socialLinks isPremium'
        })
        .populate({
          path: 'parentCommentId',
          populate: {
            path: 'userId',
            select: 'username profileImage email bio isVerified'
          }
        });

      return res.status(201).json({
        message: "Reply added successfully",
        data: {
          ...populatedReply.toObject(),
          likes: [],
          likeCount: 0,
          hasLiked: false,
          isEdited: false
        }
      });
    } catch (error) {
      console.error("Error in replyToComment:", error);
      return res.status(500).json({
        message: "Error adding reply",
        error: error.message
      });
    }
  };
