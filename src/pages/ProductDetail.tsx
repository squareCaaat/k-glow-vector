import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, Share2, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
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
    ingredients_full: string[];
    texture_desc: string;
    explain_short: string;
    explain_detail_points: string[];
    image_url: string;
    similar_ids: string[];
}

interface SimilarProduct {
    id: string;
    name: string;
    brand: string;
    image_url: string;
}

const categoryLabels: Record<string, string> = {
    skincare: "스킨케어",
    base: "베이스",
    lip: "립",
    eye: "아이",
    suncare: "선케어",
};

export default function ProductDetail() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();

    const [product, setProduct] = useState<Product | null>(null);
    const [similar, setSimilar] = useState<SimilarProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [showIngredients, setShowIngredients] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);

    useEffect(() => {
        if (!productId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        window.scrollTo(0, 0);

        const fetchProduct = async () => {
            const { data, error } = await supabase
                .from("products")
                .select("*")
                .eq("id", productId)
                .single();

            if (error || !data) {
                setProduct(null);
                setLoading(false);
                return;
            }

            setProduct(data);

            if (data.similar_ids && data.similar_ids.length > 0) {
                const { data: simData } = await supabase
                    .from("products")
                    .select("id, name, brand, image_url")
                    .in("id", data.similar_ids);
                if (simData) setSimilar(simData);
            }

            if (isLoggedIn && user) {
                const { data: savedData } = await supabase
                    .from("saved_products")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("product_id", productId)
                    .maybeSingle();
                setSaved(!!savedData);
            }

            setLoading(false);
        };

        fetchProduct();
    }, [productId, isLoggedIn, user]);

    const handleSaveToggle = async () => {
        if (!product) return;
        if (!isLoggedIn || !user) {
            navigate(`/auth?next=/p/${product.id}&intent=save`);
            return;
        }
        if (saved) {
            await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", product.id);
            setSaved(false);
        } else {
            await supabase.from("saved_products").insert({ user_id: user.id, product_id: product.id });
            setSaved(true);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("링크가 복사되었습니다.");
    };

    const handleOpenPayment = () => {
        if (!product) return;
        if (!isLoggedIn) {
            navigate(`/auth?next=/p/${product.id}&intent=buy_report`);
            return;
        }
        setPaymentOpen(true);
    };

    if (loading) {
        return (
            <Layout showSearch>
                <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="h-64 md:h-80 w-full bg-muted rounded-2xl"></div>
                    <div className="space-y-4">
                        <div className="h-8 w-2/3 bg-muted rounded"></div>
                        <div className="h-4 w-1/3 bg-muted rounded"></div>
                        <div className="h-32 w-full bg-muted rounded-xl"></div>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!product) {
        return (
            <Layout showSearch>
                <div className="py-16 text-center space-y-4">
                    <p className="text-xl text-muted-foreground">제품을 찾을 수 없습니다.</p>
                    <Button variant="outline" onClick={() => navigate("/")}>홈으로</Button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout showSearch>
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-10">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    뒤로가기
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row gap-6 md:gap-10 items-start"
                >
                    <div className="w-full md:w-80 shrink-0 aspect-square rounded-2xl overflow-hidden bg-secondary border border-border shadow-sm relative">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-primary">{product.brand}</p>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{product.name}</h1>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-xs px-3 py-1 bg-secondary rounded-full font-medium">{categoryLabels[product.category] || product.category}</span>
                            <span className="text-xs px-3 py-1 bg-secondary rounded-full font-medium">{product.price_band}</span>
                            {product.finish && <span className="text-xs px-3 py-1 border border-border rounded-full font-medium">{product.finish}</span>}
                            <span className="text-xs px-3 py-1 border border-border rounded-full font-medium">{product.tone_fit === 'any' ? '모든톤' : product.tone_fit}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border/50">
                            <Button
                                onClick={handleSaveToggle}
                                variant={saved ? "default" : "outline"}
                                className={`rounded-full shadow-sm px-6 h-12 flex-1 md:flex-none ${saved ? 'glow-shadow' : ''}`}
                            >
                                <Heart className={`w-5 h-5 mr-2 ${saved ? 'fill-current' : ''}`} />
                                {saved ? '저장됨' : '저장하기'}
                            </Button>
                            <Button
                                onClick={handleShare}
                                variant="outline"
                                className="rounded-full shadow-sm px-4 h-12 bg-background"
                            >
                                <Share2 className="w-5 h-5 mr-2" />
                                공유
                            </Button>
                        </div>
                    </div>
                </motion.div>

                <div className="rounded-2xl gradient-glow-subtle p-5 md:p-6 shadow-sm border border-primary/10">
                    <div className="flex items-center gap-2 text-primary font-bold mb-3">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="text-lg">AI 추천 근거</h2>
                    </div>
                    <div className="space-y-4 text-foreground/90">
                        <p className="text-lg font-medium leading-relaxed">
                            {product.explain_short}
                        </p>
                        {product.explain_detail_points.length > 0 && (
                            <ul className="space-y-2 mt-4 text-sm md:text-base">
                                {product.explain_detail_points.map((point, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">성분 분석</h2>
                        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground font-medium mb-1">핵심 성분</p>
                                <p className="text-foreground font-medium">{product.ingredients_top.join(", ")}</p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground font-medium mb-1">주의 성분</p>
                                <p className={`font-medium ${product.ingredients_caution.length > 0 ? 'text-destructive' : 'text-green-500'}`}>
                                    {product.ingredients_caution.length > 0 ? product.ingredients_caution.join(", ") : "주의 성분 없음"}
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => setShowIngredients(!showIngredients)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm font-medium"
                                >
                                    전체 성분 보기
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showIngredients ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showIngredients && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="p-4 mt-2 text-xs leading-relaxed text-muted-foreground bg-muted rounded-xl border border-border">
                                                {product.ingredients_full.length > 0
                                                    ? product.ingredients_full.join(", ")
                                                    : product.ingredients_top.join(", ")}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">사용감 및 제형</h2>
                        <div className="bg-card border border-border rounded-2xl p-5 h-full space-y-4">
                            <div className="flex flex-wrap gap-2 mb-4">
                                {product.tags.map((tag, i) => (
                                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground font-medium border border-border/50">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <p className="text-foreground/80 leading-relaxed text-sm md:text-base">
                                {product.texture_desc}
                            </p>
                        </div>
                    </div>
                </div>

                {similar.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-border">
                        <h2 className="text-xl font-bold">비슷한 추천 제품</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {similar.map(sim => (
                                <div
                                    key={sim.id}
                                    onClick={() => navigate(`/p/${sim.id}`)}
                                    className="bg-card border border-border p-3 rounded-2xl cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
                                >
                                    <div className="aspect-square rounded-xl bg-secondary mb-3 overflow-hidden">
                                        <img
                                            loading="lazy"
                                            src={sim.image_url}
                                            alt={sim.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-bold mb-0.5 truncate">{sim.brand}</p>
                                    <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight">{sim.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-12 gradient-glow p-8 md:p-10 rounded-3xl border border-pink-500/20 shadow-lg text-center relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-3xl rounded-full" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-pink-500/10 to-purple-500/10 blur-3xl rounded-full" />
                    <div className="relative z-10">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-background/50 backdrop-blur-md rounded-2xl mb-5 text-pink-500 border border-pink-500/20 shadow-inner">
                            <Sparkles className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-3 truncate">
                            '{product.name}' 포함 루틴 리포트 만들기
                        </h2>
                        <p className="text-base text-foreground/70 mb-8 max-w-lg mx-auto">
                            AI가 이 제품과 잘 맞는 AM/PM 스킨케어 루틴, 주의 조합, 대체 제품을 꼼꼼하게 분석해 드립니다.
                        </p>
                        <Button
                            className="rounded-full glow-shadow-lg bg-foreground text-background hover:bg-foreground/90 font-bold px-8 h-12 text-base w-full sm:w-auto"
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
