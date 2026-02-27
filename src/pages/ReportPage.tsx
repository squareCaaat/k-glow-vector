import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Share2, FileText, Search, Sun, Moon } from "lucide-react";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

interface Report {
    id: string;
    title: string;
    created_at: string;
    summary: string;
    routine_am: string[];
    routine_pm: string[];
    reasoning: string[];
    warnings: string[];
    alternative_product_ids: string[];
}

interface AltProduct {
    id: string;
    name: string;
    brand: string;
    image_url: string;
}

export default function ReportPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [report, setReport] = useState<Report | null>(null);
    const [altProducts, setAltProducts] = useState<AltProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!reportId || !user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        window.scrollTo(0, 0);

        const fetchReport = async () => {
            // For demo: if no real report exists, insert a sample one
            let { data, error } = await supabase
                .from("reports")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!data) {
                // Insert a demo report for this user
                const { data: inserted } = await supabase
                    .from("reports")
                    .insert({
                        user_id: user.id,
                        query: "글로우 피부",
                        title: "글로우 피부 맞춤 K-뷰티 루틴 리포트",
                        summary: "지성·쿨톤 피부를 위한 글로우 중심 루틴입니다. 수분-광채 밸런스를 유지하면서도 과도한 유분을 제어하는 성분 조합으로 구성했습니다.",
                        routine_am: [
                            "1단계: 폼 클렌징 (저자극 계면활성제)",
                            "2단계: 토너 (히알루론산 함유)",
                            "3단계: 세럼 — 그린티 씨드 세럼 (이니스프리)",
                            "4단계: 가벼운 젤 수분크림",
                            "5단계: 선크림 SPF50+ PA++++",
                        ],
                        routine_pm: [
                            "1단계: 오일 클렌징",
                            "2단계: 폼 클렌징 (더블 클렌징)",
                            "3단계: 앰플 — 비타C 브라이트닝 앰플 (격일 사용)",
                            "4단계: 세럼 — 워터뱅크 히알루론 세럼 (라네즈)",
                            "5단계: 나이트 크림 (가벼운 텍스처)",
                        ],
                        reasoning: [
                            "히알루론산과 녹차 추출물은 수분 공급·진정 효과에서 시너지를 발휘합니다.",
                            "비타민C는 자외선에 불안정하므로 PM에만 사용해 산화를 방지합니다.",
                            "지성 피부에 과도한 오일 성분 대신 젤 타입 제형을 우선 선택했습니다.",
                            "쿨톤 피부에는 블루 히알루론 성분이 밝고 투명한 광채를 강조합니다.",
                        ],
                        warnings: [
                            "레티놀과 비타민C를 같은 날 함께 사용하면 자극이 생길 수 있습니다. 격일 사용을 권장합니다.",
                            "AHA/BHA 계열 성분과 레티놀 동시 사용은 피부 장벽 손상을 유발할 수 있습니다.",
                        ],
                        alternative_product_ids: ["p003", "p004", "p005"],
                    })
                    .select()
                    .single();

                data = inserted;
                error = null;
            }

            if (error || !data) {
                setReport(null);
                setLoading(false);
                return;
            }

            setReport(data);

            if (data.alternative_product_ids && data.alternative_product_ids.length > 0) {
                const { data: alts } = await supabase
                    .from("products")
                    .select("id, name, brand, image_url")
                    .in("id", data.alternative_product_ids);
                if (alts) setAltProducts(alts);
            }

            setLoading(false);
        };

        fetchReport();
    }, [reportId, user]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("링크가 복사되었습니다.", {
            position: "bottom-center",
            className: "rounded-full justify-center text-sm font-medium",
        });
    };

    const handleDownloadPdf = () => {
        toast.info("PDF 다운로드는 준비 중입니다.", {
            position: "bottom-center",
            className: "rounded-full justify-center text-sm font-medium",
        });
    };

    if (loading) {
        return (
            <Layout showSearch>
                <div className="max-w-3xl mx-auto py-8">
                    <div className="h-64 w-full bg-muted rounded-2xl animate-pulse" />
                </div>
            </Layout>
        );
    }

    if (!report) {
        return (
            <Layout showSearch>
                <div className="py-16 text-center space-y-4">
                    <p className="text-xl text-muted-foreground">리포트를 찾을 수 없습니다.</p>
                    <Button variant="outline" onClick={() => navigate("/")} className="rounded-full">홈으로</Button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout showSearch>
            <div className="max-w-3xl mx-auto py-6 space-y-8 animate-in fade-in duration-500 pb-12">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
                    <div className="space-y-2">
                        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight tracking-tight">
                            {report.title}
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            {new Date(report.created_at).toLocaleDateString("ko-KR", {
                                year: 'numeric', month: 'long', day: 'numeric'
                            })} 생성됨
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="rounded-full h-9" onClick={handleShare}>
                            <Share2 className="w-4 h-4 mr-1.5" />
                            공유
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full h-9" onClick={handleDownloadPdf}>
                            <FileText className="w-4 h-4 mr-1.5" />
                            PDF
                        </Button>
                        <Button variant="default" size="sm" className="rounded-full h-9 glow-shadow border-none text-primary-foreground font-bold" onClick={() => navigate("/")}>
                            <Search className="w-4 h-4 mr-1.5" />
                            새 검색
                        </Button>
                    </div>
                </div>

                <div className="gradient-glow-subtle p-6 rounded-2xl border border-primary/20 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <SparklesIcon className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                            요약
                        </h2>
                        <p className="text-foreground/90 leading-relaxed font-medium md:text-lg">
                            {report.summary}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <Sun className="w-6 h-6 text-accent" />
                            <h2 className="text-xl font-bold">AM 루틴</h2>
                        </div>
                        <ul className="space-y-4">
                            {report.routine_am.map((step, idx) => (
                                <li key={idx} className="flex gap-3 text-sm md:text-base">
                                    <span className="font-bold text-muted-foreground mt-0.5">{idx + 1}</span>
                                    <span className="text-foreground/90 leading-snug">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <Moon className="w-6 h-6 text-primary" />
                            <h2 className="text-xl font-bold">PM 루틴</h2>
                        </div>
                        <ul className="space-y-4">
                            {report.routine_pm.map((step, idx) => (
                                <li key={idx} className="flex gap-3 text-sm md:text-base">
                                    <span className="font-bold text-muted-foreground mt-0.5">{idx + 1}</span>
                                    <span className="text-foreground/90 leading-snug">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">조합 근거</h2>
                    <div className="bg-muted/30 p-5 rounded-2xl border border-border">
                        <ul className="space-y-3">
                            {report.reasoning.map((reason, idx) => (
                                <li key={idx} className="flex gap-3 text-sm md:text-base text-foreground/80">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <span className="leading-relaxed">{reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {report.warnings.length > 0 && (
                    <div className="space-y-4 pt-4">
                        <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
                            주의 조합
                        </h2>
                        <div className="border border-destructive/30 bg-destructive/5 p-5 rounded-2xl">
                            <ul className="space-y-3">
                                {report.warnings.map((warning, idx) => (
                                    <li key={idx} className="flex gap-3 text-sm md:text-base text-destructive/90 font-medium">
                                        <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                                        <span className="leading-relaxed">{warning}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {altProducts.length > 0 && (
                    <div className="space-y-4 pt-6 mt-6 border-t border-border">
                        <h2 className="text-xl font-bold">대체 추천 제품</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {altProducts.map(alt => (
                                <div
                                    key={alt.id}
                                    onClick={() => navigate(`/p/${alt.id}`)}
                                    className="bg-card border border-border p-3.5 rounded-2xl cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                                >
                                    <div className="aspect-square rounded-xl bg-secondary mb-3 overflow-hidden border border-border/50">
                                        <img
                                            loading="lazy"
                                            src={alt.image_url}
                                            alt={alt.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-bold mb-1 truncate">{alt.brand}</p>
                                    <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight">{alt.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            ></path>
        </svg>
    );
}
