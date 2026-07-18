"use client";

import { useMemo, useState, useTransition } from "react";
import { som } from "@/lib/format";
import { createSale } from "./actions";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
};

type Employee = {
  id: number;
  name: string;
};

const PAYMENT_LABELS = {
  cash: "Наличные",
  card: "Карта",
  qr: "QR (ELQR)",
} as const;

export function SalesRegister({
  venueId,
  products,
  employees,
}: {
  venueId: number;
  products: Product[];
  employees: Employee[];
}) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<keyof typeof PAYMENT_LABELS>("cash");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? 0);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category))).map((category) => ({
        category,
        products: products.filter((product) => product.category === category),
      })),
    [products]
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: productById.get(Number(id)), qty }))
    .filter((line): line is { product: Product; qty: number } => Boolean(line.product));
  const total = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  function addProduct(productId: number) {
    setMessage("");
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  }

  function removeProduct(productId: number) {
    setMessage("");
    setCart((current) => {
      const next = { ...current };
      if ((next[productId] ?? 0) <= 1) delete next[productId];
      else next[productId] -= 1;
      return next;
    });
  }

  function submitSale() {
    startTransition(async () => {
      setMessage("");
      const result = await createSale({
        venueId,
        employeeId,
        paymentMethod,
        items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
      });
      if (result.ok) {
        setCart({});
        setMessage(`Чек на ${som(result.total)} пробит.`);
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="kicker mb-1">Товары</div>
        {categories.length === 0 && (
          <p className="muted small">Активных товаров нет — добавьте меню в базе.</p>
        )}
        {categories.map(({ category, products: categoryProducts }) => (
          <section className="mb-1" key={category}>
            <h3>{category}</h3>
            <div className="pos-grid">
              {categoryProducts.map((product) => (
                <button
                  className="pos-item"
                  key={product.id}
                  onClick={() => addProduct(product.id)}
                  type="button"
                >
                  <strong>{product.name}</strong>
                  <div className="mono small">{som(product.price)}</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card card--framed">
        <div className="kicker mb-1">Чек</div>
        {lines.length === 0 && <p className="muted small">Корзина пуста — выберите товары слева.</p>}
        {lines.map(({ product, qty }) => (
          <div className="flex-between mb-1" key={product.id}>
            <div>
              <strong>{product.name}</strong> <span className="mono small">× {qty}</span>
            </div>
            <div className="actions">
              <span className="mono">{som(product.price * qty)}</span>
              <button
                aria-label={`Убрать ${product.name}`}
                className="btn btn--ghost btn--sm"
                onClick={() => removeProduct(product.id)}
                type="button"
              >
                −
              </button>
            </div>
          </div>
        ))}

        <div className="flex-between mb-1">
          <strong>Итого</strong>
          <span className="stat__value">{som(total)}</span>
        </div>

        <div className="field">
          <span className="field__label">Способ оплаты</span>
          <div className="actions">
            {(Object.keys(PAYMENT_LABELS) as (keyof typeof PAYMENT_LABELS)[]).map((method) => (
              <button
                className={`btn btn--sm${paymentMethod === method ? "" : " btn--ghost"}`}
                key={method}
                onClick={() => setPaymentMethod(method)}
                type="button"
              >
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Продавец</span>
          <select
            className="select"
            disabled={employees.length === 0}
            onChange={(event) => setEmployeeId(Number(event.target.value))}
            value={employeeId}
          >
            {employees.length === 0 && <option value={0}>Нет активных сотрудников</option>}
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="btn"
          disabled={isPending || lines.length === 0 || employees.length === 0}
          onClick={submitSale}
          type="button"
        >
          {isPending ? "Пробиваем…" : "Пробить чек"}
        </button>
        {message && <p className="small mt-1" aria-live="polite">{message}</p>}
      </div>
    </div>
  );
}
