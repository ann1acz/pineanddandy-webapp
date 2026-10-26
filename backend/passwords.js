import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) {
    throw new Error("Invalid stored password hash");
  }
  return timingSafeEqual(Buffer.from(hash, "hex"), await derive(password, salt));
}
