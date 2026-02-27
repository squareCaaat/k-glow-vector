import { supabase } from "./supabase";

const SEARCH_TIMEOUT_MS = 15000;
const SEARCH_EDGE_FN = "ai-search";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SearchResponse {
  results: Product[];
  intent_summary?: string;
  search_meta?: unknown;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_band: string;
  finish: string;
  tone_fit: string;
  tags: string[];
  ingredients_top: string[];
  ingredients_caution: string[];
  texture_desc: string;
  explain_short: string;
  explain_detail_points: string[];
  image_url: string;
  similar_ids: string[];
  similarity_score: number;
}

// 기존 키워드 검색 로직은 변경 없이 유지한다.
async function searchProductsKeyword(query: string): Promise<SearchResponse> {
  const { data, error } = await supabase.rpc("search_products", { search_query: query });

  if (!error && data && data.length > 0) {
    return { results: data as Product[] };
  }

  // RPC가 없거나 실패한 경우에도 키워드 조건으로 2차 폴백을 시도한다.
  const keyword = query.trim();
  if (keyword) {
    const ilike = `%${keyword}%`;
    const { data: keywordProducts, error: keywordError } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, price_band, finish, tone_fit, tags, ingredients_top, ingredients_caution, texture_desc, explain_short, explain_detail_points, image_url, similar_ids"
      )
      .or(
        [
          `name.ilike.${ilike}`,
          `brand.ilike.${ilike}`,
          `category.ilike.${ilike}`,
          `price_band.ilike.${ilike}`,
          `texture_desc.ilike.${ilike}`,
          `explain_short.ilike.${ilike}`,
        ].join(",")
      )
      .limit(30);

    if (!keywordError && keywordProducts && keywordProducts.length > 0) {
      const results = keywordProducts.map((product) => ({
        ...product,
        similarity_score: 0.8,
      })) as Product[];

      return { results };
    }
  }

  {
    const { data: allProducts } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, price_band, finish, tone_fit, tags, ingredients_top, ingredients_caution, texture_desc, explain_short, explain_detail_points, image_url, similar_ids"
      );

    const results = (allProducts || []).map((product) => ({
      ...product,
      similarity_score: 0.8,
    })) as Product[];

    return { results };
  }
}

async function searchProductsAI(query: string, filters?: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${SEARCH_EDGE_FN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ query, filters }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI search failed: ${response.status}`);
    }

    const payload = await response.json();
    return payload as {
      results?: Product[];
      intent_summary?: string;
      search_meta?: unknown;
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchProducts(query: string, filters?: Record<string, unknown>): Promise<SearchResponse> {
  try {
    const aiResult = await searchProductsAI(query, filters);
    if (aiResult.results && aiResult.results.length > 0) {
      return {
        results: aiResult.results,
        intent_summary: aiResult.intent_summary,
        search_meta: aiResult.search_meta,
      };
    }
  } catch (error) {
    console.warn("AI search failed, falling back to keyword search:", error);
  }

  return searchProductsKeyword(query);
}
