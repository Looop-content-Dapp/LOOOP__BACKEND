import { Schema, SchemaTypes, model } from "mongoose";

// https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
// "access_token": "2YotnFZFEjr1zCsicMWpAA",
// "token_type": "example",
// "expires_in": 3600,
// "refresh_token": "tGzv3JOkF0XG5Qx2TlKWIA",
// "example_parameter": "example_value"
const OAuthTokenObjectSchema = new Schema({
    provider: { // 'spotify', 'instagram', 'google' etc.
        type: SchemaTypes.String,
        required: true
    },
    userId: {
        type: SchemaTypes.ObjectId,
        required: true,
        index: true
    },
    user: {
        type: SchemaTypes.ObjectId,
        ref: "users",
        required: true
    },
    token: {
        access_token: {
            type: SchemaTypes.String,
            required: true
        },
        token_type: {
            type: String,
            enum: ["bearer", "mac"],
            required: true,
            lowercase: true
        },
        scope: {    //  https://datatracker.ietf.org/doc/html/rfc6749#section-3.3
            type: SchemaTypes.String,
            required: true
        },
        expires_in: {
            type: SchemaTypes.Number,
            required: false
        },
        refresh_token: {
            type: SchemaTypes.String,
            required: false
        },
    }
},
    { strict: false,  }   // Just in case we have providers that send custom fields in token response.
);


export const OAuthToken = model('OAuthToken', OAuthTokenObjectSchema);