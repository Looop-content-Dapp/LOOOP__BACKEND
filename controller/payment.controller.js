import { initializePaystackTransaction } from "./paystack.controller.js";


// PayStack (PSTK), FlutterWave(FLTW).
const PAYMENT_PROVIDERS_TAG = ["PSTK", "FLTW"]


export async function paymentController(req, res) {
    const { email, amount, provider } = req.body;

    if (!email || !amount) {
        return res.status(400).json({ message: 'Email and amount are required' });
    }

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    switch (provider) {
        // case PAYMENT_PROVIDERS_TAG[0]:     // PayStack
        case "PSTK":     // PayStack
            return await initializePaystackTransaction(req, res, email, amount);

        case "FLTW":    // FlutterWave
            // TODO
            break;

        default:
            return res.status(400).json({ message: "Payment Provider not specified" });
    }
}
