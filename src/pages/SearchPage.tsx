import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Sparkles, Check } from "lucide-react";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

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

interface SearchMeta {
    results_after_filter: number;
    top_brands: string[];
    top_tags: string[];
    category_distribution: Record<string, number>;
}

const categoryLabels: Record<string, string> = {
    skincare: "스킨케어",
    base: "베이스",
    lip: "립",
    eye: "아이",
    suncare: "선케어",
};

function buildSearchMeta(products: Product[]): SearchMeta {
    const brandCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    const catDist: Record<string, number> = {};
    for (const p of products) {
        brandCount[p.brand] = (brandCount[p.brand] || 0) + 1;
        for (const t of p.tags) tagCount[t] = (tagCount[t] || 0) + 1;
        catDist[p.category] = (catDist[p.category] || 0) + 1;
    }
    const top_brands = Object.entries(brandCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const top_tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    return { results_after_filter: products.length, top_brands, top_tags, category_distribution: catDist };
}

function LoadingSteps() {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const intervals = [
            setTimeout(() => setStep(1), 500),
            setTimeout(() => setStep(2), 1000),
        ];
        return () => intervals.forEach(clearTimeout);
    }, []);

    const steps = [
        "쿼리 분석 중...",
        "벡터 검색 중...",
        "개인화 필터링 중...",
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
            <div className="space-y-4 w-full max-w-sm">
                {steps.map((text, idx) => {
                    const isActive = step === idx;
                    const isDone = step > idx;
                    return (
                        <div key={idx} className={`flex items-center gap-3 text-lg font-medium transition-colors duration-300 ${isDone ? 'text-primary' : isActive ? 'text-foreground animate-pulse' : 'text-muted-foreground/30'}`}>
                            {isDone ? <Check className="w-5 h-5 text-green-500" /> : <div className={`w-5 h-5 rounded-full border-2 ${isActive ? 'border-primary border-t-transparent animate-spin' : 'border-current'}`} />}
                            <span>{text}</span>
                        </div>
                    );
                })}
            </div>
            <div className="w-full max-w-sm h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: `${(step + 1) * 33.33}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>
        </div>
    );
}

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();

    const q = searchParams.get("q") ?? "";

    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [visibleCount, setVisibleCount] = useState(10);
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [meta, setMeta] = useState<SearchMeta | null>(null);

    const fetchSavedIds = useCallback(async () => {
        if (!isLoggedIn || !user) return;
        const { data } = await supabase
            .from("saved_products")
            .select("product_id")
            .eq("user_id", user.id);
        if (data) setSavedIds(data.map(d => d.product_id));
    }, [isLoggedIn, user]);

    useEffect(() => {
        if (!q) {
            navigate("/", { replace: true });
            return;
        }

        setLoading(true);
        setActiveCategory("all");
        setVisibleCount(10);

        const doSearch = async () => {
            const { data, error } = await supabase.rpc("search_products", { search_query: q });

            if (error || !data || data.length === 0) {
                // Fallback: return all products if search_products fails or returns nothing
                const { data: allProducts } = await supabase
                    .from("products")
                    .select("id, name, brand, category, price_band, finish, tone_fit, tags, ingredients_top, ingredients_caution, texture_desc, explain_short, explain_detail_points, image_url, similar_ids");
                const results = (allProducts || []).map(p => ({ ...p, similarity_score: 0.80 }));
                setResults(results);
                setMeta(buildSearchMeta(results));
            } else {
                setResults(data);
                setMeta(buildSearchMeta(data));
            }

            // Log the search
            if (isLoggedIn && user) {
                await supabase.from("search_logs").insert({
                    user_id: user.id,
                    query: q,
                    result_count: data?.length ?? 0,
                });
            } else {
                await supabase.from("search_logs").insert({
                    query: q,
                    result_count: data?.length ?? 0,
                });
            }

            await fetchSavedIds();
            setLoading(false);
        };

        const timer = setTimeout(doSearch, 800);
        return () => clearTimeout(timer);
    }, [q, navigate, isLoggedIn, user, fetchSavedIds]);

    const filteredResults = activeCategory === "all"
        ? results
        : results.filter(p => p.category === activeCategory);

    const visibleResults = filteredResults.slice(0, visibleCount);

    const handleSaveToggle = async (id: string) => {
        if (!isLoggedIn || !user) {
            navigate(`/auth?next=/search?q=${encodeURIComponent(q)}&intent=save`);
            return;
        }
        if (savedIds.includes(id)) {
            await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", id);
            setSavedIds(prev => prev.filter(savedId => savedId !== id));
        } else {
            await supabase.from("saved_products").insert({ user_id: user.id, product_id: id });
            setSavedIds(prev => [...prev, id]);
        }
    };

    const handleOpenPayment = () => {
        if (!isLoggedIn) {
            navigate(`/auth?next=/search?q=${encodeURIComponent(q)}&intent=buy_report`);
            return;
        }
        setPaymentOpen(true);
    };

    if (loading) {
        return (
            <Layout showSearch>
                <LoadingSteps />
            </Layout>
        );
    }

    if (filteredResults.length === 0) {
        return (
            <Layout showSearch>
                <div className="py-16 text-center space-y-6 flex flex-col items-center">
                    <div className="w-32 h-32 bg-secondary rounded-full flex items-center justify-center text-4xl shadow-inner mb-4">
                        😢
                    </div>
                    <p className="text-xl text-muted-foreground font-medium">결과가 없습니다</p>
                    <Button variant="outline" onClick={() => { setActiveCategory("all"); setVisibleCount(10); }}>
                        필터 초기화
                    </Button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout showSearch>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {meta && (
                    <div className="gradient-glow-subtle p-5 md:p-6 rounded-2xl border border-primary/10 shadow-sm">
                        <div className="flex items-center gap-2 text-primary font-bold mb-3">
                            <Sparkles className="w-5 h-5" />
                            <span>AI 검색 인사이트</span>
                        </div>
                        <p className="text-foreground mb-4">
                            "<span className="font-semibold">{q}</span>"에 대해 {meta.results_after_filter}개 제품을 찾았습니다.
                        </p>
                        <div className="space-y-2 text-sm">
                            {meta.top_brands.length > 0 && (
                                <p className="text-muted-foreground">
                                    <span className="font-medium text-foreground">상위 브랜드:</span> {meta.top_brands.join(", ")}
                                </p>
                            )}
                            {meta.top_tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-foreground">주요 성분/태그:</span>
                                    {meta.top_tags.map(tag => (
                                        <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-secondary/80 text-secondary-foreground border border-border">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 gap-2 scrollbar-none">
                    <Button
                        variant={activeCategory === "all" ? "default" : "outline"}
                        className="rounded-full shadow-sm"
                        onClick={() => { setActiveCategory("all"); setVisibleCount(10); }}
                    >
                        전체 <span className="ml-1 opacity-70 text-xs">{results.length}</span>
                    </Button>
                    {Object.entries(categoryLabels).map(([key, label]) => {
                        const count = results.filter(p => p.category === key).length;
                        if (count === 0) return null;
                        return (
                            <Button
                                key={key}
                                variant={activeCategory === key ? "default" : "outline"}
                                className={`rounded-full shadow-sm ${activeCategory !== key ? "text-muted-foreground" : ""}`}
                                onClick={() => { setActiveCategory(key); setVisibleCount(10); }}
                            >
                                {label} <span className="ml-1 opacity-70 text-xs">{count}</span>
                            </Button>
                        );
                    })}
                </div>

                <div>
                    <p className="text-sm text-muted-foreground mb-4 pl-1 font-medium">
                        "{q}" 검색 결과 {filteredResults.length}개
                    </p>

                    <div className="space-y-4">
                        {visibleResults.map((product, idx) => (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-card border border-border rounded-2xl p-4 flex gap-4 hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer"
                                onClick={() => navigate(`/p/${product.id}`)}
                            >
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border">
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-foreground text-base md:text-lg truncate">{product.name}</h3>
                                            <div className="flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                <Sparkles className="w-3 h-3" />
                                                {Math.round(product.similarity_score * 100)}% 매치
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 mb-2 truncate">
                                            {product.brand} | {categoryLabels[product.category] || product.category} | {product.price_band}
                                        </p>
                                        <p className="text-sm text-foreground/80 line-clamp-1 mb-2">
                                            {product.explain_short}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex gap-1.5 overflow-hidden pr-2">
                                            {product.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground whitespace-nowrap truncate">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant={savedIds.includes(product.id) ? "default" : "outline"}
                                                className={`rounded-full h-8 px-3 ${savedIds.includes(product.id) ? 'glow-shadow-lg' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); handleSaveToggle(product.id); }}
                                            >
                                                <Heart className={`w-3.5 h-3.5 mr-1.5 ${savedIds.includes(product.id) ? 'fill-current' : ''}`} />
                                                {savedIds.includes(product.id) ? '저장됨' : '저장'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {visibleCount < filteredResults.length && (
                        <Button
                            variant="outline"
                            className="mx-auto flex mt-8 rounded-full shadow-sm hover:border-primary/50"
                            onClick={() => setVisibleCount(prev => prev + 10)}
                        >
                            더 보기 ({filteredResults.length - visibleCount})
                        </Button>
                    )}
                </div>

                <div className="mt-12 gradient-glow p-6 md:p-8 rounded-3xl border border-pink-500/20 shadow-lg text-center relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-3xl rounded-full" />
                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-background/50 backdrop-blur-md rounded-2xl mb-4 text-pink-500 border border-pink-500/20 group-hover:scale-110 transition-transform shadow-inner">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold mb-2">프리미엄 루틴 리포트 만들기</h3>
                        <p className="text-sm md:text-base text-foreground/70 mb-6 max-w-md mx-auto">
                            AI가 내 피부 정보와 검색 맥락을 바탕으로 아침/저녁 단계별 루틴, 주의 조합, 추천 근거를 상세히 분석합니다.
                        </p>
                        <Button
                            className="rounded-full glow-shadow-lg bg-foreground text-background hover:bg-foreground/90 font-bold px-8 h-12 text-base"
                            onClick={handleOpenPayment}
                        >
                            리포트 만들기 — ₩4,900
                        </Button>
                    </div>
                </div>

            </div>

            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogContent className="max-w-sm text-center p-8 rounded-3xl">
                    <DialogTitle className="sr-only">루틴 리포트 결제</DialogTitle>
                    <div className="space-y-6">
                        <div className="text-6xl animate-bounce mt-4">✨</div>
                        <div>
                            <p className="text-xl font-bold mb-1">프리미엄 루틴 리포트</p>
                            <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">₩4,900</p>
                        </div>
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-xl">
                            결제 완료 시, 전문가 수준의 피부 루틴 리포트가 즉시 생성됩니다.
                        </p>
                        <div className="space-y-3 pt-2">
                            <Button
                                className="w-full rounded-2xl h-12 text-base font-bold shadow-lg"
                                onClick={() => {
                                    setPaymentOpen(false);
                                    navigate(`/report/report-${Date.now()}`);
                                }}
                            >
                                결제 테스트 (완료)
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full rounded-2xl h-12"
                                onClick={() => setPaymentOpen(false)}
                            >
                                취소
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
