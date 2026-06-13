export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    const webhookUrl = context.env.GHL_WEBHOOK_URL;

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing GHL_WEBHOOK_URL" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!payload.email || !payload.first_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const ghlPayload = {
      first_name: payload.first_name,
      email: payload.email,

      main_path: payload.main_path,
      secondary_path: payload.secondary_path,
      support_path: payload.support_path,

      diagnosis_title: payload.diagnosis_title,
      diagnosis_summary: payload.diagnosis_summary,
      suggested_options: Array.isArray(payload.suggested_options)
        ? payload.suggested_options.join("\n")
        : payload.suggested_options,

      what_to_avoid: payload.what_to_avoid,
      next_step: payload.next_step,
      pitch_angle: payload.pitch_angle,

      scores: JSON.stringify(payload.scores || {}),
      selected_answers: JSON.stringify(payload.selected_answers || []),
      avoided_options: JSON.stringify(payload.avoided_options || []),

      tags: Array.isArray(payload.tags)
        ? payload.tags.join(",")
        : payload.tags
    };

    const ghlResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(ghlPayload)
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();

      return new Response(
        JSON.stringify({
          success: false,
          error: "GoHighLevel webhook failed",
          details: errorText
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid request",
        details: error.message
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
