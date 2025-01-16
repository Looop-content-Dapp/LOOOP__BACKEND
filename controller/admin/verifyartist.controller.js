import { Artist } from "../../models/artist.model.js";
import validator from "validator";

export const verifyArtist = async (req, res) => {
  try {
    const { artistId } = req.params;
    const { verified } = req.body;

    if (!validator.isMongoId(artistId)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid artist ID format",
      });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({
        status: "failed",
        message: "Artist not found",
      });
    }

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        status: "failed",
        message: "Verification status must be a boolean",
      });
    }

    const updatedArtist = await Artist.findByIdAndUpdate(
      artistId,
      {
        $set: {
          verified: verified,
          updatedAt: new Date(),
        },
      },
      { new: true }
    ).select("name email profileImage verified updatedAt");

    return res.status(200).json({
      status: "success",
      message: `Artist ${verified ? "verified" : "unverified"} successfully`,
      data: updatedArtist,
    });
  } catch (error) {
    console.error("Error verifying artist:", error);
    return res.status(500).json({
      status: "failed",
      message: "Error verifying artist",
      error: error.message,
    });
  }
};

// // Get verification status
// export const getVerificationStatus = async (req, res) => {
//   try {
//     const { artistId } = req.params;

//     if (!Types.ObjectId.isValid(artistId)) {
//       return res.status(400).json({
//         status: "failed",
//         message: "Invalid artist ID format"
//       });
//     }

//     const artist = await Artist.findById(artistId)
//       .select('name email profileImage verified verificationNotes updatedAt');

//     if (!artist) {
//       return res.status(404).json({
//         status: "failed",
//         message: "Artist not found"
//       });
//     }

//     return res.status(200).json({
//       status: "success",
//       data: {
//         artistId: artist._id,
//         name: artist.name,
//         email: artist.email,
//         profileImage: artist.profileImage,
//         verified: artist.verified,
//         verificationNotes: artist.verificationNotes,
//         lastUpdated: artist.updatedAt
//       }
//     });

//   } catch (error) {
//     console.error("Error checking verification status:", error);
//     return res.status(500).json({
//       status: "failed",
//       message: "Error checking verification status",
//       error: error.message
//     });
//   }
// };
