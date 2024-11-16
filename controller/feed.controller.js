const Post = require("../models/post.model");
const Community = require("../models/community.model");
const Like = require("../models/likes.model");

const getUserFeed = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10
    } = req.query;

    const userId = req.user._id;

    // Get user's tribes/communities
    const userTribes = await Community.find({
      $or: [
        { members: userId },
        { subscribers: userId }
      ]
    }).select('_id name');

    const tribeIds = userTribes.map(tribe => tribe._id);

    // Build base query
    const query = {
      communityId: { $in: tribeIds },
      status: 'published',
      'artistId.verified': true
    };

    // Fetch posts with specific population
    const posts = await Post.find(query)
      .populate({
        path: 'artistId',
        select: 'name profileImage verified'
      })
      .populate({
        path: 'communityId',
        select: 'name icon'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get user's likes for interaction state
    const userLikes = await Like.find({
      userId,
      postId: { $in: posts.map(post => post._id) }
    });

    // Transform posts to match UI exactly
    const formattedPosts = posts.map(post => {
      const hasLiked = userLikes.some(like => like.postId.equals(post._id));

      return {
        id: post._id,
        artist: {
          id: post.artistId._id,
          name: post.artistId.name,
          avatar: post.artistId.profileImage,
          verified: true
        },
        tribe: {
          id: post.communityId._id,
          name: post.communityId.name,
          icon: post.communityId.icon,
          prefix: '►'  // Used in UI before tribe names
        },
        content: {
          text: post.content,
          media: post.media.map(m => ({
            type: m.type,
            url: m.url,
            ...(m.type === 'audio' && {
              duration: m.duration,
              waveform: true
            }),
            ...(m.type === 'image' && {
              aspectRatio: m.width / m.height
            })
          }))
        },
        engagement: {
          plays: formatCount(post.playCount),
          shares: formatCount(post.shareCount),
          likes: formatCount(post.likeCount),
          comments: formatCount(post.commentCount)
        },
        timestamp: formatTimeAgo(post.createdAt),
        interactions: {
          hasLiked,
          hasShared: false,  // Implement if you track shares
          hasCommented: false  // Implement if you track user comments
        }
      };
    });

    // Example response matching the UI exactly
    const exampleResponse = {
      posts: [
        {
          id: "1",
          artist: {
            id: "rema_id",
            name: "Rema",
            avatar: "rema_avatar_url",
            verified: true
          },
          tribe: {
            id: "afroravers_id",
            name: "Afroravers official",
            prefix: "►"
          },
          content: {
            text: "Heyy y'all...heard you guys are enjoying HEIS!!! excited to announce that i'm already working on some new music to be out soon😉",
            media: [{
              type: "audio",
              url: "audio_url",
              duration: "0:53",
              waveform: true
            }]
          },
          engagement: {
            plays: "1.8k",
            shares: "857",
            likes: "5.2k",
            comments: "1.1k"
          },
          timestamp: "5h",
          interactions: {
            hasLiked: false,
            hasShared: false,
            hasCommented: false
          }
        },
        {
          id: "2",
          artist: {
            id: "burna_id",
            name: "Burna Boy",
            avatar: "burna_avatar_url",
            verified: true
          },
          tribe: {
            id: "outsiders_id",
            name: "Outsiders 🦍",
            prefix: "►"
          },
          content: {
            text: "EMPTY CHAIRS OUT SOON!"
          },
          engagement: {
            likes: "5.2k",
            comments: "1.1k"
          },
          timestamp: "7h",
          interactions: {
            hasLiked: false,
            hasShared: false,
            hasCommented: false
          }
        },
        {
          id: "3",
          artist: {
            id: "wizkid_id",
            name: "Wizkid",
            avatar: "wizkid_avatar_url",
            verified: true
          },
          tribe: {
            id: "wizfc_id",
            name: "Wiz FC",
            prefix: "►"
          },
          content: {
            text: "09/11 🎸",
            media: [{
              type: "image",
              url: "image_url"
            }]
          },
          engagement: {},
          timestamp: "7h",
          interactions: {
            hasLiked: false,
            hasShared: false,
            hasCommented: false
          }
        }
      ],
      pagination: {
        currentPage: parseInt(page),
        hasMore: posts.length === limit
      }
    };

    return res.status(200).json({
      success: true,
      data: {
        posts: formattedPosts,
        pagination: {
          currentPage: parseInt(page),
          hasMore: posts.length === limit
        }
      }
    });
  } catch (error) {
    console.error("Error in getUserFeed:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching feed",
      error: error.message
    });
  }
};

// Helper function to format numbers like 1.8k, 857, 5.2k
const formatCount = (count) => {
  if (!count) return null;

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}m`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

// Helper function to format time like 5h, 7h
const formatTimeAgo = (date) => {
  const now = new Date();
  const hours = Math.floor((now - date) / (1000 * 60 * 60));

  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

module.exports = {
  getUserFeed
};
