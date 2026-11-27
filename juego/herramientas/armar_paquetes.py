# ==========================================================
# ARMAR PAQUETES DE MODELOS 3D — El Laburador
#
# Junta todos los .obj de una carpeta en UN archivo binario
# comprimido (.bin.gz) que el juego puede usar directamente.
#
# ¿Por qué? Los .obj son texto: pesan mucho (17 MB en total),
# GitHub Pages no los comprime, y el navegador tiene que leerlos
# línea por línea antes de poder dibujarlos. En el paquete los
# modelos ya vienen "armados" (como los deja p5 después de leer
# el .obj), guardados como números enteros y comprimidos:
# pesan 2 MB y no hay que leer nada.
#
# No se pierde precisión: los .obj que exporta Blender tienen
# como mucho 2 decimales en las posiciones, 4 en las UV y 3 en
# las normales, y se guardan multiplicados por 100, 10000 y 1000.
# Si algún modelo no entra en ese formato, el script lo saltea
# y avisa: el juego lo baja como .obj, igual que antes.
#
# CUÁNDO CORRERLO: cada vez que se cambia o se agrega un .obj.
# (Si te olvidás, el juego sigue andando: los modelos nuevos que
# no están en el paquete se bajan como .obj, solo que más lento.)
#
# Uso, desde la carpeta juego/:
#     python herramientas/armar_paquetes.py
# Solo usa librerías que vienen con Python.
# ==========================================================

import glob
import gzip
import json
import os
import struct
import sys

# Qué carpeta va en qué paquete
PAQUETES = {
    'kiosco':   'src/modelos/*.obj',            # heladeras, góndola, productos
    'personas': 'src/modelos/personas/*.obj',   # la gente del barrio (5 piezas c/u)
    'calle':    'src/modelos/calle/*.obj',      # la villa y la reja del kiosco
}
CARPETA_SALIDA = 'src/modelos/paquetes'

ESCALA_POSICION = 100     # 2 decimales
ESCALA_UV = 10000         # 4 decimales
ESCALA_NORMAL = 1000      # 3 decimales


class NoEntra(Exception):
    """El modelo no se puede guardar sin perder precisión."""


def entero_exacto(valor, escala, minimo, maximo, que):
    entero = round(valor * escala)
    if abs(entero / escala - valor) > 1e-9:
        raise NoEntra(f'{que} con más decimales de los que entran ({valor})')
    if not minimo <= entero <= maximo:
        raise NoEntra(f'{que} fuera de rango ({valor})')
    return entero


def leer_obj(ruta):
    """Lee el .obj exactamente igual que p5.js (parseObj de p5 1.9):
    cada combinación distinta de v/vt/vn es un vértice nuevo, las caras
    de más de 3 lados se parten en triángulos y la V de la textura se
    invierte (1 - v)."""
    v, vt, vn = [], [], []
    indices = {}          # 'v/vt/vn' -> número de vértice
    vertices = []         # [(iv, ivt, ivn)]
    caras = []

    with open(ruta, encoding='utf-8') as archivo:
        for linea in archivo:
            t = linea.split()
            if not t:
                continue
            tipo = t[0]
            if tipo == 'v':
                v.append([float(x) for x in t[1:4]])
            elif tipo == 'vt':
                vt.append([float(t[1]), 1 - float(t[2])])
            elif tipo == 'vn':
                vn.append([float(x) for x in t[1:4]])
            elif tipo == 'f':
                for tri in range(3, len(t)):
                    cara = []
                    for clave in (t[1], t[tri - 1], t[tri]):
                        if clave not in indices:
                            partes = clave.split('/')
                            iv = int(partes[0]) - 1
                            ivt = int(partes[1]) - 1 if len(partes) > 1 and partes[1] else -1
                            ivn = int(partes[2]) - 1 if len(partes) > 2 and partes[2] else -1
                            if iv < 0:
                                raise NoEntra('usa índices negativos')
                            indices[clave] = len(vertices)
                            vertices.append((iv, ivt, ivn))
                        cara.append(indices[clave])
                    # p5 descarta los triángulos "aplastados" (vértices repetidos)
                    if cara[0] != cara[1] and cara[0] != cara[2] and cara[1] != cara[2]:
                        caras.append(cara)

    posiciones, uvs, normales = [], [], []
    for iv, ivt, ivn in vertices:
        posiciones += [entero_exacto(c, ESCALA_POSICION, -2**31, 2**31 - 1, 'posición') for c in v[iv]]
        uv = vt[ivt] if 0 <= ivt < len(vt) else [0, 0]
        uvs += [entero_exacto(c, ESCALA_UV, 0, 65535, 'UV') for c in uv]
        if not 0 <= ivn < len(vn):
            raise NoEntra('le faltan normales a algún vértice')
        normales += [entero_exacto(c, ESCALA_NORMAL, -32768, 32767, 'normal') for c in vn[ivn]]

    # Las caras se guardan como "diferencia con el índice anterior":
    # son números chicos y parecidos, y así se comprimen mucho mejor.
    deltas, anterior = [], 0
    for cara in caras:
        for indice in cara:
            deltas.append(indice - anterior)
            anterior = indice

    return len(vertices), len(caras), posiciones, uvs, normales, deltas


def rellenar_a_4(datos):
    """Los arreglos de números en JavaScript tienen que empezar en una
    posición múltiplo de 4 bytes."""
    while len(datos) % 4:
        datos += b'\0'
    return datos


def armar_paquete(nombre, patron):
    indice, cuerpo, salteados = [], bytearray(), []

    for ruta in sorted(glob.glob(patron)):
        nombre_modelo = os.path.splitext(os.path.basename(ruta))[0]
        try:
            nv, nc, pos, uvs, nor, deltas = leer_obj(ruta)
        except NoEntra as motivo:
            salteados.append(f'{nombre_modelo} ({motivo})')
            continue

        cuerpo += struct.pack(f'<{len(pos)}i', *pos)
        cuerpo += struct.pack(f'<{len(uvs)}H', *uvs)
        cuerpo = rellenar_a_4(cuerpo + struct.pack(f'<{len(nor)}h', *nor))
        cuerpo += struct.pack(f'<{len(deltas)}i', *deltas)
        indice.append({'nombre': nombre_modelo, 'vertices': nv, 'caras': nc})

    cabecera = json.dumps({'version': 1, 'modelos': indice}).encode('utf-8')
    while len(cabecera) % 4:
        cabecera += b' '

    archivo = b'ELB1' + struct.pack('<I', len(cabecera)) + cabecera + bytes(cuerpo)
    destino = os.path.join(CARPETA_SALIDA, nombre + '.bin.gz')
    with open(destino, 'wb') as salida:
        # mtime=0: si los modelos no cambian, el archivo sale idéntico
        salida.write(gzip.compress(archivo, compresslevel=9, mtime=0))

    peso_obj = sum(os.path.getsize(r) for r in glob.glob(patron))
    print(f'{nombre:9s} {len(indice):3d} modelos  '
          f'{peso_obj / 1048576:5.1f} MB de .obj  ->  {os.path.getsize(destino) / 1048576:4.2f} MB')
    for s in salteados:
        print(f'          SALTEADO (se va a bajar como .obj): {s}')


if __name__ == '__main__':
    # Siempre trabaja desde la carpeta juego/, se llame desde donde se llame
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    os.makedirs(CARPETA_SALIDA, exist_ok=True)
    for nombre, patron in PAQUETES.items():
        armar_paquete(nombre, patron)
    sys.exit(0)
