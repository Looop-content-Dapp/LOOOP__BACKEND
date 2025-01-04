const crypto = require("crypto");

const encryptPrivateKey = (privateKey, password) => {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    encryptedPrivateKey: encrypted.toString("hex"),
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
};

module.exports.encryptPrivateKey = encryptPrivateKey;
