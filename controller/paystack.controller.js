
import assert from 'assert'
import crypto from 'crypto';
import { config } from 'dotenv';
import { Paystack } from 'paystack-sdk';

// load .env file
config();

const BASE_URL = 'https://api.paystack.co'
// const SUBSCRIPTION_PLANS = {
//     "SILVER": "PLN_32480",
//     "GOLD": "PLN_86D63"
// }

const paystackClient = initializePaystack();


export async function initializePaystackTransaction(req, res, email, amount) {
    const body = {
        email,
        amount
        // Might need to generate trnx reference ourselves if need be.
        // but can use the auto-generated one from paystack for now.
    }

    const apiRes = await paystackClient.transaction.initialize({ email, amount });
    if (!apiRes.status) {
        // This is a strange one indeed
        console.log("[Paystack Transaction Init Error]", apiRes);
        return res.status(500).json({ message: "Failed to create transaction", error: apiRes.message });
    }

    // TODO: Update DB to store payment information.
}




//
// <<<<<========================== START of WebHook Functions ================================
//
export async function paystackWebhookHandler(req, res) {
    try {
        // Validate the event signature
        const signature = req.headers['x-paystack-signature'];
        const hash = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== signature) {
            return res.status(400).send('Invalid signature');
        }

        // Should I respond immediately after validation before processing
        // the event to avoid timeout in case our processing takes too long?
        // res.status(200).send('Webhook received');

        const event = req.body;
        console.log('Webhook event received:', event);

        switch (event.event) {
            case 'charge.success':
                chargeSuccessEventHandler(event.data);
                break;
            default:
                break;
        }

        res.status(200).send('Webhook received');

    } catch (error) {
        console.error('Error processing paystack webhook:', error.message);
        res.status(500).send('Server error');
    }
}


function chargeSuccessEventHandler(event) {

    // TODO: Update DB to store transaction data and update user information.

    // Paystack "Transaction Successful" event payload.
    // {
    //     "event": "charge.success",
    //     "data": {
    //       "id": 302961,
    //       "domain": "live",
    //       "status": "success",
    //       "reference": "qTPrJoy9Bx",
    //       "amount": 10000,
    //       "message": null,
    //       "gateway_response": "Approved by Financial Institution",
    //       "paid_at": "2016-09-30T21:10:19.000Z",
    //       "created_at": "2016-09-30T21:09:56.000Z",
    //       "channel": "card",
    //       "currency": "NGN",
    //       "ip_address": "41.242.49.37",
    //       "metadata": 0,
    //       "log": {
    //         "time_spent": 16,
    //         "attempts": 1,
    //         "authentication": "pin",
    //         "errors": 0,
    //         "success": false,
    //         "mobile": false,
    //         "input": [],
    //         "channel": null,
    //         "history": [
    //           {
    //             "type": "input",
    //             "message": "Filled these fields: card number, card expiry, card cvv",
    //             "time": 15
    //           },
    //           {
    //             "type": "action",
    //             "message": "Attempted to pay",
    //             "time": 15
    //           },
    //           {
    //             "type": "auth",
    //             "message": "Authentication Required: pin",
    //             "time": 16
    //           }
    //         ]
    //       },
    //       "fees": null,
    //       "customer": {
    //         "id": 68324,
    //         "first_name": "BoJack",
    //         "last_name": "Horseman",
    //         "email": "bojack@horseman.com",
    //         "customer_code": "CUS_qo38as2hpsgk2r0",
    //         "phone": null,
    //         "metadata": null,
    //         "risk_action": "default"
    //       },
    //       "authorization": {
    //         "authorization_code": "AUTH_f5rnfq9p",
    //         "bin": "539999",
    //         "last4": "8877",
    //         "exp_month": "08",
    //         "exp_year": "2020",
    //         "card_type": "mastercard DEBIT",
    //         "bank": "Guaranty Trust Bank",
    //         "country_code": "NG",
    //         "brand": "mastercard",
    //         "account_name": "BoJack Horseman"
    //       },
    //       "plan": {}
    //     }
    //   }
}
//
//========================== END of WebHook Functions ================================>>>>>
//




//
// <<========================== (private) UnExported Functions Stay Below ================================>>
//

// Load Paystack keys & Initialize SDK
function initializePaystack() {
    const envStr = process.env.NODE_ENV === "production" ? "PAYSTACK_SECRET_KEY" : "PAYSTACK_SECRET_KEY_TEST";
    const paystackSecretKey = process.env[envStr];
    assert(paystackSecretKey, "Error: Paystack Secret Key Not Provided!");
    return new Paystack(paystackSecretKey);
}


// {
//     status: true,
//     message: "Account number resolved",
//     data: {
//         account_number: "0001234567",
//         account_name: "Doe Jane Loren",
//         bank_id: 9
//     }
// }
async function resolveBankAccount(bankCode, acctNum) {
    const url = `${BASE_URL}/bank/resolve?account_number=${acctNum}&bank_code=${bankCode}`;
    const headers = {
        Authorization: 'Bearer ' + paystackSecretKey,
    };
    let ret = { status: false, message: "Account number not resolved", data: null };
    try {
        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            return ret;
        }

        const jsonRes = await response.json();
        console.log(jsonRes); // Log the JSON response data

        if (jsonRes.status === true & jsonRes.data !== null) {
            ret.status = true;
            ret.message = jsonRes.message;
            ret.data = jsonRes.data;
            return ret;
        }

    } catch (error) {
        console.error('Error:', error.message);
    }

    return ret;
}
