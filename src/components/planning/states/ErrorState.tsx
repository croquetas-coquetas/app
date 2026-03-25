import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  errorMsg: string;
  onBack: () => void;
  onRetry: () => void;
}

export function ErrorState({ errorMsg, onBack, onRetry }: ErrorStateProps) {
  return (
    <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-2xl">
          ⚠
        </div>
        <CardTitle className="text-2xl font-bold">Algo salió mal</CardTitle>
        <CardDescription className="text-destructive">{errorMsg}</CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-center gap-3">
        <Button variant="outline" onClick={onBack}>
          ← Volver
        </Button>
        <Button onClick={onRetry}>Reintentar</Button>
      </CardFooter>
    </Card>
  );
}

