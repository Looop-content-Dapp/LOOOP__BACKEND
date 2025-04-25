import AbstraxionAuth from "../xion/AbstraxionAuth.js";
import mongoose from "mongoose";
import "dotenv/config";

// Mock models (replace with actual implementations)
// Check if models are already defined before creating them
if (!mongoose.models.Wallet) {
    const WalletSchema = new mongoose.Schema({
        email: String,
        xion: {
            address: String,
            encryptedMnemonic: String,
            iv: String,
            salt: String,
            authTag: String,
        },
        shamirShares: [String],
        multiSigKeys: [String],
    });
    mongoose.model("Wallet", WalletSchema);
}

if (!mongoose.models.Transaction) {
    const TransactionSchema = new mongoose.Schema({
        sender: String,
        recipient: String,
        amount: String,
        denom: String,
        transactionHash: String,
        timestamp: Date,
    });
    mongoose.model("Transaction", TransactionSchema);
}

// Mock websocket service
const websocketService = {
    emit: (event, data) => console.log(`Emitting ${event}:`, data),
};

// Mock environment variables
process.env.XION_RPC_URL = "https://rpc.xion-testnet-2.burnt.com:443";
process.env.XION_REST_URL = "https://api.xion-testnet-2.burnt.com";
process.env.TREASURY_ADDRESS = "xion1treasury";
process.env.GRANTER_ADDRESS = "xion1granter";
process.env.SERVER_SECRET = "be3313041d7e3edd0b9526a9b0cf618fedab1a271be5f980d42793919388f2ba";

// Test suite
async function runTests() {
    try {
        // Connect to MongoDB (replace with your connection string)
        await mongoose.connect("mongodb+srv://looopMusic:Dailyblessing@looopmusic.a5lp1.mongodb.net/?retryWrites=true&w=majority&appName=LooopMusic", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Connected to MongoDB");

        const auth = new AbstraxionAuth();
        const email = "test20@example.com";

        // Test 1: Signup
        console.log("Testing signup...");
        const signupResult = await auth.signup(email);
        console.log("Signup Result:", signupResult);

        // Test 2: Login
        console.log("Testing login...");
        const keypair = await auth.login(email);
        console.log("Login Successful, Address:", (await keypair.getAccounts())[0].address);

        // Test 3: Add Multi-Sig Key
        console.log("Testing add multi-sig key...");
        await auth.addMultiSigKey(email, "xion1multisigkey");
        const wallet = await Wallet.findOne({ email });
        console.log("Multi-Sig Keys:", wallet.multiSigKeys);

        // Test 4: Transfer Funds (mocked, requires valid addresses and funds)
        console.log("Testing transfer funds...");
        try {
            const transferResult = await auth.transferFunds(
                "xion1recipient",
                "100000",
                "uxion",
                [{ signer: "xion1multisigkey" }]
            );
            console.log("Transfer Result:", transferResult);
        } catch (error) {
            console.error("Transfer Failed (expected if no funds):", error.message);
        }

        // Test 5: Mint Pass (mocked, requires valid contract)
        console.log("Testing mint pass...");
        try {
            const mintResult = await auth.mintPass("xion1collection");
            console.log("Mint Result:", mintResult);
        } catch (error) {
            console.error("Mint Failed (expected if no funds):", error.message);
        }

        // Test 6: Execute Smart Contract (mocked)
        console.log("Testing execute smart contract...");
        try {
            const executeResult = await auth.executeSmartContract(
                "xion1contract",
                { action: "test" },
                "Test execution"
            );
            console.log("Execute Result:", executeResult);
        } catch (error) {
            console.error("Execute Failed (expected if no contract):", error.message);
        }

        // Test 7: Query Smart Contract (mocked)
        console.log("Testing query smart contract...");
        try {
            const queryResult = await auth.querySmartContract("xion1contract", { info: {} });
            console.log("Query Result:", queryResult);
        } catch (error) {
            console.error("Query Failed (expected if no contract):", error.message);
        }

        // Test 8: Key Rotation
        console.log("Testing key rotation...");
        const rotateResult = await auth.rotateKey(email);
        console.log("Key Rotation Result:", rotateResult);

        // Test 9: Recover Wallet
        console.log("Testing wallet recovery...");
        const recovered = await auth.recoverWallet(email, wallet.shamirShares.slice(0, 3));
        console.log("Recovery Result:", recovered);

        // Test 10: Logout
        console.log("Testing logout...");
        await auth.logout();
        console.log("Logged out, isLoggedIn:", auth.isLoggedIn);

    } catch (error) {
        console.error("Test suite failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    }
}

runTests();
