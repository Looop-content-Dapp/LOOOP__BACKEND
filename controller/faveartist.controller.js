import { FaveArtist } from "../models/faveartist.model.js";


export const getAllFaveArtist = async (req, res) => {
  try {
    const faveArtist = await FaveArtist.find({});

    return res.status(200).json({
      message: "successfully get all fave artists",
      data: faveArtist,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching fave artists", error: error.message });
  }
};

export const getFaveArtist = async (req, res) => {
  try {
    const faveArtist = await FaveArtist.aggregate([
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
    ]);

    if (!faveArtist) {
      return res.status(404).json({ message: "fave Artist not found" });
    }

    return res.status(200).json({
      message: "successfully gotten user fave artist",
      data: faveArtist[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching fave artist", error: error.message });
  }
  1``;
};

export const getAllFaveArtistForUser = async (req, res) => {
  try {
    const faveArtistForUser = await FaveArtist.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              "$userId",
              {
                $toObjectId: req.params.userid,
              },
            ],
          },
        },
      },
    ]);

    return res.status(200).json({
      message: "successfully gotten user favorite artist",
      data: faveArtistForUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching user favorite artist",
      error: error.message,
    });
  }
};
