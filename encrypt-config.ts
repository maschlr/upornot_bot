#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

import { encrypt, PASSWORD, ENCRYPTED_FILE } from "./crypto.ts";

const CONFIG_FILE = "config.json";


try {
  // Read the contents of the config file
  const configContent = await Deno.readTextFile(CONFIG_FILE);

  // Encrypt the content
  const encryptedContent = await encrypt(configContent, PASSWORD as string);

  // Write the encrypted content to a new file
  await Deno.writeTextFile(ENCRYPTED_FILE, encryptedContent);

  console.log(`Successfully encrypted ${CONFIG_FILE} to ${ENCRYPTED_FILE}`);

  // Stage the encrypted file
  const command = new Deno.Command("git", {
    args: ["add", ENCRYPTED_FILE],
  });
  const { success } = await command.output();

  if (success) {
    console.log(`${ENCRYPTED_FILE} has been staged for commit`);
  } else {
    console.error(`Failed to stage ${ENCRYPTED_FILE}`);
    throw new Error(`Failed to stage ${ENCRYPTED_FILE}`);   
  }

} catch (error) {
  throw new Error(`Error during encryption: ${error}`);
}
