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
    const { name, description, artistId } = req.body;

    const artist = await Artist.findById(artistId);

    if (!artist) {
      return res.status(400).json({ message: "Artist doesnt exist" });
    }

    const community = new Community({
      name,
      description,
      createdBy: artistId,
    });

    await community.save();

    return res.status(200).json({
      message: "successfully created a community",
      data: community,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching community", error: error.message });
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

module.exports = {
  getAllCommunity,
  getCommunity,
  createCommunity,
  joinCommunity,
};
