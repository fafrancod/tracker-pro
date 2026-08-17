/** 256 palabras cortas (8 bits). 12 palabras ≈ 96 bits de secreto. */
export const FINANCE_RECOVERY_WORDS = [
  'agua', 'aire', 'alce', 'alma', 'ancla', 'anillo', 'arbol', 'arena',
  'arroz', 'aspa', 'avena', 'barco', 'bebes', 'bicho', 'blanco', 'bosque',
  'boton', 'bravo', 'brisa', 'cabra', 'cacao', 'cafe', 'caja', 'calle',
  'calma', 'campo', 'canta', 'caoba', 'carta', 'casa', 'casco', 'cedro',
  'celeste', 'cena', 'cerca', 'cerro', 'chala', 'charco', 'cielo', 'cima',
  'circo', 'clavo', 'coco', 'colina', 'color', 'copa', 'coral', 'correo',
  'costa', 'crema', 'crudo', 'cuadro', 'cuenco', 'cuerda', 'cuero', 'cuerpo',
  'cuento', 'culebra', 'cuna', 'cura', 'curso', 'dalia', 'danza', 'dato',
  'delta', 'diente', 'dique', 'dona', 'dorso', 'dulce', 'duna', 'eco',
  'eje', 'elefante', 'enlace', 'epoca', 'escama', 'escudo', 'espiga', 'estepa',
  'faro', 'feria', 'ficha', 'finca', 'flauta', 'flor', 'foco', 'fogata',
  'fondo', 'forma', 'fresa', 'frio', 'fruta', 'fuego', 'fuente', 'funda',
  'gallo', 'gema', 'gente', 'girasol', 'globo', 'grano', 'grillo', 'grupo',
  'guante', 'guia', 'guion', 'haba', 'hacha', 'hilo', 'hoja', 'hombre',
  'hongo', 'hora', 'huella', 'huerto', 'humo', 'idea', 'iglu', 'isla',
  'jabon', 'jara', 'jaula', 'jiron', 'joven', 'juego', 'junio', 'koala',
  'lago', 'lama', 'lancha', 'lapiz', 'largo', 'lata', 'laurel', 'leche',
  'lejos', 'lente', 'leon', 'letra', 'libro', 'lima', 'limon', 'linea',
  'lirio', 'lista', 'lobo', 'loma', 'lomo', 'loro', 'lucha', 'lugar',
  'lumen', 'luna', 'lunes', 'lupa', 'luz', 'madre', 'magma', 'maiz',
  'malla', 'mango', 'manta', 'mapa', 'marco', 'marea', 'mata', 'maya',
  'mesa', 'metal', 'miedo', 'miel', 'mina', 'mirlo', 'moda', 'molino',
  'monte', 'moral', 'morsa', 'mosca', 'mota', 'motor', 'mueble', 'muelle',
  'mundo', 'muro', 'nacer', 'naranja', 'nariz', 'nieve', 'nube', 'nudo',
  'nuez', 'oasis', 'obra', 'ocaso', 'oeste', 'ojo', 'ola', 'olivo',
  'orilla', 'oro', 'oso', 'otoño', 'oveja', 'padre', 'pagina', 'palma',
  'pan', 'papel', 'pared', 'paso', 'pasta', 'patio', 'pausa', 'paz',
  'peca', 'pedal', 'pena', 'perla', 'perro', 'pesca', 'piano', 'pino',
  'piña', 'playa', 'pluma', 'polvo', 'pomelo', 'porto', 'posta', 'pozo',
  'prado', 'puente', 'puerta', 'pulso', 'punto', 'queso', 'rama', 'rastro',
  'rayo', 'red', 'reino', 'reloj', 'rio', 'roca', 'rueda', 'ruido',
  'ruta', 'saco', 'sal', 'salsa', 'selva', 'sello', 'senda', 'silla',
  'sirena', 'sobre', 'sol', 'sombra', 'sopa', 'suave', 'sur', 'tabla',
  'taco', 'tallo', 'tapa', 'tarde', 'techo', 'tejido', 'tela', 'templo',
  'tenis', 'tierra', 'tigre', 'tina', 'tinta', 'tiza', 'tofu', 'tomate',
  'trama', 'trigo', 'trino', 'tronco', 'trueno', 'tubo', 'tulipan', 'tuna',
  'uva', 'vaca', 'valle', 'vapor', 'vara', 'vela', 'venado', 'venta',
  'verano', 'verde', 'viaje', 'vidrio', 'viento', 'villa', 'vino', 'vista',
  'viuda', 'vocal', 'volcan', 'vuelo', 'yate', 'yema', 'yute', 'zanahoria',
] as const;

function randomByte(): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('getRandomValues no disponible');
  }
  const buf = new Uint8Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
}

export function generateRecoveryPhrase(wordCount = 12): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i += 1) {
    words.push(FINANCE_RECOVERY_WORDS[randomByte()]!);
  }
  return words.join(' ');
}

export function normalizeRecoveryPhrase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
