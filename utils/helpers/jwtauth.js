import { config } from "dotenv";
import fastJWT from "fast-jwt";

const { createVerifier, createSigner } = fastJWT;
// Load .env
config();

const JWT_ISS = "com.looopmusic";
const JWT_AUD = "looopmusic-v1-api-service";

if (!process.env['JWT_SECRET']) throw "[JWT_SECRET_ERROR]: Key Not Found!"

export const createAuthToken = createSigner({
    key: process.env['JWT_SECRET'].trim(),
    algorithm: 'HS512',
    iss: JWT_ISS,
    aud: JWT_AUD,
});


export const verifyAuthToken = createVerifier({
    key: async () => process.env['JWT_SECRET'].trim(),
    algorithms: ["HS512"],
    allowedIss: JWT_ISS,
    requiredClaims: ["iss", "aud"],
    allowedAud: JWT_AUD,
});


// if (import.meta.url === new URL(import.meta.resolve('C:/Users/Temi/Documents/Tope/looop/loop-backend/utils/helpers/jwtauth.js'))) {
//     const token = createAuthToken({ name: "Temi", role: "ADMIN" });
//     console.log(token, verifyAuthToken(token));
// }
// const token = createAuthToken({ name: "Temi", role: "ADMIN" });
// console.log(token, await verifyAuthToken(token));

// console.log(new URL(import.meta.filename));
// console.log(new URL(import.meta.url).protocol);
