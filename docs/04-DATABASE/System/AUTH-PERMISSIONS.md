# AUTH & PERMISSIONS

> Runtime QCVL hien tai: Node API + PostgreSQL.

## Nguyen Tac

- Dang nhap dung bang `users` trong PostgreSQL cua QCVL.
- Session dung bang `sessions`.
- Permission luu theo quan he nhieu-nhieu trong `user_permissions`.
- Khong luu mang permission trong user/profile.
- Thay doi permission phai di qua Backend API va can co audit khi mo rong production.
- MVP co the seed admin/noi bo voi day du quyen van hanh chinh.

## Bang Runtime Toi Thieu

Schema runtime toi thieu nam trong [../../../database/schema.sql](../../../database/schema.sql).

| Bang | Vai tro |
|---|---|
| `organizations` | Tenant/to chuc; bill settings: `shop_name`, `shop_address`, `shop_phone`, `default_bill_template` (`a4`\|`k80`) — migration `0009` |
| `users` | Tai khoan dang nhap, password hash, display name, status |
| `workstations` | May/quay su dung POS |
| `permissions` | Danh muc ma quyen |
| `user_permissions` | Gan quyen cho user |
| `sessions` | Token dang nhap va han dung |

## Seed Toi Thieu

Migration/seed phai tao:

1. Organization `VAN-LAM`.
2. Danh muc permission can cho POS/admin/finance/inventory.
3. It nhat mot workstation active.
4. It nhat mot admin active duoc gan day du permission can thiet.

Khong ghi password bootstrap vao repository.

## Preset Goi Y

| Preset | Cach luu MVP | Ghi chu |
|---|---|---|
| Owner/Admin | Gan toan bo active permissions | Bat buoc co `perm.manage_users` |
| Internal Staff | Gan quyen van hanh MVP chinh | POS, khach hang, bang gia, kho, tai chinh |
| Restricted | Gan thu cong theo ngoai le | Dung cho tai khoan thue ngoai/thu viec |
