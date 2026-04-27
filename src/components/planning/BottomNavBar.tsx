import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface BottomNavBarProps {
  onCalendarClick: () => void;
  onShoppingListClick: () => void;
  onProfileClick?: (action: "mi-perfil" | "configurar-horario") => void;
  activeTab?: "calendar" | "shopping-list" | "profile";
}

export function BottomNavBar({
  onCalendarClick,
  onShoppingListClick,
  onProfileClick,
  activeTab,
}: BottomNavBarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleProfileAction = (action: "mi-perfil" | "configurar-horario") => {
    onProfileClick?.(action);
    setIsProfileOpen(false);
  };

  return (
    <>
      {/* Overlay when menu is open */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-sm"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            animation: "fadeIn 200ms ease-out",
          }}
          onClick={() => setIsProfileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 safe-area-inset-bottom"
        style={{
          paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
        }}
      >
        <div className="flex items-center justify-around px-4 py-2">
          {/* Calendar Button */}
          <Button
            type="button"
            variant="link"
            size="icon"
            onClick={onCalendarClick}
            className={cn(
              "rounded-xl h-12 w-12 transition-colors",
              activeTab === "calendar"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={activeTab === "calendar" ? { backgroundColor: "rgba(var(--color-primary-rgb, 22, 163, 74), 0.1)" } : undefined}
            aria-label="Ver calendario"
          >
            <Calendar className="size-6" />
          </Button>

          {/* Shopping List Button */}
          <Button
            type="button"
            variant="link"
            size="icon"
            onClick={onShoppingListClick}
            className={cn(
              "rounded-xl h-12 w-12 transition-colors",
              activeTab === "shopping-list"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={activeTab === "shopping-list" ? { backgroundColor: "rgba(var(--color-primary-rgb, 22, 163, 74), 0.1)" } : undefined}
            aria-label="Generar lista de la compra"
          >
            <ShoppingCart className="size-6" />
          </Button>

          {/* Profile Button with Dropdown */}
          <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-xl h-12 w-12 transition-colors",
                  isProfileOpen || activeTab === "profile"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={isProfileOpen || activeTab === "profile" ? { backgroundColor: "rgba(var(--color-primary-rgb, 22, 163, 74), 0.1)" } : undefined}
                aria-label="Abrir menú del perfil"
              >
                <User className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8}>
              <DropdownMenuItem onClick={() => handleProfileAction("mi-perfil")}>
                <User className="size-4" />
                <span>Mi perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleProfileAction("configurar-horario")}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Configurar horario</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Spacer to prevent content overlap */}
      <div
        style={{
          height: `calc(5rem + max(1rem, env(safe-area-inset-bottom)))`,
        }}
      />
    </>
  );
}


