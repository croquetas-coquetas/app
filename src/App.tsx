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

function App() {
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
          <Button>Get Started</Button>
          <Button variant="outline">Learn More</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default App;
