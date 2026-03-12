from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from API_planificacion import API_planificacion, InsufficientRecipesError, PlanningError


class WeeklyPlanningView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        try:
            planificacion = API_planificacion().planifica()
        except InsufficientRecipesError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PlanningError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(planificacion, status=status.HTTP_200_OK)

