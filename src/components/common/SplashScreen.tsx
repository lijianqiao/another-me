import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/shadcn";

export function SplashScreen() {
    const { t } = useTranslation();
    const [line, setLine] = useState(0);

    // 将 app.tagline 按句号/逗号拆成两行
    const tagline = t("app.tagline");
    const splitIdx = tagline.search(/[，,。.]/);
    const quotes =
        splitIdx > 0
            ? [tagline.slice(0, splitIdx + 1), tagline.slice(splitIdx + 1)]
            : [tagline, ""];

    useEffect(() => {
        const t1 = setTimeout(() => setLine(1), 300);
        const t2 = setTimeout(() => setLine(2), 1500);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-500">
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex h-32 flex-col items-center justify-center gap-4 text-lg font-light tracking-widest text-muted-foreground sm:text-xl lg:text-2xl">
                    <p
                        className={cn(
                            "transition-all duration-1000",
                            line >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}
                    >
                        {quotes[0]}
                    </p>
                    {quotes[1] && (
                        <p
                            className={cn(
                                "transition-all duration-1000 delay-500",
                                line >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                            )}
                        >
                            {quotes[1]}
                        </p>
                    )}
                </div>
                <div className="mt-8 h-px w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full origin-left animate-pulse bg-primary/40"></div>
                </div>
            </div>
        </div>
    );
}

