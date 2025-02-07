import axios from "axios";
// import { initializePaystackTransaction } from "./paystack.controller.js";

// PayStack (PSTK), FlutterWave(FLTW).
const PAYMENT_PROVIDERS_TAG = ["PSTK", "FLTW"];

// export async function paymentController(req, res) {
//   const { email, amount, provider } = req.body;

//   if (!email || !amount) {
//     return res.status(400).json({ message: "Email and amount are required" });
//   }

//   if (isNaN(amount) || amount <= 0) {
//     return res
//       .status(400)
//       .json({ message: "Amount must be a positive number" });
//   }

//   switch (provider) {
//     // case PAYMENT_PROVIDERS_TAG[0]:     // PayStack
//     case "PSTK": // PayStack
//       return await initializePaystackTransaction(req, res, email, amount);

//     case "FLTW": // FlutterWave
//       // TODO
//       break;

//     default:
//       return res
//         .status(400)
//         .json({ message: "Payment Provider not specified" });
//   }
// }

export async function flutterWavePaymentController(req, res) {
  const {
    amount,
    currency,
    card_number,
    cvv,
    expiry_month,
    expiry_year,
    email,
    tx_ref,
  } = req.body;

  if (!email || !amount) {
    return res.status(400).json({ message: "Email and amount are required" });
  }

  const paymentData = {
    card_number,
    cvv,
    expiry_month,
    expiry_year,
    currency: currency || "NGN",
    amount,
    email,
    tx_ref: tx_ref || `tx-${Date.now()}`,
    redirect_url: "https://your-redirect-url.com",
    authorization: {
      mode: "pin",
      pin: "1234",
    },
  };
  try {
    const response = await axios.post(
      "https://api.flutterwave.com/v3/charges?type=card",
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { data } = response;
    if (data.status === "success") {
      res
        .status(200)
        .json({ status: "success", message: "Payment successful", data });
    } else {
      res
        .status(400)
        .json({ status: "success", message: "Payment failed", data });
    }
  } catch (error) {
    console.error("Payment processing error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
