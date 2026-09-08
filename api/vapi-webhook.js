export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("VAPI WEBHOOK RECEIVED");
    console.log(JSON.stringify(req.body, null, 2));

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
