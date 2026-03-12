import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import "./App.css";
import {useState} from "react";
import {fetchPlanification} from "@/lib/api.ts";
import { toast } from "sonner"
import {CalendarioPlanificacion} from "@/components/CalendarioPlanificacion.tsx";
import {Planification} from "@/types/api.ts";
import {LoaderCircle} from "lucide-react";

function App() {

  const [planification, setPlanification] = useState<Planification | null>(null);
  const [loading, setLoading] = useState(false);

  function generarPlanificacion() {
    setLoading(true);
    fetchPlanification()
        .then((data) => {
          setPlanification(data);
        })
        .catch((error) => {
          toast.error("Error al generar la planificación: " + error.message, { position: "top-center" });
        })
        .finally(() => setLoading(false));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold tracking-tight text-primary">
            SmartCook
          </CardTitle>
          <CardDescription className="text-xl">
            Your intelligent cooking assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>
            Discover delicious recipes, manage your pantry, and plan your meals
            with ease. SmartCook helps you make the most of what you have.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button onClick={generarPlanificacion}>Generar planificación</Button>
        </CardFooter>
      </Card>

      {
        loading && (
            <div className="flex flex-col items-center mt-6">
              <p className="mt-4 text-muted-foreground">Generando planificación...</p>
              <LoaderCircle className="animate-spin mt-2 text-primary" size={24} />
            </div>
          )
      }

      {
        planification && <CalendarioPlanificacion planification={planification}/>
      }
    </div>
  );
}

export default App;
