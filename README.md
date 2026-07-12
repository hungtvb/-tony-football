# Tony Football Max

Game bóng đá arcade 6v6 dành cho PC, chạy trực tiếp trên trình duyệt.

## Điều khiển

- Phím mũi tên: di chuyển và chọn hướng chuyền/sút
- `S`: chuyền sệt / kèm người
- `W`: chọc khe / đổi cầu thủ
- Giữ và thả `D`: sút theo lực / tranh bóng đứng
- `A`: tạt bóng / soạc bóng
- `E`: chạy nhanh khi tấn công hoặc phòng thủ
- `C`: chuyển camera Broadcast / Close Action / Tactical
- `V`: chuyển thời tiết Clear / Rain
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
