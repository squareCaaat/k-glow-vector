# BACKEND_DATA_IA — 페이지 라우터별 백엔드 데이터 요구사항

> **프로젝트**: K-Beauty Whisperer (K-Glow AI Search)
> **목적**: 프론트엔드 목업 기준, 각 페이지 라우터가 실제 백엔드(Supabase)와 연동될 때 필요한 CRUD 데이터를 정리한 IA(Information Architecture) 문서
> **참조**: `docs/front_mock/v1/mockup-prompt-route-*.md`

---

## 목차

1. [Route `/` — 홈](#1-route----홈)
2. [Route `/search?q=` — 검색 결과](#2-route-searchq--검색-결과)
3. [Route `/p/:productId` — 제품 상세](#3-route-pproductid--제품-상세)
4. [Route `/saved` — 저장한 제품](#4-route-saved--저장한-제품)
5. [Route `/account` — 계정 / 내 조건](#5-route-account--계정--내-조건)
6. [Route `/report/:reportId` — AI 루틴 리포트](#6-route-reportreportid--ai-루틴-리포트)
7. [Route `/auth` — 인증](#7-route-auth--인증)
8. [엔티티-라우트 CRUD 매트릭스](#8-엔티티-라우트-crud-매트릭스)

---

## 1. Route `/` — 홈

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/HomePage.tsx` |
| **접근 권한** | Public (비로그인 가능) |
| **조건부 UI** | 로그인 시 "최근 검색 로그" 섹션 추가 표시 |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 예시 칩 목록 | `id`, `label`, `query` | `example_chips` 또는 CMS/정적 | 홈 화면 상단 검색 유도 칩 |
| 예시 문장 목록 | `id`, `icon`, `text`, `query` | `example_sentences` 또는 CMS/정적 | "이렇게도 검색해 보세요" 섹션 |
| 트렌드 태그 | `id`, `label`, `query` | `trend_tags` 또는 CMS/정적 | "지금 뜨는 키워드" 섹션 |
| 최근 검색 로그 (로그인 시) | `query`, `created_at` | `search_logs` | `user_id` 필터, 최근 N건, 최신순 |

### CREATE (생성)

없음 (홈에서 직접 데이터 생성 없음, 검색 제출 시 `/search` 라우트로 이동)

### UPDATE (수정)

없음

### DELETE (삭제)

없음

---

## 2. Route `/search?q=` — 검색 결과

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/SearchPage.tsx` |
| **접근 권한** | Public |
| **필수 파라미터** | `?q=` (없으면 `/` redirect) |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| AI 검색 인사이트 (search_meta) | `model`, `embedding_dim`, `match_threshold`, `candidates_found`, `results_after_filter`, `top_similarity`, `avg_similarity`, `top_brands[]`, `top_tags[]`, `category_distribution{}` | Edge Function 응답 (벡터 검색) | AI가 실시간 생성하는 메타 정보 |
| 검색 결과 제품 목록 | `id`, `name`, `brand`, `category`, `price_band`, `finish`, `tone_fit`, `tags[]`, `ingredients_top[]`, `ingredients_caution[]`, `explain_short`, `image_url`, `similarity_score` | `products` + 벡터 검색 결과 | 임베딩 유사도 기반 정렬 |
| 카테고리 라벨 맵 | `skincare`, `base`, `lip`, `eye`, `suncare` → 한글 | 정적/Enum | 프론트 필터 UI용 |
| 사용자 저장 제품 ID 목록 | `product_id[]` | `saved_products` | 로그인 시, 하트 아이콘 활성 상태 표시용 |

### CREATE (생성)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 검색 로그 | `user_id`, `query`, `result_count`, `created_at` | `search_logs` | 검색 실행 시 자동 기록 |
| 결제 (루틴 리포트) | `user_id`, `report_id`, `amount`, `status`, `created_at` | `payments` | PaymentModal → 결제 완료 시 |
| 루틴 리포트 | `report_id`, `user_id`, `query`, `title`, `summary`, `routine_am[]`, `routine_pm[]`, `reasoning[]`, `warnings[]`, `alternatives[]`, `created_at` | `reports` | 결제 완료 후 AI가 생성 |

### UPDATE (수정)

| 데이터 | 액션 | 테이블 | 비고 |
|---|---|---|---|
| 제품 저장 토글 | INSERT 또는 DELETE | `saved_products` | 하트 버튼 클릭 시 |

### DELETE (삭제)

| 데이터 | 액션 | 테이블 | 비고 |
|---|---|---|---|
| 저장 해제 | DELETE row | `saved_products` | 하트 버튼 재클릭 시 |

---

## 3. Route `/p/:productId` — 제품 상세

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/ProductDetail.tsx` |
| **접근 권한** | Public |
| **필수 파라미터** | `:productId` |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 제품 상세 정보 | `id`, `name`, `brand`, `category`, `price_band`, `finish`, `tone_fit`, `tags[]`, `ingredients_top[]`, `ingredients_caution[]`, `ingredients_full[]`, `texture_desc`, `explain_short`, `explain_detail_points[]`, `image_url`, `similar_ids[]` | `products` | 단일 제품 조회 (`id` 매칭) |
| 유사 제품 목록 | `id`, `name`, `brand`, `image_url` | `products` | `similar_ids`로 IN 쿼리, 그리드 표시용 |
| 사용자 저장 여부 | `product_id` 존재 여부 | `saved_products` | 로그인 시, 하트 ♡/♥ 상태 결정 |
| 카테고리 라벨 맵 | 같은 정적 맵 | 정적/Enum | 뱃지 표시용 |

### CREATE (생성)

| 데이터 | 필드 | 테이블 | 비고 |
|---|---|---|---|
| 제품 저장 | `user_id`, `product_id`, `created_at` | `saved_products` | 하트 저장 시 (로그인 필수, 미로그인→`/auth`) |
| 결제 (루틴 리포트) | `user_id`, `report_id`, `amount`, `status`, `created_at` | `payments` | "리포트 만들기" CTA |
| 루틴 리포트 | (동일) | `reports` | 결제 후 AI 생성 |

### UPDATE (수정)

없음 (저장은 INSERT/DELETE 패턴)

### DELETE (삭제)

| 데이터 | 액션 | 테이블 | 비고 |
|---|---|---|---|
| 저장 해제 | DELETE row | `saved_products` | 하트 재클릭 |

---

## 4. Route `/saved` — 저장한 제품

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/SavedPage.tsx` |
| **접근 권한** | **Protected** (로그인 필수) |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 저장된 제품 목록 | `id`, `name`, `brand`, `category`, `price_band`, `finish`, `tone_fit`, `tags[]`, `ingredients_top[]`, `ingredients_caution[]`, `texture_desc`, `explain_short`, `image_url`, `similar_ids[]` | `saved_products` JOIN `products` | `user_id` 필터, 전체 목록 |

### CREATE (생성)

없음 (저장은 다른 페이지에서 수행)

### UPDATE (수정)

없음

### DELETE (삭제)

| 데이터 | 액션 | 테이블 | 비고 |
|---|---|---|---|
| 저장 해제 | DELETE row | `saved_products` | "저장 해제" 버튼 클릭 |

> **비교 모드**: 프론트엔드 전용 로직 (최대 3개 선택 → 테이블 비교). 백엔드 데이터 변경 없음.

---

## 5. Route `/account` — 계정 / 내 조건

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/AccountPage.tsx` |
| **접근 권한** | **Protected** (로그인 필수) |
| **탭 구조** | "내 조건" / "검색 로그" |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 사용자 선호도 (내 조건) | `skin_type`, `tone`, `concerns[]`, `fragrance_free`, `exclude_ingredients[]`, `budget_band` | `user_preferences` | `user_id` 단건 조회 |
| 선호도 옵션 목록 | `skinTypes[]`, `tones[]`, `concerns[]`, `excludeOpts[]`, `budgets[]` | 정적/Enum 또는 `preference_options` | 폼 칩 렌더링용 |
| 검색 로그 이력 | `query`, `created_at`, `result_count` | `search_logs` | `user_id` 필터, 최신순 |

### CREATE (생성)

| 데이터 | 필드 | 테이블 | 비고 |
|---|---|---|---|
| 선호도 초기 생성 | `user_id`, `skin_type`, `tone`, `concerns[]`, `fragrance_free`, `exclude_ingredients[]`, `budget_band` | `user_preferences` | 최초 저장 시 (UPSERT) |

### UPDATE (수정)

| 데이터 | 액션 | 테이블 | 비고 |
|---|---|---|---|
| 선호도 수정 | UPDATE (UPSERT) | `user_preferences` | "저장" 버튼 클릭 시 |
| 선호도 초기화 | UPDATE (모든 필드 빈값) | `user_preferences` | "초기화" 버튼 클릭 시 |

### DELETE (삭제)

없음 (초기화는 UPDATE, 검색 로그 삭제 UI 없음)

---

## 6. Route `/report/:reportId` — AI 루틴 리포트

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/ReportPage.tsx` |
| **접근 권한** | **Protected** (로그인 필수) |
| **필수 파라미터** | `:reportId` |
| **Fallback** | `"report-{timestamp}"` → `"default"` 리포트 매칭 |

### READ (조회)

| 데이터 | 필드 | 소스 테이블 (제안) | 비고 |
|---|---|---|---|
| 루틴 리포트 | `report_id`, `title`, `created_at`, `summary`, `routine_am[]`, `routine_pm[]`, `reasoning[]`, `warnings[]`, `alternatives[]` | `reports` | `report_id` 단건 조회, `user_id` 소유권 확인 |
| 대체 추천 제품 | `id`, `name`, `brand`, `image_url` | `products` | `alternatives[]` ID 배열로 IN 쿼리 |

### CREATE (생성)

없음 (리포트 생성은 `/search` 또는 `/p/:id`의 PaymentModal에서 트리거)

### UPDATE (수정)

없음

### DELETE (삭제)

없음

> **공유**: `navigator.clipboard.writeText(URL)` → 프론트 전용, 백엔드 불필요
> **PDF 다운로드**: 향후 Edge Function 또는 서버리스로 PDF 생성 필요 (V1에서는 toast 안내만)

---

## 7. Route `/auth` — 인증

| 항목 | 값 |
|---|---|
| **파일** | `src/pages/AuthPage.tsx` |
| **접근 권한** | Public |
| **파라미터** | `?next=`, `?intent=` |

### READ (조회)

| 데이터 | 필드 | 소스 | 비고 |
|---|---|---|---|
| intent 메시지 맵 | `save` → 메시지, `buy_report` → 메시지 | 정적/프론트 | CTA 맥락 안내문 |
| 가치 제안 목록 | `benefits[]` | 정적/프론트 | 좌측 패널 표시용 |

### CREATE (생성)

| 데이터 | 필드 | 테이블 / 서비스 | 비고 |
|---|---|---|---|
| 사용자 계정 (회원가입) | `email`, `password`, `name?` | Supabase Auth (`auth.users`) | `supabase.auth.signUp()` |
| 사용자 프로필 | `user_id`, `display_name`, `created_at` | `user_profiles` | 회원가입 후 트리거 또는 직접 INSERT |
| 사용자 선호도 초기값 | `user_id` + 빈 필드 | `user_preferences` | 가입 후 기본 레코드 생성 |

### UPDATE (수정)

| 데이터 | 액션 | 서비스 | 비고 |
|---|---|---|---|
| 로그인 세션 | session 갱신 | Supabase Auth | `supabase.auth.signInWithPassword()` 또는 `signInWithOAuth()` |

### DELETE (삭제)

없음

---

## 8. 엔티티-라우트 CRUD 매트릭스

각 엔티티(테이블)이 어떤 라우트에서 어떤 CRUD 작업으로 사용되는지 한 눈에 정리.

| 엔티티 (테이블) | `/` | `/search` | `/p/:id` | `/saved` | `/account` | `/report/:id` | `/auth` |
|---|---|---|---|---|---|---|---|
| **products** | — | **R** | **R** | **R** | — | **R** | — |
| **saved_products** | — | **C/D** | **C/D** | **R/D** | — | — | — |
| **search_logs** | **R** | **C** | — | — | **R** | — | — |
| **user_preferences** | — | — | — | — | **R/U** | — | **C** |
| **user_profiles** | — | — | — | — | — | — | **C** |
| **reports** | — | **C** | **C** | — | — | **R** | — |
| **payments** | — | **C** | **C** | — | — | — | — |
| **auth.users** | — | — | — | — | — | — | **C/U** |
| **example_chips** | **R** | — | — | — | — | — | — |
| **example_sentences** | **R** | — | — | — | — | — | — |
| **trend_tags** | **R** | — | — | — | — | — | — |

> **범례**: **R** = Read, **C** = Create, **U** = Update, **D** = Delete, **—** = 사용 안 함

---

## 참고: 주요 Supabase 테이블 후보 요약

| 테이블명 | 주요 역할 | RLS 정책 |
|---|---|---|
| `products` | 제품 카탈로그 (+ 임베딩 벡터) | Public Read, Admin Write |
| `saved_products` | 사용자별 제품 저장 | 본인만 CRUD |
| `search_logs` | 검색 이력 | 본인만 R/C |
| `user_preferences` | 피부 조건/선호도 | 본인만 R/U |
| `user_profiles` | 프로필 (display_name 등) | 본인만 R/U |
| `reports` | AI 루틴 리포트 | 본인만 R, 시스템 C |
| `payments` | 결제 이력 | 본인만 R, 시스템 C |
| `example_chips` | 홈 예시 칩 | Public Read, Admin Write |
| `example_sentences` | 홈 예시 문장 | Public Read, Admin Write |
| `trend_tags` | 홈 트렌드 태그 | Public Read, Admin Write |
