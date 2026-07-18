import { seed } from "./seed";

let done = false;

/** Первый запуск на пустой базе — заполняем демо-данными. */
export function ensureSeeded() {
  if (done) return;
  seed();
  done = true;
}
