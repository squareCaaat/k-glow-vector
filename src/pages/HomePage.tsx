import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase";

interface ExampleChip {
    id: string;
    label: string;
    query: string;
}

interface ExampleSentence {
    id: string;
    icon: string | null;
    text: string;
    query: string;
}

interface TrendTag {
    id: string;
    label: string;
    query: string;
}

interface RecentSearch {
    query: string;
    created_at: string;
}

export default function HomePage() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const { isLoggedIn, user } = useAuth();

    const [chips, setChips] = useState<ExampleChip[]>([]);
    const [sentences, setSentences] = useState<ExampleSentence[]>([]);
    const [trendTags, setTrendTags] = useState<TrendTag[]>([]);
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

    useEffect(() => {
        const fetchHomeData = async () => {
            const [chipsRes, sentencesRes, tagsRes] = await Promise.all([
                supabase.from("example_chips").select("id, label, query").eq("is_active", true).order("sort_order"),
                supabase.from("example_sentences").select("id, icon, text, query").eq("is_active", true).order("sort_order"),
                supabase.from("trend_tags").select("id, label, query").eq("is_active", true).order("sort_order"),
            ]);
            if (chipsRes.data) setChips(chipsRes.data);
            if (sentencesRes.data) setSentences(sentencesRes.data);
            if (tagsRes.data) setTrendTags(tagsRes.data);
        };
        fetchHomeData();
    }, []);

    useEffect(() => {
        if (!isLoggedIn || !user) return;
        const fetchRecent = async () => {
            const { data } = await supabase
                .from("search_logs")
                .select("query, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(5);
            if (data) setRecentSearches(data);
        };
        fetchRecent();
    }, [isLoggedIn, user]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim().length >= 2) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
        }
    };

    return (
        <Layout>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
                <div className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
                        <span className="gradient-text">K-Glow AI Search</span>
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground">
                        원하는 무드 · 피부 상태를 자연어로 입력하세요
                    </p>
                </div>

                <form onSubmit={handleSearch} className="w-full max-w-2xl relative mb-12">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-focus-within:bg-primary/30 transition-all duration-300" />
                        <div className="relative flex items-center bg-background border-2 border-border focus-within:border-primary/50 rounded-full overflow-hidden shadow-lg pl-6 pr-2 py-2">
                            <Search className="w-6 h-6 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="검색어를 입력하세요..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-lg"
                            />
                            <Button type="submit" size="icon" className="rounded-full w-12 h-12 glow-shadow shrink-0 ml-2">
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </form>

                <div className="flex flex-wrap justify-center gap-3 w-full max-w-3xl mb-12">
                    {chips.map((chip) => (
                        <motion.button
                            key={chip.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/search?q=${encodeURIComponent(chip.query)}`)}
                            className="px-5 py-2 rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
                        >
                            {chip.label}
                        </motion.button>
                    ))}
                </div>

                {sentences.length > 0 && (
                    <div className="w-full max-w-2xl text-left bg-card/50 glass border border-border rounded-2xl p-6 mb-12">
                        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
                            <span className="text-xl">💬</span> 이렇게도 검색해 보세요
                        </div>
                        <div className="flex flex-col gap-3">
                            {sentences.map((sentence) => (
                                <motion.button
                                    key={sentence.id}
                                    whileHover={{ x: 4 }}
                                    onClick={() => navigate(`/search?q=${encodeURIComponent(sentence.query)}`)}
                                    className="group flex items-center justify-between w-full p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors text-left text-sm md:text-base"
                                >
                                    <span className="text-foreground/80 group-hover:text-foreground transition-colors">
                                        {sentence.icon && <span className="mr-2">{sentence.icon}</span>}
                                        "{sentence.text}"
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </motion.button>
                            ))}
                        </div>
                    </div>
                )}

                {isLoggedIn && recentSearches.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-full max-w-2xl text-left mb-12"
                    >
                        <h3 className="text-sm font-semibold mb-4 text-muted-foreground border-b border-border pb-2">최근 검색</h3>
                        <div className="flex flex-col gap-2">
                            {recentSearches.map((search, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-accent/50 rounded-lg transition-colors group">
                                    <span className="text-foreground line-clamp-1">"{search.query}"</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                        onClick={() => navigate(`/search?q=${encodeURIComponent(search.query)}`)}
                                    >
                                        다시 보기
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {trendTags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 text-xs font-medium text-primary/60">
                        <span className="text-muted-foreground">인기:</span>
                        {trendTags.map((tag) => (
                            <span key={tag.id}>#{tag.label}</span>
                        ))}
                    </div>
                )}
            </motion.div>
        </Layout>
    );
}
