-- ============================================================
-- K-Glow AI Search — Supabase Schema
-- ============================================================
-- 이 파일을 Supabase SQL Editor에서 실행하면
-- 테이블, 인덱스, RLS 정책, 트리거가 모두 생성됩니다.
-- 실행 순서: 위에서 아래로 순차 실행
-- ============================================================

-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for embeddings


-- ============================================================
-- 1. user_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS '사용자 프로필 (auth.users 1:1)';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles: users can read own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "user_profiles: users can update own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles: service can insert"
  ON public.user_profiles FOR INSERT
  WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. user_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_type             text,            -- 건성 | 지성 | 복합 | 민감
  tone                  text,            -- 웜 | 쿨 | 뉴트럴 | 모름
  concerns              text[] NOT NULL DEFAULT '{}',
  fragrance_free        boolean NOT NULL DEFAULT false,
  exclude_ingredients   text[] NOT NULL DEFAULT '{}',
  budget_band           text,            -- 1-3만 | 3-5만 | 5만+
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS '사용자 피부 조건 / 선호도 (1:1)';

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences: users can read own"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences: users can insert own"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences: users can update own"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create empty preferences on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_preferences();


-- ============================================================
-- 3. products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                      text PRIMARY KEY,  -- e.g. 'p001'
  name                    text NOT NULL,
  brand                   text NOT NULL,
  category                text NOT NULL,     -- skincare | base | lip | eye | suncare
  price_band              text NOT NULL,     -- 1-3만 | 3-5만 | 5만+
  finish                  text,              -- 글로우 | 새틴 | 크리미 | 매트
  tone_fit                text NOT NULL DEFAULT 'any',  -- any | warm | cool | neutral
  tags                    text[] NOT NULL DEFAULT '{}',
  ingredients_top         text[] NOT NULL DEFAULT '{}',
  ingredients_caution     text[] NOT NULL DEFAULT '{}',
  ingredients_full        text[] NOT NULL DEFAULT '{}',
  texture_desc            text,
  explain_short           text,
  explain_detail_points   text[] NOT NULL DEFAULT '{}',
  image_url               text,
  similar_ids             text[] NOT NULL DEFAULT '{}',
  embedding               vector(1536),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS '제품 카탈로그 (+ pgvector 임베딩)';

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_products_embedding
  ON public.products
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products (category);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public read for everyone
CREATE POLICY "products: public read"
  ON public.products FOR SELECT
  USING (true);

-- Only service_role can write (admin)
CREATE POLICY "products: service write"
  ON public.products FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 4. saved_products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

COMMENT ON TABLE public.saved_products IS '사용자별 제품 저장 (찜)';

CREATE INDEX IF NOT EXISTS idx_saved_products_user
  ON public.saved_products (user_id);

ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_products: users can read own"
  ON public.saved_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_products: users can insert own"
  ON public.saved_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_products: users can delete own"
  ON public.saved_products FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- 5. search_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.search_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable for anon
  query         text NOT NULL,
  result_count  int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.search_logs IS '검색 이력 로그';

CREATE INDEX IF NOT EXISTS idx_search_logs_user_created
  ON public.search_logs (user_id, created_at DESC);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own logs
CREATE POLICY "search_logs: users can read own"
  ON public.search_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone (including anon) can insert
CREATE POLICY "search_logs: anyone can insert"
  ON public.search_logs FOR INSERT
  WITH CHECK (true);


-- ============================================================
-- 6. reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query                    text,
  title                    text NOT NULL,
  summary                  text,
  routine_am               text[] NOT NULL DEFAULT '{}',
  routine_pm               text[] NOT NULL DEFAULT '{}',
  reasoning                text[] NOT NULL DEFAULT '{}',
  warnings                 text[] NOT NULL DEFAULT '{}',
  alternative_product_ids  text[] NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reports IS 'AI 루틴 리포트';

CREATE INDEX IF NOT EXISTS idx_reports_user_created
  ON public.reports (user_id, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can only read their own reports
CREATE POLICY "reports: users can read own"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role (Edge Functions) can create reports
CREATE POLICY "reports: service can insert"
  ON public.reports FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 7. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id       uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  amount          int NOT NULL,               -- 금액 (원), e.g. 4900
  status          text NOT NULL DEFAULT 'pending',  -- pending | completed | failed | refunded
  payment_method  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payments IS '결제 이력';

CREATE INDEX IF NOT EXISTS idx_payments_user
  ON public.payments (user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can only read their own payments
CREATE POLICY "payments: users can read own"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role can create/update payments
CREATE POLICY "payments: service can insert"
  ON public.payments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payments: service can update"
  ON public.payments FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 8. example_chips  (홈 화면 예시 칩)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.example_chips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  query       text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.example_chips IS '홈 화면 예시 검색 칩';

ALTER TABLE public.example_chips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "example_chips: public read"
  ON public.example_chips FOR SELECT
  USING (true);

CREATE POLICY "example_chips: service write"
  ON public.example_chips FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 9. example_sentences  (홈 화면 예시 문장)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.example_sentences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text,            -- emoji
  text        text NOT NULL,
  query       text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.example_sentences IS '홈 화면 "이렇게도 검색해 보세요" 문장';

ALTER TABLE public.example_sentences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "example_sentences: public read"
  ON public.example_sentences FOR SELECT
  USING (true);

CREATE POLICY "example_sentences: service write"
  ON public.example_sentences FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 10. trend_tags  (홈 화면 트렌드 태그)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trend_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  query       text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.trend_tags IS '홈 화면 "지금 뜨는 키워드" 태그';

ALTER TABLE public.trend_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trend_tags: public read"
  ON public.trend_tags FOR SELECT
  USING (true);

CREATE POLICY "trend_tags: service write"
  ON public.trend_tags FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 11. updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables that have updated_at
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'user_profiles',
      'user_preferences',
      'products',
      'payments'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 12. Seed Data — 홈 화면 컨텐츠
-- ============================================================

-- Example Chips
INSERT INTO public.example_chips (label, query, sort_order) VALUES
  ('글로우 피부', '글로우 피부', 1),
  ('무향 스킨케어', '무향 스킨케어', 2),
  ('진정 앰플', '진정 앰플', 3),
  ('쿨톤 쿠션', '쿨톤 쿠션', 4),
  ('립 틴트', '립 틴트', 5),
  ('수분 크림', '수분 크림', 6)
ON CONFLICT DO NOTHING;

-- Example Sentences
INSERT INTO public.example_sentences (icon, text, query, sort_order) VALUES
  ('💧', '민감 피부인데 수분 세럼 추천해줘', '민감 피부 수분 세럼', 1),
  ('✨', '글로우 메이크업 베이스 뭐가 좋아?', '글로우 메이크업 베이스', 2),
  ('🌿', '자극 없는 순한 클렌저 찾아줘', '순한 저자극 클렌저', 3),
  ('🧴', '지성 피부 여름 선크림 추천', '지성 피부 여름 선크림', 4)
ON CONFLICT DO NOTHING;

-- Trend Tags
INSERT INTO public.trend_tags (label, query, sort_order) VALUES
  ('글로우 세럼', '글로우 세럼', 1),
  ('쿨톤 쿠션', '쿨톤 쿠션', 2),
  ('진정 크림', '진정 크림', 3),
  ('선크림 SPF50', '선크림 SPF50', 4),
  ('비타민C 앰플', '비타민C 앰플', 5)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Done!
-- ============================================================
