const Preferences = require("../models/Preferences");

const getAllPreferences = async (req, res) => {
  try {
    const preferences = await Preferences.find({});

    return res.status(200).json({
      message: "successfully get all preferences",
      data: preferences,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching preferences", error: error.message });
  }
};

const getPreference = async (req, res) => {
  try {
    const preference = await Preferences.aggregate([
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

    if (!preference) {
      return res.status(404).json({ message: "Preference not found" });
    }

    return res.status(200).json({
      message: "successfully gotten user preference",
      data: preference[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error fetching preference", error: error.message });
  }
};

module.exports = {
  getAllPreferences,
  getPreference,
};
