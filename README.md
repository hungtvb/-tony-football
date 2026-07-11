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
