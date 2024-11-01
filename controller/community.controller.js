const Artist = require("../models/artist.model");
const Community = require("../models/community.model");
const CommunityMember = require("../models/communitymembers.mode");

const getAllCommunity = async (req, res) => {
  try {
    const communities = await Community.find({});

    return res.status(200).json({
      message: "successfully get all communities",
      data: communities,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching communities", error: error.message });
  }
};

const getCommunity = async (req, res) => {
  try {
    const community = await Community.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$_id",
              {
                $toObjectId: req.params.communityid,
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "communitymembers",
          localField: "_id",
          foreignField: "communityId",
          as: "members",
        },
      },
    ]);

    if (!community) {
      return res.status(404).json({ message: "community not found" });
    }

    return res.status(200).json({
      message: "successfully gotten a community",
      data: community[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching community", error: error.message });
  }
};

const createCommunity = async (req, res) => {
    try {
      const {
        // Basic Info
        name,
        description,
        coverImage,

        // Tribe Pass Details
        collectibleName,
        collectibleDescription,
        collectibleImage,
        collectibleType,

        artistId
      } = req.body;

      // Validate required fields
      if (!name || !description || !coverImage || !collectibleName || !collectibleImage || !artistId) {
        return res.status(400).json({
          message: "Missing required fields",
          required: [
            'name',
            'description',
            'coverImage',
            'collectibleName',
            'collectibleImage',
            'artistId'
          ]
        });
      }

      // Validate image size and type for collectible
      if (collectibleImage) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (collectibleImage.size > maxSize) {
          return res.status(400).json({
            message: "Collectible image must be less than 50MB"
          });
        }

        if (!['PNG', 'GIF', 'WEBP'].includes(collectibleType)) {
          return res.status(400).json({
            message: "Invalid collectible type. Must be PNG, GIF, or WEBP"
          });
        }
      }

      const artist = await Artist.findById(artistId);
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const community = new Community({
        name,
        description,
        coverImage,
        tribePass: {
          collectibleName,
          collectibleDescription,
          collectibleImage,
          collectibleType
        },
        createdBy: artistId
      });

      await community.save();

      // Populate creator details before sending response
      await community.populate('createdBy', 'name email profileImage genre verified');

      return res.status(201).json({
        message: "Successfully created tribe",
        data: community
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Error creating tribe",
        error: error.message
      });
    }
  };

  const deleteCommunity = async (req, res) => {
    try {
      const { communityId } = req.params;
      const { artistId } = req.body; // The artist attempting to delete

      // Validate the community exists
      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({
          message: "Community not found"
        });
      }

      // Check if the requesting artist is the creator
      if (community.createdBy.toString() !== artistId) {
        return res.status(403).json({
          message: "Only the community creator can delete the community"
        });
      }

      // Begin transaction to ensure all related data is cleaned up
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete all community members
        await CommunityMember.deleteMany({
          communityId: communityId
        }, { session });

        // Delete all community posts if you have them
        if (Post) {
          await Post.deleteMany({
            communityId: communityId
          }, { session });
        }

        // Delete the community itself
        await Community.findByIdAndDelete(communityId, { session });

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        message: "Community successfully deleted",
        data: {
          communityId,
          name: community.name
        }
      });

    } catch (error) {
      console.error("Error in deleteCommunity:", error);
      return res.status(500).json({
        message: "Error deleting community",
        error: error.message
      });
    }
  };

const joinCommunity = async (req, res) => {
  try {
    const { userId, communityId } = req.body;

    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(400).json({ message: "community doesn't exist" });
    }

    // check if fthere is a matcing doc that has user id and the community id
    const userAlreadyExistinCommunity = await CommunityMember.aggregate([
      {
        $match: {
          $and: [
            {
              $expr: {
                $eq: [
                  {
                    $toObjectId: userId,
                  },
                  "$userId",
                ],
              },
            },
            {
              $expr: {
                $eq: [
                  {
                    $toObjectId: communityId,
                  },
                  "$communityId",
                ],
              },
            },
          ],
        },
      },
    ]);

    if (userAlreadyExistinCommunity.length > 0) {
      return res
        .status(400)
        .json({ message: "User already exist in community" });
    }

    const communitymember = new CommunityMember({
      userId,
      communityId,
    });

    await communitymember.save();

    return res.status(200).json({
      message: "successfully joined a community",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error joining community", error: error.message });
  }
};

const searchCommunity = async (req, res) => {
  try {
    const { query } = req.query;

    const results = await Community.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" }, // Optional: get relevance score
      }
    ).sort({ score: 1 });

    return res.status(200).json({
      message: "success",
      searchResults: results,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return res
      .status(500)
      .json({ message: "Error searching", error: error.message });
  }
};

module.exports = {
  getAllCommunity,
  getCommunity,
  createCommunity,
  joinCommunity,
  searchCommunity,
  deleteCommunity
};
