import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="mt-auto py-8 text-center text-xs text-muted-foreground border-t border-border">
            <p className="mb-2">© 2026 K-Glow</p>
            <div className="flex justify-center gap-4">
                <Link to="#" className="hover:underline">서비스 소개</Link>
                <Link to="#" className="hover:underline">개인정보 처리방침</Link>
                <Link to="#" className="hover:underline">문의</Link>
            </div>
        </footer>
    );
}
