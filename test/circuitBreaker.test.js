import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker, estadosCircuito } from "../src/shared/circuitBreaker.js";

const fallar = async () => {
  throw new Error("servicio caído");
};

test("abre el circuito al alcanzar el umbral de fallos", async () => {
  const breaker = new CircuitBreaker({ nombre: "prueba", umbralFallos: 2 });

  await assert.rejects(breaker.ejecutar(fallar));
  assert.equal(breaker.estado, estadosCircuito.cerrado);
  await assert.rejects(breaker.ejecutar(fallar));
  assert.equal(breaker.estado, estadosCircuito.abierto);

  await assert.rejects(breaker.ejecutar(async () => "ok"), { codigo: "CIRCUITO_ABIERTO" });
});

test("pasa a semiabierto tras el tiempo de espera y se cierra si la prueba funciona", async () => {
  let reloj = 0;
  const breaker = new CircuitBreaker({
    nombre: "prueba",
    umbralFallos: 1,
    tiempoAbiertoMs: 1000,
    ahora: () => reloj,
  });

  await assert.rejects(breaker.ejecutar(fallar));
  assert.equal(breaker.estado, estadosCircuito.abierto);

  reloj = 1000;
  const resultado = await breaker.ejecutar(async () => "recuperado");
  assert.equal(resultado, "recuperado");
  assert.equal(breaker.estado, estadosCircuito.cerrado);
});

test("los errores de negocio no cuentan como fallos del servicio", async () => {
  const breaker = new CircuitBreaker({ nombre: "prueba", umbralFallos: 1 });
  const errorNegocio = Object.assign(new Error("sin stock"), { esErrorNegocio: true });

  await assert.rejects(breaker.ejecutar(async () => { throw errorNegocio; }));
  assert.equal(breaker.estado, estadosCircuito.cerrado);
});
