export function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
      <div className="h-10 w-10 rounded-full border-4 border-border border-t-primary animate-spin" />
      <p className="text-muted-foreground text-sm">Generando tu menú...</p>
    </div>
  );
}

