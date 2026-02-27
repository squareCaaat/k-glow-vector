import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATCH_THRESHOLD = 0.2;
const MATCH_COUNT = 30;
const EMBEDDING_DIM = 384;
const EMBEDDING_MODEL = "gte-small";

type ProductFilters = {
  category?: string;
  price_band?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, filters } = (await req.json()) as {
      query?: string;
      filters?: ProductFilters;
    };

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // @ts-ignore - Supabase Edge Runtime 내장 AI 세션
    const session = new Supabase.ai.Session(EMBEDDING_MODEL);
    const queryEmbedding = await session.run(query, {
      mean_pool: true,
      normalize: true,
    });

    const { data: matches, error: rpcError } = await supabase.rpc("match_products", {
      query_embedding: Array.from(queryEmbedding),
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
    });

    if (rpcError) {
      throw rpcError;
    }

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          intent_summary: `"${query}"에 대한 검색 결과가 없습니다.`,
          results: [],
          search_meta: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const matchedIds = matches.map((m: { id: string }) => m.id);

    let dbQuery = supabase
      .from("products")
      .select(
        "id, name, brand, category, price_band, finish, tone_fit, tags, ingredients_top, ingredients_caution, texture_desc, explain_short, explain_detail_points, image_url, similar_ids",
      )
      .in("id", matchedIds);

    if (filters?.category) {
      dbQuery = dbQuery.eq("category", filters.category);
    }
    if (filters?.price_band) {
      dbQuery = dbQuery.eq("price_band", filters.price_band);
    }

    const { data: fullRows, error: fetchError } = await dbQuery;
    if (fetchError) {
      throw fetchError;
    }

    const simMap: Record<string, number> = {};
    for (const match of matches as Array<{ id: string; similarity: number }>) {
      simMap[match.id] = match.similarity;
    }

    const results = (fullRows || [])
      .map((row) => ({
        ...row,
        similarity: simMap[row.id] || 0,
        similarity_score: simMap[row.id] || 0,
      }))
      .sort((a, b) => b.similarity_score - a.similarity_score);

    const similarities = results.map((r) => r.similarity_score);
    const searchMeta = {
      model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
      match_threshold: MATCH_THRESHOLD,
      candidates_found: matches.length,
      results_after_filter: results.length,
      top_similarity: similarities.length > 0 ? Math.round(Math.max(...similarities) * 1000) / 1000 : 0,
      avg_similarity:
        similarities.length > 0
          ? Math.round((similarities.reduce((a, b) => a + b, 0) / similarities.length) * 1000) / 1000
          : 0,
    };

    return new Response(
      JSON.stringify({
        intent_summary: `"${query}" 검색으로 ${results.length}개 결과를 찾았습니다.`,
        results,
        search_meta: searchMeta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ai-search error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
