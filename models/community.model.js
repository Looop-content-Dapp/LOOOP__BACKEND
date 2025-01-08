import { Schema, Types, model } from "mongoose";
import validator from "validator";

const communitySchema = new Schema(
  {
    communityName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 150,
    },
    coverImage: {
      type: String,
      validate: {
        validator: (value) =>
          validator.isURL(value, {
            protocols: ["http", "https"],
            require_protocol: true,
          }),
        message: (props) => `coverimage does not have a valid URL!`,
      },
      required: true,
    },

    tribePass: {
      collectibleName: {
        type: String,
        required: true,
        trim: true,
      },
      collectibleDescription: {
        type: String,
        maxlength: 150,
        trim: true,
      },
      collectibleImage: {
        type: String,
        validate: {
          validator: (value) =>
            validator.isURL(value, {
              protocols: ["http", "https"],
              require_protocol: true,
            }),
          message: (props) => `collectibleImage does not have a valid URL!`,
        },
        required: true,
      },
      collectibleType: {
        type: String,
        enum: ["PNG", "JPG", "WEBP", "png", "jpg", "webp", "GIF", "gif"],
        required: false,
      },
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "artist",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "active",
    },
    memberCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

communitySchema.index({ communityName: "text" });

export const Community = model("community", communitySchema);
