Supabase 벡터 시맨틱 검색 추가 구현 — 싱글턴 프롬프트

아래는 **"일반 검색이 이미 있는 Supabase 프로젝트에 벡터 시맨틱 검색을 추가하라"**는 범용 싱글턴 프롬프트입니다. 프로젝트명·테이블명·컬럼명만 치환하면 어떤 Supabase 프로젝트에서든 사용 가능합니다.

# Supabase 벡터 시맨틱 검색 추가 구현 — 싱글턴 프롬프트

────────────────────────────────────────────────────────
## 0. 중요 선언
────────────────────────────────────────────────────────

이 프로젝트에는 이미 키워드 기반 검색이 동작하고 있다.
여기에 **벡터 임베딩 기반 시맨틱 검색**을 추가한다.

외부 임베딩 API(OpenAI 등)는 사용하지 않는다.
Supabase 빌트인 AI(`Supabase.ai.Session`)와 `gte-small` 모델(384차원)만 사용한다.
추가 비용이 발생하는 외부 서비스를 연동하지 않는다.

────────────────────────────────────────────────────────
## 1. 전제 조건 — 치환 변수
────────────────────────────────────────────────────────

아래 변수를 자신의 프로젝트에 맞게 치환한다.

| 변수 | 설명 | 예시 |
|---|---|---|
| `{MAIN_TABLE}` | 검색 대상 메인 테이블 | `products` |
| `{MAIN_TABLE_ID}` | 메인 테이블 PK 컬럼 | `id` (uuid) |
| `{TEXT_COLUMNS}` | 임베딩에 포함할 텍스트 컬럼들 | `name, brand, category, description` |
| `{RELATED_TEXT_TABLES}` | 임베딩에 포함할 관련 테이블(태그 등) | `product_tags(tag)` |
| `{FILTER_COLUMNS}` | 검색 시 필터링할 컬럼들 | `category, price_band` |
| `{MATCH_THRESHOLD}` | 코사인 유사도 임계값 | `0.2` |
| `{MATCH_COUNT}` | 최대 반환 건수 | `30` |
| `{EMBEDDING_MODEL}` | Supabase 빌트인 모델 | `gte-small` |
| `{EMBEDDING_DIM}` | 벡터 차원 수 | `384` |
| `{BATCH_SIZE}` | 배치 임베딩 시 한번에 처리할 건수 | `5` |
| `{SEARCH_EDGE_FN}` | 검색 Edge Function 이름 | `ai-search` |
| `{EMBED_EDGE_FN}` | 임베딩 생성 Edge Function 이름 | `generate-embeddings` |
| `{SEARCH_TIMEOUT_MS}` | 프론트엔드 검색 타임아웃 | `15000` |

────────────────────────────────────────────────────────
## 2. 아키텍처 개요
────────────────────────────────────────────────────────

```text
┌─────────────────────────────────────────────────────────────┐
│                      프론트엔드                              │
│                                                             │
│  searchProducts(query, filters)                             │
│       │                                                     │
│       ├─► [1] AI 시맨틱 검색 시도 (fetch → Edge Function)    │
│       │       ├─ 성공 & 결과 > 0 → 반환                     │
│       │       └─ 실패 or 결과 = 0 ──┐                       │
│       │                             │                       │
│       └─► [2] 키워드 폴백 검색 ◄────┘                       │
│               (기존 검색 로직 그대로 유지)                     │
└───────────────┬─────────────────────────────────────────────┘
                │ fetch (POST, {SEARCH_TIMEOUT_MS}ms timeout)
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Function: {SEARCH_EDGE_FN}                │
│                                                             │
│  1. 쿼리 텍스트 → Supabase.ai.Session → 384d 벡터           │
│  2. supabase.rpc("match_{MAIN_TABLE}") → 유사도 순 후보      │
│  3. 후보 ID로 {MAIN_TABLE} + 관련 테이블 JOIN 조회           │
│  4. 서버사이드 필터 적용 (카테고리, 성분 등)                   │
│  5. search_meta 메타데이터 계산                              │
│  6. { intent_summary, results, search_meta } 반환            │
└───────────────┬─────────────────────────────────────────────┘
                │ rpc("match_{MAIN_TABLE}")
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                     │
│                                                             │
│  {MAIN_TABLE}                                               │
│    ├── ...기존 컬럼들...                                     │
│    ├── embedding_text  text        (임베딩 원본 텍스트)       │
│    └── embedding       vector(384) (벡터 데이터)             │
│                                                             │
│  FUNCTION match_{MAIN_TABLE}(                               │
│    query_embedding vector(384),                              │
│    match_threshold float,                                    │
│    match_count int                                          │
│  ) → TABLE(id, name, ..., similarity float)                 │
│    WHERE 1 - (embedding <=> query_embedding) > threshold     │
│    ORDER BY embedding <=> query_embedding                    │
│    LIMIT match_count                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Edge Function: {EMBED_EDGE_FN} (배치 유틸)           │
│                                                             │
│  1. embedding IS NULL인 레코드 {BATCH_SIZE}개 조회           │
│  2. {TEXT_COLUMNS} + {RELATED_TEXT_TABLES} 텍스트 결합       │
│  3. Supabase.ai.Session → 벡터 생성                         │
│  4. embedding, embedding_text 컬럼 UPDATE                   │
│  5. 반복 호출하여 전체 데이터 임베딩 완료                     │
└─────────────────────────────────────────────────────────────┘
```

────────────────────────────────────────────────────────
## 3. 단계별 구현 지시
────────────────────────────────────────────────────────

### STEP 1: 데이터베이스 마이그레이션

`{MAIN_TABLE}` 테이블에 벡터 컬럼을 추가하고 RPC 함수를 생성한다.

```sql
-- 1-1. 벡터 컬럼 추가
ALTER TABLE {MAIN_TABLE}
  ADD COLUMN IF NOT EXISTS embedding_text text,
  ADD COLUMN IF NOT EXISTS embedding extensions.vector({EMBEDDING_DIM});

-- 1-2. 벡터 인덱스 생성 (IVFFlat 또는 HNSW)
-- 데이터가 1만건 미만이면 순차 스캔도 충분하므로 생략 가능
-- CREATE INDEX idx_{MAIN_TABLE}_embedding
--   ON {MAIN_TABLE}
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- 1-3. 코사인 유사도 검색 RPC 함수
CREATE OR REPLACE FUNCTION match_{MAIN_TABLE}(
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT {MATCH_THRESHOLD},
  match_count integer DEFAULT {MATCH_COUNT}
)
RETURNS TABLE (
  {MAIN_TABLE_ID} uuid,
  -- 필요한 컬럼 추가 (name, brand 등)
  similarity double precision
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    t.{MAIN_TABLE_ID},
    -- 필요한 컬럼 추가
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM {MAIN_TABLE} t
  WHERE t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**핵심 포인트:**
- `<=>` 연산자: pgvector의 코사인 거리 연산자. 거리이므로 유사도는 `1 - distance`.
- `extensions.vector` 타입을 명시적으로 사용. Supabase는 pgvector를 extensions 스키마에 설치.
- `search_path`에 `'extensions'`를 포함해야 vector 타입을 인식.

────────────────────────────────────────────────────────

### STEP 2: 배치 임베딩 Edge Function (`{EMBED_EDGE_FN}`)

**파일:** `supabase/functions/{EMBED_EDGE_FN}/index.ts`

기능:
- `embedding IS NULL`인 레코드를 `{BATCH_SIZE}`개 가져온다.
- 각 레코드의 `{TEXT_COLUMNS}`와 `{RELATED_TEXT_TABLES}` 텍스트를 공백으로 결합하여 `embedding_text`를 만든다.
- `Supabase.ai.Session("{EMBEDDING_MODEL}")`로 벡터를 생성한다.
- `embedding`과 `embedding_text` 컬럼을 UPDATE한다.
- 응답: `{ count: 처리건수, remaining: 남은건수 }`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch_size = {BATCH_SIZE} } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 남은 건수 확인
    const { count: totalRemaining } = await supabase
      .from("{MAIN_TABLE}")
      .select("{MAIN_TABLE_ID}", { count: "exact", head: true })
      .is("embedding", null);

    // 임베딩 없는 레코드 조회
    const { data: rows, error } = await supabase
      .from("{MAIN_TABLE}")
      .select("{TEXT_COLUMNS}")  // 예: "id, name, brand, category, description"
      .is("embedding", null)
      .limit(batch_size);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "All records embedded", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 관련 테이블 데이터 조회 (태그 등)
    // const { data: relatedData } = await supabase
    //   .from("{RELATED_TEXT_TABLE}")
    //   .select("{RELATED_FK}, {RELATED_TEXT_COL}")
    //   .in("{RELATED_FK}", rows.map(r => r.id));

    // @ts-ignore - Supabase 빌트인 AI
    const session = new Supabase.ai.Session("{EMBEDDING_MODEL}");

    let updated = 0;
    for (const row of rows) {
      // 임베딩용 텍스트 결합
      // 모든 텍스트 필드를 공백으로 연결
      const embeddingText = [
        row.name,
        row.brand,
        row.category,
        // relatedTexts,  // 태그 등
        row.description || "",
      ].filter(Boolean).join(" ");

      const embedding = await session.run(embeddingText, {
        mean_pool: true,
        normalize: true,
      });

      const { error: updateError } = await supabase
        .from("{MAIN_TABLE}")
        .update({
          embedding: Array.from(embedding),
          embedding_text: embeddingText,
        })
        .eq("{MAIN_TABLE_ID}", row.id);

      if (!updateError) updated++;
    }

    return new Response(
      JSON.stringify({
        count: updated,
        remaining: (totalRemaining || 0) - updated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**사용법:**
```bash
# 전체 데이터 임베딩 (remaining이 0이 될 때까지 반복 호출)
curl -X POST https://{PROJECT_REF}.supabase.co/functions/v1/{EMBED_EDGE_FN} \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 5}'
```

**핵심 포인트:**
- `Supabase.ai.Session`은 Supabase Edge Runtime 빌트인. 별도 API 키 불필요.
- `mean_pool: true, normalize: true`는 gte-small 권장 설정.
- `Array.from(embedding)`: Float32Array를 일반 배열로 변환해야 Supabase에 저장 가능.
- 한 번에 너무 많이 처리하면 Edge Function 타임아웃(기본 60초). 5~10개씩 배치 권장.

────────────────────────────────────────────────────────

### STEP 3: 시맨틱 검색 Edge Function (`{SEARCH_EDGE_FN}`)

**파일:** `supabase/functions/{SEARCH_EDGE_FN}/index.ts`

기능:
1. 사용자 쿼리를 벡터로 변환
2. `match_{MAIN_TABLE}` RPC로 유사도 검색
3. 매칭된 ID로 전체 데이터 + 관련 테이블 JOIN 조회
4. 필터 적용
5. 검색 메타데이터 계산
6. 응답 반환

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, filters } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. 쿼리 → 벡터 변환 ──
    // @ts-ignore - Supabase 빌트인 AI
    const session = new Supabase.ai.Session("{EMBEDDING_MODEL}");
    const queryEmbedding = await session.run(query, {
      mean_pool: true,
      normalize: true,
    });

    // ── 2. 벡터 유사도 검색 (RPC) ──
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_{MAIN_TABLE}",
      {
        query_embedding: Array.from(queryEmbedding),
        match_threshold: {MATCH_THRESHOLD},
        match_count: {MATCH_COUNT},
      }
    );

    if (rpcError) throw rpcError;

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          intent_summary: `"${query}"에 대한 검색 결과가 없습니다.`,
          results: [],
          search_meta: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. 매칭 ID로 전체 데이터 조회 ──
    const matchedIds = matches.map((m: any) => m.id);
    let dbQuery = supabase
      .from("{MAIN_TABLE}")
      .select("*, {RELATED_TEXT_TABLES}")  // 예: "*, product_tags(*)"
      .in("{MAIN_TABLE_ID}", matchedIds);

    // DB 레벨 필터 적용
    // {FILTER_COLUMNS} 각각에 대해:
    // if (filters?.category) dbQuery = dbQuery.eq("category", filters.category);

    const { data: fullRows, error: fetchError } = await dbQuery;
    if (fetchError) throw fetchError;

    // ── 4. 유사도 순 정렬 + 클라이언트 필터 ──
    const simMap: Record = {};
    matches.forEach((m: any) => { simMap[m.id] = m.similarity; });

    let results = (fullRows || [])
      .map((row: any) => ({
        ...row,  // 또는 필요한 필드만 매핑
        similarity: simMap[row.id] || 0,
      }))
      .sort((a: any, b: any) => b.similarity - a.similarity);

    // 추가 클라이언트 사이드 필터 (예: 특정 성분 제외 등)
    // if (filters?.someFlag) {
    //   results = results.filter(r => ...);
    // }

    // ── 5. 검색 메타데이터 계산 ──
    const similarities = results.map((r: any) => r.similarity);
    const searchMeta = {
      model: "{EMBEDDING_MODEL}",
      embedding_dim: {EMBEDDING_DIM},
      match_threshold: {MATCH_THRESHOLD},
      candidates_found: matches.length,
      results_after_filter: results.length,
      top_similarity: similarities.length > 0
        ? Math.round(Math.max(...similarities) * 1000) / 1000
        : 0,
      avg_similarity: similarities.length > 0
        ? Math.round(
            (similarities.reduce((a: number, b: number) => a + b, 0) /
              similarities.length) *
              1000
          ) / 1000
        : 0,
    };

    // ── 6. 응답 ──
    return new Response(
      JSON.stringify({
        intent_summary: `"${query}" 검색으로 ${results.length}개 결과를 찾았습니다.`,
        results,
        search_meta: searchMeta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("{SEARCH_EDGE_FN} error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

────────────────────────────────────────────────────────

### STEP 4: Edge Function 설정

**파일:** `supabase/config.toml`에 추가

```toml
[functions.{SEARCH_EDGE_FN}]
verify_jwt = false

[functions.{EMBED_EDGE_FN}]
verify_jwt = false
```

`verify_jwt = false`로 설정하면 anon key만으로 호출 가능.
프로덕션에서는 `true`로 변경하고 Authorization 헤더에 유효한 JWT를 전달할 것.

────────────────────────────────────────────────────────

### STEP 5: 프론트엔드 통합

기존 `searchProducts()` 함수를 **수정하지 않고 감싸는** 하이브리드 패턴:

```typescript
// 기존 키워드 검색 함수는 그대로 유지
// async function searchProductsKeyword(q, filters) { ... }

// 새로 추가: AI 시맨틱 검색 시도
async function searchProductsAI(q: string, filters?: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    {SEARCH_TIMEOUT_MS}
  );

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/{SEARCH_EDGE_FN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ query: q, filters }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// 통합 검색 함수: AI 우선, 키워드 폴백
export async function searchProducts(q: string, filters?: any) {
  try {
    const aiResult = await searchProductsAI(q, filters);
    if (aiResult.results?.length > 0) {
      return {
        results: aiResult.results,
        intent_summary: aiResult.intent_summary,
        search_meta: aiResult.search_meta,
      };
    }
  } catch (err) {
    console.warn("AI search failed, falling back:", err);
  }

  // 폴백: 기존 키워드 검색
  return searchProductsKeyword(q, filters);
}
```

**핵심 포인트:**
- `AbortController`로 타임아웃 제어. AI 검색이 느리면 기존 검색으로 즉시 전환.
- `supabase.functions.invoke()` 대신 직접 `fetch` 사용. invoke는 타임아웃 제어가 어렵고, 응답 파싱 방식이 다름.
- 기존 키워드 검색 함수는 **절대 수정하지 않는다**. 폴백으로 항상 동작해야 함.

────────────────────────────────────────────────────────
## 4. 데이터 흐름 정리
────────────────────────────────────────────────────────

```text
[데이터 준비 단계 — 1회성]

  {MAIN_TABLE} 레코드 INSERT
       │
       ▼
  {EMBED_EDGE_FN} 호출 (반복)
       │
       ├─ SELECT ... WHERE embedding IS NULL LIMIT {BATCH_SIZE}
       ├─ 텍스트 컬럼 결합 → embedding_text
       ├─ Supabase.ai.Session("{EMBEDDING_MODEL}").run(embedding_text)
       ├─ UPDATE embedding = vector, embedding_text = text
       └─ remaining = 0이 될 때까지 반복

[검색 단계 — 매 요청]

  사용자 입력: "촉촉한 수분크림 추천해줘"
       │
       ▼
  프론트엔드 searchProducts()
       │
       ├─[시도 1] fetch → {SEARCH_EDGE_FN}
       │     │
       │     ├─ query → Supabase.ai → 384d 벡터
       │     ├─ rpc("match_{MAIN_TABLE}") → 유사도 순 ID 목록
       │     ├─ ID로 전체 데이터 조회 + 필터
       │     └─ 응답: { results, intent_summary, search_meta }
       │
       ├─[성공 & 결과 > 0] → UI 렌더링
       │
       └─[실패 or 결과 = 0]
             │
             └─[시도 2] searchProductsKeyword()
                   (기존 키워드 검색 — 변경 없음)
```

────────────────────────────────────────────────────────
## 5. 주의사항 및 트러블슈팅
────────────────────────────────────────────────────────

### 5-1. Supabase.ai.Session 관련
- `Supabase.ai.Session`은 **Edge Function 런타임 전용**. 브라우저/Node에서 사용 불가.
- `// @ts-ignore` 주석 필수. TypeScript 타입 정의가 없음.
- `mean_pool: true, normalize: true` 옵션은 gte-small 모델 권장값. 생략하면 결과 품질 저하.

### 5-2. vector 타입 관련
- `embedding` 컬럼 타입은 반드시 `extensions.vector({EMBEDDING_DIM})`.
- `vector`가 아니라 `extensions.vector`. Supabase는 pgvector를 extensions 스키마에 설치.
- RPC 함수의 `search_path`에 `'extensions'`를 반드시 포함.
- `<=>` 연산자는 **코사인 거리**(0~2). 유사도로 변환하려면 `1 - distance`.

### 5-3. 임베딩 텍스트 품질
- 임베딩 품질 = 검색 품질. `embedding_text`에 포함되는 정보가 중요.
- 권장 구성: `이름 + 브랜드 + 카테고리 + 태그 + 설명 + 특징`
- 불필요한 데이터(ID, URL, 날짜 등)는 제외.
- 한국어 텍스트도 gte-small이 지원하므로 번역 불필요.

### 5-4. 성능
- 레코드 1만건 미만: 인덱스 없이 순차 스캔으로 충분 (수십ms).
- 레코드 1만건 이상: IVFFlat 또는 HNSW 인덱스 추가 권장.
- Edge Function 콜드 스타트: 첫 요청 시 2~5초 지연. 이후 요청은 수백ms.
- 배치 임베딩: 1건당 약 200~500ms. 100건이면 약 1~2분.

### 5-5. 프론트엔드 타임아웃
- `AbortController`로 {SEARCH_TIMEOUT_MS}ms 타임아웃 설정.
- 타임아웃 시 기존 키워드 검색으로 자동 폴백.
- 사용자는 검색이 느려지는 것을 느끼지 못해야 함.

### 5-6. 흔한 에러와 해결

| 에러 | 원인 | 해결 |
|---|---|---|
| `Could not find function match_{MAIN_TABLE}` | RPC 함수 미생성 | SQL 마이그레이션 실행 |
| `expected {EMBEDDING_DIM} dimensions, not N` | 벡터 차원 불일치 | embedding 컬럼 타입과 모델 차원 확인 |
| `permission denied for table {MAIN_TABLE}` | RLS 정책 차단 | RLS 비활성화 또는 정책 추가 |
| Edge Function 타임아웃 | 배치 크기 과다 | batch_size를 5 이하로 줄임 |
| 검색 결과 0건 | threshold 너무 높음 | `{MATCH_THRESHOLD}`를 0.1~0.2로 낮춤 |
| `Supabase.ai is not defined` | 로컬 환경에서 실행 시도 | Edge Function은 Supabase 런타임에서만 동작 |

────────────────────────────────────────────────────────
## 6. 구현 순서 체크리스트
────────────────────────────────────────────────────────

□ 1. SQL 마이그레이션 실행 (embedding 컬럼 + RPC 함수)
□ 2. {EMBED_EDGE_FN} Edge Function 생성 및 배포
□ 3. {EMBED_EDGE_FN} 반복 호출하여 기존 데이터 전체 임베딩
□ 4. {SEARCH_EDGE_FN} Edge Function 생성 및 배포
□ 5. supabase/config.toml에 Edge Function 설정 추가
□ 6. 프론트엔드 searchProductsAI() 함수 추가
□ 7. 프론트엔드 searchProducts()에 하이브리드 로직 적용
□ 8. 검색 테스트 (AI 성공 케이스)
□ 9. 검색 테스트 (AI 실패 → 키워드 폴백 케이스)
□ 10. 검색 테스트 (타임아웃 → 폴백 케이스)
□ 11. 새 레코드 추가 시 임베딩 자동 생성 훅 검토 (선택)