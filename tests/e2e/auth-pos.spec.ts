import { expect, test } from "@playwright/test";

test("login, open dashboard modules, refresh POS shell, and logout", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill("admin");
  await page.getByLabel("Mật khẩu").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "QC-OMS" })).toBeVisible();
  await page.getByRole("button", { name: /^(POS|Bán hàng)$/ }).click();
  await expect(page.getByLabel("K01 topbar")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("K01 topbar")).toBeVisible();
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("heading", { name: "QC-OMS" })).toBeVisible();
});

test("login, create a cash invoice from POS, and clear the paid draft", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill("admin");
  await page.getByLabel("Mật khẩu").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "QC-OMS" })).toBeVisible();

  await page.getByRole("button", { name: /^(POS|Bán hàng)$/ }).click();
  await expect(page.getByLabel("K01 topbar")).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm khách" }).fill("KH000001");
  await page.getByRole("textbox", { name: "Tìm khách" }).press("Enter");
  await page.getByRole("button", { name: /Chọn KH000001/ }).click();
  await expect(page.getByRole("textbox", { name: "Tìm khách" })).toHaveValue("Khách lẻ");

  await page.getByRole("button", { name: /Standee chữ X 180 000/ }).click();
  await expect(page.getByLabel("K02 giỏ hàng").getByText("Standee chữ X")).toBeVisible();
  await page.getByLabel("Số lượng Standee chữ X").fill("2");
  await page.getByRole("button", { name: "Thanh toán" }).click();
  await expect(page.getByLabel("Ngăn thanh toán")).toBeVisible();
  await page.getByLabel("Tiền mặt trả hóa đơn").fill("360000");
  const checkoutResponse = page.waitForResponse(
    (response) => response.url().includes("/api/v1/orders/checkout") && response.request().method() === "POST",
  );
  await page.getByLabel("Ngăn thanh toán").getByRole("button", { name: "Tạo hóa đơn", exact: true }).click();
  const response = await checkoutResponse;
  expect(response.status()).toBe(201);
  const body = await response.json();

  expect(body.data.order.code).toMatch(/^HD[0-9]{6}$/);
  expect(body.data.order.paid_amount).toBe(360000);
  await expect(page.getByLabel("Ngăn thanh toán")).toBeHidden();
  await expect(page.getByLabel("K02 giỏ hàng").getByText("Standee chữ X")).toBeHidden();
});
