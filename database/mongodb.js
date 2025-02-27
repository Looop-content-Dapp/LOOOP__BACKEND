import mongoose from "mongoose";
import { MONGODB_URI, NODE_ENV } from "../config/env";

if(!MONGODB_URI){
    throw new Error("Mongodb URI not found inside .env.<development/production>.local, Please define it!")
}

const connectToDatabase = async () => {
    try {
        await mongoose.connect(MONGODB_URI)
    } catch (error) {
      console.error("Problem connecting to database!")
      
    }
}