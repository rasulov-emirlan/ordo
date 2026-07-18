"use server";

import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { nowISO } from "@/lib/format";
import { revalidatePath } from "next/cache";

type SaleInput = {
  venueId: number;
  employeeId: number;
  paymentMethod: "cash" | "card" | "qr";
  items: { productId: number; qty: number }[];
};

export async function createSale(input: SaleInput) {
  const user = await requireUser();
  const db = getDb();

  if (!Number.isInteger(input.venueId) || input.venueId <= 0) {
    return { ok: false, error: "Выберите заведение." } as const;
  }
  if (!Number.isInteger(input.employeeId) || input.employeeId <= 0) {
    return { ok: false, error: "Выберите продавца." } as const;
  }
  if (!(["cash", "card", "qr"] as const).includes(input.paymentMethod)) {
    return { ok: false, error: "Выберите способ оплаты." } as const;
  }

  const venue = db.prepare("SELECT id FROM venues WHERE id = ?").get(input.venueId);
  if (!venue) return { ok: false, error: "Заведение не найдено." } as const;

  const employee = db
    .prepare("SELECT id FROM employees WHERE id = ? AND venue_id = ? AND status = 'active'")
    .get(input.employeeId, input.venueId);
  if (!employee) return { ok: false, error: "Продавец не найден в этой точке." } as const;

  const quantities = new Map<number, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.productId) || !Number.isInteger(item.qty) || item.qty <= 0) continue;
    quantities.set(item.productId, Math.min(99, (quantities.get(item.productId) ?? 0) + item.qty));
  }
  if (quantities.size === 0) return { ok: false, error: "Добавьте товары в чек." } as const;

  const productQuery = db.prepare(
    "SELECT id, price FROM products WHERE id = ? AND active = 1"
  );
  const items = Array.from(quantities, ([productId, qty]) => {
    const product = productQuery.get(productId) as { id: number; price: number } | undefined;
    return product ? { productId: product.id, qty, price: product.price } : null;
  }).filter((item): item is { productId: number; qty: number; price: number } => item !== null);

  if (items.length !== quantities.size) {
    return { ok: false, error: "Один из товаров больше недоступен. Обновите страницу." } as const;
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const saveSale = db.transaction(() => {
    const sale = db
      .prepare(
        `INSERT INTO sales (venue_id, employee_id, ts, total, payment_method)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.venueId, input.employeeId, nowISO(), total, input.paymentMethod);
    const saleId = Number(sale.lastInsertRowid);
    const insertItem = db.prepare(
      "INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)"
    );
    for (const item of items) {
      insertItem.run(saleId, item.productId, item.qty, item.price);
    }
  });

  saveSale();
  revalidatePath("/sales");
  revalidatePath("/stats");
  revalidatePath(`/venues/${input.venueId}`);
  revalidatePath("/");
  return { ok: true, total, saleBy: user.id } as const;
}
