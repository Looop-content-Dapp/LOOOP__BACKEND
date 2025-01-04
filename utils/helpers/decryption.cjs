const crypto = require("crypto");

const decryptPrivateKey = (backup, password) => {
  const { encryptedPrivateKey, salt, iv, tag } = backup;

  try {
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, "hex"),
      100000,
      32,
      "sha256"
    );

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPrivateKey, "hex")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("Decryption failed. Invalid password or corrupted data.");
  }
};

try {
  const backup = {
    encryptedPrivateKey: "your-encrypted-private-key-hex",
    salt: "your-salt-hex",
    iv: "your-iv-hex",
    tag: "your-auth-tag-hex",
  };

  const password = "user-password";
  const privateKey = decryptPrivateKey(backup, password);

  console.log("Decrypted Private Key:", privateKey);
} catch (error) {
  console.error(error.message);
}
