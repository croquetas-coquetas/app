# SmartCook

Este repositorio contiene el código fuente de SmartCook.

## API REST de planificación semanal con Flask

El servidor dentro de `server/` usa Flask y expone una API JSON para obtener una planificación semanal completa de comidas y cenas.

### Puesta en marcha en Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Set-Location .\server
python manage.py
```

Si prefieres ejecutar Flask directamente:

```powershell
python app.py
```

### Probar la API

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/planificacion/semanal/
```

### Ejecutar pruebas

```powershell
Set-Location .\server
python -m unittest discover -s . -p "tests.py"
```

### Script de consola

También puedes generar una planificación en JSON sin levantar Flask:

```powershell
python .\server\planificacion.py
```
