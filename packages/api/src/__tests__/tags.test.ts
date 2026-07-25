import { describe, it, expect } from 'vitest';
import { extractHashtags, mergeTags, mergeTagsForRx } from '../lib/tags.js';

describe('tags / hashtags', () => {
  it('extrae #Ragnar del título', () => {
    expect(extractHashtags('Paseo #Ragnar y #Luna')).toEqual(['Ragnar', 'Luna']);
  });

  it('merge dedupe case-insensitive', () => {
    expect(mergeTags(['ragnar'], 'Ragnar', ['Luna'])).toEqual(['ragnar', 'Luna']);
  });

  it('rx_pet añade subject como tag', () => {
    expect(mergeTagsForRx('Amoxi', [], 'rx_pet', 'Ragnar')).toEqual(['Ragnar']);
  });

  it('rx_human no fuerza subject como tag si no es pet', () => {
    expect(mergeTagsForRx('Ibuprofeno #casa', [], 'rx_human', 'Juan')).toEqual(['casa']);
  });
});
