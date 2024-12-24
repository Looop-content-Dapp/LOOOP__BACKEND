import { Schema, model } from "mongoose";

const socialSchema = new Schema(
  {
    artistId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Artist",
    },
    twitter: { type: String },
    linkedin: { type: String },
    instagram: { type: String },
  },
  { timestamps: true }
);

export const Social = model("socials", socialSchema);
