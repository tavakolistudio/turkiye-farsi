import { describe, it, expect } from "vitest";
import { classify } from "@/server/newsroom/classify/classification.service";

const categories = [
  { slug: "istanbul", name: "استانبول" },
  { slug: "economy", name: "اقتصاد" },
  { slug: "residence", name: "اقامت" },
];
const tags = [{ slug: "lira", name: "لیر" }];

describe("classification — bilingual (Persian + Turkish)", () => {
  it("suggests a category for Persian text (existing behavior)", () => {
    const r = classify("لیر ترکیه در برابر دلار سقوط کرد", categories, tags);
    expect(r.primaryCategorySlug).toBe("economy");
    expect(r.suggestedTagSlugs).toContain("lira");
  });

  it("suggests a category for the same story reported in Turkish", () => {
    const r = classify("Merkez Bankası rezervleri ve dolar kuru açıklandı", categories, tags);
    expect(r.primaryCategorySlug).toBe("economy");
  });

  it("recognizes İstanbul (capital dotted İ) despite JS's locale-agnostic lowercasing quirk", () => {
    const r = classify("İstanbul'da yeni bir düzenleme açıklandı", categories, tags);
    expect(r.geographicScope).toBe("استانبول");
  });

  it("flags a Turkish immigration/legal story as high sensitivity", () => {
    const r = classify("Göç İdaresi oturma izni başvurularında yeni kanun uyguluyor", categories, tags);
    expect(r.sensitivityLevel).toBe("HIGH");
  });
});
