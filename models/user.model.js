import { Schema, SchemaTypes, model } from "mongoose";
import bcrypt from "bcryptjs";

const securitySettingsSchema = new Schema({
  isGoogleAuthEnabled: {
    type: Boolean,
    default: false
  },
  googleAuthSecret: {
    type: String,
    select: false // Hide from regular queries
  },
  passcodeHash: {
    type: String,
    select: false
  },
  passcodeSalt: {
    type: String,
    select: false
  },
  isBiometricEnabled: {
    type: Boolean,
    default: false
  },
  requiredAuthMethods: {
    type: [String],
    enum: ['PASSCODE', 'GOOGLE_AUTH', 'BIOMETRIC'],
    default: ['PASSCODE']
  }
});

// const walletSchema = new Schema({
//   address: String,
//   mnemonic: String,
//   balance: {
//     type: Number,
//     default: 0
//   }
// });

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  fullname: { type: String, required: true },
  age: { type: String, required: true },
  gender: {
    type: String,
    required: true,
    enum: ["male", "female"],
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profileImage: { type: String, default: null },
  bio: { type: String, default: null },
  isPremium: { type: Boolean, default: false },
  tel: { type: Number, default: null },
  // New fields for enhanced profile
  location: {
    country: { type: String, default: null },
    state: { type: String, default: null },
    city: { type: String, default: null }
  },
  socialLinks: {
    instagram: { type: String, default: null },
    twitter: { type: String, default: null },
    facebook: { type: String, default: null },
    website: { type: String, default: null }
  },
  preferences: {
    favoriteGenres: [{ type: SchemaTypes.ObjectId, ref: 'Genre' }],
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR']
    },
    chain: {
      type: String,
      default: 'XION',
      enum: ['XION', 'STARKNET']
    },
    theme: {
      type: String,
      default: 'system',
      enum: ['light', 'dark', 'system']
    },
    displayMode: {
      type: String,
      default: 'comfortable',
      enum: ['compact', 'comfortable']
    }
  },
  role: {
    type: String,
    enum: ["LISTENER", "ARTIST", "ADMIN"],
    default: "LISTENER",
  },
  wallets: {
    starknet: {
      type: {
        address: { type: String, default: null },
        balance: { type: Number, default: 0 },
      },
      default: null,
    },
    xion: {
      type: {
        address: { type: String, required: true },
        mnemonic: { type: String, required: true },
        balance: { type: Number, default: 0 },
      },
      default: null,
    },
  },
  nftContracts: [{
    contractAddress: { type: String, required: true },
    communityId: { type: SchemaTypes.ObjectId, ref: 'Community', required: true },
    mintedAt: { type: Date, default: Date.now }
  }],
  oauthTokens: [{ type: SchemaTypes.ObjectId, ref: "OAuthToken" }],
  artist: { type: SchemaTypes.ObjectId, ref: "artist" },
  referralCode: { type: String, required: true, unique: true },
  referralCount: { type: Number, default: 0 },
  referralCodeUsed: [
    { type: SchemaTypes.ObjectId, ref: "users", default: [] },
  ],
  security: {
    type: securitySettingsSchema,
    default: {}
  },
  oauthprovider: { type: String },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model("user", userSchema);
