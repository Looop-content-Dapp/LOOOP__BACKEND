import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(
  "776440951072-v1ncd4jb1o8arac8f541p0ghrv24v4ro.apps.googleusercontent.com"
);

export const validateGoogleToken = async (token, emailToCompare) => {
  try {
    if (!token) return false;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience:
        "776440951072-v1ncd4jb1o8arac8f541p0ghrv24v4ro.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    if (payload && payload.email) {
      if (payload.email === emailToCompare) {
        return true;
      } else {
        console.error("Email does not match");
        return false;
      }
    }

    return false;
  } catch (error) {
    if (error.message.includes("Token used too late")) {
      console.error("Error verifying Google token: Token has expired");
    } else if (error.message.includes("Wrong recipient")) {
      console.error(
        "Error verifying Google token: Wrong recipient, payload audience != requiredAudience"
      );
    } else {
      console.error("Error verifying Google token:", error);
    }
    return false;
  }
};
