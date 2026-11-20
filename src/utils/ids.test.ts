import test from 'node:test';
import assert from 'node:assert/strict';
import { newId } from './ids';

test('newId - 10.000 chiamate in ciclo sincrono producono 10.000 ID tutti diversi con prefisso corretto', () => {
  const count = 10_000;
  const generated = new Set<string>();
  for (let i = 0; i < count; i++) {
    const id = newId('tx');
    assert.ok(id.startsWith('tx-'), `Expected prefix tx- on ${id}`);
    generated.add(id);
  }
  assert.equal(generated.size, count);
});
