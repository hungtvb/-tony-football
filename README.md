# Tony Football Max

Game bóng đá arcade 6v6 dành cho PC, chạy trực tiếp trên trình duyệt.

## Điều khiển

- Phím mũi tên: di chuyển và chọn hướng chuyền/sút
- `S`: chuyền ngắn / đổi cầu thủ
- `W`: chọc khe / gọi thủ môn lao ra
- Giữ và thả `D`: sút theo lực / giữ để áp sát
- `A`: tạt bóng / xoạc bóng
- `E`: chạy nhanh khi tấn công hoặc phòng thủ
- `Q`: gọi chạy chỗ / gọi đồng đội pressing
- `C`: che bóng / jockey
- `Space`: tắc bóng hoặc tỳ vai khi phòng thủ
- `Shift + phím mũi tên`: đổi cầu thủ theo hướng
- `B`: chuyển camera Broadcast / Close Action / Tactical
- `Escape`: tạm dừng

## Chạy local

```bash
npm start
```

Mở `http://localhost:4173`.

## Kiểm tra

```bash
npm test
```

Game dùng Three.js WebGL với chế độ Canvas 2D dự phòng, Web Audio API, ba cấp độ AI, stamina, radar, thống kê trực tiếp, hiệu ứng ghi bàn và bố cục responsive.

## PC Controls — Sprint 9

- Chuyển hoàn toàn sang định hướng PC-first; loại bỏ joystick và nút cảm ứng
- Điều hướng mặc định bằng bốn phím mũi tên
- Bộ phím hành động kiểu PES/FIFA: `S / W / D / A / E`
- Chuyền sệt ưu tiên đồng đội theo hướng đang giữ
- Chọc khe đưa bóng vào khoảng trống phía trước đà chạy
- Tạt bóng có lực và tầm chuyền lớn hơn chuyền sệt
- Phòng thủ có kèm người, đổi cầu thủ, tranh bóng đứng và soạc bóng riêng
- Tăng tốc hoạt động ở cả hai trạng thái tấn công và phòng thủ

## Player Animation — Sprint 10

- Xoay thân theo tám hướng di chuyển với tốc độ quay phụ thuộc trạng thái chạy
- Cầu thủ nghiêng người khi đổi hướng và giảm tốc nhẹ ở các pha ngoặt gấp
- Locomotion có độ trễ tăng/giảm nhịp để tránh chuyển động giật cục
- Dẫn bóng luân phiên hai chân, bóng lệch theo chân chạm thay vì dính giữa người
- Bóng theo điểm chạm bằng nội suy để giảm hiện tượng giật hoặc teleport
- Tay, chân và thân trên có follow-through riêng khi chuyền và sút
- Crossfade giữa idle, jog và sprint dài hơn để chuyển animation tự nhiên

## Gameplay & AI — Sprint 11

- Bóng bổng có độ cao, trọng lực, nảy và chỉ được khống chế khi hạ đủ thấp
- Cú sút có quỹ đạo xoáy giảm dần theo vận tốc và ma sát mặt sân
- Thủ môn dự đoán điểm bóng đến trước khung thành để chọn vị trí và bay người
- Bán kính bắt bóng riêng cho thủ môn, không còn dùng chung với cầu thủ sân
- Chuyền sệt đánh giá nguy cơ cắt bóng trong hành lang chuyền
- AI ưu tiên đường chuyền an toàn hoặc chọc khe khi bị pressing
- Tiền đạo chạy giãn biên, tiền vệ hỗ trợ và hậu vệ lùi giữ cự ly đội hình
- Mỗi đội chỉ dùng cầu thủ gần bóng nhất để pressing, tránh toàn đội cùng lao vào bóng

## Matchday UI — Sprint 12

- Thiết kế lại toàn bộ giao diện PC theo phong cách truyền hình thể thao hiện đại
- Hero trước trận có thông tin matchday, lựa chọn AI dạng thẻ và CTA phân cấp rõ ràng
- Bảng điểm, nút âm thanh và pause dùng icon vector cùng trạng thái focus dễ nhận biết
- Sidebar được nén để vừa chiều cao sân, loại bỏ khoảng trống đen và cuộn dọc trên desktop
- Controls chuyển thành lưới hai cột, chữ lớn và tương phản tốt hơn
- Giữ đầy đủ bảng controls trên laptop 1024px thay vì ẩn như giao diện cũ
- Player card, thống kê, radar, pause và kết quả dùng chung một visual system
- Hỗ trợ reduced motion và focus-visible cho người chơi dùng bàn phím

## Pitch & Ball — Sprint 13

- Chọn mặt sân Classic, Elite, Dry hoặc Midnight ngay trước trận
- Mỗi mặt sân có bảng màu, vệt cắt, cỏ 3D và phản xạ thời tiết riêng
- Chọn bóng Classic, Volt hoặc Crimson với vật liệu và màu panel khác nhau
- Lựa chọn áp dụng đồng thời cho WebGL 3D và chế độ Canvas 2D dự phòng
- Tự lưu lựa chọn mặt sân và bóng bằng local storage cho lần chơi sau
- Bộ chọn swatch được tích hợp vào Matchday UI mà không làm trang bị cuộn

## Stadium Ultra — Sprint 14

- Khán đài procedural ba tầng bao quanh sân với vật liệu và độ cao riêng
- Mái che kim loại, cột kết cấu, đường hầm cầu thủ và khu kỹ thuật hai bên
- Mật độ khán giả desktop tăng lên 1.900 điểm màu nhưng vẫn dùng một draw call
- Bốn cột đèn sân tự tăng cường độ khi chọn mặt sân Midnight
- Ánh sáng môi trường, flood light, rim light, fog và exposure đổi theo chế độ ngày/đêm
- Bổ sung cờ góc, ghế dự bị và canopy trong không gian 3D
- Canvas 2D fallback có vùng khán đài, khán giả và cờ góc thay vì chỉ có mặt cỏ phẳng
- Giữ pipeline SSAO, bloom nhẹ và SMAA dành cho desktop

## FO4 Keyboard Controls — Sprint 15

- Dùng preset PC Keyboard theo FIFA Online 4 làm cấu hình mặc định
- Giữ phím mũi tên để di chuyển và định hướng; `S / W / A / D / E` lần lượt là chuyền ngắn, chọc khe, chuyền dài hoặc tạt, sút và tăng tốc khi tấn công
- Đổi bộ phím phòng thủ thành `S` đổi cầu thủ, `D` áp sát, `Space` tắc bóng hoặc tỳ vai, `A` xoạc bóng, `Q` gọi đồng đội pressing, `C` jockey và `W` gọi thủ môn lao ra
- Hỗ trợ đổi cầu thủ theo hướng bằng `Shift + phím mũi tên`, thay vì chỉ chọn tự động
- Bổ sung các tổ hợp FO4 cốt lõi: `Q + S` bật tường, `Q + W` chọc khe bổng, `Q + D` lốp bóng và `Z + D` sút cứa lòng
- Chuyền, chọc khe, tạt và sút đều nhận lực theo thời gian giữ phím; nhả phím mới thực hiện hành động
- Tách rõ trạng thái có bóng, phòng thủ và bóng tự do để thao tác không bị đổi chức năng ngay trước khi cầu thủ nhận bóng
- Thêm action map trung gian để gameplay không phụ thuộc trực tiếp vào mã phím và sẵn sàng cho màn hình remap
- Cập nhật bảng hướng dẫn trong trận theo đúng trạng thái tấn công hoặc phòng thủ và hiển thị tổ hợp phím nâng cao
- Di chuyển đổi thời tiết khỏi phím gameplay `V` sang phần thiết lập trước trận để tránh bấm nhầm

### Sprint 15 — Acceptance Criteria

- Tất cả phím cơ bản và tổ hợp trên hoạt động đúng trong cả WebGL 3D lẫn Canvas 2D fallback
- Giữ phím không kích hoạt lặp ngoài ý muốn; thao tác hai phím vẫn được nhận khi bấm lệch nhau trong một khoảng đệm ngắn
- `S` luôn đổi người khi phòng thủ, `D` chỉ áp sát và `Space` mới thực hiện tắc bóng hoặc tỳ vai
- Cầu thủ được đổi bằng `S` ưu tiên mục tiêu phòng ngự hợp lý; `Shift + hướng` chọn đúng cầu thủ theo hướng người chơi yêu cầu
- Khi bóng tự do, game duy trì ngữ cảnh thao tác trong một khoảng đệm ngắn và không tự biến lệnh chuyền hoặc sút thành lệnh phòng thủ
- HUD, pause help và README hiển thị cùng một mapping, không còn phím chết hoặc mô tả sai chức năng
- Bộ test đầu vào bao phủ nhấn, giữ, nhả, tổ hợp, đổi trạng thái sở hữu bóng và chống kích hoạt kép

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

## WebGL 3D — Sprint 3

- Sân vận động, khán đài, bảng LED và khung thành dựng bằng mesh 3D
- Cầu thủ low-poly có khớp tay chân, bóng 3D và bóng đổ thời gian thực
- Camera truyền hình phối cảnh bám theo diễn biến trận đấu
- Ánh sáng sân vận động, sương chiều sâu và hiệu ứng màu điện ảnh
- Giữ nguyên gameplay 6v6, AI, vật lý bóng, radar và điều khiển cảm ứng

## Matchday — Sprint 4

- Camera Broadcast, Close Action và Tactical chuyển trực tiếp bằng phím `C`
- Instant replay tự động phát lại diễn biến trước mỗi bàn thắng
- Camera cinematic và animation ăn mừng theo đội ghi bàn
- Khán giả cùng bảng LED phản ứng theo cao trào trận đấu
- Tự giảm mật độ khán giả, độ phân giải và shadow trên thiết bị cấu hình thấp

## Player Detail — Build 4.1

- Tỷ lệ đầu, cổ, vai, thân và chân tự nhiên hơn
- Khuôn mặt, nhiều tông da cùng bốn kiểu tóc khác nhau
- Áo đấu có cổ, sọc ngực và số áo ở cả mặt trước lẫn mặt sau
- Tay chân chia khớp, tất, giày và găng thủ môn có hình khối riêng
- Thân trên nghiêng, lắc vai và chuyển động đầu theo nhịp chạy, sút, xoạc, ăn mừng
- Chế độ Canvas 2D dự phòng cũng dùng thiết kế cầu thủ chi tiết mới

## Stadium Atmosphere — Sprint 5

- Hàng trăm cụm cỏ 3D xuất hiện rõ ở camera cận cảnh
- Mưa động thích ứng theo cấu hình thiết bị và có chế độ Clear / Rain
- Mặt sân chuyển dần sang trạng thái ướt, tối và phản sáng dưới đèn
- Luồng sáng thể tích từ bốn cột đèn tạo chiều sâu sân vận động
- Lưới khung thành rung và giảm chấn sau mỗi bàn thắng
- Canvas 2D dự phòng có lớp mưa và màu sân ướt tương ứng

## Pro Controls — Sprint 6

- Joystick analog có deadzone, response curve và tốc độ theo độ nghiêng thực
- Gia tốc, giảm tốc và đổi hướng phụ thuộc quán tính thay vì chuyển động tức thời
- Chuyền bóng ưu tiên đồng đội nằm trên hướng điều khiển đang giữ
- Hỗ trợ ngắm dọc khung thành khi sút, giảm độ ngẫu nhiên cho người chơi
- Đổi cầu thủ thông minh dựa trên quỹ đạo bóng, hướng di chuyển và vị trí phòng ngự
- Giữ `Q` trên bàn phím để rê sát chân, xoay nhanh và tiết kiệm stamina
- Cụm nút cảm ứng có phản hồi rung nhẹ trên thiết bị hỗ trợ

## Dual Controls — Build 6.1

- Cụm nút tự chuyển theo quyền kiểm soát bóng, không cần đổi chế độ thủ công
- Tấn công gồm CHUYỀN, SÚT và TĂNG TỐC
- Phòng thủ gồm KÈM NGƯỜI, ĐỔI NGƯỜI và XOẠC
- Giữ KÈM để cầu thủ tự áp sát, giữ cự ly jockey và luôn hướng mặt về đối thủ
- Vòng chọn cầu thủ đổi sang màu cyan khi chế độ kèm người đang hoạt động
- Bàn phím dùng cùng ánh xạ `J / K / L` theo trạng thái tấn công hoặc phòng thủ

## Desktop Ultra — Sprint 7

- Pipeline hậu kỳ EffectComposer dành riêng cho máy tính
- SSAO tăng contact shadow ở chân cầu thủ, khớp cơ thể và vật thể trên sân
- Bloom nhẹ, SMAA và OutputPass tạo hình ảnh sạch, có chiều sâu nhưng không lóa
- Ánh sáng môi trường PBR qua RoomEnvironment và PMREM
- Vật liệu áo đấu có sheen vải; da có roughness và phản sáng tự nhiên hơn
- Shadow map nâng từ 1024 lên 2048, render scale tối đa 2x và texture anisotropy 16x
- Camera Broadcast / Close hạ thấp để nhìn rõ cầu thủ và chuyển động
- Mật độ cỏ, mưa và khán giả tăng gần gấp đôi trên desktop
- Thiết bị cấu hình thấp vẫn tự bỏ post-processing và dùng pipeline nhẹ

## Player Rig — Sprint 8

- GLTFLoader và SkeletonUtils clone skeleton độc lập cho 12 cầu thủ
- AnimationMixer crossfade giữa idle, jog, sprint, nhận bóng, xoạc và ăn mừng
- Model procedural cũ được giữ lại làm fallback khi asset tải lỗi

## Player Motion Fix — Build 8.1

- Thay mannequin bằng character full-body có khuôn mặt, mắt, da và texture 1K
- Jersey, tay áo, quần, tất, giày và tóc được gắn trực tiếp vào bone
- Cầu thủ đứng hoặc di chuyển chậm xoay thân và đầu theo hướng bóng
- Khi chạy nhanh, thân theo hướng chạy nhưng đầu vẫn quan sát bóng trong giới hạn tự nhiên
- Xoay thân dùng nội suy góc, loại bỏ hiện tượng snap rotation
- Locomotion có hysteresis và crossfade dài hơn để tránh nhảy liên tục giữa idle, jog và sprint
- Động tác chuyền/sút dùng chuyển động chân phủ lên locomotion thay vì clip humanoid không phù hợp
- Character và animation từ Quaternius, giấy phép CC0; xem `assets/models/README.md`
