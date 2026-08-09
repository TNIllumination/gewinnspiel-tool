import { createHmac } from "node:crypto";

/// Deterministischer Zufallsgenerator (HMAC-SHA256 im Zaehlerbetrieb).
///
/// Warum nicht einfach crypto.randomBytes? Weil die Ziehung nachrechenbar
/// sein soll: Aus demselben Seed muss jeder dasselbe Ergebnis erhalten.
/// Der Seed selbst wird kryptografisch sicher erzeugt und erst NACH der
/// Ziehung veroeffentlicht — vorher ist er durch den Commit-Hash gebunden.
export class SeededRandom {
  private counter = 0;
  private block = Buffer.alloc(0);
  private offset = 0;

  constructor(private readonly seed: string) {}

  private refill() {
    this.block = createHmac("sha256", this.seed)
      .update(`ctr:${this.counter++}`)
      .digest();
    this.offset = 0;
  }

  private bytes(count: number): Buffer {
    const out = Buffer.alloc(count);
    let written = 0;
    while (written < count) {
      if (this.offset >= this.block.length) this.refill();
      const take = Math.min(count - written, this.block.length - this.offset);
      this.block.copy(out, written, this.offset, this.offset + take);
      this.offset += take;
      written += take;
    }
    return out;
  }

  /// Gleichverteilte Ganzzahl in [0, max). Verwirft Werte oberhalb der
  /// groessten durch `max` teilbaren Schranke — sonst waeren kleine Zahlen
  /// minimal wahrscheinlicher (Modulo-Verzerrung).
  nextBelow(max: number): number {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`nextBelow erwartet eine positive Ganzzahl, bekam ${max}`);
    }
    if (max === 1) return 0;

    const SPACE = 2 ** 48; // 6 Byte, sicher innerhalb von Number.MAX_SAFE_INTEGER
    const limit = Math.floor(SPACE / max) * max;

    for (;;) {
      const b = this.bytes(6);
      const value = b.readUIntBE(0, 6);
      if (value < limit) return value % max;
    }
  }
}
