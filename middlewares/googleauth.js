import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(
  "30715199372-96o0hmuttrbtpjbmm0hhht38ii24unim.apps.googleusercontent.com"
);
// const client = new OAuth2Client(CLIENT_ID);

export const validateGoogleToken = async (token, emailToCompare) => {
  try {
    if (!token) return false;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (payload && payload.email) {
      return payload.email === emailToCompare;
    }

    return false;
  } catch (error) {
    console.error("Error verifying Google token:", error);
    return false;
  }
};
