export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const message = req.body?.message;

    // Vapi sends several webhook event types.
    // We only update the tracker after the call has ended.
    if (!message || message.type !== "end-of-call-report") {
      return res.status(200).json({ received: true });
    }

    const variables =
      message.call?.assistantOverrides?.variableValues ||
      message.artifact?.variableValues ||
      {};

    const leadId = variables.leadId;

    if (!leadId) {
      console.log("No leadId found in Vapi webhook");
      return res.status(200).json({
        received: true,
        updated: false,
        reason: "No leadId",
      });
    }

    // Look through Vapi's messages for a successful Google Calendar event.
    const messages =
      message.artifact?.messages ||
      message.messages ||
      [];

    let appointment = null;

    for (const item of messages) {
      if (
        item?.role === "tool_call_result" &&
        item?.name === "google_calendar_tool" &&
        item?.result
      ) {
        try {
          const result =
            typeof item.result === "string"
              ? JSON.parse(item.result)
              : item.result;

          if (result?.status === "confirmed") {
            appointment = result;
            break;
          }
        } catch (error) {
          console.error("Could not parse calendar result:", error);
        }
      }
    }

    // If no appointment was actually created, leave the lead alone.
    if (!appointment) {
      return res.status(200).json({
        received: true,
        updated: false,
        reason: "No confirmed appointment",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase server environment variables are missing");
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // Get the lead first so we also have its user_id, kind and name.
    const leadResponse = await fetch(
      `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=id,user_id,kind,name`,
      { headers }
    );

    if (!leadResponse.ok) {
      throw new Error(`Unable to load lead: ${await leadResponse.text()}`);
    }

    const leads = await leadResponse.json();
    const lead = leads[0];

    if (!lead) {
      return res.status(200).json({
        received: true,
        updated: false,
        reason: "Lead not found",
      });
    }

    // Update the lead to Appointment.
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "Appointment",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Unable to update lead: ${await updateResponse.text()}`);
    }

    const start =
      appointment.start?.dateTime ||
      appointment.startDateTime ||
      "";

    const end =
      appointment.end?.dateTime ||
      appointment.endDateTime ||
      "";

    const appointmentNotes = [
      "Appointment booked by AI",
      appointment.summary ? `Calendar: ${appointment.summary}` : "",
      start ? `Start: ${start}` : "",
      end ? `End: ${end}` : "",
      appointment.id ? `Calendar event ID: ${appointment.id}` : "",
      message.call?.id ? `Vapi call ID: ${message.call.id}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Add the appointment to the activity history.
    const activityResponse = await fetch(
      `${supabaseUrl}/rest/v1/activities`,
      {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: lead.user_id,
          lead_id: lead.id,
          kind: lead.kind,
          name: lead.name,
          status: "Appointment",
          notes: appointmentNotes,
          happened_at: message.endedAt || new Date().toISOString(),
          follow_up_at: start || null,
        }),
      }
    );

    if (!activityResponse.ok) {
      throw new Error(
        `Unable to create activity: ${await activityResponse.text()}`
      );
    }

    console.log(`Lead ${leadId} updated to Appointment`);

    return res.status(200).json({
      received: true,
      updated: true,
      leadId,
      status: "Appointment",
    });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
