const { randomUUID } = require("crypto");

async function main() {
    const idempotencyKey = randomUUID();

    const body = {
        shippingAddress: {
            fullName: "Ada Lovelace",
            streetAddress: "123 Main St",
            city: "Seattle",
            stateProvince: "WA",
            postalCode: "98101",
            country: "US",
        },
        paymentDetails: {
            cardNumber: "4242424242424242",
            expiryDate: "12/30",
            cvv: "123",
            cardholderName: "Ada Lovelace",
        },
        metadata: "cli",
    };

    const res = await fetch("http://localhost:3000/api/checkout/payment", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("Idempotency-Key:", idempotencyKey);
    console.log("HTTP status:", res.status);
    console.log(text);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
