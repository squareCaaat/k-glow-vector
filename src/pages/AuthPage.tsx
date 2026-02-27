import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const VISUAL_PLACEHOLDER_STYLE = {
    background: "linear-gradient(135deg, hsl(var(--primary)/0.2) 0%, hsl(var(--secondary)/0.5) 100%)",
};

const INTENT_MESSAGES: Record<string, string> = {
    save: "제품을 저장하려면 로그인이 필요합니다",
    buy_report: "프리미엄 리포트를 구매하려면 로그인이 필요합니다",
};

const BENEFITS = [
    "저장 기능으로 마음에 드는 제품 관리",
    "내 조건 저장으로 추천 정확도 향상",
    "AI 루틴 리포트 구매 및 조회",
];

export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();

    const next = searchParams.get("next") ?? "/";
    const intent = searchParams.get("intent") ?? "";

    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [signupSuccess, setSignupSuccess] = useState(false);

    useEffect(() => {
        if (isLoggedIn) navigate(decodeURIComponent(next), { replace: true });
    }, [isLoggedIn, navigate, next]);

    const handleGoogleAuth = async () => {
        setError("");
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}${decodeURIComponent(next)}` },
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("이메일과 비밀번호를 입력해주세요");
            return;
        }
        if (password.length < 6) {
            setError("비밀번호는 6자 이상이어야 합니다");
            return;
        }

        setLoading(true);
        setError("");

        if (mode === "login") {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name: name || undefined } },
            });
            if (error) {
                setError(error.message);
                setLoading(false);
            } else {
                setLoading(false);
                setSignupSuccess(true);
            }
        }
    };

    const intentMessage = intent ? INTENT_MESSAGES[intent] : null;

    if (signupSuccess) {
        return (
            <div className="flex-1 flex items-center justify-center py-12 px-4 h-full min-h-[70vh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4 max-w-md w-full bg-card p-8 rounded-2xl border border-border shadow-sm"
                >
                    <div className="text-4xl mb-4">📧</div>
                    <h2 className="text-xl font-bold text-foreground">이메일을 확인해주세요</h2>
                    <p className="text-muted-foreground whitespace-pre-line">
                        {`${email}으로 인증 메일을 보냈습니다.\n메일의 링크를 클릭하면 가입이 완료됩니다.`}
                    </p>
                    <div className="pt-4">
                        <Button
                            variant="outline"
                            className="w-full rounded-full h-11"
                            onClick={() => {
                                setSignupSuccess(false);
                                setMode("login");
                                setPassword("");
                            }}
                        >
                            로그인으로 돌아가기
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center py-12 px-4 h-full min-h-[80vh]">
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">

                <div className="hidden md:flex flex-col space-y-8 pr-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-48 h-48 rounded-3xl flex items-center justify-center shadow-inner drop-shadow-xl" style={VISUAL_PLACEHOLDER_STYLE}>
                            <span className="text-5xl font-extrabold text-white opacity-80 mix-blend-overlay">K-Glow</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground">
                            <span className="font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mr-1">K-Glow</span>
                            와 함께
                        </h2>
                        <ul className="space-y-3">
                            {BENEFITS.map((benefit, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-foreground/80 font-medium tracking-wide">
                                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {intentMessage && (
                        <div className="pt-4 border-t border-border/50">
                            <p className="text-sm font-bold text-primary px-4 border-l-2 border-primary">
                                {intentMessage}
                            </p>
                        </div>
                    )}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-sm"
                >
                    <div className="mb-8 text-center md:text-left">
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            {mode === "login" ? "로그인" : "회원가입"}
                        </h1>
                        <p className="text-sm text-muted-foreground md:hidden">
                            <span className="font-bold text-primary">K-Glow</span>에 오신 것을 환영합니다
                        </p>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-5">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-xl h-12 shadow-sm relative font-medium border-border/60 hover:bg-muted/50"
                            onClick={handleGoogleAuth}
                            disabled={loading}
                        >
                            <GoogleSvg className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2" />
                            Google로 {mode === "login" ? "로그인" : "가입"}
                        </Button>

                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px bg-border flex-1" />
                            <span className="text-xs font-medium text-muted-foreground">또는</span>
                            <div className="h-px bg-border flex-1" />
                        </div>

                        <div className="space-y-3">
                            {mode === "signup" && (
                                <div>
                                    <input
                                        type="text"
                                        disabled={loading}
                                        placeholder="이름 (선택)"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded-xl border border-border bg-background px-4 py-3 sm:py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                    />
                                </div>
                            )}
                            <div>
                                <input
                                    type="email"
                                    disabled={loading}
                                    placeholder="이메일"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                    className="w-full rounded-xl border border-border bg-background px-4 py-3 sm:py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    disabled={loading}
                                    placeholder="비밀번호"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                    className="w-full rounded-xl border border-border bg-background px-4 py-3 sm:py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm font-medium text-destructive text-center select-none animate-in fade-in slide-in-from-top-1">
                                {error}
                            </p>
                        )}

                        <Button
                            type="submit"
                            variant="default"
                            disabled={loading}
                            className="w-full rounded-xl h-12 sm:h-14 font-extrabold text-base glow-shadow border-none text-primary-foreground mt-2"
                        >
                            {loading ? "처리 중..." : (mode === "login" ? "로그인" : "회원가입")}
                        </Button>

                        <div className="pt-4 text-center">
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                    setMode(mode === "login" ? "signup" : "login");
                                    setError("");
                                }}
                                className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                {mode === "login" ? (
                                    <>계정이 없으신가요?  <span className="text-primary font-bold">회원가입</span></>
                                ) : (
                                    <>이미 계정이 있으신가요?  <span className="text-primary font-bold">로그인</span></>
                                )}
                            </button>
                        </div>

                    </form>
                </motion.div>
            </div>
        </div>
    );
}

function GoogleSvg({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}
