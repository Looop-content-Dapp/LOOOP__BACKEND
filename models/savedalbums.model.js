import { Schema, model } from "mongoose";

const SavedReleaseSchema = new Schema(
  {
    releaseId: {
      type: Schema.Types.ObjectId,
      ref: "Album",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const SavedRelease = model("savedreleases", SavedReleaseSchema);
