"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
function decrypt(adminPrivateKey, encryptedAesKey, encryptedPrivateKey) {
    // decrypt the aes key with the private key
    const aesKey = rsaDecryptWithPrivateKey(adminPrivateKey, encryptedAesKey);
    // describe the private key with the aes key
    const privateKeyDecrypted = aesDecrypt(aesKey, encryptedPrivateKey);
    return privateKeyDecrypted;
}
function rsaDecryptWithPrivateKey(privateKey, toDecrypt) {
    // toDecrypt is base64 string
    const buffer = Buffer.from(toDecrypt, 'base64');
    const decrypted = crypto_1.default.privateDecrypt({
        key: privateKey,
        // RSA/ECB/OAEPWithSHA-256AndMGF1Padding
        padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
    }, buffer);
    // to base64 string
    return decrypted.toString('base64');
}
function aesDecrypt(aesKey, encryptedData) {
    // aes-256-gcm
    const GCM_IV_LENGTH = 12;
    const GCM_TAG_LENGTH = 16;
    // aesKey is base64 string, 
    const key = Buffer.from(aesKey, 'base64');
    // encryptedData is base64 string
    const data = Buffer.from(encryptedData, 'base64');
    const iv = data.subarray(0, GCM_IV_LENGTH);
    const tag = data.subarray(data.length - GCM_TAG_LENGTH);
    const encrypted = data.subarray(GCM_IV_LENGTH, data.length - GCM_TAG_LENGTH);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
//# sourceMappingURL=encrypt.js.map