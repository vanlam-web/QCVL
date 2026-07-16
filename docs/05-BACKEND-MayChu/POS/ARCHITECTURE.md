# ARCHITECTURE — Kiến trúc State Manager & Data Safety

> **Nguồn:** Di chuyển từ `02-PRD-UX-PhongCanh/POS/01-POS-LAYOUT.md` (Section V) và `02-PRD-UX-PhongCanh/POS/K01/01c-K01-ARCH-SAFETY.md` (Section V.1–V.3)

---

## 1. KIẾN TRÚC STATE MANAGER (POS STORE)

### 1.1. Nguyên tắc cốt lõi

UI component **chỉ làm 2 việc:**
1. Hiển thị state từ Store (qua selector / derived).
2. Phát lệnh bằng cách gọi Action từ Store — không tự tính, không tự gọi API.

Component UI **TUYỆT ĐỐI KHÔNG** viết trực tiếp trong `.tsx` / `.svelte`:

- Tính toán nghiệp vụ: `m² = R × D × SL`, `Thành tiền = m² × Đơn giá`
- Thao tác mảng giỏ hàng: `cart.push()`, `cart.find()`, `cart.reduce()`
- Gọi dữ liệu nghiệp vụ trực tiếp: `direct database access`, `direct database access`
- Đăng ký Realtime trực tiếp trong component thay vì qua lớp `lib/realtime`
- Sinh bill text: template Zalo, format tiền
- Validation: check SĐT rỗng, check giỏ rỗng trước thanh toán

### 1.2. State tập trung trong Store

| Vùng state | Vai trò | Action đi kèm |
|---|---|---|
| **Tabs** | Danh sách tab đang mở, tab active, cuộn ngang | `addTab()`, `closeTab(id)`, `setActiveTab(id)`, `scrollTabs(dir)` |
| **Cart** | Mảng dòng sản phẩm từng tab, focus row | `addRow()`, `updateRow()`, `removeRow()`, `selectRow()` |
| **Order note** | Ghi chú tổng tab active | `setNote(text)` |
| **Customer** | KH đang chọn, bảng giá, % chiết khấu | `setCustomer(id)`, `clearCustomer()`, `setPriceList(id)` |
| **Toast** | Trạng thái hiển thị Toast | `showMissingPhoneToast()`, `hideToast()` |
| **Production queue** | Danh sách file máy sản xuất đang chờ K02-D | `enqueueFile()`, `removeFromQueue()` |
| **Connection** | Realtime: Connected / Connecting / Disconnected | `setConnection(state)` |
| **Active user** | Hồ sơ nhân viên đang đăng nhập + `user_id` session | `setUser(profile)` |

### 1.3. Pattern chuẩn

**Hiển thị:**

```ts
// SAI — logic nặng inline trong component
function K02A_Row({ row }) {
  const total = row.r * row.d * row.sl
  return <div>{total} m²</div>
}

// ĐÚNG — UI chỉ đọc state đã được Store tính sẵn
function K02A_Row({ row }) {
  return <div>{row.totalArea} m²</div>
}
```

**Tương tác:**

```ts
// SAI — component tự mutate state
<input onChange={e => cart.push({ ...row, sl: e.target.value })} />

// ĐÚNG — component phát action, Store lo tính toán
<input onChange={e => posStore.updateRow(row.id, { sl: e.target.value })} />
```

### 1.4. Ràng buộc

| Ràng buộc | Chi tiết |
|---|---|
| Component ≤ 200 dòng | Trừ K02-A có nhiều row |
| Không import QCVL Node API data client trong UI | Dữ liệu nghiệp vụ chỉ đi qua API Client; QCVL Node API SDK chỉ dùng tại lớp Auth/Realtime |
| Công thức tính đặt tại `lib/pos/calc.ts` | `m²`, `Thành tiền`, `Tiền thừa` |
| Action trong Store phải **pure** | Hoặc có doc rõ side-effect |

### 1.5. Cấu trúc thư mục

```
src/
├── stores/
│   └── posStore.ts          ← State tập trung + Actions
├── lib/pos/
│   ├── calc.ts              ← Công thức tính (m², tiền, bill)
│   ├── api.ts               ← API Client gọi /api/v1
│   ├── realtime.ts          ← QCVL Node API Realtime subscriptions
│   └── types.ts             ← TypeScript types cho Row, Tab, Customer
├── lib/auth/
│   └── QCVL Node API.ts          ← QCVL Node API Auth client
└── components/pos/
    ├── K01/
    ├── K02/
    └── K03/
```

---

## 2. PERSISTENCE — LƯU TRỮ LOCAL (CHỐNG SẬP NGUỒN)

### 2.1. Phạm vi lưu trữ LocalStorage

> Database reference: `04-DATABASE/Sales/POS-TABLES.md`

Khi Store thay đổi (debounce 300ms), ghi xuống LocalStorage (key: `qc-oms.pos.invoice-tabs.v1`):

| Vùng dữ liệu | Ghi chú |
|---|---|
| Danh sách tab đang mở | Kèm thứ tự, tab active |
| Trạng thái từng tab | `Active` / `Dirty` (đã có hàng chưa thanh toán) |
| Toàn bộ dòng sản phẩm trong giỏ từng tab | Rộng / Dài / SL / Đơn giá / Thành tiền |
| Ghi chú đơn hàng (K02-B) | Theo từng tab |
| Đối tác đang chọn + bảng giá (K03-A) | Theo từng tab |

### 2.2. Vòng đời dữ liệu

```
Bất kỳ thay đổi nào trong Store (addRow, setNote, setCustomer...)
    ↓ (Debounce 300ms)
Ghi xuống LocalStorage (key: `qc-oms.pos.invoice-tabs.v1`)
    ↓
Sập nguồn / F5 / Đóng tab trình duyệt → Dữ liệu vẫn còn nguyên
    ↓
Khởi động lại POS → Đọc LocalStorage → Dựng lại nguyên trạng thái làm việc; dòng hàng hydrate lại sản phẩm từ catalog hiện tại để cập nhật đơn vị quy đổi/giá trị sản phẩm mới nhất
    ↓
Dữ liệu CHỈ bị xóa sạch khỏi LocalStorage khi:
    (a) Bấm [Thanh toán] thành công (F9), HOẶC
    (b) Nhân viên chủ động bấm [X] đóng tab
```

### 2.3. Lưu ý an toàn

- Không lưu thông tin nhạy cảm (mật khẩu, token bí mật) — chỉ lưu state làm việc.
- Khi version schema thay đổi, tăng suffix key `qc-oms.pos.invoice-tabs.v1` → `v2` để tránh crash do dữ liệu cũ.

---

## 3. CONCURRENCY LOCK — KHÓA ĐƠN TRANH CHẤP

### 3.1. Trigger

Khi nhân viên mở đơn hàng cũ để cập nhật (`Update_HD010664`) — Tab khởi tạo thành công → **ngay lập tức** gọi RPC.

### 3.2. Workflow

```
Nhân viên click [Sửa] HD010664
    ↓
Tab mới được sinh ra trên POS
    ↓
Ngay lập tức gọi: POST /api/v1/orders/HD010664/lock
    ↓
Server ghi cờ locked_by + locked_at vào bảng orders
    ↓
Realtime push xuống màn hình/máy sản xuất liên quan
    ↓
Màn hình xưởng hiển thị: [🔒 Đang thanh toán tại quầy]
    ↓
Toàn bộ nút bấm chỉnh sửa của thợ in/cắt bị vô hiệu hóa
```

### 3.3. Giải phóng khóa

| Tình huống | Hành động |
|---|---|
| Đơn hoàn thành (bấm [Thanh toán] thành công) | Gọi RPC `unlock_order(order_id)` |
| Tab POS bị đóng (bấm [X] trên tab) | Gọi RPC `unlock_order(order_id)` |
| Tab POS bị đóng do refresh/timeout | TTL lock tự hết hạn — **30 phút** |

### 3.4. Ràng buộc

Trong suốt thời gian giữ khóa, hệ thống phải kiểm tra lock còn hiệu lực trước khi cho lưu. Nếu mất khóa giữa chừng (do tab khác giành quyền), hiển thị cảnh báo và từ chối ghi.

---

## 4. TAB OVERFLOW — XỬ LÝ TRÀN DẢI TAB

### 4.1. Phát hiện tràn

Khi tổng chiều rộng các tab `>` chiều rộng vùng hiển thị khả dụng → kích hoạt chế độ cuộn ngang.

### 4.2. Cơ chế điều phối

| Thành phần | Vị trí | Hành vi |
|---|---|---|
| Nút `[◀]` | Đầu trái dải tab | Click → cuộn sang trái 1 tab (snap). Ẩn/mờ 50% + disabled nếu đã ở đầu |
| Nút `[▶]` | Cuối phải dải tab | Click → cuộn sang phải 1 tab (snap). Ẩn/mờ 50% + disabled nếu đã ở cuối |
| Cuộn chuột | Rê chuột vào dải tab | `wheel` → cuộn ngang (deltaY mapped sang scrollLeft) |
| Auto-scroll | Tự động | Tab Active (hoặc tab vừa tạo) luôn được cuộn vào vùng nhìn thấy |

### 4.3. Quy tắc lưu trữ

- Vị trí cuộn hiện tại của dải tab **không cần lưu** vào LocalStorage (không có key trong §2) — khi khởi động lại POS, tab active sẽ được auto-scroll vào view.
- Nút `[+]` **luôn hiển thị** ở cuối dải, không bị che bởi nút `[▶]`.

---

← [Quay về POS README](./README.md)
