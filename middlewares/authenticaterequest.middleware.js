
import { verifyAuthToken } from "../utils/helpers/jwtauth.js";


export function authenticateAPIRequest(req, res, next) {
    // let tokenError = {
    //     error: null,
    //     message: ""
    // };
    const authToken = req.headers.authorization?.split(" ")[1]?.trim() || null;

    verifyAuthToken(authToken, (err, payload) => {
        // console.log("error:", err);
        // console.log("payload:", payload);
        if (err) {
            console.log("[InvalidAuthToken]:", authToken);
            // tokenError.error = "Invalid Token";
            // tokenError.message = "Auth Token Verification Failed";
            return res.status(401).json({ error: "Invalid Token", message: "Auth-Token Verification Failed" });
        }
        console.log("[AuthToken]:", payload);
        req.authToken = payload;
        next();
    });
    
    // !IMPORTANT NOTICE!!!
    // Do not call "next()" after "verifyToken", 
    // as it will run (get called) before the callback passed to "verifyToken" completes.

    // if (tokenError.error != null) return res.status(401).json(tokenError);
    // req.test = "Works"
    // next();
}