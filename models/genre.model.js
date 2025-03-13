import { Schema, model } from "mongoose";

const GenreSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
      required: false,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Genre = model("genres", GenreSchema);
