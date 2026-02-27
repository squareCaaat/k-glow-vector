import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

interface UserPreferences {
    skin_type: string;
    tone: string;
    concerns: string[];
    fragrance_free: boolean;
    exclude_ingredients: string[];
    budget_band: string;
}

interface SearchLog {
    query: string;
    created_at: string;
    result_count: number;
}

const SKIN_TYPES = ["건성", "지성", "복합", "민감"];
const TONES = ["웜", "쿨", "뉴트럴", "모름"];
const CONCERNS = ["홍조", "트러블", "속건조", "모공", "각질", "잡티", "주름", "다크서클"];
const EXCLUDE_OPTS = ["향료", "에탄올", "실리콘", "파라벤"];
const BUDGETS = ["1-3만", "3-5만", "5만+"];

const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

const DEFAULT_PREFS: UserPreferences = {
    skin_type: "",
    tone: "",
    concerns: [],
    fragrance_free: false,
    exclude_ingredients: [],
    budget_band: "",
};

export default function AccountPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState<"prefs" | "logs">("prefs");
    const [prefs, setPrefs] = useState<UserPreferences | null>(null);
    const [logs, setLogs] = useState<SearchLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
            setLoading(true);
            const [prefsRes, logsRes] = await Promise.all([
                supabase
                    .from("user_preferences")
                    .select("skin_type, tone, concerns, fragrance_free, exclude_ingredients, budget_band")
                    .eq("user_id", user.id)
                    .maybeSingle(),
                supabase
                    .from("search_logs")
                    .select("query, created_at, result_count")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(20),
            ]);

            if (prefsRes.data) {
                setPrefs({
                    skin_type: prefsRes.data.skin_type || "",
                    tone: prefsRes.data.tone || "",
                    concerns: prefsRes.data.concerns || [],
                    fragrance_free: prefsRes.data.fragrance_free || false,
                    exclude_ingredients: prefsRes.data.exclude_ingredients || [],
                    budget_band: prefsRes.data.budget_band || "",
                });
            } else {
                setPrefs({ ...DEFAULT_PREFS });
            }

            if (logsRes.data) setLogs(logsRes.data);
            setLoading(false);
        };
        fetchData();
    }, [user]);

    const handleSave = async () => {
        if (!user || !prefs) return;
        const { error } = await supabase
            .from("user_preferences")
            .upsert({
                user_id: user.id,
                skin_type: prefs.skin_type || null,
                tone: prefs.tone || null,
                concerns: prefs.concerns,
                fragrance_free: prefs.fragrance_free,
                exclude_ingredients: prefs.exclude_ingredients,
                budget_band: prefs.budget_band || null,
            }, { onConflict: "user_id" });

        if (error) {
            toast.error("저장 실패: " + error.message);
        } else {
            toast.success("조건이 저장되었습니다", {
                position: "bottom-center",
                className: "rounded-full justify-center text-sm font-medium",
            });
        }
    };

    const handleReset = () => {
        setPrefs({ ...DEFAULT_PREFS });
    };

    const handleRerunSearch = (query: string) => {
        navigate(`/search?q=${encodeURIComponent(query)}`);
    };

    if (loading || !prefs) {
        return (
            <Layout showSearch>
                <div className="max-w-2xl mx-auto py-6 space-y-6">
                    <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-[500px] w-full bg-muted rounded-2xl animate-pulse" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout showSearch>
            <div className="max-w-2xl mx-auto py-6 space-y-6 animate-in fade-in duration-500 pb-12">

                <h1 className="text-2xl font-bold text-foreground">계정</h1>

                <div className="bg-muted p-1 rounded-xl w-fit flex gap-1">
                    <button
                        onClick={() => setTab("prefs")}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tab === "prefs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                        내 조건
                    </button>
                    <button
                        onClick={() => setTab("logs")}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tab === "logs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                        검색 로그
                    </button>
                </div>

                {tab === "prefs" && (
                    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-8 shadow-sm">

                        <div className="space-y-3">
                            <label className="text-base font-bold text-foreground block">피부 타입</label>
                            <div className="flex flex-wrap gap-2">
                                {SKIN_TYPES.map(t => (
                                    <Button
                                        key={t}
                                        variant={prefs.skin_type === t ? "default" : "outline"}
                                        className="rounded-full shadow-sm"
                                        onClick={() => setPrefs({ ...prefs, skin_type: prefs.skin_type === t ? "" : t })}
                                    >
                                        {t}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-base font-bold text-foreground block">톤</label>
                            <div className="flex flex-wrap gap-2">
                                {TONES.map(t => (
                                    <Button
                                        key={t}
                                        variant={prefs.tone === t ? "default" : "outline"}
                                        className="rounded-full shadow-sm"
                                        onClick={() => setPrefs({ ...prefs, tone: prefs.tone === t ? "" : t })}
                                    >
                                        {t}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-base font-bold text-foreground flex items-center justify-between">
                                피부 고민 <span className="text-xs font-normal text-muted-foreground">복수 선택 가능</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {CONCERNS.map(c => (
                                    <Button
                                        key={c}
                                        variant={prefs.concerns.includes(c) ? "default" : "outline"}
                                        className={`rounded-full shadow-sm ${!prefs.concerns.includes(c) ? 'text-muted-foreground' : ''}`}
                                        onClick={() => setPrefs({ ...prefs, concerns: toggleArray(prefs.concerns, c) })}
                                    >
                                        {c}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-border pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-base font-bold text-foreground block">무향 선호</label>
                                    <p className="text-xs text-muted-foreground mt-0.5">향료가 포함되지 않은 제품만 추천받습니다.</p>
                                </div>
                                <button
                                    onClick={() => setPrefs({ ...prefs, fragrance_free: !prefs.fragrance_free })}
                                    className={`relative w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ${prefs.fragrance_free ? 'bg-primary' : 'bg-muted border border-border'}`}
                                >
                                    <span className={`absolute left-0.5 w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${prefs.fragrance_free ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="text-base font-bold text-foreground flex items-center justify-between">
                                제외 성분 <span className="text-xs font-normal text-muted-foreground">복수 선택 가능</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {EXCLUDE_OPTS.map(e => (
                                    <Button
                                        key={e}
                                        variant={prefs.exclude_ingredients.includes(e) ? "destructive" : "outline"}
                                        className={`rounded-full shadow-sm ${!prefs.exclude_ingredients.includes(e) ? 'text-muted-foreground hover:text-destructive' : 'bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20'}`}
                                        onClick={() => setPrefs({ ...prefs, exclude_ingredients: toggleArray(prefs.exclude_ingredients, e) })}
                                    >
                                        {e}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <label className="text-base font-bold text-foreground block">선호 예산</label>
                            <div className="flex flex-wrap gap-2">
                                {BUDGETS.map(b => (
                                    <Button
                                        key={b}
                                        variant={prefs.budget_band === b ? "default" : "outline"}
                                        className="rounded-full shadow-sm"
                                        onClick={() => setPrefs({ ...prefs, budget_band: prefs.budget_band === b ? "" : b })}
                                    >
                                        {b}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-8 border-t border-border mt-8">
                            <Button
                                variant="outline"
                                className="rounded-full flex-1 md:flex-none border-border"
                                onClick={handleReset}
                            >
                                초기화
                            </Button>
                            <Button
                                variant="default"
                                className="rounded-full flex-1 font-bold glow-shadow border-none text-primary-foreground"
                                onClick={handleSave}
                            >
                                조건 변경 저장
                            </Button>
                        </div>

                    </div>
                )}

                {tab === "logs" && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground font-medium">
                                검색 기록이 없습니다
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {logs.map((log, i) => (
                                    <li key={i} className="p-4 md:p-5 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                                        <div className="min-w-0 pr-4">
                                            <p className="font-bold text-foreground text-sm md:text-base truncate mb-1">"{log.query}"</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(log.created_at).toLocaleDateString("ko-KR")} · {log.result_count}개 결과
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-primary text-xs font-bold rounded-full hover:bg-primary/10 transition-colors shrink-0"
                                            onClick={() => handleRerunSearch(log.query)}
                                        >
                                            다시 보기
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

            </div>
        </Layout>
    );
}
