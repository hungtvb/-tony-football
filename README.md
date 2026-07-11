# Tony Football Max

Game bóng đá arcade 6v6 chạy trực tiếp trên trình duyệt, không cần tải asset hay cài framework.

## Điều khiển

- `WASD` / phím mũi tên: di chuyển
- `J`: chuyền bóng hoặc tắc bóng
- Giữ và thả `K`: sút bóng theo lực
- `L`: tăng tốc
- `Space`: đổi cầu thủ
- `Escape`: tạm dừng
- Trên điện thoại: joystick và cụm nút cảm ứng xuất hiện tự động

## Chạy local

```bash
npm start
```

Mở `http://localhost:4173`.

## Kiểm tra

```bash
npm test
```

Toàn bộ game dùng Canvas 2D và Web Audio API, có ba cấp độ AI, stamina, radar, thống kê trực tiếp, hiệu ứng ghi bàn và bố cục responsive.

## Đồ họa Sprint 1

- Sân cỏ procedural với vệt cắt, chi tiết mặt cỏ và ánh đèn
- Khán đài, bảng LED và khung thành giả lập chiều sâu
- Cầu thủ 2.5D xoay theo hướng chạy, có chuyển động tay chân
- Bóng có đổ bóng, phản sáng và vệt chuyển động
- Camera bám bóng, zoom động, rung khi ghi bàn và vignette điện ảnh
- HUD nâng cấp với scoreboard và hiệu ứng điểm số

## Animation Sprint 2

- Chu kỳ chạy thay đổi theo tốc độ thực của từng cầu thủ
- Animation riêng cho nhận bóng, chuyền, sút và xoạc bóng
- Thủ môn có trang phục, găng tay và tư thế bay người
- Hiệu ứng tăng tốc, vòng va chạm và cỏ bắn khi tắc bóng
- Bóng xoay theo cú sút và nhịp rê bóng
