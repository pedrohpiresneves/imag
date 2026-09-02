# Modelo 3D do MAG

Coloque aqui o personagem real exportado como `mag.glb` (Draco/meshopt comprimido,
polígonos reduzidos e texturas otimizadas):

```
public/models/mag.glb
```

Assim que o arquivo existir, o componente `MAGCharacter` passa a renderizá-lo
automaticamente — nenhum ajuste de código é necessário.

Clipes de animação reconhecidos (opcionais): `idle`, `happy`, `thinking`, `sad`,
`attention`, `celebrate`, `walk`. Sem clipes, as posturas são aplicadas
proceduralmente (flutuação, inclinação, olhar e piscar).
