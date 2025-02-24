import crypto from "crypto";
import appleSigninAuth from "apple-signin-auth";
import jwt from "jsonwebtoken";

export async function validateAppleToken(id_token, emailToCompare, nonce) {
  try {
    await appleSigninAuth.verifyIdToken(id_token, {
      nonce: nonce
        ? crypto.createHash("sha256").update(nonce).digest("hex")
        : undefined,
    });

    const decodedToken = jwt.decode(id_token);

    if (decodedToken && decodedToken.email) {
      return decodedToken.email === emailToCompare;
    }

    return false;
  } catch (error) {
    console.error("Token verification failed:", error);
    return false;
  }
}
