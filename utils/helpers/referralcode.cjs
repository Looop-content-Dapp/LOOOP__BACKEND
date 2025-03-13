const { User } = require("../../models/user.model");

const generateUniqueReferralCode = async (username) => {
  let isUnique = false;
  let referralCode = "";

  while (!isUnique) {
    const userPart = (username + "xxxx").slice(0, 4).toUpperCase();
    const numberPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    referralCode = userPart + numberPart;

    const existingUser = await User.findOne({ referralCode });

    if (!existingUser) {
      isUnique = true;
    }
  }

  return referralCode;
};

module.exports = { generateUniqueReferralCode };
