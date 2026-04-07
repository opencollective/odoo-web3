/**
 * Encrypt a private key with a passphrase for use as PRIVATE_KEY_ENCRYPTED.
 *
 * Usage:
 *   bun run scripts/encrypt-key.ts
 *
 * It will prompt for the private key and passphrase interactively.
 * Output: the encrypted string to set as PRIVATE_KEY_ENCRYPTED env var.
 */
import { encrypt } from "../src/lib/keystore.ts";

const rl = require("node:readline").createInterface({
  input: process.stdin,
  output: process.stderr, // prompts go to stderr so stdout is clean for piping
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => resolve(answer.trim()));
  });
}

async function main() {
  console.error("Encrypt a private key for PRIVATE_KEY_ENCRYPTED\n");

  const privateKey = await question("Private key (hex, with or without 0x): ");
  const cleaned = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  if (!/^[a-fA-F0-9]{64}$/.test(cleaned)) {
    console.error("Error: not a valid 32-byte hex private key");
    process.exit(1);
  }

  const passphrase = await question("Passphrase: ");
  if (passphrase.length < 8) {
    console.error("Error: passphrase must be at least 8 characters");
    process.exit(1);
  }

  const passphrase2 = await question("Confirm passphrase: ");
  if (passphrase !== passphrase2) {
    console.error("Error: passphrases do not match");
    process.exit(1);
  }

  rl.close();

  const encrypted = await encrypt(privateKey, passphrase);

  // Output to stdout (clean, pipeable)
  console.log(encrypted);

  console.error("\nSet this as your PRIVATE_KEY_ENCRYPTED environment variable.");
}

main();
