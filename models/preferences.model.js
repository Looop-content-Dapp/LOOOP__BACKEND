import { Schema, model } from "mongoose";

const PreferenceSchema = new Schema(
  {
    genreId: [
      {
        type: String,
        required: true,
        ref: "Genre",
      },
    ],
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Preferences = model("preferences", PreferenceSchema);
