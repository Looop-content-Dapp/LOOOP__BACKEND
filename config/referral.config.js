import dotenv from "dotenv";
dotenv.config();

const referralRewards = {
  NEW_USER_SIGNUP: {
    points: Number(process.env.REWARD_NEW_USER_SIGNUP) || 3,
    historyType: "NewUserSignup",
    description: "Reward for new user referral signup.",
  },
  PURCHASE: {
    points: Number(process.env.REWARD_PURCHASE) || 10,
    historyType: "Purchase",
    description: "Reward for a purchase made by a referred user.",
  },
  PROFILE_COMPLETION: {
    points: Number(process.env.REWARD_PROFILE_COMPLETION) || 5,
    historyType: "ProfileCompletion",
    description: "Reward for the referred user completing their profile.",
  },
  SOCIAL_SHARE: {
    points: Number(process.env.REWARD_SOCIAL_SHARE) || 2,
    historyType: "SocialShare",
    description:
      "Reward for the referred user sharing content on social media.",
  },
};

export default {
  referralRewards,
};
