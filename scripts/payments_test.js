

import { config } from "dotenv";
import { Paystack } from "paystack-sdk";


config();


const p = new Paystack(process.env['PAYSTACK_SECRET_KEY_TEST']);

const res = await p.transaction.initialize({email: "amosun@g.com", amount: 100000});
console.log(res);
console.log(res.status);
