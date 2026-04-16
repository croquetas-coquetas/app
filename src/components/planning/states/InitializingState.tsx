export function InitializingState() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
            style={{
              borderTopColor: "currentColor",
            }}
          ></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Cargando...
          </p>
        </div>
      </div>
    </div>
  );
}

