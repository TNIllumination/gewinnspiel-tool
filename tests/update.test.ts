import { describe, expect, it } from "vitest";
import { isNewer } from "../scripts/update.mjs";

describe("Fassungsvergleich", () => {
  it("erkennt eine neuere Fassung", () => {
    expect(isNewer("0.3.0", "0.2.0")).toBe(true);
    expect(isNewer("1.0.0", "0.9.9")).toBe(true);
    expect(isNewer("0.2.1", "0.2.0")).toBe(true);
  });

  it("erkennt gleiche und ältere Fassungen", () => {
    expect(isNewer("0.2.0", "0.2.0")).toBe(false);
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
    expect(isNewer("0.9.9", "1.0.0")).toBe(false);
  });

  it("vergleicht Zahlen, nicht Text", () => {
    // Als Text wäre "0.9.0" größer als "0.10.0" — das wäre ein
    // verpasstes Update, das niemand bemerkt.
    expect(isNewer("0.10.0", "0.9.0")).toBe(true);
    expect(isNewer("0.9.0", "0.10.0")).toBe(false);
    expect(isNewer("2.0.0", "10.0.0")).toBe(false);
  });

  it("kommt mit unterschiedlich langen Angaben klar", () => {
    expect(isNewer("0.3", "0.2.9")).toBe(true);
    expect(isNewer("1", "0.9.9")).toBe(true);
    expect(isNewer("0.2.0", "0.2")).toBe(false);
  });

  it("stürzt bei unsinnigen Angaben nicht ab", () => {
    expect(isNewer("kaputt", "0.2.0")).toBe(false);
    expect(isNewer("", "0.2.0")).toBe(false);
  });
});
