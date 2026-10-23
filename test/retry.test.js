import { test } from "node:test";
import assert from "node:assert/strict";
import { conReintentos } from "../src/shared/retry.js";

test("reintenta hasta que la operación funciona", async () => {
  let llamadas = 0;
  const resultado = await conReintentos(
    async () => {
      llamadas += 1;
      if (llamadas < 3) throw new Error("falla transitoria");
      return "ok";
    },
    { intentos: 3, esperaMs: 1 },
  );
  assert.equal(resultado, "ok");
  assert.equal(llamadas, 3);
});

test("no reintenta los errores marcados como definitivos", async () => {
  let llamadas = 0;
  await assert.rejects(
    conReintentos(
      async () => {
        llamadas += 1;
        throw Object.assign(new Error("sin stock"), { noReintentar: true });
      },
      { intentos: 5, esperaMs: 1 },
    ),
  );
  assert.equal(llamadas, 1);
});
