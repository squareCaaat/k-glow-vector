import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, GitCompare, Heart, ArrowRight } from "lucide-react";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
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
    image_url: string;
    similar_ids: string[];
}

const categoryLabels: Record<string, string> = {
    skincare: "스킨케어",
    base: "베이스",
    lip: "립",
    eye: "아이",
    suncare: "선케어",
};

export default function SavedPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [compareOpen, setCompareOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchSaved = async () => {
            setLoading(true);
            const { data } = await supabase
                .from("saved_products")
                .select("product_id, products(*)")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (data) {
                const mapped = data
                    .map((row: any) => row.products)
                    .filter(Boolean) as Product[];
                setProducts(mapped);
            }
            setLoading(false);
        };
        fetchSaved();
    }, [user]);

    const handleToggleCompareMode = () => {
        if (compareMode) {
            setCompareMode(false);
            setSelected([]);
        } else {
            setCompareMode(true);
        }
    };

    const handleSelectForCompare = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (selected.includes(id)) {
            setSelected(prev => prev.filter(s => s !== id));
        } else {
            if (selected.length < 3) {
                setSelected(prev => [...prev, id]);
            }
        }
    };

    const handleUnsave = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", id);
        setProducts(prev => prev.filter(p => p.id !== id));
        if (selected.includes(id)) {
            setSelected(prev => prev.filter(s => s !== id));
        }
    };

    const selectedProducts = products.filter(p => selected.includes(p.id));

    if (loading) {
        return (
            <Layout showSearch>
                <div className="max-w-4xl mx-auto space-y-4 py-6">
                    <div className="h-8 w-32 bg-muted rounded animate-pulse mb-8" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
                    ))}
                </div>
            </Layout>
        );
    }

    if (products.length === 0) {
        return (
            <Layout showSearch>
                <div className="py-20 text-center space-y-6 flex flex-col items-center animate-in fade-in duration-700">
                    <div className="w-32 h-32 bg-secondary rounded-full flex items-center justify-center text-4xl shadow-inner mb-2 border border-border">
                        <Heart className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="text-xl text-muted-foreground font-medium">저장한 제품이 없습니다</p>
                    <Button
                        variant="default"
                        className="rounded-full px-8 h-12 shadow-lg glow-shadow border-none"
                        onClick={() => navigate("/")}
                    >
                        <Search className="w-5 h-5 mr-2" />
                        검색하러 가기
                    </Button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout showSearch>
            <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        저장한 제품 <span className="text-primary text-xl ml-1">{products.length}</span>
                    </h1>
                    <Button
                        variant={compareMode ? "default" : "outline"}
                        size="sm"
                        className="rounded-full shadow-sm"
                        onClick={handleToggleCompareMode}
                    >
                        <GitCompare className="w-4 h-4 mr-2" />
                        {compareMode ? '비교 모드 끄기' : '비교 모드'}
                    </Button>
                </div>

                {compareMode && selected.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-glow-subtle p-4 rounded-xl border border-primary/20 flex items-center justify-between shadow-sm sticky top-20 z-10 backdrop-blur-md"
                    >
                        <p className="font-bold text-primary flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">{selected.length}</span>
                            / 3 선택됨
                        </p>
                        <Button
                            variant="default"
                            size="sm"
                            className="rounded-full px-6 shadow-md glow-shadow border-none"
                            disabled={selected.length < 2}
                            onClick={() => setCompareOpen(true)}
                        >
                            <GitCompare className="w-4 h-4 mr-2" />
                            비교 보기
                        </Button>
                    </motion.div>
                )}

                <div className="space-y-4">
                    {products.map((product, idx) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => compareMode ? handleSelectForCompare(product.id, { stopPropagation: () => { } } as any) : navigate(`/p/${product.id}`)}
                            className={`bg-card border ${selected.includes(product.id) ? 'border-primary ring-1 ring-primary/30' : 'border-border'} rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group`}
                        >
                            {compareMode && (
                                <div className="shrink-0 pl-2">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selected.includes(product.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 group-hover:border-primary/50'}`}>
                                        {selected.includes(product.id) && <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                </div>
                            )}

                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border">
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                <div>
                                    <h3 className="font-bold text-foreground text-base md:text-lg truncate group-hover:text-primary transition-colors">{product.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5 mb-2 truncate">
                                        {product.brand} | {categoryLabels[product.category]} | {product.price_band}
                                    </p>
                                    <p className="text-sm text-foreground/80 line-clamp-1 mb-2 hidden sm:block">
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

                                    {!compareMode && (
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="rounded-full h-8 px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                                                onClick={(e) => handleUnsave(product.id, e)}
                                            >
                                                <Heart className="w-3.5 h-3.5 mr-1.5 fill-current opacity-70" />
                                                저장 해제
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="rounded-full h-8 px-3 shrink-0 group/btn"
                                                onClick={(e) => { e.stopPropagation(); navigate(`/p/${product.id}`); }}
                                            >
                                                상세 보기
                                                <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover/btn:translate-x-0.5 transition-transform" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                    <DialogContent className="max-w-3xl rounded-3xl p-6 md:p-8">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <GitCompare className="w-6 h-6 text-primary" />
                                제품 비교
                            </DialogTitle>
                        </DialogHeader>

                        <div className="overflow-x-auto rounded-xl border border-border">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-24 md:w-32 py-4 font-bold">속성</TableHead>
                                        {selectedProducts.map(p => (
                                            <TableHead key={p.id} className="min-w-[150px] font-bold text-foreground">
                                                <div className="flex flex-col items-center text-center space-y-2">
                                                    <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-lg object-cover border border-border" />
                                                    <span className="line-clamp-2 leading-tight">{p.name}</span>
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">브랜드</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id} className="font-semibold">{p.brand}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">카테고리</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id}>{categoryLabels[p.category]}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">가격대</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id}>{p.price_band}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">피니시</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id}>{p.finish}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">톤핏</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id}>{p.tone_fit}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">핵심 성분</TableCell>
                                        {selectedProducts.map(p => <TableCell key={p.id}>{p.ingredients_top.slice(0, 3).join(", ")}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">주의 성분</TableCell>
                                        {selectedProducts.map(p => (
                                            <TableCell key={p.id} className={p.ingredients_caution.length > 0 ? "text-destructive font-medium" : "text-green-500 font-medium"}>
                                                {p.ingredients_caution.length > 0 ? p.ingredients_caution.join(", ") : "없음"}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-muted-foreground">주요 태그</TableCell>
                                        {selectedProducts.map(p => (
                                            <TableCell key={p.id}>
                                                <div className="flex flex-wrap gap-1">
                                                    {p.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-secondary rounded-full">{tag}</span>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button onClick={() => setCompareOpen(false)} className="rounded-full px-8 py-6 text-base font-bold shadow-md w-full sm:w-auto">
                                닫기
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </Layout>
    );
}
