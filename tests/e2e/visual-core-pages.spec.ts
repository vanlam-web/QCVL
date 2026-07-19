import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const visualStylePath = path.join(import.meta.dirname, "visual-regression.css");

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  fullPage: false,
  scale: "css",
  stylePath: visualStylePath,
  threshold: 0.2,
} as const;

const corePages = [
  { path: "/dashboard", name: "dashboard", waitFor: async (page: Page) => expect(page.getByRole("navigation", { name: "Điều hướng tổng quan" })).toBeVisible() },
  { path: "/pos", name: "pos", waitFor: async (page: Page) => expect(page.getByLabel("K01 topbar")).toBeVisible() },
  { path: "/sales-documents", name: "sales-documents", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách chứng từ bán hàng" })).toBeVisible() },
  { path: "/customers", name: "customers", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách khách hàng" })).toBeVisible() },
  { path: "/products", name: "products", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách hàng hóa" })).toBeVisible() },
  { path: "/price-book", name: "price-book", waitFor: async (page: Page) => expect(page.getByRole("heading", { name: "Bảng giá" })).toBeVisible() },
  { path: "/inventory", name: "inventory", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách hàng hóa" })).toBeVisible() },
  { path: "/finance", name: "finance", waitFor: async (page: Page) => expect(page.locator('.management-list-surface[aria-label="Sổ quỹ"]')).toBeVisible() },
  { path: "/reports", name: "reports", waitFor: async (page: Page) => expect(page.getByRole("heading", { name: "Báo cáo" })).toBeVisible() },
  { path: "/suppliers", name: "suppliers", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách nhà cung cấp" })).toBeVisible() },
  { path: "/receipts", name: "purchase-receipts", waitFor: async (page: Page) => expect(page.getByRole("region", { name: "Danh sách phiếu nhập" })).toBeVisible() },
  { path: "/admin", name: "admin", waitFor: async (page: Page) => expect(page.getByRole("heading", { name: "Quản trị" })).toBeVisible() },
] as const;

test.use({ viewport: { width: 1440, height: 900 } });

test("login page matches visual baseline", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "QC-OMS" })).toBeVisible();
  await expect(page).toHaveScreenshot("core-login.png", screenshotOptions);
});

test("authenticated core pages match visual baselines", async ({ page }) => {
  await login(page);

  for (const corePage of corePages) {
    await page.goto(corePage.path);
    await corePage.waitFor(page);
    await expect(page).toHaveScreenshot(`core-${corePage.name}.png`, screenshotOptions);
  }
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill("admin");
  await page.getByLabel("Mật khẩu").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng tổng quan" })).toBeVisible();
}
