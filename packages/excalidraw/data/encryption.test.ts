/**
 * Characterization tests for packages/excalidraw/data/encryption.ts
 *
 * This module provides the end-to-end encryption behind shareable links and
 * live collaboration: the key ends up in the URL fragment (#json=id,KEY or
 * #room=id,KEY) and the server only ever stores ciphertext. These tests pin
 * down what the code does *today* so it can be refactored safely; they are
 * not a statement of what it ideally should do.
 */
import {
  IV_LENGTH_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
  getCryptoKey,
} from "./encryption";

const AES_GCM_TAG_BYTES = 16;

const decode = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

// A real key generated once by generateEncryptionKey(), hard-coded so that
// the tests below are independent of key generation.
const FIXED_KEY = "Q0NRbdJQZbPuTP_gqJ7BJA";

describe("generateEncryptionKey", () => {
  it("givenNoArgument_whenGenerating_returnsA22CharBase64UrlString", async () => {
    const key = await generateEncryptionKey();

    expect(typeof key).toBe("string");
    // 128 bits = 16 bytes = 22 base64url chars, unpadded
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("givenTwoCalls_whenGenerating_returnsDifferentKeys", async () => {
    const a = await generateEncryptionKey();
    const b = await generateEncryptionKey();

    expect(a).not.toBe(b);
  });

  it("givenCryptoKeyArgument_whenGenerating_returnsExtractableAes128GcmKey", async () => {
    const key = await generateEncryptionKey("cryptoKey");

    expect(key.type).toBe("secret");
    expect(key.extractable).toBe(true);
    expect(key.algorithm).toEqual({ name: "AES-GCM", length: 128 });
    expect([...key.usages].sort()).toEqual(["decrypt", "encrypt"]);
  });
});

describe("getCryptoKey", () => {
  it("givenValidKeyString_whenImporting_returnsNonExtractableKeyWithOnlyRequestedUsage", async () => {
    const key = await getCryptoKey(FIXED_KEY, "encrypt");

    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["encrypt"]);
    expect(key.algorithm).toEqual({ name: "AES-GCM", length: 128 });
  });

  it("givenEncryptOnlyKey_whenUsedToDecrypt_rejects", async () => {
    const encryptOnly = await getCryptoKey(FIXED_KEY, "encrypt");
    const { encryptedBuffer, iv } = await encryptData(encryptOnly, "x");

    await expect(
      window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        encryptOnly,
        encryptedBuffer,
      ),
    ).rejects.toThrow();
  });

  it("givenKeyStringOfWrongLength_whenImporting_rejects", async () => {
    // 256-bit key: valid base64url, but import hard-codes alg "A128GCM"
    const key256 = "Q0NRbdJQZbPuTP_gqJ7BJEFBQUFBQUFBQUFBQUFBQUE";

    await expect(getCryptoKey(key256, "encrypt")).rejects.toThrow();
  });

  it("givenEmptyKeyString_whenImporting_rejects", async () => {
    await expect(getCryptoKey("", "decrypt")).rejects.toThrow();
  });
});

describe("createIV", () => {
  it("whenCreating_returns12RandomBytes", () => {
    const a = createIV();
    const b = createIV();

    expect(IV_LENGTH_BYTES).toBe(12);
    expect(a).toBeInstanceOf(Uint8Array);
    expect(a.byteLength).toBe(12);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("encryptData / decryptData", () => {
  it("givenString_whenEncryptedThenDecrypted_returnsOriginalUtf8Text", async () => {
    const text = '{"type":"excalidraw","elements":[]} — ünïcødé ✏️';

    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, text);
    const decrypted = await decryptData(iv, encryptedBuffer, FIXED_KEY);

    expect(decode(decrypted)).toBe(text);
  });

  it("givenPlaintext_whenEncrypting_ciphertextIsPlaintextPlus16ByteTagAndIvIs12Bytes", async () => {
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, plaintext);

    expect(iv.byteLength).toBe(IV_LENGTH_BYTES);
    expect(encryptedBuffer.byteLength).toBe(
      plaintext.byteLength + AES_GCM_TAG_BYTES,
    );
    expect(new Uint8Array(encryptedBuffer).slice(0, 5)).not.toEqual(plaintext);
  });

  it("givenSamePlaintextTwice_whenEncrypting_usesFreshIvAndProducesDifferentCiphertext", async () => {
    const first = await encryptData(FIXED_KEY, "same");
    const second = await encryptData(FIXED_KEY, "same");

    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
    expect(new Uint8Array(first.encryptedBuffer)).not.toEqual(
      new Uint8Array(second.encryptedBuffer),
    );
  });

  it("givenEachSupportedInputType_whenEncrypting_allDecryptToSameBytes", async () => {
    const bytes = new TextEncoder().encode("payload");
    const inputs = [
      "payload",
      bytes,
      bytes.buffer,
      new Blob([bytes]),
      new File([bytes], "scene.excalidraw"),
    ];

    for (const input of inputs) {
      const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, input);
      expect(decode(await decryptData(iv, encryptedBuffer, FIXED_KEY))).toBe(
        "payload",
      );
    }
  });

  it("givenCryptoKeyObject_whenEncrypting_canBeDecryptedWithItsExportedString", async () => {
    const cryptoKey = await generateEncryptionKey("cryptoKey");
    const exported = (await window.crypto.subtle.exportKey("jwk", cryptoKey))
      .k!;

    const { encryptedBuffer, iv } = await encryptData(cryptoKey, "hello");

    expect(decode(await decryptData(iv, encryptedBuffer, exported))).toBe(
      "hello",
    );
  });

  it("givenUint8ArrayCiphertext_whenDecrypting_isAcceptedLikeArrayBuffer", async () => {
    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, "abc");

    const decrypted = await decryptData(
      iv,
      new Uint8Array(encryptedBuffer),
      FIXED_KEY,
    );

    expect(decode(decrypted)).toBe("abc");
  });

  // --- boundaries ---------------------------------------------------------

  it("givenEmptyString_whenEncrypted_producesTagOnlyCiphertextThatDecryptsToEmpty", async () => {
    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, "");

    expect(encryptedBuffer.byteLength).toBe(AES_GCM_TAG_BYTES);
    expect(decode(await decryptData(iv, encryptedBuffer, FIXED_KEY))).toBe("");
  });

  it("givenLargePayload_whenEncryptedThenDecrypted_roundTripsByteForByte", async () => {
    const big = new Uint8Array(256 * 1024);
    for (let i = 0; i < big.length; i++) {
      big[i] = i % 251;
    }

    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, big);
    const decrypted = new Uint8Array(
      await decryptData(iv, encryptedBuffer, FIXED_KEY),
    );

    expect(decrypted.byteLength).toBe(big.byteLength);
    expect(decrypted).toEqual(big);
  });

  // --- failure paths ------------------------------------------------------

  it("givenWrongKey_whenDecrypting_rejectsInsteadOfReturningGarbage", async () => {
    const otherKey = await generateEncryptionKey();
    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, "secret");

    await expect(decryptData(iv, encryptedBuffer, otherKey)).rejects.toThrow();
  });

  it("givenTamperedCiphertext_whenDecrypting_rejectsBecauseGcmTagFails", async () => {
    const { encryptedBuffer, iv } = await encryptData(FIXED_KEY, "secret");
    const tampered = new Uint8Array(encryptedBuffer.slice(0));
    tampered[0] ^= 0xff;

    await expect(decryptData(iv, tampered, FIXED_KEY)).rejects.toThrow();
  });

  it("givenWrongIv_whenDecrypting_rejects", async () => {
    const { encryptedBuffer } = await encryptData(FIXED_KEY, "secret");

    await expect(
      decryptData(createIV(), encryptedBuffer, FIXED_KEY),
    ).rejects.toThrow();
  });

  it("givenTruncatedCiphertextShorterThanTag_whenDecrypting_rejects", async () => {
    const { iv } = await encryptData(FIXED_KEY, "secret");

    await expect(
      decryptData(iv, new Uint8Array(8), FIXED_KEY),
    ).rejects.toThrow();
  });

  it("givenMalformedKeyString_whenEncrypting_rejectsBeforeEncrypting", async () => {
    await expect(encryptData("not-a-key", "data")).rejects.toThrow();
  });
});
