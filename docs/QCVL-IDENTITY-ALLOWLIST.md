# Allow-list technical identifier cũ QCVL

Cập nhật: `2026-07-24`

## Mục đích

QCVL là tên duy nhất người dùng và tài liệu active nhìn thấy. Các identifier dưới đây còn dùng
`qcoms` hoặc `qc-oms` chỉ vì rename có thể làm mất session/draft, hỏng deploy hoặc hỏng dữ liệu NAS.
Chúng là technical compatibility, không phải tên sản phẩm.

## Identifier được giữ

| Vị trí | Identifier | Consumer | Lý do giữ | Điều kiện đổi |
|---|---|---|---|---|
| `docker-compose.nas.yml` | PostgreSQL database/user/container có `qcoms` | NAS Docker, PostgreSQL, health, migration | Persistent database/container. Đổi trực tiếp có thể tách runtime khỏi dữ liệu live. | Chỉ đổi trong migration/rebuild riêng có backup, rollback, NAS dry-run và invariant audit. |
| Client storage | `qc-oms-*`, `qc_oms.*` | Theme, access token, POS draft, quote/invoice handoff, purchase draft, device ID | Đổi làm mất session/draft người dùng. | Có migration đọc key cũ một lần, chuyển key mới, test rollback. |
| Local default email | `*@qc-oms.local` | Dev-memory, test/verify script | Fixture identity, không hiển thị public. | Đổi cùng toàn bộ fixture, seed, e2e và verify credentials. |
| Windows task/script filename | `*-qc-oms-*` | Task Scheduler, shortcut, watchdog đã cài | Rename có thể bỏ orphan task hoặc làm startup fail. | Script migration tìm task cũ, tạo QCVL task, verify startup, rồi xóa task cũ. |
| Test/runtime env key | `QC_OMS_ALLOWED_ORIGINS` | Playwright/test config | Internal config key, không public. | Đổi đồng thời tất cả producer/consumer và CI config. |

## Cấm

- Không dùng các identifier trên trong UI, PWA, title, toast, email gửi người dùng hoặc tài liệu hướng dẫn.
- Không tạo thêm identifier mới chứa `QC-OMS`, `QC_OMS`, `qc-oms` hoặc `qcoms`.
- Không giữ alias ngoài bảng này khi consumer đã hết.

## Quy trình đổi sau

1. Tạo plan con runtime riêng.
2. Map producer/consumer và dữ liệu persistent.
3. Backup/checkpoint, migration có rollback.
4. Test local, NAS dry-run, deploy, health và invariant audit.
5. Xóa entry allow-list ngay sau khi consumer cũ hết.
