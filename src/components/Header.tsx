import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, Heart, User, LogOut, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export default function Header({ showSearch = false }: { showSearch?: boolean }) {
    const { isLoggedIn, signOut } = useAuth();
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(false);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (document.documentElement.classList.contains("dark")) {
            setIsDark(true);
        }
    }, []);

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle("dark");
        setIsDark(!isDark);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim().length >= 2) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    return (
        <header className="fixed top-0 w-full z-50 glass h-16 flex items-center justify-between px-4 md:px-8">
            <Link to="/" className="text-xl font-bold gradient-text tracking-tight">
                K-Glow
            </Link>

            {showSearch && (
                <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="검색어를 입력하세요..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-background border border-border rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </form>
            )}

            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(isLoggedIn ? "/saved" : "/auth?next=/saved")}
                >
                    <Heart className="w-5 h-5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(isLoggedIn ? "/account" : "/auth?next=/account")}
                >
                    <User className="w-5 h-5" />
                </Button>
                {isLoggedIn && (
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="w-5 h-5 text-muted-foreground" />
                    </Button>
                )}
            </div>
        </header>
    );
}
