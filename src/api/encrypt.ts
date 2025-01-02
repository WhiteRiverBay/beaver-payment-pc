import crypto from 'crypto';

export function decrypt(adminPrivateKey: string, encryptedAesKey: string, encryptedPrivateKey: string): string {
    // decrypt the aes key with the private key
    const aesKey = rsaDecryptWithPrivateKey(adminPrivateKey, encryptedAesKey);
    // describe the private key with the aes key
    const privateKeyDecrypted = aesDecrypt(aesKey, encryptedPrivateKey);
    return privateKeyDecrypted;
}

function rsaDecryptWithPrivateKey(privateKey: string, toDecrypt: string): string {
    // toDecrypt is base64 string
    const buffer = Buffer.from(toDecrypt, 'base64');
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            // RSA/ECB/OAEPWithSHA-256AndMGF1Padding
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256', 
        },
        buffer
    );
    // to base64 string
    return decrypted.toString('base64');
}

function aesDecrypt(aesKey: string, encryptedData: string): string {
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

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}