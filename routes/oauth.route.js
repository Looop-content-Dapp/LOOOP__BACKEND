
import { Router } from "express";
import { OAuthToken } from "../models/oauth.model.js";
import { authenticateAPIRequest } from "../middlewares/authenticaterequest.middleware.js";


const VALID_OAUTH_PROVIDERS = ['spotify', 'instagram', 'twitter'];
const OAuthRouter = Router();


OAuthRouter.post("/:provider", authenticateAPIRequest, async (req, res) => {
    try {
        const { provider } = req.params;
        const looopAuthToken = req.authToken;
        const oauthToken = req.body.oauthToken;
        console.log("Received: ", looopAuthToken);

        if (VALID_OAUTH_PROVIDERS.includes(provider) === false || !looopAuthToken) {
            return res.status(400).json({ error: "Invalid Request", message: "Provide Valid Provider & Auth" });
        }

        if (!oauthToken) {
            return res.status(400).json({ error: "Invalid Request", message: "No OAuth2 payload found in body" });
        }

        await OAuthToken.create({
            provider: provider,
            userId: looopAuthToken.sub,
            user: looopAuthToken.user,
            token: {
                ...oauthToken,
                access_token: oauthToken.access_token,
                token_type: oauthToken.token_type,
                refresh_token: oauthToken.refresh_token,
                expires_in: oauthToken.expires_in || '',
                scope: oauthToken.scope,
            }
        });

        return res.status(200).json({ status: true, message: "Third-party OAUth saved" });
    } catch (error) {
        return res.status(500).json({ error: "Unexpected Error Occurred", message: String(error) });
    }
});



export default OAuthRouter;