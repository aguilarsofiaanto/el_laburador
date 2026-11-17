@echo off
REM ==========================================================
REM  EL LABURADOR - servidor local para jugar en Windows
REM  Doble clic en este archivo: levanta el servidor y abre el
REM  juego en el navegador. Para apagarlo, cerra esta ventana.
REM  Necesita Python instalado (https://www.python.org).
REM
REM  Siempre usa el mismo puerto (5517): la partida guardada queda
REM  asociada a esa direccion. Si cambias el puerto, el navegador
REM  arranca con otro usuario y no encuentra la partida.
REM ==========================================================

cd /d "%~dp0"
set PUERTO=5517

set PY=python
where python >nul 2>nul || set PY=py

echo Abriendo El Laburador en http://localhost:%PUERTO%
echo (para apagar el servidor, cerra esta ventana)
echo.

REM Abre el navegador 2 segundos despues, cuando el servidor ya arranco
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PUERTO%'"

REM servidor.py es como "python -m http.server" pero sin cache:
REM al recargar la pagina siempre se ve la ultima version del codigo
%PY% servidor.py %PUERTO%

echo.
echo No se pudo iniciar el servidor.
echo  - Fijate que Python este instalado.
echo  - O que el puerto %PUERTO% no lo este usando otro programa.
pause
