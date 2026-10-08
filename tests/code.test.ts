import { describe, expect, it } from "vitest";
import { normalizeCode } from "../src/code.js";

describe("normalizeCode（与 Python SDK 同规则）", () => {
  it("原生前缀原样返回（前缀小写化）", () => {
    expect(normalizeCode("sh600667")).toBe("sh600667");
    expect(normalizeCode("sz000001")).toBe("sz000001");
    expect(normalizeCode("SH600667")).toBe("sh600667");
    expect(normalizeCode("SZ000001")).toBe("sz000001");
  });

  it("后缀风格 → 原生格式", () => {
    expect(normalizeCode("600667.SH")).toBe("sh600667");
    expect(normalizeCode("000001.SZ")).toBe("sz000001");
    expect(normalizeCode("830799.BJ")).toBe("bj830799");
    expect(normalizeCode("600667.sh")).toBe("sh600667"); // 大小写不敏感
  });

  it("纯 6 位 → 按首位推断市场", () => {
    expect(normalizeCode("600667")).toBe("sh600667"); // 6 → 沪
    expect(normalizeCode("512600")).toBe("sh512600"); // 5 → 沪（ETF）
    expect(normalizeCode("000001")).toBe("sz000001"); // 0 → 深
    expect(normalizeCode("300750")).toBe("sz300750"); // 3 → 深
    expect(normalizeCode("830799")).toBe("bj830799"); // 8 → 北
    expect(normalizeCode("430047")).toBe("bj430047"); // 4 → 北
  });

  it("港股 / 美股前缀保留（只小写前缀）", () => {
    expect(normalizeCode("hk00700")).toBe("hk00700");
    expect(normalizeCode("HK00700")).toBe("hk00700");
    expect(normalizeCode("usAAPL")).toBe("usAAPL"); // 后缀大小写原样
    expect(normalizeCode("USAAPL")).toBe("usAAPL");
  });

  it("空值 / 认不出的原样返回（不猜）", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
    expect(normalizeCode("abc")).toBe("abc");
    expect(normalizeCode("60066")).toBe("60066"); // 5 位不推断
  });

  it("前后空格被裁掉", () => {
    expect(normalizeCode("  sh600667  ")).toBe("sh600667");
  });
});
