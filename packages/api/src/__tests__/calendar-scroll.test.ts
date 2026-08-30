import { describe, it, expect } from 'vitest';
import { nestedScrollerConsumesWheel } from '@daily-tracker/core';

describe('nestedScrollerConsumesWheel', () => {
  it('no atrapa la rueda si la caja no desborda', () => {
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 0,
        clientHeight: 80,
        scrollHeight: 80,
        deltaY: 40,
      })
    ).toBe(false);
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 0,
        clientHeight: 80,
        scrollHeight: 81,
        deltaY: 40,
      })
    ).toBe(false);
  });

  it('se queda el delta si hay sitio en esa dirección', () => {
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 0,
        clientHeight: 80,
        scrollHeight: 200,
        deltaY: 40,
      })
    ).toBe(true);
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 50,
        clientHeight: 80,
        scrollHeight: 200,
        deltaY: -20,
      })
    ).toBe(true);
  });

  it('suelta la rueda en el borde para que el calendario padre avance', () => {
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 0,
        clientHeight: 80,
        scrollHeight: 200,
        deltaY: -40,
      })
    ).toBe(false);
    expect(
      nestedScrollerConsumesWheel({
        scrollTop: 120,
        clientHeight: 80,
        scrollHeight: 200,
        deltaY: 40,
      })
    ).toBe(false);
  });
});
