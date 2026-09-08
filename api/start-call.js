export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {const { phone, name, businessName, town, leadId } = req.body || {};
    const formattedPhone = phone ? (phone.startsWith("+") ? phone : "+1" + phone.replace(/\D/g, "")) : "";

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: formattedPhone,
          name: name || businessName || "Prospect",
        },
        assistantOverrides: {
         variableValues: {
  prospectName: name || "",
  businessName: businessName || "",
  town: town || "",
  leadId: leadId || "",
},
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to start call" });
  }
}
