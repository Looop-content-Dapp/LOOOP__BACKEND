import crypto from "crypto";
import appleSigninAuth from "apple-signin-auth";
import jwt from "jsonwebtoken";

export async function validateAppleToken(id_token, emailToCompare, nonce) {
  try {
    const options = {
      nonce: nonce
        ? crypto.createHash("sha256").update(nonce).digest("hex")
        : undefined,
    };

    const appleResponse = await appleSigninAuth.verifyIdToken(
      id_token,
      options
    );

    if (!appleResponse) {
      console.error("Apple token verification failed: No response from Apple");
      return false;
    }

    const decodedToken = jwt.decode(id_token);

    if (!decodedToken) {
      console.error("Apple token verification failed: Unable to decode token");
      return false;
    }

    if (decodedToken.email !== emailToCompare) {
      console.error("Apple token verification failed: Email does not match");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Apple token verification failed:", error);
    return false;
  }
}
