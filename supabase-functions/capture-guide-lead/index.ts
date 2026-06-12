import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GUIDES: Record<string, { bucket: string; path: string; filename: string }> = {
  "copper-dry-body-brushing": {
    bucket: "guides",
    path: "copper-dry-body-brushing",
    filename: "moleculla-copper-dry-body-brushing-guide.pdf",
  },
  "hormone-balance": {
    bucket: "guides",
    path: "hormone-balance",
    filename: "moleculla-hormone-balance-guide.pdf",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const guideSlug = String(body.guideSlug || "").trim();
    const sourceUrl = String(body.sourceUrl || "");
    const referrer = String(body.referrer || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guide = GUIDES[guideSlug];
    if (!guide) {
      return new Response(JSON.stringify({ error: "Unknown guide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("guide_leads").insert({
      email,
      guide_slug: guideSlug,
      source_url: sourceUrl,
      referrer,
    });

    if (insertError) {
      console.error("guide_leads insert error", insertError);
      return new Response(JSON.stringify({ error: "Could not save your email." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storagePath = `${guide.path}/${guide.filename}`;
    const { data: signedData, error: signedError } = await supabase.storage
      .from(guide.bucket)
      .createSignedUrl(storagePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("signed url error", signedError);
      return new Response(JSON.stringify({ guideUrl: null, email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ guideUrl: signedData.signedUrl, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("capture-guide-lead error", err);
    return new Response(JSON.stringify({ error: "Internal error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
