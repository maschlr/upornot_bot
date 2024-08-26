// crypto.ts
import "jsr:@std/dotenv/load";

export const PASSWORD = Deno.env.get("PASSWORD");
if (PASSWORD === undefined) {
    throw new Error("ENCRYPTION_PASSWORD environment variable is not set");
}

export const ENCRYPTED_FILE = "./encrypted_config.txt";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(
    password: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

export async function encrypt(data: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoder.encode(data),
    );

    const result = new Uint8Array(
        salt.length + iv.length + encrypted.byteLength,
    );
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode.apply(null, result as unknown as number[]));
}

export async function decrypt(
    encryptedData: string,
    password: string,
): Promise<string> {
    const data = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const ciphertext = data.slice(28);

    const key = await deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext,
    );

    return decoder.decode(decrypted);
}
