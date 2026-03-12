import json
import sys

from API_planificacion import API_planificacion, PlanningError


def main() -> int:
    try:
        planificacion = API_planificacion().planifica()
    except PlanningError as exc:
        print(f"Error al generar la planificación: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(planificacion, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
