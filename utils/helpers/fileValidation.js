import axios from "axios";
import * as mm from "music-metadata";

export const validateFile = async (fileUrl) => {
  try {
    // Fetch the file as a stream
    const response = await axios.get(fileUrl, { responseType: "stream" });

    // Parse metadata
    const metadata = await mm.parseStream(response.data, { mimeType: response.headers["content-type"] });

    return {
      valid: true,
      metadata: {
        duration: metadata.format.duration, // Duration in seconds
        bitrate: metadata.format.bitrate, // Bitrate in kbps
        format: metadata.format.container, // File format (mp3, wav, etc.)
        fileHash: metadata.common.picture?.[0]?.data?.toString("hex") // Example hash from album art
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message || "Error validating file"
    };
  }
};
