import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = DEFAULT_BATCH_SIZE } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count: totalRemaining } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    const { data: rows, error: fetchError } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, price_band, finish, tone_fit, tags, ingredients_top, ingredients_caution, texture_desc, explain_short, explain_detail_points",
      )
      .is("embedding", null)
      .limit(batch_size);

    if (fetchError) {
      throw fetchError;
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "All records embedded", count: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // @ts-ignore - Supabase Edge Runtime 내장 AI 세션
    const session = new Supabase.ai.Session("gte-small");

    let updated = 0;
    for (const row of rows) {
      const embeddingText = [
        row.name,
        row.brand,
        row.category,
        row.price_band,
        row.finish,
        row.tone_fit,
        ...(row.tags || []),
        ...(row.ingredients_top || []),
        ...(row.ingredients_caution || []),
        row.texture_desc || "",
        row.explain_short || "",
        ...(row.explain_detail_points || []),
      ]
        .filter(Boolean)
        .join(" ");

      const embedding = await session.run(embeddingText, {
        mean_pool: true,
        normalize: true,
      });

      const { error: updateError } = await supabase
        .from("products")
        .update({
          embedding: Array.from(embedding),
          embedding_text: embeddingText,
        })
        .eq("id", row.id);

      if (!updateError) {
        updated += 1;
      }
    }

    return new Response(
      JSON.stringify({
        count: updated,
        remaining: Math.max((totalRemaining || 0) - updated, 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
