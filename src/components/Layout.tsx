import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children, showSearch = false }: { children: React.ReactNode, showSearch?: boolean }) {
    return (
        <div className="min-h-screen flex flex-col bg-background relative selection:bg-primary/20">
            <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] opacity-5 pointer-events-none mix-blend-overlay" />
            <Header showSearch={showSearch} />
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 pt-24 pb-12 z-10">
                {children}
            </main>
            <Footer />
        </div>
    );
}
