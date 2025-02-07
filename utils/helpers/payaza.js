import axios from "axios";

const PayAzaCardPayment = async (transaction_reference) => {
  const response = await axios.get(
    `https://api.payaza.africa/live/merchant-collection/transfer_notification_controller/transaction-query?transaction_reference=${transaction_reference}`,
    {
      headers: {
        Authorization: `Payaza PZ78-PKTEST-FF00C2E4-3339-4D9A-93AF-1CD4F3A834DC`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 200) {
    return {
      status: "success",
      message: "Payment verified successfully",
      data: response.data,
    };
  } else {
    return {
      status: "failed",
      message: "Payment failed",
      data: null,
    };
  }
};

export { PayAzaCardPayment };
