// import axios from "axios";

export const createWalletViaAPI = async () => {
  try {
    const response = await axios.post(
      `http://localhost:3000/auth/login`
    );
// export const createWalletViaAPI = async () => {
//   try {
//     const response = await axios.post(
//       `${process.env.XION_BASE_URL}/auth/login`
//     );

//     if (response.data.success === true) {

//       return response.data.walletInfo;
//     }
//   } catch (error) {
//     console.error("Error creating wallet:", error);
//     throw error;
//   }
// };

// adapt dependencies
// storage mechanism,