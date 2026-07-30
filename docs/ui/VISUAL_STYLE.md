# Visual Style — UI Refinements

## Vấn đề "AI-gen" đã xác định

1. **Gold (#e7bd50) + Cyan (#4bd2dc) quá nhiều** — bảng màu AI-gen điển hình
2. **Gradient trên mọi surface** — body, cards, buttons, scoreboard đều có gradient
3. **Decorative pseudo-elements** — ::before/::after dùng để trang trí thay vì functional
4. **Letter-spacing quá lớn** — đặc biệt trên text nhỏ (7-9px với letter-spacing .14-.24em)
5. **Borders trên mọi thứ** — từng element đều có border riêng
6. **Barlow Condensed + Inter** — combo font rất AI-gen
7. **backdrop-filter: blur() tràn lan**
8. **Nhiều lớp shadow phức tạp**
9. **Label decorative không cần thiết** — "MATCH FEED", "TF" watermark

## Các thay đổi đã thực hiện

### style.css (core)
- Loại bỏ grid overlay trên body
- Loại bỏ gold line trên topbar
- Loại bỏ "MATCH FEED" label
- Loại bỏ inset shadow trên pitch
- Loại bỏ TF watermark trên hero-card
- Simplify `.eyebrow` — bỏ glow, giảm letter-spacing
- Simplify overlay-card — bỏ gradient nền, shadow đơn giản
- Simplify brand-mark — bỏ clip-path phức tạp
- Simplify scoreboard — bỏ shadow phức tạp
- Simplify difficulty picker buttons
- Simplify primary/secondary buttons
- Loại bỏ backdrop-filter trên replay-badge, asset-status

### u1-match-experience.css
- Simplify topbar (bỏ gradient)
- Simplify scoreboard background
- Simplify HUD player card (bỏ gradient, backdrop-filter)
- Simplify hud-shirt (bỏ clip-path)
- Simplify hud-controls (bỏ backdrop-filter, shadow)
- Simplify hud-radar (bỏ backdrop-filter, shadow)
- Simplify team-crest (bỏ clip-path)
- Simplify matchup section (bỏ gradient)
- Simplify pre-match overlay background

### u3-camera-hud.css
- Simplify scoreboard (bỏ gradient, backdrop-filter)
- Simplify HUD radar (bỏ shadow)
- Remove decorative box-shadows

### u3-match-flow.css
- Simplify main menu overlay
- Simplify main menu card (bỏ gradient, shadow phức tạp)
- Simplify main menu logo
- Simplify mode cards

### u3-match-intro.css
- Simplify overlay background
- Remove decorative backdrop
- Simplify match intro card (bỏ gradient, decorative circles)
- Simplify intro crest
- Simplify intro details
- Simplify countdown stage
- Simplify progress bar

### u3-post-match.css
- Simplify result overlay
- Simplify post-match card (bỏ decorative gradient bar, FT watermark)
- Simplify header
- Simplify outcome label
- Simplify crest
- Simplify stats sections
- Simplify possession track

### u3-goal-presentation.css
- Simplify wash background
- Remove decorative lines
- Simplify card (bỏ decorative border accent)
- Simplify header
- Simplify crest
- Simplify score display
- Simplify footer (bỏ progress bar animation)
