# INVENTORY — Nghiệp vụ kho vật tư

> Index SoT kho. Queue sống: [../../PHASE-CHECKLIST.md](../../PHASE-CHECKLIST.md).
> Nguồn: phân tích KiotViet + Owner (2026-06-30 trở đi).
>
> Cách đọc (tránh lệch docs ↔ code) — cùng quy ước với BOM:
> 1. **Quyết định Owner** = nghiệp vụ phải đạt khi implement xong.
> 2. **Hiện trạng code** = runtime đang làm gì.
> 3. **Hướng dài / chưa làm** = đã chốt hướng, chưa thuộc slice hiện tại.

---

## Cấu trúc

| File | Vai trò |
|---|---|
| [STOCK-RULES.md](./STOCK-RULES.md) | Chính sách tồn, trừ kho, tồn âm, thường/cuộn/tấm |
| [UNIT-CONVERSION.md](./UNIT-CONVERSION.md) | Đơn vị tồn chính / bán phụ, quy đổi |
| [STOCKTAKE.md](./STOCKTAKE.md) | Kiểm kho, cân bằng, phiếu tự động khi sửa tồn |
| [PRODUCTION-RECONCILIATION.md](./PRODUCTION-RECONCILIATION.md) | Đối soát máy sản xuất — chưa tự trừ kho |

PRD/UX: [../../02-PRD-UX-PhongCanh/Inventory/](../../02-PRD-UX-PhongCanh/Inventory/) · API: [../../05-BACKEND-MayChu/Inventory/INVENTORY-API.md](../../05-BACKEND-MayChu/Inventory/INVENTORY-API.md) · DB: [../../04-DATABASE/Inventory/](../../04-DATABASE/Inventory/)

---

## 1. Quyết định Owner (SoT nghiệp vụ)

| # | Chốt |
|---|---|
| A | `stock_movements` là sổ tồn vận hành QCVL |
| B | `Tồn kho` từ file Hàng hóa KV = **`Tồn KV tạm nhập`** (`inventory_provisional_balances`, `source_type = kiotviet_import`) — chỉ đối chiếu, **không** là mốc mở / tồn chính thức |
| C | **`Tồn QCVL` mục tiêu** = tồn mở từ **mốc mở đã chọn rõ** + chứng từ tin cậy **sau mốc** (nhập / bán-POS / trả / kiểm-cân bằng / thao tác vật lý) |
| D | Import phiếu kiểm kho KV = lịch sử/bằng chứng; **không** tự tạo `stock_movements`. Chỉ khi Owner **chọn rõ** một phiếu/ngày làm mốc mở thì dùng số đó làm tồn mở |
| E | Tạo/lưu hóa đơn bán chính thức (và HD import đã completed tương ứng) ghi `sale_deduction`. Path runtime: [Sales README — Trừ kho khi bán](../Sales/README.md) (POS combo đã khớp slice KV trên `main`) |
| F | MVP: cảnh báo tồn âm, không chặn bán; máy sản xuất **không** tự trừ kho |
| G | Mục tiêu dài: cuộn/tấm quản lý theo **object vật lý**, không chỉ tổng m² gộp |

### Owner 2026-07-20 — Đợt import KiotViet đã xong

- Dữ liệu chuyển đổi ban đầu (hàng hóa, khách, NCC, phiếu nhập, hóa đơn, kiểm kho, sổ quỹ… theo các file đã nạp) **đã import đủ** cho vận hành hiện tại.
- **Không** mở thêm đợt import KiotViet mới làm việc tiếp theo (không xếp “import file KV nữa” vào queue).
- Việc còn lại là **vận hành trên dữ liệu đã có**: chốt/hiển thị tồn QCVL đúng, POS/trừ kho, đối soát — không phụ thuộc import thêm.
- Giữ nút/API import trong app chỉ như công cụ kỹ thuật phòng hờ (re-import/sửa sự cố); **không** coi là bước nghiệp vụ đang mở.
- Chọn **mốc mở** từ phiếu kiểm kho **đã import sẵn** (nếu Owner chọn) vẫn là thao tác cấu hình trên dữ liệu hiện có — **không** phải import file mới.

### Hiển thị V1 (đã chấp nhận tạm)

- Cột list Hàng hóa được phép **fallback số** từ `Tồn KV tạm nhập` khi chưa có `operating_stock`, để màn hình không trống sau import.
- Đây chỉ là **hiển thị tạm**. Logic trừ kho / công thức vận hành **không** được lấy provisional làm tồn chính thức.
- Tab chi tiết phải tách nhãn `Tồn QCVL` và `Tồn KV tạm nhập`. Không đổi tên provisional thành “Tồn kho / Tồn hiện tại”.

> Trước đây PRD có câu “chưa chọn mốc mở thì không lấy KV lấp vào QCVL” **mâu thuẫn** với fallback list V1. **Chốt đọc:** fallback chỉ ở cột list khi chưa có movement; chi tiết vẫn tách nhãn và hiện “Chưa chốt mốc tồn đầu kỳ” khi chưa có `operating_stock`. Công thức có mốc mở (C) vẫn là mục tiêu — chưa có UI/API chọn mốc.

---

## 2. Hiện trạng code (rà soát 2026-07-20)

| Hạng mục | Runtime | Khớp SoT? |
|---|---|---|
| Lưu `Tồn KV tạm nhập` khi import hàng | Có (`inventory_provisional_balances`) | Có |
| API trả riêng `kiotviet_provisional_stock` + `operating_stock` | Có (Postgres) | Có |
| List Hàng hóa fallback KV khi chưa có movement | Có (`CatalogPage`) | Khớp hiển thị V1 tạm |
| Chi tiết tách QCVL / KV; nguồn “Chưa chốt mốc…” | Có | Một phần |
| `operating_stock` Postgres | Latest/`ending_qty` từ `stock_movements`; recompute **cộng mọi movement từ 0** | **Không** (thiếu mốc mở + lọc sau mốc) |
| Chọn mốc mở (UI/API/bảng) | **Chưa** — làm trên dữ liệu KK đã import; **không** cần import file KV mới | **Không** |
| Import kiểm kho KV → movement | Không (đúng) | Có |
| Dev-memory: balanced stocktake (kể cả KV?) như checkpoint | Có hành vi reset trong memory path | **Lệch** SoT “chỉ khi Owner chọn” — không lấy làm chuẩn Postgres |
| PN posted / HD import / POS → `stock_movements` | Có (aggregate theo mã hàng) | Một phần |
| Sửa tồn hàng thường → phiếu + movement | Có; movement type code = `stocktake_balance` | Một phần (một số doc còn viết `stocktake_adjustment`) |
| Khui vật tư Postgres | Chỉ `inventory_shape = normal` | Một phần |
| Cuộn/tấm object CRUD + trừ kho theo object | Route sample/stub; không đủ bảng/repo vận hành | **Không** |
| Chuẩn hóa dần provisional → object | Chưa | **Không** |

**Chưa làm runtime — đóng băng (Owner 2026-07-21):** mốc mở; công thức sau mốc; roll/sheet thật; chuẩn hóa provisional = **nâng cấp sau**. Bản hiện tại dùng được tạm với fallback KV list + movement đã có.

---

## 3. Hướng dài / chưa làm

| Hạng mục | Ghi chú |
|---|---|
| UI/API chọn phiếu KV / ngày làm mốc mở | Trên dữ liệu KK **đã import**; Owner 2026-07-20: không mở đợt import KV mới |
| Lọc movement trước/sau mốc | Tránh tính trùng lịch sử trước mốc |
| Trả hàng / đảo chứng từ sau mốc | Movement đảo |
| Cuộn/tấm object + kiểm kho theo object + POS chọn object | PRD 03-ROLL-SHEET; V1 freeze 2026-07-14 giữ dormant |
| Khui roll/sheet đầy đủ | Hiện chỉ normal |
| Báo cáo đối chiếu KV ↔ QCVL theo bộ lọc | Queue V1 — trên dữ liệu đã có |
| Import thêm file KiotViet (hàng/KK/PN/HD/…) | **Đóng** theo Owner 2026-07-20 — đã import hết |
| Máy sản xuất tự trừ kho | **Không** trong MVP (xem PRODUCTION-RECONCILIATION) |

---

## 4. Nguyên tắc MVP (rút gọn)

- Hóa đơn bán đã lưu = mốc trừ kho MVP.
- Máy sản xuất: giám sát/đối soát, không tự sinh bút toán kho.
- Hàng thường: một đơn vị tồn chính (+ quy đổi).
- Cuộn/tấm: **hướng** object vật lý; V1 có thể chưa kích hoạt.
- Kiểm kho/cân bằng / sửa tồn thường: có bút toán truy vết.

---

## 5. Quy ước ghi docs

- Quyết định tồn chỉ sửa ở **mục 1** + STOCK-RULES / STOCKTAKE / PRD liên quan.
- Mỗi lần đổi code tồn: cập nhật **mục 2** cùng PR.
- Không viết “đã có mốc mở / đã tính đúng công thức C” khi chưa có chọn mốc + lọc sau mốc.
- Phân biệt rõ: **fallback hiển thị list** ≠ **tồn vận hành chính thức**.

---

## Tham chiếu

- [Sales Checkout](../Sales/POS-CHECKOUT.md) · [BOM](../BOM/) · [PRD Khui](../../02-PRD-UX-PhongCanh/POS/K01/01d-K01-KHUI.md)

---

← [Quay về 03-BUSINESS README](../README.md)
