"use server";

import { getDb } from "@/lib/db";
import { createSession, destroySession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE login = ?")
    .get(login) as { id: number; password_hash: string } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect("/login?error=1");
  }
  const token = createSession(user.id);
  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
