import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Planificacion } from "@/types/planning";
import { formatFechaGenerado } from "@/lib/planning.utils";

interface ConfirmOverwriteStateProps {
  planificacionExistente: Planificacion;
  onShowExisting: () => void;
  onGenerateNew: () => void;
}

export function ConfirmOverwriteState({
  planificacionExistente,
  onShowExisting,
  onGenerateNew,
}: ConfirmOverwriteStateProps) {
  return (
    <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-2xl">
          ⚠
        </div>
        <CardTitle className="text-xl font-bold">Ya tienes una planificación de hoy</CardTitle>
        <CardDescription>
          Generada el {formatFechaGenerado(planificacionExistente.generado_en)}. Si continúas se sobreescribirá.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          ¿Quieres ver la planificación existente o generar una nueva?
        </p>
      </CardContent>
      <CardFooter className="flex justify-center gap-3">
        <Button variant="outline" onClick={onShowExisting} className="rounded-xl px-4 text-base font-semibold shadow-sm">
          Ver la existente
        </Button>
        <Button onClick={onGenerateNew} className="rounded-xl px-4 text-base font-semibold shadow-sm">
          Generar nueva
        </Button>
      </CardFooter>
    </Card>
  );
}

