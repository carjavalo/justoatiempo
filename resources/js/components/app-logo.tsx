import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                <AppLogoIcon className="size-7" />
            </div>
            <div className="ml-1 grid flex-1 text-left leading-tight">
                <span className="truncate text-[0.95rem] font-extrabold tracking-tight text-white">Justo a Tiempo</span>
                <span className="text-sidebar-foreground/80 truncate text-[0.7rem] font-medium tracking-[0.14em] uppercase">SP · Operaciones</span>
            </div>
        </>
    );
}
