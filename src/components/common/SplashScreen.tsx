import { useEffect, useState } from "react";
import { cn } from "../../utils/shadcn";

const QUOTES = [
    "每个人生选择的背后",
    "都有一条被放弃的时间线",
];

export function SplashScreen() {
    const [line, setLine] = useState(0);

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
                        {QUOTES[0]}
                    </p>
                    <p
                        className={cn(
                            "transition-all duration-1000 delay-500",
                            line >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}
                    >
                        {QUOTES[1]}
                    </p>
                </div>
                <div className="mt-8 h-px w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full origin-left animate-pulse bg-primary/40"></div>
                </div>
            </div>
        </div>
    );
}
