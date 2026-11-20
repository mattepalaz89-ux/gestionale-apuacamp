import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from './saveQueue';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('createSaveQueue - 1. 10 enqueue ravvicinati provocano una sola chiamata a saveFn con il 10° stato', async () => {
  const savedStates: number[] = [];
  const queue = createSaveQueue<number>(async (state) => {
    savedStates.push(state);
  }, 40);

  for (let i = 1; i <= 10; i++) {
    queue.enqueue(i);
  }
  assert.equal(queue.getStatus(), 'pending');

  await sleep(90);
  assert.deepEqual(savedStates, [10]);
  assert.equal(queue.getStatus(), 'idle');
});

test('createSaveQueue - 2. un enqueue che arriva mentre saveFn è in volo provoca una seconda chiamata dopo che la prima finisce', async () => {
  const savedStates: string[] = [];
  let releaseFirstSave!: () => void;
  const firstSaveGate = new Promise<void>((resolve) => {
    releaseFirstSave = resolve;
  });

  const queue = createSaveQueue<string>(async (state) => {
    savedStates.push(state);
    if (state === 'first') {
      await firstSaveGate;
    }
  }, 20);

  queue.enqueue('first');
  await sleep(35);
  // Ora la prima saveFn è in volo ('saving')
  assert.equal(queue.getStatus(), 'saving');
  assert.deepEqual(savedStates, ['first']);

  // Mentre la prima è in volo, accodiamo nuovi stati
  queue.enqueue('second');
  queue.enqueue('third');

  // Rilasciamo la prima saveFn e attendiamo il completamento
  releaseFirstSave();
  await queue.flush();

  assert.deepEqual(savedStates, ['first', 'third']);
  assert.equal(queue.getStatus(), 'idle');
});

test('createSaveQueue - 3. flush() aspetta il completamento immediato senza attendere il debounce residuo', async () => {
  const savedStates: string[] = [];
  const queue = createSaveQueue<string>(async (state) => {
    await sleep(15);
    savedStates.push(state);
  }, 5000); // debounce lungo (5s)

  queue.enqueue('urgent-save');
  assert.equal(queue.getStatus(), 'pending');

  await queue.flush();
  assert.deepEqual(savedStates, ['urgent-save']);
  assert.equal(queue.getStatus(), 'idle');
});

test('createSaveQueue - 4. se saveFn lancia errore, lo stato va in error e il prossimo enqueue riprova', async () => {
  let shouldFail = true;
  const savedStates: number[] = [];

  const queue = createSaveQueue<number>(async (state) => {
    if (shouldFail) {
      throw new Error('Drive network failure');
    }
    savedStates.push(state);
  }, 15);

  queue.enqueue(1);
  await sleep(40);
  assert.equal(queue.getStatus(), 'error');
  assert.deepEqual(savedStates, []);

  // Ora la rete torna disponibile e un nuovo enqueue riprova con successo
  shouldFail = false;
  queue.enqueue(2);
  await queue.flush();
  assert.equal(queue.getStatus(), 'idle');
  assert.deepEqual(savedStates, [2]);
});
