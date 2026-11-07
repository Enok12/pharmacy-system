import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createCategory, createManufacturer } from "../helpers/fixtures.js";

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Products", () => {
  it("GET is open to any authenticated role; 401 signed out", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/products", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(200);

    const signedOut = await apiRequest("GET", "/api/v1/products");
    expect(signedOut.status).toBe(401);
  });

  it("POST as Cashier → 403; as Admin → 201", async () => {
    const category = await createCategory(tokenFor("admin"));
    const manufacturer = await createManufacturer(tokenFor("admin"));
    const payload = {
      name: uniqueName("Product"),
      categoryId: category.id,
      manufacturerId: manufacturer.id,
      unitOfMeasure: "TABLET",
      costPrice: 5,
      sellingPrice: 10,
    };

    const asCashier = await apiRequest("POST", "/api/v1/products", { token: tokenFor("cashier"), body: payload });
    expect(asCashier.status).toBe(403);

    const asAdmin = await apiRequest("POST", "/api/v1/products", { token: tokenFor("admin"), body: payload });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.product.sellingPrice).toBe(10);
  });

  it("missing required fields → 422", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/products", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Incomplete") },
    });
    expect(status).toBe(422);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("nonexistent categoryId/manufacturerId → 422 naming the field", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/products", {
      token: tokenFor("admin"),
      body: {
        name: uniqueName("Orphan"),
        categoryId: "does-not-exist",
        manufacturerId: "does-not-exist",
        unitOfMeasure: "TABLET",
        costPrice: 1,
        sellingPrice: 2,
      },
    });
    expect(status).toBe(422);
    expect(body.errors.some((e) => e.field === "categoryId")).toBe(true);
  });

  it("duplicate (name, manufacturerId) → 409", async () => {
    const category = await createCategory(tokenFor("admin"));
    const manufacturer = await createManufacturer(tokenFor("admin"));
    const name = uniqueName("SameName");
    const payload = {
      name,
      categoryId: category.id,
      manufacturerId: manufacturer.id,
      unitOfMeasure: "TABLET",
      costPrice: 1,
      sellingPrice: 2,
    };

    const first = await apiRequest("POST", "/api/v1/products", { token: tokenFor("admin"), body: payload });
    expect(first.status).toBe(201);

    const dup = await apiRequest("POST", "/api/v1/products", { token: tokenFor("admin"), body: payload });
    expect(dup.status).toBe(409);
  });

  it("duplicate barcode → 409", async () => {
    const category = await createCategory(tokenFor("admin"));
    const manufacturer = await createManufacturer(tokenFor("admin"));
    const barcode = `BC-${Date.now()}`;

    const first = await apiRequest("POST", "/api/v1/products", {
      token: tokenFor("admin"),
      body: {
        name: uniqueName("Barcoded"),
        categoryId: category.id,
        manufacturerId: manufacturer.id,
        unitOfMeasure: "TABLET",
        costPrice: 1,
        sellingPrice: 2,
        barcode,
      },
    });
    expect(first.status).toBe(201);

    const dup = await apiRequest("POST", "/api/v1/products", {
      token: tokenFor("admin"),
      body: {
        name: uniqueName("BarcodedAgain"),
        categoryId: category.id,
        manufacturerId: manufacturer.id,
        unitOfMeasure: "TABLET",
        costPrice: 1,
        sellingPrice: 2,
        barcode,
      },
    });
    expect(dup.status).toBe(409);
  });

  it("PATCH updates price and deactivates", async () => {
    const category = await createCategory(tokenFor("admin"));
    const manufacturer = await createManufacturer(tokenFor("admin"));
    const created = await apiRequest("POST", "/api/v1/products", {
      token: tokenFor("admin"),
      body: {
        name: uniqueName("Editable"),
        categoryId: category.id,
        manufacturerId: manufacturer.id,
        unitOfMeasure: "TABLET",
        costPrice: 1,
        sellingPrice: 2,
      },
    });
    const { id } = created.body.data.product;

    const updated = await apiRequest("PATCH", `/api/v1/products/${id}`, {
      token: tokenFor("admin"),
      body: { sellingPrice: 15, isActive: false },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.product.sellingPrice).toBe(15);
    expect(updated.body.data.product.isActive).toBe(false);
  });
});
