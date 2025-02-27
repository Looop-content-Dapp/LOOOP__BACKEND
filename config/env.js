import { config } from "dotenv";

config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const {
  PORT,
  NODE_ENV,
  MONGODB_URI,
  ACCT_ADDRESS,
  PRIVATE_KEY,
  FLW_SECRET_KEY,
  FLW_SECRET_HASH,
  FLUTTERWAVE_REDIRECT_URL,
  FLUTTERWAVE_PLAN_ID,
  FLW_PUBLIC_KEY,
  COINGECKO_API_URL,
} = process.env;
