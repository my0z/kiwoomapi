var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var CF_ACCOUNT_ID = "709dcc6af36c8ee7b6d3d99e7a9fe422";
var CF_AI_GATEWAY = "yzusb";
var STYLE = `
  :root{
    --bg:#FFF9F6; --surface:#FDEFE9; --border:#F3DDD4;
    --accent:#FF7A85; --accent-text:#E85C6B; --amber:#FFC65C; --amber-text:#C98A1F;
    --green:#5FD9A8; --green-text:#2FA97A; --lav:#B9A6F5;
    --text:#3A2E2A; --muted:#9C8B85; --ink-chip:#3A2E2A;
  }
  *{box-sizing:border-box;}
  body{
    background:var(--bg); color:var(--text); margin:0;
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    line-height:1.6;
  }
  .mono{ font-family:'IBM Plex Mono',monospace; }
  h1,h2,h3{ font-family:'Space Grotesk',sans-serif; letter-spacing:-0.02em; margin:0; }
  a{ color:inherit; text-decoration:none; }
  .wrap{ max-width:1200px; margin:0 auto; padding:0 24px; }
  .top-banner{
    display:block; position:relative; max-width:1200px; margin:10px auto 0; padding:0 24px;
  }
  .top-banner-inner{
    position:relative; display:block; height:150px; border-radius:22px; overflow:hidden;
    text-decoration:none; color:#fff; box-shadow:0 10px 28px rgba(58,46,42,0.18);
  }
  .top-banner-bg{
    position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
    filter:brightness(0.6) saturate(1.15);
    transform:scale(1.02); transition:transform 0.5s ease;
  }
  .top-banner-inner:hover .top-banner-bg{ transform:scale(1.08); }
  .top-banner-fg{
    position:absolute; right:20px; top:0; bottom:0; height:100%; width:auto; max-width:60%;
    object-fit:contain; filter:drop-shadow(0 14px 22px rgba(0,0,0,0.38));
  }
  .top-banner-scrim{
    position:absolute; inset:0;
    background:linear-gradient(100deg, rgba(58,46,42,0.78) 0%, rgba(58,46,42,0.55) 38%, rgba(58,46,42,0.08) 75%);
  }
  .top-banner-info{
    position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:8px;
    padding:18px 24px;
  }
  .top-banner-eyebrow{
    font-family:'Gaegu',cursive; font-size:13px; font-weight:700; letter-spacing:0.01em;
    color:#fff; background:var(--accent); display:inline-flex; width:fit-content;
    padding:4px 11px; border-radius:100px; box-shadow:0 3px 8px rgba(255,122,133,0.4);
  }
  .top-banner-title{
    font-family:'Jua',sans-serif; font-weight:600; font-size:19px; line-height:1.3; max-width:520px;
    overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    text-shadow:0 2px 8px rgba(0,0,0,0.3);
  }
  .top-banner-info .price-tag{ width:fit-content; }
  @media(max-width:680px){
    .top-banner{ padding:0 16px; }
    .top-banner-inner{ height:128px; border-radius:18px; }
    .top-banner-info{ padding:14px 16px; gap:6px; }
    .top-banner-title{ font-size:15px; max-width:78%; -webkit-line-clamp:2; }
    .top-banner-eyebrow{ font-size:10px; padding:3px 9px; }
    .top-banner-fg{ max-width:48%; right:12px; }
  }
  header.site{ border-bottom:1px solid var(--border); padding:20px 0; }
  header.site .wrap{ display:flex; justify-content:space-between; align-items:center; }
  .logo{ font-family:'Jua',sans-serif; font-weight:600; font-size:21px; display:flex; align-items:center; gap:8px; letter-spacing:-0.01em; }
  .logo span{ color:var(--accent); }
  .logo-icon{ display:flex; align-items:center; justify-content:center; }
  .hero{
    position:relative; padding:44px 0 54px; border-bottom:1px solid var(--border);
    background-image: radial-gradient(var(--border) 1.5px, transparent 1.5px);
    background-size: 24px 24px;
    background-position: -8px -8px;
  }
  .hero .wrap{ position:relative; }
  .hero .eyebrow{
    font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600; letter-spacing:0.08em;
    color:#fff; background:var(--accent); text-transform:uppercase; margin-bottom:16px;
    display:inline-block; padding:5px 12px; border-radius:100px; transform:rotate(-1.5deg);
    box-shadow:0 4px 10px rgba(255,122,133,0.35);
  }
  .hero h1{ font-family:'Jua',sans-serif; font-weight:600; font-size:40px; max-width:640px; line-height:1.2; letter-spacing:-0.01em; }
  .hero p.sub{ color:var(--muted); font-size:16px; margin:16px 0 0; max-width:520px; }
  .hero .meta-line{
    margin-top:18px; font-family:'IBM Plex Mono',monospace; font-size:13px; color:var(--muted);
  }
  .hero .meta-line b{ color:var(--accent-text); font-weight:700; }
  .logo.compact .logo-text{ display:none; }
  @keyframes logoPulse{ 0%,100%{ transform:scale(1) rotate(0deg); } 50%{ transform:scale(1.12) rotate(-6deg); } }
  .logo.compact .logo-icon{ animation:logoPulse 1.8s ease-in-out infinite; }
  .index{ padding:16px 0 48px; display:grid; grid-template-columns:repeat(4, 1fr); gap:18px; }
  .entry{
    display:flex; flex-direction:column; gap:0; padding:0; position:relative;
    border:1px solid var(--border); border-radius:20px; overflow:visible; background:var(--bg);
    box-shadow:0 3px 12px rgba(58,46,42,0.05);
    transition:transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease, border-color 0.25s ease;
  }
  .entry:hover{ transform:translateY(-4px) scale(1.015); box-shadow:0 12px 26px rgba(255,122,133,0.18); border-color:var(--accent); z-index:5; }
  .entry:first-child{ padding-top:0; }
  .entry-main{ flex:1; min-width:0; padding:16px 18px 18px; position:relative; }
  .entry-eyebrow{
    font-family:'Gaegu',cursive; font-size:13px; color:var(--accent-text); font-weight:700;
    letter-spacing:0.01em; margin-bottom:10px;
  }
  .entry-eyebrow::before{ content:'✦ '; }
  .entry-title{
    font-family:'Jua',sans-serif; font-weight:600;
    font-size:18px; line-height:1.35; color:var(--text); margin:0 0 8px; letter-spacing:-0.005em;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; /* 2줄로 잘라서 카드 높이 통일 */
  }
  .entry:hover .entry-title{ color:var(--accent-text); }
  .entry-excerpt{ color:var(--muted); font-size:14px; line-height:1.6; margin:0 0 10px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .entry-meta{ font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); }
  .entry-thumb{
    width:100%; aspect-ratio:16/10; border-radius:20px 20px 0 0;
    display:flex; align-items:center; justify-content:center;
    background:var(--surface); overflow:visible; position:relative;
  }
  .entry-thumb img{ width:100%; height:100%; object-fit:contain; display:block; position:relative; z-index:1; transition:transform 0.4s cubic-bezier(0.22,1,0.36,1); will-change:transform; }
  .entry:hover .entry-thumb img{ transform:scale(1.3); }
  /* 상품이미지 배경 장식 랜덤 변형 — 밋밋함 방지 */
  .entry-thumb.d1::before{ /* 색종이 흩뿌리기 */
    content:''; position:absolute; z-index:0; top:14%; left:10%; width:8px; height:8px;
    background:var(--accent); border-radius:2px; transform:rotate(12deg);
    box-shadow:
      145px 42px 0 -1px var(--amber), 58px 92px 0 -2px var(--lav),
      215px 98px 0 -1px var(--green), 26px 8px 0 -2px var(--amber),
      188px 12px 0 -1px var(--accent), 100px 130px 0 -2px var(--lav);
  }
  .entry-thumb.d2::before{ /* 물결 */
    content:''; position:absolute; z-index:0; left:0; right:0; bottom:0; height:38%;
    background:var(--accent); opacity:0.16;
    clip-path: polygon(0% 45%,8% 32%,16% 48%,24% 62%,32% 48%,40% 32%,48% 48%,56% 62%,64% 48%,72% 32%,80% 48%,88% 62%,96% 48%,100% 38%,100% 100%,0% 100%);
  }
  .entry-thumb.d3::before{ /* 블롭 */
    content:''; position:absolute; z-index:0; width:72%; height:72%; top:14%; left:14%;
    background:var(--lav); opacity:0.28; border-radius:42% 58% 65% 35%/45% 40% 60% 55%;
  }
  .entry-thumb.d4::before{ /* 점선 링 */
    content:''; position:absolute; z-index:0; width:66%; height:66%; top:17%; left:17%;
    border:3px dashed var(--accent); opacity:0.32; border-radius:50%;
  }
  .entry-thumb.d5::before{ /* 사선무늬 */
    content:''; position:absolute; inset:0; z-index:0;
    background:repeating-linear-gradient(45deg, var(--amber) 0, var(--amber) 2px, transparent 2px, transparent 14px);
    opacity:0.14;
  }
  .price-tag{
    display:inline-flex; align-items:center; gap:5px; background:var(--ink-chip); color:var(--amber);
    font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:13px; letter-spacing:0.02em;
    padding:6px 13px; border-radius:100px; position:relative;
    transform:rotate(-2deg); box-shadow:0 4px 10px rgba(58,46,42,0.25);
    transition:transform 0.25s cubic-bezier(.34,1.56,.64,1);
  }
  .price-tag::before{ content:'✦'; font-size:10px; }
  .price-tag.deal{ color:var(--green); }
  /* 가격풍선 모양 랜덤 변형 — 카드마다 다른 실루엣/기울기 */
  .price-tag.v1{ border-radius:100px; transform:rotate(-3deg); }
  .price-tag.v2{ border-radius:6px 22px 22px 6px; transform:rotate(2deg); }
  .price-tag.v3{ border-radius:50% 18px 50% 18px/18px 50% 18px 50%; transform:rotate(-1.5deg); }
  .price-tag.v4{ border-radius:4px 18px 4px 18px; transform:rotate(4deg); }
  .price-tag.v5{ border-radius:100px 8px 100px 8px; transform:rotate(-4deg); }
  /* 말풍선 색깔 랜덤 변형 */
  .price-tag.c1{ background:var(--ink-chip); color:var(--amber); }
  .price-tag.c2{ background:var(--accent); color:#fff; }
  .price-tag.c3{ background:var(--lav); color:#fff; }
  .price-tag.c4{ background:var(--green); color:#1f4a3a; }
  .price-tag.c5{ background:var(--amber); color:#5c3d0a; }
  /* 말풍선 글씨체 랜덤 변형 */
  .price-tag.f1{ font-family:'IBM Plex Mono',monospace; font-weight:600; letter-spacing:0.02em; }
  .price-tag.f2{ font-family:'Jua',sans-serif; font-weight:400; letter-spacing:0; font-size:14px; }
  .price-tag.f3{ font-family:'Gaegu',cursive; font-weight:700; letter-spacing:0; font-size:14px; }
  .entry-thumb .price-tag{ position:absolute; left:10px; bottom:10px; z-index:1; font-size:12px; }
  .entry:hover .price-tag{ transform:rotate(3deg) scale(1.08); }
  @media(max-width:680px){
    .hero h1{ font-size:34px; }
    .index{ grid-template-columns:repeat(2, 1fr); gap:14px; }
    .entry-thumb{ aspect-ratio:1/1; }
    .entry-thumb img{ object-fit:contain; } /* 잘리지 않고 이미지 전체가 보이게 */
    .entry-main{ padding:10px 12px 12px; }
    .entry-eyebrow{ font-size:10px; margin-bottom:6px; }
    .entry-title{ font-size:15px; line-height:1.35; margin-bottom:6px; }
    .entry-excerpt{ display:none; } /* 카드 폭이 좁아서 발췌문은 생략 */
    .entry-meta{ font-size:10px; }
    .entry-thumb .price-tag{ font-size:11px; padding:4px 9px 4px 14px; left:6px; bottom:6px; }
    .hero .eyebrow{ font-size:11px; }
  }
  .cta{
    display:inline-flex; align-items:center; justify-content:center; gap:6px;
    margin-top:6px; padding:13px 20px;
    background:var(--accent); color:#fff; font-weight:700; border-radius:100px;
    text-align:center; font-size:14px; box-shadow:0 6px 16px rgba(255,122,133,0.4);
    border:none; transition:transform 0.2s cubic-bezier(.34,1.56,.64,1);
  }
  .cta:hover{ transform:translateY(-2px) scale(1.03); }
  .post-body{ padding:44px 0; max-width:720px; }
  .post-body h1{ font-family:'Jua',sans-serif; font-size:29px; font-weight:600; margin-bottom:8px; letter-spacing:-0.01em; }
  .post-body .meta{ color:var(--muted); font-size:13px; font-family:'IBM Plex Mono',monospace; margin-bottom:28px; }
  .post-body h2{ font-family:'Jua',sans-serif; font-size:20px; font-weight:600; margin:32px 0 12px; }
  .tldr-box{
    background:var(--surface); border:1.5px solid var(--accent); border-radius:16px;
    padding:16px 20px; margin:20px 0 28px; position:relative;
  }
  .tldr-label{
    font-family:'Gaegu',cursive; font-weight:700; font-size:14px; color:var(--accent-text);
    display:block; margin-bottom:6px;
  }
  .tldr-box p{ margin:0; font-size:15px; line-height:1.6; font-weight:500; }
  .faq-section{ margin-top:40px; }
  .faq-item{
    border:1px solid var(--border); border-radius:12px; padding:14px 18px; margin-bottom:10px; background:var(--bg);
  }
  .faq-item summary{ font-family:'Jua',sans-serif; font-size:15px; cursor:pointer; list-style:none; }
  .faq-item summary::-webkit-details-marker{ display:none; }
  .faq-item summary::before{ content:'Q. '; color:var(--accent-text); }
  .faq-item p{ margin:10px 0 0; color:var(--muted); font-size:14px; line-height:1.6; }
  .faq-item p::before{ content:'A. '; color:var(--green-text); font-weight:700; }
  .post-body p{ margin:0 0 16px; color:var(--text); }
  .product-block{
    position:relative; overflow:hidden;
    background:var(--surface); border:1px solid var(--border); border-radius:20px;
    padding:20px; margin:24px 0; min-height:180px; display:flex; align-items:flex-end;
  }
  .product-block:hover{ overflow:visible; z-index:5; }
  .product-block .thumb{
    position:absolute; inset:0; width:100%; height:100%; overflow:hidden;
  }
  .product-block:hover .thumb{ overflow:visible; }
  .product-block .thumb-bg{
    position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
    filter:brightness(0.6) saturate(1.15); transform:scale(1.2);
  }
  .product-block .thumb-fg{
    position:absolute; right:0; top:0; bottom:0; height:100%; width:auto; max-width:85%;
    object-fit:contain; display:block;
    filter:drop-shadow(0 14px 22px rgba(0,0,0,0.38));
    transition:transform 0.35s cubic-bezier(.25,.8,.35,1); transform-origin:bottom right; z-index:2;
  }
  .product-block:hover .thumb-fg{ transform:scale(1.35); }
  .product-block .pb-scrim{
    position:absolute; inset:0;
    background:linear-gradient(180deg, rgba(58,46,42,0.05) 0%, rgba(58,46,42,0.45) 55%, rgba(58,46,42,0.82) 100%);
  }
  .product-block .pb-info{ position:relative; z-index:1; color:#fff; }
  .product-block .pb-info h3{ color:#fff; }
  footer{ border-top:1px solid var(--border); padding:24px 0; color:var(--muted); font-size:13px; }
  table{ width:100%; border-collapse:collapse; margin-top:20px; }
  th,td{ text-align:left; padding:10px; border-bottom:1px solid var(--border); font-size:14px; }
  th{ white-space:nowrap; }
  .table-scroll{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .table-scroll table{ min-width:640px; margin-top:0; }
  .table-scroll th:first-child, .table-scroll td:first-child{
    position:sticky; left:0; background:var(--surface); z-index:2;
    box-shadow:2px 0 4px rgba(58,46,42,0.08);
  }
  button{ background:var(--accent); color:#fff; border:none; padding:10px 18px; border-radius:100px; font-weight:700; cursor:pointer; }
  button.danger{ background:#F08A8A; color:#fff; }
  .kenburns-wrap{ overflow:hidden; border-radius:16px; background:#000; }
  .kenburns-wrap img{ width:100%; height:100%; object-fit:cover; display:block; }
  .kb1{ animation: kenburns1 4.5s ease-in-out infinite alternate; }
  .kb2{ animation: kenburns2 4.5s ease-in-out infinite alternate; }
  .kb3{ animation: kenburns3 4.5s ease-in-out infinite alternate; }
  .kb4{ animation: kenburns4 4.5s ease-in-out infinite alternate; }
  @keyframes kenburns1{ 0%{ transform:scale(1) translate(0,0); } 100%{ transform:scale(1.3) translate(-4%,-4%); } }
  @keyframes kenburns2{ 0%{ transform:scale(1.3) translate(4%,4%); } 100%{ transform:scale(1) translate(0,0); } }
  @keyframes kenburns3{ 0%{ transform:scale(1) translate(0,0); } 100%{ transform:scale(1.35) translate(4%,-4%); } }
  @keyframes kenburns4{ 0%{ transform:scale(1.25) translate(-3%,3%); } 100%{ transform:scale(1.05) translate(3%,-3%); } }
  .privacy-banner{
    position:fixed; left:0; right:0; bottom:0; z-index:999;
    background:var(--surface); border-top:1px solid var(--border);
    padding:16px 20px; display:flex; gap:16px; align-items:center; justify-content:space-between;
    flex-wrap:wrap; box-shadow:0 -2px 12px rgba(0,0,0,0.06);
  }
  .privacy-banner p{ margin:0; font-size:13px; color:var(--muted); line-height:1.5; max-width:760px; }
  .privacy-banner button{
    background:var(--accent); color:#fff; border:none; padding:9px 20px; border-radius:6px;
    font-weight:700; font-size:13px; cursor:pointer; flex-shrink:0;
  }
  .privacy-banner.hidden{ display:none; }

  /* ===== Admin console ===== */
  .admin-shell{ padding:28px 0 60px; }
  .admin-topbar{
    display:flex; justify-content:space-between; align-items:flex-start; gap:20px;
    flex-wrap:wrap; margin-bottom:20px;
  }
  .admin-topbar h2{ font-size:22px; }
  .admin-topbar .eyebrow{ font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:4px; }
  .admin-stat-strip{
    display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:24px;
  }
  .admin-stat{
    background:var(--surface); border:1px solid var(--border); border-radius:14px;
    padding:14px 16px; display:flex; flex-direction:column; gap:4px;
  }
  .admin-stat .num{ font-family:'Space Grotesk',sans-serif; font-size:24px; font-weight:700; line-height:1; }
  .admin-stat .label{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); }
  .admin-stat.ok .num{ color:var(--green-text); }
  .admin-stat.warn .num{ color:#c0392b; }
  .admin-actions{
    background:var(--surface); border:1px solid var(--border); border-radius:16px;
    padding:16px 18px; display:flex; gap:10px; flex-wrap:wrap; margin-bottom:24px;
  }
  .admin-actions form{ display:flex; gap:8px; align-items:center; }
  .admin-actions input[type=text], .admin-actions input[type=url]{
    padding:9px 12px; border-radius:8px; border:1px solid var(--border);
    background:var(--bg); color:var(--text); font-size:13px; font-family:'IBM Plex Mono',monospace;
  }
  .admin-card{
    background:var(--surface); border:1px solid var(--border); border-radius:16px;
    padding:18px 20px; margin-bottom:20px;
  }
  .admin-card.alert{ background:#fdecea; border-color:#f5b5ab; }
  .admin-card-head{
    display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;
  }
  .admin-card-head .title{ font-size:14px; font-weight:700; font-family:'Space Grotesk',sans-serif; }
  .admin-card.alert .title{ color:#c0392b; }
  .admin-card table{ margin-top:0; }
  @keyframes pkwPromote{
    0%{ box-shadow:0 0 0 0 rgba(255,198,92,0); }
    30%{ box-shadow:0 0 0 6px rgba(255,198,92,0.55); transform:scale(1.1); }
    100%{ box-shadow:0 0 0 0 rgba(255,198,92,0); transform:scale(1); }
  }
  .pkw-badge.promoted, .purl-badge.promoted{ animation:pkwPromote 0.6s ease-out; }
`;
var FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@400;700&family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link href="https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@400;700&family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"></noscript>`;
// ============================================
// Danawa IT 카테고리 정의
// ============================================
const IT_CATEGORIES = [
  { name: '노트북', cate: 'cate=112758' },
  { name: '모니터', cate: 'cate=112757' },
  { name: '스마트폰', cate: 'cate=122515' },
  { name: '태블릿', cate: 'cate=12210596' },
  { name: 'SSD', cate: 'cate=112760' },
  { name: 'CPU', cate: 'cate=112747' },
  { name: '메인보드', cate: 'cate=112751' },
  { name: '그래픽카드', cate: 'cate=112753' },
  { name: '키보드', cate: 'cate=112782' },
  { name: '이어폰/헤드폰', cate: 'cate=11252453' },
  { name: '웹캠', cate: 'cate=11253489' },
  { name: '공유기', cate: 'cate=112804' },
  { name: '액션캠', cate: 'cate=12237508' },
  { name: '블루투스스피커', cate: 'cate=12237379' },
  { name: '드론', cate: 'cate=19217301' },
  { name: '미니게임기', cate: 'cate=11338109' },
  { name: '휴대용PC게임기', cate: 'cate=11341228' },
  { name: '휴대미니프로젝터', cate: 'cate=1032820' },
  { name: '삼각대셀카봉짐벌', cate: 'cate=12337581' },
  { name: '홈IP카메라(베이비캠)', cate: 'cate=19327720' },
  { name: '스마트워치', cate: 'cate=12215657' },
  { name: '학습/과학완구', cate: 'cate=16322482' }
];

var HOT_KEYWORDS = [
  // 현재 인기 플래그십 위주 — 필요시 여기만 수동으로 갱신
  "아이폰17프로",
  "아이폰17",
  "아이폰에어",
  "갤럭시Z폴드7",
  "갤럭시Z플립7",
  "갤럭시S25",
  "에어팟프로",
  "갤럭시워치8",
  "애플워치",
  "맥북에어",
  "갤럭시탭S10"
];

var KEYWORDS = [
  // 오디오
  "무선이어폰",
  "블루투스이어폰",
  "블루투스스피커",
  "헤드폰",
  "헤드셋",
  "사운드바",
  "게이밍헤드셋",
  "넥밴드이어폰",
  "스피커독",
  "미니스피커",
  "유선이어폰",
  "콘덴서마이크",
  "방송용마이크",
  // 모바일 액세서리
  "보조배터리",
  "무선충전기",
  "충전기",
  "폰케이스",
  "강화유리필름",
  "차량용거치대",
  "차량용충전기",
  "고속충전케이블",
  "C타입케이블",
  "젠더",
  "셀카봉",
  "스마트폰짐벌",
  "방수케이스",
  "폰스트랩",
  "멀티포트충전기",
  // PC 주변기기
  "기계식키보드",
  "무선마우스",
  "게이밍마우스",
  "게이밍키보드",
  "모니터암",
  "웹캠",
  "웹캠거치대",
  "usb허브",
  "외장SSD",
  "외장하드",
  "usb메모리",
  "hdmi케이블",
  "멀티탭",
  "노트북거치대",
  "노트북파우치",
  "마우스패드",
  "키보드팔레스트",
  "도킹스테이션",
  "usb-c허브",
  "노트북쿨러",
  "노트북받침대",
  // 디스플레이/영상
  "휴대용모니터",
  "미니빔프로젝터",
  "게이밍모니터",
  "터치모니터",
  "모니터받침대",
  "hdmi스위치",
  // 웨어러블
  "스마트워치",
  "스마트링",
  "스마트밴드",
  "심박측정기",
  // 태블릿/독서
  "태블릿거치대",
  "전자책리더기",
  "태블릿케이스",
  "태블릿펜",
  "필기감펜",
  // 스마트홈/생활가전
  "로봇청소기",
  "무선청소기",
  "공기청정기",
  "스마트플러그",
  "스마트조명",
  "스마트도어락",
  "IoT센서",
  "홈캠",
  "CCTV",
  "반려동물카메라",
  "스마트체중계",
  "가습기",
  "제습기",
  "온습도계",
  "도어벨카메라",
  "스마트초인종",
  "스팀청소기",
  "무선다리미",
  "자외선살균기",
  // 네트워크
  "와이파이공유기",
  "유심라우터",
  "메시공유기",
  "랜케이블",
  "스위칭허브",
  "포켓와이파이",
  // 게이밍/VR
  "콘솔게임패드",
  "VR기기",
  "게이밍의자",
  "조이스틱",
  "게임패드",
  "콘솔거치대",
  "게이밍마우스패드",
  "스트리밍캡처카드",
  // 카메라
  "액션캠",
  "짐벌",
  "삼각대",
  "미러리스카메라",
  "웹캠라이트",
  "링라이트",
  "드론",
  "카메라가방",
  "ND필터",
  "카메라스트랩",
  "짐벌액세서리",
  // 차량용 전자기기
  "블랙박스",
  "차량용무선카플레이",
  "차량용공기청정기",
  "타이어공기압측정기",
  "차량용청소기",
  "차량용냉장고",
  "차량용선풍기",
  "하이패스단말기",
  // 건강/헬스테크
  "혈압계",
  "체온계",
  "마사지건",
  "안마기",
  // 사무/교육 전자기기
  "라벨프린터",
  "문서스캐너",
  "계산기",
  "전자사전",
  "화이트보드",
  // 조명/전기
  "led스탠드",
  "무드등",
  "감성조명",
  "usb선풍기",
  // 3D프린팅/DIY
  "3d프린터",
  "라즈베리파이",
  "아두이노",
  "납땜인두기",
  "멀티미터",
  // 추가 오디오/모바일
  "블루투스리시버",
  "블루투스송신기",
  "스마트폰렌즈",
  // 추가 PC 주변기기
  "캡처보드",
  "펜슬케이스",
  "외장그래픽카드",
  // 추가 디스플레이
  "프로젝터스크린",
  // 추가 웨어러블
  "스마트글래스",
  // 추가 생활가전
  "가습기",
  "제습기",
  "온습도계",
  // 추가 게이밍
  "게이밍마우스패드",
  "스트리밍캡처카드",
  // 추가 카메라
  "카메라가방",
  // 추가 차량용
  "차량용선풍기",
  "하이패스단말기",
  // 추가 건강
  "체지방측정기",
  "수면측정기",
  "스마트줄넘기",
  "스마트요가매트",
  // 추가 조명
  "캠핑랜턴",
  // 추가 오디오
  "턴테이블",
  "앰프",
  "휴대용DAC",
  "골전도이어폰",
  // 추가 모바일
  "스마트폰그립톡",
  "폰투명케이스",
  // 추가 PC 주변기기
  "웹캠커버",
  "노트북어댑터",
  // 추가 웨어러블
  "스마트이어링",
  // 추가 스마트홈
  "도어벨카메라",
  "스마트초인종",
  "스팀청소기",
  "무선다리미",
  "자외선살균기",
  // 추가 카메라
  "ND필터",
  "카메라스트랩",
  "짐벌액세서리",
  // 추가 차량용
  "타이어펌프",
  "점프스타터",
  // 추가 사무
  "문서파쇄기",
  // 반려동물테크(신규 카테고리)
  "자동급식기",
  "스마트급수기",
  "펫도어락",
  "펫트래커",
  // 홈오피스/생산성(신규 카테고리)
  "스탠딩데스크",
  "모니터라이트바",
  "데스크매트",
  "케이블정리함",
  "무선프레젠터",
  // 스트리밍/방송장비(신규 카테고리)
  "방송용조명",
  "그린스크린",
  "마이크암",
  "팟캐스트믹서",
  "스트리밍마이크",
  // 포터블파워(신규 카테고리)
  "포터블파워스테이션",
  "태양광충전기",
  "캠핑용발전기"
];
var CATEGORIES = [
  { slug: "audio", name: "오디오", keywords: ["무선이어폰", "블루투스이어폰", "블루투스스피커", "헤드폰", "헤드셋", "사운드바", "게이밍헤드셋", "넥밴드이어폰", "스피커독", "미니스피커", "유선이어폰", "콘덴서마이크", "방송용마이크", "블루투스리시버", "블루투스송신기", "턴테이블", "앰프", "휴대용DAC", "골전도이어폰"] },
  { slug: "mobile", name: "모바일 액세서리", keywords: ["보조배터리", "무선충전기", "충전기", "폰케이스", "강화유리필름", "차량용거치대", "차량용충전기", "고속충전케이블", "C타입케이블", "젠더", "셀카봉", "스마트폰짐벌", "방수케이스", "폰스트랩", "멀티포트충전기", "스마트폰렌즈", "스마트폰그립톡", "폰투명케이스"] },
  { slug: "pc", name: "PC 주변기기", keywords: ["기계식키보드", "무선마우스", "게이밍마우스", "게이밍키보드", "모니터암", "웹캠", "웹캠거치대", "usb허브", "외장SSD", "외장하드", "usb메모리", "hdmi케이블", "멀티탭", "노트북거치대", "노트북파우치", "마우스패드", "키보드팔레스트", "도킹스테이션", "usb-c허브", "노트북쿨러", "노트북받침대", "캡처보드", "펜슬케이스", "외장그래픽카드", "웹캠커버", "노트북어댑터"] },
  { slug: "display", name: "디스플레이/영상", keywords: ["휴대용모니터", "미니빔프로젝터", "게이밍모니터", "터치모니터", "모니터받침대", "hdmi스위치", "프로젝터스크린"] },
  { slug: "wearable", name: "웨어러블", keywords: ["스마트워치", "스마트링", "스마트밴드", "심박측정기", "스마트글래스", "스마트이어링"] },
  { slug: "tablet", name: "태블릿/독서", keywords: ["태블릿거치대", "전자책리더기", "태블릿케이스", "태블릿펜", "필기감펜"] },
  { slug: "smarthome", name: "스마트홈/생활가전", keywords: ["로봇청소기", "무선청소기", "공기청정기", "스마트플러그", "스마트조명", "스마트도어락", "IoT센서", "홈캠", "CCTV", "반려동물카메라", "스마트체중계", "가습기", "제습기", "온습도계", "도어벨카메라", "스마트초인종", "스팀청소기", "무선다리미", "자외선살균기"] },
  { slug: "network", name: "네트워크", keywords: ["와이파이공유기", "유심라우터", "메시공유기", "랜케이블", "스위칭허브", "포켓와이파이"] },
  { slug: "gaming", name: "게이밍/VR", keywords: ["콘솔게임패드", "VR기기", "게이밍의자", "조이스틱", "게임패드", "콘솔거치대", "게이밍마우스패드", "스트리밍캡처카드"] },
  { slug: "camera", name: "카메라", keywords: ["액션캠", "짐벌", "삼각대", "미러리스카메라", "웹캠라이트", "링라이트", "드론", "카메라가방", "ND필터", "카메라스트랩", "짐벌액세서리"] },
  { slug: "car", name: "차량용 전자기기", keywords: ["블랙박스", "차량용무선카플레이", "차량용공기청정기", "타이어공기압측정기", "차량용청소기", "차량용냉장고", "차량용선풍기", "하이패스단말기", "타이어펌프", "점프스타터"] },
  { slug: "health", name: "건강/헬스테크", keywords: ["혈압계", "체온계", "마사지건", "안마기", "체지방측정기", "수면측정기", "스마트줄넘기", "스마트요가매트"] },
  { slug: "office", name: "사무/교육 전자기기", keywords: ["라벨프린터", "문서스캐너", "계산기", "전자사전", "화이트보드", "문서파쇄기"] },
  { slug: "lighting", name: "조명/전기", keywords: ["led스탠드", "무드등", "감성조명", "usb선풍기", "캠핑랜턴"] },
  { slug: "diy", name: "3D프린팅/DIY", keywords: ["3d프린터", "라즈베리파이", "아두이노", "납땜인두기", "멀티미터"] },
  { slug: "pet", name: "반려동물테크", keywords: ["자동급식기", "스마트급수기", "펫도어락", "펫트래커"] },
  { slug: "homeoffice", name: "홈오피스/생산성", keywords: ["스탠딩데스크", "모니터라이트바", "데스크매트", "케이블정리함", "무선프레젠터"] },
  { slug: "streaming", name: "스트리밍/방송장비", keywords: ["방송용조명", "그린스크린", "마이크암", "팟캐스트믹서", "스트리밍마이크"] },
  { slug: "power", name: "포터블파워", keywords: ["포터블파워스테이션", "태양광충전기", "캠핑용발전기"] }
];
function getCategoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug) || null;
}
__name(getCategoryBySlug, "getCategoryBySlug");
var KEYWORD_ROTATION_MS = 2 * 24 * 60 * 60 * 1e3;
var ACTIVE_KEYWORD_POOL_SIZE = 10;
var KEYWORD_USED_TTL_SECONDS = 5 * 24 * 60 * 60;
var TECH_SIGNAL_WORDS = [
  "무선",
  "유선",
  "블루투스",
  "충전",
  "배터리",
  "usb",
  "usb-c",
  "스마트",
  "전자",
  "디지털",
  "이어폰",
  "헤드폰",
  "헤드셋",
  "스피커",
  "키보드",
  "마우스",
  "모니터",
  "카메라",
  "캠",
  "프로젝터",
  "로봇청소기",
  "청소기",
  "와이파이",
  "공유기",
  "드론",
  "프린터",
  "스캐너",
  "웹캠",
  "태블릿",
  "노트북",
  "ssd",
  "hdmi",
  "케이블",
  "허브",
  "거치대",
  "워치",
  "가습기",
  "제습기",
  "공기청정기",
  "체중계",
  "cctv",
  "도어락",
  "리더기",
  "마이크",
  "앰프",
  "전동",
  "led",
  "ai",
  "센서",
  "라우터",
  "어댑터",
  "변환기",
  "충전기",
  "보조배터리",
  "스탠드",
  "조명",
  "3d프린터",
  "측정기"
];
function isOutdatedProduct(productName) {
  const name = productName || "";
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const currentYear2 = currentYear % 100;
  const fourDigitMatches = name.match(/\b(19\d{2}|20\d{2})\b/g) || [];
  for (const y of fourDigitMatches) {
    if (Number(y) < currentYear) return true;
  }
  const twoDigitMatches = name.match(/\b([0-9]{1,2})년/g) || [];
  for (const raw of twoDigitMatches) {
    const num = parseInt(raw, 10);
    if (num >= 10 && num < currentYear2) return true;
  }
  return false;
}
__name(isOutdatedProduct, "isOutdatedProduct");
function isTechRelated(productName) {
  const name = (productName || "").toLowerCase();
  return TECH_SIGNAL_WORDS.some((w) => name.includes(w));
}
__name(isTechRelated, "isTechRelated");
async function naverAuthHeaders(env, extra = {}) {
  return {
    "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
    "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
    ...extra
  };
}
__name(naverAuthHeaders, "naverAuthHeaders");
function stripNaverHtml(s) {
  return (s || "").replace(/<\/?b>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
__name(stripNaverHtml, "stripNaverHtml");
async function naverShoppingSearch(query, env, display = 15, sort = "sim") {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
  try {
    const res = await fetch(url, { headers: await naverAuthHeaders(env) });
    if (!res.ok) {
      const bodyText = await res.text();
      return { items: [], error: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
    }
    const data = await res.json();
    const items = (data.items || []).map((it) => ({
      name: stripNaverHtml(it.title),
      lprice: it.lprice,
      mallName: it.mallName
    }));
    return { items, error: null };
  } catch (e) {
    return { items: [], error: e.message };
  }
}
__name(naverShoppingSearch, "naverShoppingSearch");
var NAVER_SHOPPING_CID_LIST = [
  { cid: "50000003", name: "디지털/가전" }
  // 실제 반환값이 비어있으면 네이버 데이터랩 쇼핑인사이트 분야 코드가 달라진 것 — cid만 교체하면 됨
];
async function naverShoppingHotKeywords(env, cid, count = 8) {
  const today = /* @__PURE__ */ new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const controllerD1 = new AbortController();
    const timerD1 = setTimeout(() => controllerD1.abort(), 8000);
    let res;
    try {
      res = await fetch("https://openapi.naver.com/v1/datalab/shopping/category/keywords", {
        method: "POST",
        headers: await naverAuthHeaders(env, { "Content-Type": "application/json" }),
        body: JSON.stringify({ startDate, endDate, timeUnit: "date", category: cid, device: "", gender: "", ages: [] }),
        signal: controllerD1.signal
      });
    } finally {
      clearTimeout(timerD1);
    }
    if (!res.ok) {
      const bodyText = await res.text();
      return { keywords: [], error: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
    }
    const data = await res.json();
    const ranks = data?.ranks || data?.results?.[0]?.data || [];
    const keywords = ranks.slice(0, count).map((r) => r.keyword).filter(Boolean);
    return { keywords, error: keywords.length ? null : `응답에 순위 없음 — raw: ${JSON.stringify(data).slice(0, 200)}` };
  } catch (e) {
    return { keywords: [], error: e.message };
  }
}
__name(naverShoppingHotKeywords, "naverShoppingHotKeywords");
async function scanNaverShoppingProducts(env) {
  const items = [];
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
    console.log("네이버쇼핑 스캔 스킵 — NAVER_CLIENT_ID/SECRET 시크릿 미등록");
    return items;
  }
  // 1) 데이터랩 트렌드 키워드로 실제 인기 상품명 발굴 (분야 목록 자체는 소수라 순차, 키워드별 검색은 병렬)
  for (const c of NAVER_SHOPPING_CID_LIST) {
    const { keywords, error: kwErr } = await naverShoppingHotKeywords(env, c.cid, 8);
    if (kwErr) {
      console.log(`네이버 인기검색어(${c.name}) 실패: ${kwErr}`);
      continue;
    }
    const results = await Promise.all(keywords.map((kw) => naverShoppingSearch(kw, env, 3, "sim")));
    for (const { items: found, error: searchErr } of results) {
      if (searchErr) continue;
      for (const f of found) {
        if (isTechRelated(f.name)) items.push({ category: `네이버트렌드(${c.name})`, name: f.name });
      }
    }
  }
  // 2) 핫키워드 시드로 네이버쇼핑 신상품(sort=date) 보강 발굴 — 병렬
  const seedResults = await Promise.all(HOT_KEYWORDS.map((seed) => naverShoppingSearch(seed, env, 4, "date")));
  for (const { items: found, error } of seedResults) {
    if (error) continue;
    for (const f of found) {
      if (isTechRelated(f.name)) items.push({ category: "네이버쇼핑", name: f.name });
    }
  }
  return items;
}
__name(scanNaverShoppingProducts, "scanNaverShoppingProducts");
async function fetchDanawaTrendingKeywords() {
  try {
    const controllerD2 = new AbortController();
    const timerD2 = setTimeout(() => controllerD2.abort(), 8000);
    let res;
    try {
      res = await fetch("https://search.danawa.com/dsearch.php?query=" + encodeURIComponent("전자기기"), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; usbkrBot/1.0)" },
        signal: controllerD2.signal
      });
    } finally {
      clearTimeout(timerD2);
    }
    if (!res.ok) return [];
    let html = await res.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const marker = "급상승 키워드";
    const idx = text.lastIndexOf(marker);
    if (idx === -1) return [];
    const segment = text.slice(idx + marker.length, idx + marker.length + 400);
    const rawItems = segment.split(/순위변경\s*\d+|신규진입/).map((s) => s.trim()).filter(Boolean);
    const keywords = [];
    for (const item of rawItems) {
      if (!item || item.includes("다나와") || item.includes("키워드") || item.length > 20) break;
      keywords.push(item);
    }
    const techOnly = keywords.filter((kw) => isTechRelated(kw));
    console.log("다나와 트렌드 키워드: " + keywords.join(", ") + " (테크 필터 후: " + techOnly.join(", ") + ")");
    return techOnly;
  } catch (e) {
    console.log("다나와 트렌드 키워드 수집 실패: " + e.message);
    return [];
  }
}
__name(fetchDanawaTrendingKeywords, "fetchDanawaTrendingKeywords");
function buildMixedKeywordPool(danawaKeywords, coupangKeywords, size) {
  const shuffledDanawa = [...new Set(danawaKeywords)].sort(() => Math.random() - 0.5);
  const danawaSlots = Math.min(shuffledDanawa.length, Math.ceil(size / 2));
  const picked = shuffledDanawa.slice(0, danawaSlots);
  const pickedSet = new Set(picked);
  const remainingCoupang = [...new Set(coupangKeywords)].filter((kw) => !pickedSet.has(kw)).sort(() => Math.random() - 0.5);
  for (const kw of remainingCoupang) {
    if (picked.length >= size) break;
    picked.push(kw);
  }
  return picked.sort(() => Math.random() - 0.5);
}
__name(buildMixedKeywordPool, "buildMixedKeywordPool");
// ============================================
// Danawa 제품 스캔 및 가져오기
// ============================================
function extractProductNames(html) {
  const nameRegex = /class="prod_name"[\s\S]*?<a[^>]*name="productName"[^>]*>([\s\S]*?)<\/a>/g;
  const matches = [];
  let m;
  while ((m = nameRegex.exec(html)) !== null) {
    matches.push({ index: m.index, end: nameRegex.lastIndex, raw: m[1] });
  }
  const results = [];
  for (let i = 0; i < matches.length; i++) {
    const clean = matches[i].raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    // 다음 상품 블록 시작 전까지(없으면 3000자 이내)에서 "26.07. 등록" 같은 등록년월 패턴을 찾음
    const windowEnd = i + 1 < matches.length ? matches[i + 1].index : matches[i].end + 3000;
    const chunk = html.slice(matches[i].end, windowEnd);
    const dateMatch = chunk.match(/(\d{2})\.(\d{2})\.\s*등록/);
    const regYm = dateMatch ? dateMatch[1] + dateMatch[2] : null; // 예: "2607"
    results.push({ name: clean, regYm });
  }
  return results;
}
__name(extractProductNames, "extractProductNames");

const IT_NEWS_KEYWORDS = [
  "노트북", "모니터", "키보드", "마우스", "이어폰", "헤드폰", "스피커", "SSD", "HDD", "그래픽카드",
  "CPU", "메인보드", "파워", "쿨러", "웹캠", "태블릿", "스마트폰", "휴대폰", "충전기", "보조배터리",
  "공유기", "NAS", "프린터", "스캐너", "카메라", "캠코더", "드론", "게이밍", "마이크", "VR", "AR",
  "글래스", "반도체", "메모리", "RAM", "프로세서", "로봇청소기", "청소기", "셋톱박스", "스마트워치",
  "웨어러블", "전자기기", "가전", "AI", "노이즈 캔슬링"
];
function isItRelatedNewsTitle(title) {
  return IT_NEWS_KEYWORDS.some((k) => title.includes(k));
}
__name(isItRelatedNewsTitle, "isItRelatedNewsTitle");

function parseNewsItemText(rawText) {
  const text = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2})\./);
  const now = new Date();
  let regYm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  let cutIndex = -1;
  if (dateMatch) {
    regYm = dateMatch[1] + dateMatch[2];
    cutIndex = text.indexOf(dateMatch[0]);
  } else {
    const timeMatch = text.match(/\d{2}:\d{2}:\d{2}/); // 오늘 등록된 글은 날짜 대신 시각만 표시됨
    if (timeMatch) cutIndex = text.indexOf(timeMatch[0]);
  }
  const title = (cutIndex > 0 ? text.slice(0, cutIndex) : text).trim();
  return { title, regYm };
}
__name(parseNewsItemText, "parseNewsItemText");

function extractProductNameFromNewsTitle(title) {
  const brandMatch = title.match(/^([가-힣A-Za-z0-9]+)/);
  const brand = brandMatch ? brandMatch[1] : "";
  const modelMatch = title.match(/\b[A-Z][A-Za-z0-9]*-?[A-Za-z0-9]*\d[A-Za-z0-9-]*\b/);
  const quoted = title.match(/['‘]([^'’]{2,60})['’]/);
  if (modelMatch && modelMatch[0].replace(/[^A-Za-z0-9]/g, "").length >= 3) {
    const parts = [brand, modelMatch[0]];
    if (quoted && quoted[1] !== brand && !modelMatch[0].includes(quoted[1]) && !quoted[1].includes(modelMatch[0])) {
      parts.push(quoted[1]);
    }
    return [...new Set(parts.filter(Boolean))].join(" ").trim();
  }
  if (quoted) {
    const q = quoted[1].trim();
    return brand && !q.includes(brand) ? `${brand} ${q}` : q;
  }
  return title.replace(/\s*(출시|공개|선봬|발표)\.?$/, "").trim();
}
__name(extractProductNameFromNewsTitle, "extractProductNameFromNewsTitle");

async function scanDanawaNewProductNews(env, pages = 2) {
  const items = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://dpg.danawa.com/mobile/news/list?boardSeq=61&page=${page}`;
    try {
      const controllerD3 = new AbortController();
      const timerD3 = setTimeout(() => controllerD3.abort(), 8000);
      let res;
      try {
        res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, signal: controllerD3.signal });
      } finally {
        clearTimeout(timerD3);
      }
      if (!res.ok) continue;
      const html = await res.text();
      const itemRegex = /<a[^>]+href="[^"]*\/mobile\/news\/view\?boardSeq=61&listSeq=\d+"[^>]*>([\s\S]{0,300}?)<\/a>/g;
      let m;
      while ((m = itemRegex.exec(html)) !== null) {
        const parsed = parseNewsItemText(m[1]);
        if (!parsed.title || parsed.title.length < 4) continue;
        if (!isItRelatedNewsTitle(parsed.title)) continue;
        const productName = extractProductNameFromNewsTitle(parsed.title);
        if (productName) items.push({ category: "신상품뉴스", name: productName, regYm: parsed.regYm });
      }
    } catch (e) {
      console.log(`신상품뉴스 스캔 오류(page ${page}): ${e.message}`);
    }
  }
  return items;
}
__name(scanDanawaNewProductNews, "scanDanawaNewProductNews");

async function scanDanawaDailyProducts(env) {
  const tasks = IT_CATEGORIES.map(async (category) => {
    const targetUrl = `https://prod.danawa.com/list/?${category.cate}`;
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!res.ok) return { category: category.name, error: `status ${res.status}` };
      const html = await res.text();
      const names = extractProductNames(html);
      return { category: category.name, count: names.length, names };
    } catch (e) {
      return { category: category.name, error: String(e) };
    }
  });

  const results = await Promise.all(tasks);
  const allItems = [];
  for (const r of results) {
    if (r.names) {
      for (const item of r.names) allItems.push({ category: r.category, name: item.name, regYm: item.regYm });
    }
  }

  // 신상품뉴스 게시판(진짜 "방금 출시된" 상품)도 합쳐서 최신성 보강
  try {
    const newsItems = await scanDanawaNewProductNews(env);
    const seen = new Set(allItems.map((i) => i.name));
    for (const item of newsItems) {
      if (!seen.has(item.name)) {
        allItems.push(item);
        seen.add(item.name);
      }
    }
    console.log(`신상품뉴스 스캔: ${newsItems.length}개 (중복제외 후 추가됨)`);
  } catch (e) {
    console.log(`신상품뉴스 스캔 실패: ${e.message}`);
  }
  
  // 네이버쇼핑(트렌드 키워드+신상품 검색)도 합쳐서 소스 다양화
  try {
    const naverItems = await scanNaverShoppingProducts(env);
    const seenN = new Set(allItems.map((i) => i.name));
    let addedN = 0;
    for (const item of naverItems) {
      if (!seenN.has(item.name)) {
        allItems.push(item);
        seenN.add(item.name);
        addedN++;
      }
    }
    console.log(`네이버쇼핑 스캔: ${naverItems.length}개 (중복제외 후 ${addedN}개 추가됨)`);
  } catch (e) {
    console.log(`네이버쇼핑 스캔 실패: ${e.message}`);
  }

  // KV에 24시간 TTL로 저장
  if (allItems.length > 0) {
    await safeKVPut(env, 'danawa-daily-products', JSON.stringify(allItems), { expirationTtl: SCAN_INTERVAL_SECONDS + 86400 });
    await safeKVPut(env, 'danawa-last-scan-at', String(Date.now()), { expirationTtl: SCAN_INTERVAL_SECONDS + 86400 });
    console.log(`Danawa+네이버 스캔 완료: ${allItems.length}개 제품 저장`);
  }
  return allItems;
}
__name(scanDanawaDailyProducts, "scanDanawaDailyProducts");
var SCAN_INTERVAL_SECONDS = 3 * 24 * 60 * 60; // 3일에 한번만 재스캔
async function scanDanawaDailyProductsIfDue(env) {
  const lastScanAt = await env.POSTS.get('danawa-last-scan-at');
  if (lastScanAt && Date.now() - Number(lastScanAt) < SCAN_INTERVAL_SECONDS * 1000) {
    const hoursLeft = Math.round((SCAN_INTERVAL_SECONDS * 1000 - (Date.now() - Number(lastScanAt))) / 3600000);
    console.log(`Danawa+네이버 스캔 스킵 — 마지막 스캔 후 ${SCAN_INTERVAL_SECONDS / 3600}시간 미경과 (약 ${hoursLeft}시간 후 재스캔)`);
    return null;
  }
  return await scanDanawaDailyProducts(env);
}
__name(scanDanawaDailyProductsIfDue, "scanDanawaDailyProductsIfDue");
function checkCronKey(request, env) {
  if (!env.CRON_SECRET) return true; // 시크릿 미설정시 막지 않음(설정 전 과도기)
  const url = new URL(request.url);
  return url.searchParams.get("key") === env.CRON_SECRET;
}
__name(checkCronKey, "checkCronKey");
async function handleExternalDanawaScan(request, env) {
  // cron-job.org 같은 외부 스케줄러가 호출하는 용도 — Cloudflare 크론 슬롯 한도 초과시 대안
  if (!checkCronKey(request, env)) return new Response("Unauthorized", { status: 401 });
  const result = await scanDanawaDailyProductsIfDue(env);
  const msg = result === null ? "스킵됨 (아직 재스캔 주기 안 됨)" : `스캔 완료 — ${result.length}개 수집`;
  console.log(`[외부크론] /cron/scan-danawa 호출됨 — ${msg}`);
  return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
__name(handleExternalDanawaScan, "handleExternalDanawaScan");
async function recordCronGenerateResult(env, entry) {
  try {
    const raw = await safeKVGet(env, "cron:generate-history");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    await safeKVPut(env, "cron:generate-history", JSON.stringify(list.slice(0, 30)));
  } catch (e) {}
}
__name(recordCronGenerateResult, "recordCronGenerateResult");
async function handleExternalGeneratePost(request, env) {
  // cron-job.org 외부 스케줄러용 — 2시간마다 글 자동생성 (구 Cloudflare Cron 대체)
  if (!checkCronKey(request, env)) return new Response("Unauthorized", { status: 401 });
  const nowStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  try {
    const result = await generateAndSavePost(env);
    const msg = result?.ok ? `발행 성공: ${result.post.slug}` : `발행 실패: ${result?.reason || "알 수 없는 오류"}`;
    console.log(`[외부크론] /cron/generate-post 호출됨 — ${msg}`);
    await recordCronGenerateResult(env, {
      ok: !!result?.ok,
      reason: result?.ok ? null : (result?.reason || "알 수 없는 오류"),
      slug: result?.ok ? result.post.slug : null,
      title: result?.ok ? result.post.title : null,
      at: nowStr
    });
    return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    console.log(`[외부크론] /cron/generate-post 예외: ${e.message}\n${e.stack}`);
    await recordCronGenerateResult(env, {
      ok: false,
      reason: `예외: ${e.message}`,
      slug: null,
      title: null,
      at: nowStr
    });
    return new Response("Error: " + e.message, { status: 500 });
  }
}
__name(handleExternalGeneratePost, "handleExternalGeneratePost");
async function ensureBrokenLinksTable(env) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS broken_links (slug TEXT, product_index INTEGER, product_name TEXT, url TEXT, status_code INTEGER, checked_at INTEGER, fail_count INTEGER DEFAULT 1, PRIMARY KEY (slug, product_index))"
    ).run();
    // 기존에 만들어진 테이블이면 IF NOT EXISTS로는 컬럼이 안 생기므로, 없으면 추가 시도(있으면 에러 무시)
    await env.DB.prepare("ALTER TABLE broken_links ADD COLUMN fail_count INTEGER DEFAULT 1").run().catch(() => {});
    // 링크체크 진행 커서 등 가벼운 상태값도 D1에 저장 — KV write 한도를 매 5분마다 갉아먹지 않기 위함
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS meta_state (key TEXT PRIMARY KEY, value TEXT)").run();
  } catch (e) {}
}
__name(ensureBrokenLinksTable, "ensureBrokenLinksTable");
var LINK_CHECK_FAIL_THRESHOLD = 3; // 이 횟수 이상 연속 실패해야 "끊김"으로 간주(오탐 방지 — 쿠팡이 서버요청을 일시적으로 막는 경우가 많음)
async function checkBrokenLinksBatch(env, batchSize = 8) {
  // 5분 크론에 얹어서 조금씩(8건) 순환하며 쿠팡 링크 생존 여부 확인 — 한번에 다 검사하면 부하가 크므로 커서로 이어서 진행
  if (!env.DB) return { checked: 0 };
  await ensureBrokenLinksTable(env);
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  if (!idx.length) return { checked: 0 };
  let cursor = 0;
  try {
    const row = await env.DB.prepare("SELECT value FROM meta_state WHERE key = 'linkcheck-cursor'").first();
    cursor = row ? parseInt(row.value, 10) || 0 : 0;
  } catch (e) {}
  const slugsToCheck = [];
  for (let i = 0; i < batchSize && i < idx.length; i++) {
    slugsToCheck.push(idx[(cursor + i) % idx.length]);
  }
  let checked = 0;
  for (const slug of slugsToCheck) {
    try {
      const raw = await safeKVGet(env, `post:${slug}`);
      if (!raw) continue;
      const post = JSON.parse(raw);
      const products = post.products || [];
      for (let pi = 0; pi < products.length; pi++) {
        const prod = products[pi];
        if (!prod?.affiliateUrl) continue;
        let statusCode = 0;
        try {
          const res = await fetch(prod.affiliateUrl, {
            method: "GET",
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
              "Accept-Encoding": "gzip, deflate, br",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1",
              "Referer": "https://www.coupang.com/"
            }
          });
          statusCode = res.status;
        } catch (e) {
          statusCode = 0; // 네트워크 오류도 이상 신호로 취급
        }
        checked++;
        if (statusCode >= 400 || statusCode === 0) {
          try {
            await env.DB.prepare(
              "INSERT INTO broken_links (slug, product_index, product_name, url, status_code, checked_at, fail_count) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT(slug, product_index) DO UPDATE SET status_code=excluded.status_code, checked_at=excluded.checked_at, fail_count = broken_links.fail_count + 1"
            ).bind(slug, pi, prod.name || "", prod.affiliateUrl, statusCode, Date.now()).run();
          } catch (e) {}
        } else {
          try {
            await env.DB.prepare("DELETE FROM broken_links WHERE slug = ? AND product_index = ?").bind(slug, pi).run();
          } catch (e) {}
        }
      }
    } catch (e) {
      console.log(`[링크체크] "${slug}" 확인 실패: ${e.message}`);
    }
  }
  const nextCursor = idx.length ? (cursor + batchSize) % idx.length : 0;
  try {
    await env.DB.prepare(
      "INSERT INTO meta_state (key, value) VALUES ('linkcheck-cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(String(nextCursor)).run();
  } catch (e) {}
  return { checked };
}
__name(checkBrokenLinksBatch, "checkBrokenLinksBatch");
async function syncKvFallbackToKV(env, batchLimit = 50) {
  // KV 한도 초과로 D1(kv_fallback)에 대신 저장됐던 항목을, KV가 정상화되면 다시 KV로 옮기고 D1에서는 삭제
  if (!env.DB) return { migrated: 0, remaining: 0 };
  let rows;
  try {
    const res = await env.DB.prepare("SELECT key, value, expires_at FROM kv_fallback ORDER BY updated_at ASC LIMIT ?").bind(batchLimit).all();
    rows = res.results || [];
  } catch (e) {
    return { migrated: 0, remaining: 0 }; // 테이블이 아직 없으면(폴백 이력 없음) 조용히 종료
  }
  let migrated = 0;
  for (const row of rows) {
    if (row.expires_at && row.expires_at < Date.now()) {
      // 이미 만료된 항목은 KV로 옮길 필요 없이 D1에서만 정리
      try { await env.DB.prepare("DELETE FROM kv_fallback WHERE key = ?").bind(row.key).run(); } catch (e) {}
      continue;
    }
    const ttlSeconds = row.expires_at ? Math.max(60, Math.ceil((row.expires_at - Date.now()) / 1000)) : undefined;
    try {
      await env.POSTS.put(row.key, row.value, ttlSeconds ? { expirationTtl: ttlSeconds } : undefined);
      await env.DB.prepare("DELETE FROM kv_fallback WHERE key = ?").bind(row.key).run();
      migrated++;
    } catch (e) {
      // 아직 KV 한도가 안 풀린 상태 — 더 시도해봐야 다 실패할 테니 여기서 중단
      console.log(`[KV 폴백 동기화] "${row.key}" 아직 실패, 중단: ${e.message}`);
      break;
    }
  }
  let remaining = 0;
  try {
    const cnt = await env.DB.prepare("SELECT COUNT(*) as c FROM kv_fallback").first();
    remaining = cnt?.c || 0;
  } catch (e) {}
  if (migrated) console.log(`[KV 폴백 동기화] ${migrated}건 KV로 복구 완료, 남은 대기 ${remaining}건`);
  return { migrated, remaining };
}
__name(syncKvFallbackToKV, "syncKvFallbackToKV");
async function handleExternalVideoPoll(request, env) {
  // cron-job.org 외부 스케줄러용 — 5분마다 영상 작업 폴링 (구 Cloudflare Cron 대체)
  if (!checkCronKey(request, env)) return new Response("Unauthorized", { status: 401 });
  try {
    await pollPendingVideoJobs(env);
    const syncResult = await syncKvFallbackToKV(env);
    const linkCheckResult = await checkBrokenLinksBatch(env).catch(() => ({ checked: 0 }));
    console.log(`[외부크론] /cron/poll-video 호출됨 — 완료 (KV폴백 복구 ${syncResult.migrated}건, 대기 ${syncResult.remaining}건, 링크체크 ${linkCheckResult.checked}건)`);
    return new Response("ok", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    console.log(`[외부크론] /cron/poll-video 예외: ${e.message}\n${e.stack}`);
    return new Response("Error: " + e.message, { status: 500 });
  }
}
__name(handleExternalVideoPoll, "handleExternalVideoPoll");

async function getDanawaDailyProducts(env) {
  const stored = await env.POSTS.get('danawa-daily-products');
  if (stored) {
    return JSON.parse(stored);
  }
  // 캐시가 없다고 여기서 무거운 실시간 스캔을 돌리면(타임아웃 없는 다중 요청) generate-post 크론 전체가
  // 30초 넘게 걸려 죽을 수 있음 — 그냥 건너뛰고 다음 폴백(트렌딩/키워드풀)으로 넘어가게 함.
  // 캐시 채우는 건 전용 크론(/cron/scan-danawa)이 하루 1번 담당.
  console.log("다나와 일일 캐시 없음 — 실시간 스캔 생략, 다음 폴백으로 진행");
  return [];
}
__name(getDanawaDailyProducts, "getDanawaDailyProducts");

async function isProductUsedRecently(productName, env, days = 4) {
  const key = `product-used:${productName}`;
  const used = await env.POSTS.get(key);
  return !!used;
}
__name(isProductUsedRecently, "isProductUsedRecently");

async function markProductAsUsed(productName, env, days = 4) {
  const key = `product-used:${productName}`;
  await safeKVPut(env, key, Date.now().toString(), { expirationTtl: days * 24 * 60 * 60 });
}
__name(markProductAsUsed, "markProductAsUsed");
function keywordCoreTokens(keyword) {
  const raw = (keyword || "").toLowerCase().split(/[\s,/()\-]+/).filter((t) => t.length >= 2);
  const core = raw.filter((t) => t.length >= 3);
  return core.length ? core : raw;
}
__name(keywordCoreTokens, "keywordCoreTokens");
async function isKeywordUsedRecently(keyword, env) {
  if (await env.POSTS.get(`usedKeyword:${keyword}`)) return true;
  // 완전히 다른 문자열이라도 핵심 토큰이 겹치면(예: "무선청소기" vs "핸디청소기"의 "청소기") 사실상 같은 상품군일 수 있으므로 최근목록과 비교
  try {
    const listRaw = await env.POSTS.get("recent-keywords-list");
    if (!listRaw) return false;
    const list = JSON.parse(listRaw);
    const cutoff = Date.now() - KEYWORD_USED_TTL_SECONDS * 1000;
    const candidateTokens = keywordCoreTokens(keyword);
    for (const entry of list) {
      if (!entry.at || entry.at < cutoff) continue;
      if (entry.keyword === keyword) continue; // 완전동일은 위에서 이미 체크됨
      const overlap = entry.tokens.filter((t) => candidateTokens.includes(t));
      if (overlap.length > 0) return true;
    }
  } catch (e) {}
  return false;
}
__name(isKeywordUsedRecently, "isKeywordUsedRecently");
async function markKeywordUsed(keyword, env) {
  await safeKVPut(env, `usedKeyword:${keyword}`, "1", { expirationTtl: KEYWORD_USED_TTL_SECONDS });
  try {
    const listRaw = await env.POSTS.get("recent-keywords-list");
    const list = listRaw ? JSON.parse(listRaw) : [];
    const cutoff = Date.now() - KEYWORD_USED_TTL_SECONDS * 1000;
    const trimmed = list.filter((e) => e.at && e.at >= cutoff).slice(0, 200);
    trimmed.unshift({ keyword, tokens: keywordCoreTokens(keyword), at: Date.now() });
    await safeKVPut(env, "recent-keywords-list", JSON.stringify(trimmed));
  } catch (e) {}
}
__name(markKeywordUsed, "markKeywordUsed");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const response = await handleRequest(request, env, ctx, url, path);
    return applySecurityHeaders(response, path);
  }
};
function applySecurityHeaders(response, path) {
  // /out은 외부(쿠팡)로 리다이렉트하는 용도라 과한 CSP를 걸면 정상 동작에 지장 없지만, 일관성 위해 기본 헤더는 동일 적용
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (!headers.has("X-Frame-Options")) headers.set("X-Frame-Options", "SAMEORIGIN");
  const ct = headers.get("Content-Type") || "";
  if (ct.includes("text/html")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; frame-ancestors 'self'; base-uri 'self'"
    );
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
__name(applySecurityHeaders, "applySecurityHeaders");
async function handleRequest(request, env, ctx, url, path) {
    try {
      if (path.startsWith("/admin")) {
        const authFail = checkAdminPassword(request, env);
        if (authFail) return authFail;
      }
      if (path === "/") return await renderHomePage(env, request);
      if (path === "/0") return await renderStatsPage(env);
      if (path === "/api/posts") return await handleApiMorePosts(request, env);
      if (path === "/privacy") return renderPrivacyPage();
      if (path === "/robots.txt") return renderRobotsTxt();
      if (path === "/llms.txt") return await renderLlmsTxt(env);
      if (path === "/sitemap.xml") return await renderSitemap(env);
      if (path === "/feed.xml" || path === "/rss.xml") return await renderRssFeed(env);
      if (path.startsWith("/category/")) return await renderCategoryPage(env, decodeURIComponent(path.slice("/category/".length)), request, ctx);
      if (path === "/favicon.ico" || path === "/favicon.svg") {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><rect x="2" y="2" width="22" height="22" rx="6" fill="#3A2E2A" stroke="#FF4B3E" stroke-width="1.5"/><path d="M13 6.5V15" stroke="#FF4B3E" stroke-width="1.6" stroke-linecap="round"/><path d="M9.5 9L13 6.5L16.5 9" stroke="#FF4B3E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="17.5" r="1.6" fill="#FFC629"/><circle cx="16.5" cy="17.5" r="1.6" fill="#FFC629"/><path d="M13 15V17.5H9.5M13 17.5H16.5" stroke="#FFC629" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=2592000" } });
      }
      if (path === "/img") return await proxyImage(url.searchParams.get("u"), { removeBg: url.searchParams.get("nobg") === "1" });
      if (path === "/manifest.json") {
        const manifest = {
          name: "usb.kr - 전자기기 비교 가이드",
          short_name: "usb.kr",
          start_url: "/",
          display: "standalone",
          background_color: "#FFF9F6",
          theme_color: "#FF4B3E",
          icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
        };
        return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
      }
      if (path.startsWith("/img/")) return await proxyImage(decodeImgToken(path.slice("/img/".length)), { removeBg: url.searchParams.get("nobg") === "1" });
      if (path.startsWith("/video/")) return await serveVideo(request, env, ctx, decodeURIComponent(path.slice("/video/".length)));
      if (path === "/admin/generate-video" && request.method === "POST") return await handleGenerateVideo(request, env);
      if (path.startsWith("/post/")) return await renderPostPage(env, decodeURIComponent(path.slice(6)), request, ctx);
      if (path === "/admin") {
        const adminRes = await renderAdminPage(env, url);
        const newHeaders = new Headers(adminRes.headers);
        newHeaders.append("Set-Cookie", "owner=1; Max-Age=31536000; Path=/; SameSite=Lax");
        return new Response(adminRes.body, { status: adminRes.status, headers: newHeaders });
      }
      if (path === "/admin/generate" && request.method === "POST") return await handleManualGenerate(request, env);
      if (path === "/admin/priority-keyword/add" && request.method === "POST") return await handleAddPriorityKeyword(request, env);
      if (path === "/admin/priority-keyword/remove" && request.method === "POST") return await handleRemovePriorityKeyword(request, env);
      if (path === "/admin/priority-keyword/promote" && request.method === "POST") return await handlePromotePriorityKeyword(request, env);
      if (path === "/admin/priority-url/add" && request.method === "POST") return await handleAddPriorityUrl(request, env);
      if (path === "/admin/priority-url/remove" && request.method === "POST") return await handleRemovePriorityUrl(request, env);
      if (path === "/admin/priority-url/promote" && request.method === "POST") return await handlePromotePriorityUrl(request, env);
      if (path === "/admin/generate-from-url" && request.method === "POST") return await handleGenerateFromUrl(request, env);
      if (path === "/go" && request.method === "GET") return await handleCoupangSearchRedirect(request, env, ctx);
      if (path === "/out" && request.method === "GET") return await handleOutboundClick(request, env, ctx);
      if (path === "/admin/generate-from-extension" && request.method === "POST") return await handleGenerateFromExtension(request, env);
      if (path === "/cron/scan-danawa") return await handleExternalDanawaScan(request, env);
      if (path === "/cron/generate-post") return await handleExternalGeneratePost(request, env);
      if (path === "/cron/poll-video") return await handleExternalVideoPoll(request, env);
      if (path === "/admin/generate-trending" && request.method === "POST") return await handleTrendingGenerate(env);
      if (path === "/admin/delete" && request.method === "POST") return await handleDelete(request, env);

      const rootSlugMatch = path.match(/^\/([^\/]+)$/);
      if (rootSlugMatch) return await renderPostPage(env, decodeURIComponent(rootSlugMatch[1]), request, ctx);
      if (!isLikelyBotUA(request.headers.get("User-Agent"))) ctx.waitUntil(bumpDailyCounter(env, "notfound", "paths", path));
      return new Response(null, { status: 302, headers: { Location: "/" } });
    } catch (e) {
      if (!isLikelyBotUA(request.headers.get("User-Agent"))) ctx.waitUntil(bumpDailyCounter(env, "notfound", "serverErrors", path));
      return new Response("Server error: " + e.message, { status: 500 });
    }
}
__name(handleRequest, "handleRequest");
var ALLOWED_IMAGE_HOST_SUFFIXES = [".coupangcdn.com", ".coupang.com"];
var ALLOWED_IMAGE_HOSTS_EXACT = ["coupangcdn.com", "coupang.com"];
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOSTS_EXACT.includes(hostname) || ALLOWED_IMAGE_HOST_SUFFIXES.some((suf) => hostname.endsWith(suf));
}
__name(isAllowedImageHost, "isAllowedImageHost");
async function serveVideo(request, env, ctx, key) {
  if (!env.VIDEOS) return new Response("Video storage not configured", { status: 500 });
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const object = await env.VIDEOS.get(key);
  if (!object) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=604800");
  const response = new Response(object.body, { headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
__name(serveVideo, "serveVideo");
async function proxyImage(imageUrl, opts = {}) {
  if (!imageUrl) return new Response("Invalid image URL", { status: 400 });
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch (e) {
    return new Response("Invalid image URL", { status: 400 });
  }
  if (parsed.protocol !== "https:" || !isAllowedImageHost(parsed.hostname)) {
    return new Response("Invalid image URL", { status: 400 });
  }
  try {
    const imageOptions = { width: 440, quality: 75, format: "webp" };
    if (opts.removeBg) imageOptions.segment = "foreground"; // 흰 배경 등을 투명 처리(Cloudflare Images 배경제거)
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; usbkrBot/1.0)" },
      cf: {
        cacheTtl: 604800,
        cacheEverything: true,
        image: imageOptions
      }
    });
    if (!res.ok) return new Response("Image fetch failed", { status: 502 });
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType && !contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 400 });
    }
    const contentLength = Number(res.headers.get("Content-Length") || 0);
    if (contentLength && contentLength > MAX_IMAGE_BYTES) {
      return new Response("Image too large", { status: 413 });
    }
    return new Response(res.body, {
      headers: { "Content-Type": contentType || "image/webp", "Cache-Control": "public, max-age=604800" }
    });
  } catch (e) {
    return new Response("Image proxy error: " + e.message, { status: 502 });
  }
}
__name(proxyImage, "proxyImage");
function imgProxy(u, opts = {}) {
  const b64 = btoa(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const suffix = opts.removeBg ? "?nobg=1" : "";
  return "/img/" + b64 + suffix;
}
__name(imgProxy, "imgProxy");
function decodeImgToken(token) {
  let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return atob(b64);
}
__name(decodeImgToken, "decodeImgToken");
async function coupangSignedHeaders(method, pathWithQuery, env) {
  const datetime = (/* @__PURE__ */ new Date()).toISOString().substr(2, 17).replace(/[-:]/g, "") + "Z";
  const [path, query = ""] = pathWithQuery.split("?");
  const message = datetime + method + path + query;
  const keyData = new TextEncoder().encode(env.COUPANG_SECRET_KEY);
  const msgData = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signature = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return {
    "Authorization": `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`,
    "Content-Type": "application/json"
  };
}
__name(coupangSignedHeaders, "coupangSignedHeaders");
var BEST_CATEGORY_IDS = [
  { id: 1016, name: "가전디지털" },
  // 전자기기 전반 — 가장 확실한 소스
  { id: 1017, name: "스포츠레저" },
  // 액션캠, 웨어러블 등 일부 테크 겹침
  { id: 1018, name: "자동차용품" },
  // 블랙박스, 차량용 카플레이 등
  { id: 1020, name: "완구/취미" },
  // 드론, RC, 3D프린터 등
  { id: 1021, name: "문구오피스" }
  // 프린터, 사무용 전자기기
];
async function coupangBestCategoryProducts(categoryId, env, limit = 20) {
  const path = `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${categoryId}?limit=${limit}`;
  const headers = await coupangSignedHeaders("GET", path, env);
  let res;
  const controller1 = new AbortController();
  const timer1 = setTimeout(() => controller1.abort(), 8000);
  try {
    res = await fetch("https://api-gateway.coupang.com" + path, { headers, signal: controller1.signal });
  } catch (e) {
    return { products: [], error: "네트워크 오류: " + e.message };
  } finally {
    clearTimeout(timer1);
  }
  if (!res.ok) {
    const bodyText = await res.text();
    console.log("쿠팡 베스트카테고리 실패: " + res.status + " " + bodyText.slice(0, 200));
    return { products: [], error: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
  }
  const data = await res.json();
  const productData = data?.data;
  if (!Array.isArray(productData) || !productData.length) {
    return {
      products: [],
      error: `응답은 성공(200)했지만 상품 없음 — rCode:${data?.rCode ?? "N/A"} rMessage:${data?.rMessage ?? "N/A"} raw:${JSON.stringify(data).slice(0, 300)}`
    };
  }
  return { products: productData, error: null };
}
__name(coupangBestCategoryProducts, "coupangBestCategoryProducts");
var VEO_MODEL = "veo-3.1-fast-generate-preview";
var VEO_BASE_URL = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_AI_GATEWAY}/google-ai-studio/v1beta`;
var VIDEO_JOB_TIMEOUT_MS = 30 * 60 * 1e3;
var VIDEO_POLL_CRON = "*/5 * * * *";
var DANAWA_SCAN_CRON = "0 5 * * *";
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function startVeoOperation({ prompt, imageBase64, imageMimeType }, env) {
  const instance = { prompt };
  if (imageBase64) {
    instance.image = { bytesBase64Encoded: imageBase64, mimeType: imageMimeType || "image/jpeg" };
  }
  let res;
  try {
    res = await fetch(`${VEO_BASE_URL}/models/${VEO_MODEL}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ instances: [instance] })
    });
  } catch (e) {
    return { ok: false, error: `Veo 시작 네트워크 오류: ${e.message}` };
  }
  if (!res.ok) {
    const bodyText = await res.text();
    return { ok: false, error: `Veo 시작 실패 HTTP ${res.status}: ${bodyText.slice(0, 300)}` };
  }
  const data = await res.json();
  const operationName = data?.name;
  if (!operationName) {
    return { ok: false, error: `operation name 없음 — raw: ${JSON.stringify(data).slice(0, 300)}` };
  }
  return { ok: true, operationName };
}
__name(startVeoOperation, "startVeoOperation");
async function fetchVeoVideoBytes({ videoUri, videoBase64 }, env) {
  if (videoBase64) {
    const binary = atob(videoBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(videoUri, { headers: { "x-goog-api-key": env.GEMINI_API_KEY } });
  if (!res.ok) throw new Error(`영상 다운로드 실패: HTTP ${res.status}`);
  return await res.arrayBuffer();
}
__name(fetchVeoVideoBytes, "fetchVeoVideoBytes");
function buildVideoPrompt(productName, hasImage = true) {
  if (hasImage) {
    return `주어진 이미지에 있는 바로 그 제품(${productName})만을 그대로 사용해서 짧은 홍보 영상을 만들어라. 매우 중요한 규칙: 1) 이미지 속 제품의 모양, 색상, 로고, 디자인, 비율을 절대 바꾸지 않는다 2) 다른 제품이나 유사 제품으로 바꾸지 않는다 3) 제품을 새로 그리거나 재해석하지 않고, 원본 이미지를 기준으로 카메라 앵글/움직임과 조명만 살짝 더한다 4) 배경은 깔끔하고 단순하게, 제품 외에 다른 물체를 추가하지 않는다 5) 텍스트나 로고를 새로 생성하지 않는다. 카메라가 제품 주위를 천천히 돌거나 살짝 클로즈업하는 정도의 절제된 움직임만 사용한다.`;
  }
  return `"${productName}" 제품을 소개하는 짧고 절제된 홍보 영상을 만들어라. 깔끔하고 단순한 배경, 부드러운 조명, 제품이 자연스럽게 돋보이는 카메라 워크만 사용한다. 실존하지 않는 브랜드 로고나 텍스트를 화면에 새로 만들어 넣지 않는다.`;
}
__name(buildVideoPrompt, "buildVideoPrompt");
async function startVideoJob({ prompt, imageUrl, r2Key, slug, field }, env) {
  if (!env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY 환경변수가 설정 안 됨" };
  if (!env.VIDEOS) return { ok: false, error: "VIDEOS(R2) 바인딩이 없음" };
  let imageBase64 = null;
  let imageMimeType = null;
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl, { cf: { image: { width: 720, quality: 80 } } });
      if (imgRes.ok) {
        imageMimeType = imgRes.headers.get("Content-Type") || "image/jpeg";
        imageBase64 = arrayBufferToBase64(await imgRes.arrayBuffer());
      }
    } catch (e) {
      console.log("영상용 이미지 준비 실패, 이미지 없이 진행: " + e.message);
    }
  }
  const start = await startVeoOperation({ prompt, imageBase64, imageMimeType }, env);
  if (!start.ok) return start;
  const saved = await safeKVPut(env,
    `videoJob:${slug}:${field}`,
    JSON.stringify({ operationName: start.operationName, slug, r2Key, field, startedAt: Date.now() })
  );
  if (!saved) return { ok: false, reason: "영상 작업 정보 저장 실패(KV 한도 초과 가능성)" };
  console.log(`영상 작업 등록됨: ${slug}:${field} (operation: ${start.operationName})`);
  return { ok: true };
}
__name(startVideoJob, "startVideoJob");
async function pollPendingVideoJobs(env) {
  const list = await env.POSTS.list({ prefix: "videoJob:" });
  if (!list.keys.length) {
    console.log("대기 중인 영상 작업 없음.");
    return;
  }
  console.log(`대기 중인 영상 작업 ${list.keys.length}건 확인 시작.`);
  for (const keyInfo of list.keys) {
    const raw = await env.POSTS.get(keyInfo.name);
    if (!raw) continue;
    const job = JSON.parse(raw);
    let res;
    try {
      res = await fetch(`${VEO_BASE_URL}/${job.operationName}`, { headers: { "x-goog-api-key": env.GEMINI_API_KEY } });
    } catch (e) {
      console.log(`[${keyInfo.name}] 상태 조회 네트워크 오류: ${e.message}`);
      continue;
    }
    if (!res.ok) {
      const bodyText = await res.text();
      console.log(`[${keyInfo.name}] 상태 조회 실패 HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
      continue;
    }
    const data = await res.json();
    if (!data.done) {
      if (Date.now() - job.startedAt > VIDEO_JOB_TIMEOUT_MS) {
        console.log(`[${keyInfo.name}] 타임아웃(${VIDEO_JOB_TIMEOUT_MS / 6e4}분 초과)으로 작업 포기.`);
        await env.POSTS.delete(keyInfo.name);
      } else {
        console.log(`[${keyInfo.name}] 아직 진행 중.`);
      }
      continue;
    }
    if (data.error) {
      console.log(`[${keyInfo.name}] Veo 생성 오류: ${JSON.stringify(data.error).slice(0, 300)}`);
      await env.POSTS.delete(keyInfo.name);
      continue;
    }
    const videoUri = data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || data?.response?.generatedVideos?.[0]?.video?.uri || data?.response?.videos?.[0]?.uri || null;
    const videoBase64 = data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded || data?.response?.generatedVideos?.[0]?.video?.videoBytes || null;
    if (!videoUri && !videoBase64) {
      console.log(`[${keyInfo.name}] 완료됐지만 영상 위치를 못 찾음 — raw: ${JSON.stringify(data).slice(0, 400)}`);
      await env.POSTS.delete(keyInfo.name);
      continue;
    }
    let videoBuffer;
    try {
      videoBuffer = await fetchVeoVideoBytes({ videoUri, videoBase64 }, env);
    } catch (e) {
      console.log(`[${keyInfo.name}] 영상 다운로드 실패: ${e.message}`);
      continue;
    }
    await env.VIDEOS.put(job.r2Key, videoBuffer, { httpMetadata: { contentType: "video/mp4" } });
    const postRaw = await safeKVGet(env, `post:${job.slug}`);
    if (postRaw) {
      const post = JSON.parse(postRaw);
      post[job.field] = job.r2Key;
      const saved = await safeKVPut(env, `post:${job.slug}`, JSON.stringify(post));
      if (!saved) { console.log(`[${keyInfo.name}] 영상 필드 저장 실패(KV 한도), 다음 폴링에서 재시도`); continue; }
    }
    await env.POSTS.delete(keyInfo.name).catch(() => {});
    console.log(`[${keyInfo.name}] 완료 및 저장: ${job.r2Key}`);
  }
}
__name(pollPendingVideoJobs, "pollPendingVideoJobs");
async function coupangSearchProducts(keyword, env, limit = 8) {
  const safeKeyword = (keyword || "").slice(0, 50);
  const path = `/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=${encodeURIComponent(safeKeyword)}&limit=${limit}`;
  const headers = await coupangSignedHeaders("GET", path, env);
  let res;
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), 8000);
  try {
    res = await fetch("https://api-gateway.coupang.com" + path, { headers, signal: controller2.signal });
  } catch (e) {
    return { products: [], error: "네트워크 오류: " + e.message };
  } finally {
    clearTimeout(timer2);
  }
  if (!res.ok) {
    const bodyText = await res.text();
    console.log("쿠팡 검색 실패: " + res.status + " " + bodyText.slice(0, 200));
    return { products: [], error: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
  }
  const data = await res.json();
  const productData = data?.data?.productData;
  if (!productData || !productData.length) {
    return {
      products: [],
      error: `응답은 성공(200)했지만 상품 없음 — rCode:${data?.rCode ?? "N/A"} rMessage:${data?.rMessage ?? "N/A"} raw:${JSON.stringify(data).slice(0, 300)}`
    };
  }
  return { products: productData, error: null };
}
__name(coupangSearchProducts, "coupangSearchProducts");
async function coupangDeeplinks(urls, env) {
  const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
  const headers = await coupangSignedHeaders("POST", path, env);
  const controller3 = new AbortController();
  const timer3 = setTimeout(() => controller3.abort(), 8000);
  let res;
  try {
    res = await fetch("https://api-gateway.coupang.com" + path, {
      method: "POST",
      headers,
      body: JSON.stringify({ coupangUrls: urls }),
      signal: controller3.signal
    });
  } catch (e) {
    console.log("쿠팡 딥링크 네트워크 오류: " + e.message);
    return urls.map((u) => ({ originalUrl: u, shortenUrl: u }));
  } finally {
    clearTimeout(timer3);
  }
  if (!res.ok) {
    console.log("쿠팡 딥링크 실패: " + res.status + " " + (await res.text()).slice(0, 200));
    return urls.map((u) => ({ originalUrl: u, shortenUrl: u }));
  }
  const data = await res.json();
  return data?.data || urls.map((u) => ({ originalUrl: u, shortenUrl: u }));
}
__name(coupangDeeplinks, "coupangDeeplinks");
async function handleCoupangSearchRedirect(request, env, ctx) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return Response.redirect(new URL("/", url).toString(), 302);
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(recordSearchQuery(env, q));
  } else {
    recordSearchQuery(env, q).catch(() => {});
  }
  const targetUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(q)}&channel=user`;
  try {
    const links = await coupangDeeplinks([targetUrl], env);
    const affiliateUrl = links[0]?.shortenUrl || targetUrl;
    return Response.redirect(affiliateUrl, 302);
  } catch (e) {
    console.log("검색 딥링크 변환 실패: " + e.message);
    return Response.redirect(targetUrl, 302);
  }
}
__name(handleCoupangSearchRedirect, "handleCoupangSearchRedirect");
var GROQ_MODEL_CHAIN = ["llama-3.1-8b-instant", "openai/gpt-oss-120b"];
async function callGroqChain(systemPrompt, userPrompt, env) {
  const attemptErrors = [];
  const tryCerebras = /* @__PURE__ */ __name(async () => {
    if (!env.CEREBRAS_API_KEY) {
      attemptErrors.push("[cerebras] CEREBRAS_API_KEY 미설정");
      return null;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(`https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_AI_GATEWAY}/cerebras/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CEREBRAS_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-oss-120b",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.6,
            max_tokens: 4200
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) {
        const data = await res.json();
        let raw = data?.choices?.[0]?.message?.content;
        if (raw) {
          raw = raw.trim().replace(/^```json\s*|\s*```$/gm, "").trim();
          try {
            return { article: JSON.parse(raw), error: null, modelUsed: "cerebras:gpt-oss-120b" };
          } catch (e) {
            console.log("Cerebras JSON 파싱 실패: " + raw.slice(0, 300));
            attemptErrors.push(`[cerebras] JSON 파싱 실패: ${e.message}`);
          }
        } else {
          attemptErrors.push("[cerebras] 응답에 content 없음");
        }
      } else {
        const bodyText = await res.text();
        console.log("Cerebras 호출 실패: " + res.status + " " + bodyText.slice(0, 200));
        attemptErrors.push(`[cerebras] HTTP ${res.status}: ${bodyText.slice(0, 150)}`);
      }
    } catch (e) {
      attemptErrors.push(`[cerebras] 네트워크 오류: ${e.message}`);
    }
    return null;
  }, "tryCerebras");
  const tryGroq = /* @__PURE__ */ __name(async () => {
    if (!env.GROQ_API_KEY) {
      attemptErrors.push("[groq] GROQ_API_KEY 환경변수가 설정 안 됨");
      return null;
    }
    const modelsToTry = env.GROQ_MODEL ? [env.GROQ_MODEL, ...GROQ_MODEL_CHAIN] : GROQ_MODEL_CHAIN;
    for (const model of modelsToTry) {
      let res;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        res = await fetch(`https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_AI_GATEWAY}/groq/openai/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.6,
            max_tokens: 4200
          }),
          signal: controller.signal
        });
      } catch (e) {
        attemptErrors.push(`[${model}] 네트워크 오류: ${e.message}`);
        continue;
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        const bodyText = await res.text();
        console.log(`Groq(${model}) 호출 실패: ${res.status} ${bodyText.slice(0, 200)}`);
        attemptErrors.push(`[${model}] HTTP ${res.status}: ${bodyText.slice(0, 150)}`);
        continue;
      }
      const data = await res.json();
      let raw = data?.choices?.[0]?.message?.content;
      if (!raw) {
        attemptErrors.push(`[${model}] 응답에 content 없음`);
        continue;
      }
      raw = raw.trim().replace(/^```json\s*|\s*```$/gm, "").trim();
      try {
        return { article: JSON.parse(raw), error: null, modelUsed: model };
      } catch (e) {
        console.log(`Groq(${model}) JSON 파싱 실패: ` + raw.slice(0, 300));
        attemptErrors.push(`[${model}] JSON 파싱 실패: ${e.message}`);
        continue;
      }
    }
    return null;
  }, "tryGroq");
  // 특정 모델(Cerebras)만 계속 쓰지 않도록, 매 호출마다 1순위를 랜덤으로 섞는다.
  const providers = Math.random() < 0.5 ? [tryCerebras, tryGroq] : [tryGroq, tryCerebras];
  for (const attempt of providers) {
    const result = await attempt();
    if (result) return result;
  }
  if (env.AI) {
    try {
      const aiTimeout1 = new Promise((_, reject) => setTimeout(() => reject(new Error("Workers AI 타임아웃(8초)")), 8000));
      const response = await Promise.race([
        env.AI.run("@cf/zai-org/glm-4.7-flash", {
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 3200
        }, { gateway: { id: CF_AI_GATEWAY } }),
        aiTimeout1
      ]);
      let raw = response?.response;
      if (raw) {
        raw = raw.trim().replace(/^```json\s*|\s*```$/gm, "").trim();
        try {
          return { article: JSON.parse(raw), error: null, modelUsed: "workers-ai:@cf/zai-org/glm-4.7-flash" };
        } catch (e) {
          attemptErrors.push(`[workers-ai] JSON 파싱 실패: ${e.message}`);
        }
      } else {
        attemptErrors.push("[workers-ai] 응답에 content 없음");
      }
    } catch (e) {
      attemptErrors.push(`[workers-ai] 오류: ${e.message}`);
    }
  } else {
    attemptErrors.push("[workers-ai] AI 바인딩 없음");
  }
  return { article: null, error: `모든 모델 시도 실패 — ${attemptErrors.join(" / ")}` };
}
__name(callGroqChain, "callGroqChain");
function cleanProductQuery(productName) {
  // 다나와 원본명은 괄호/옵션이 지저분하게 붙어있어서 검색이 잘 안 맞음 — 핵심 브랜드+모델명만 추림
  let q = (productName || "")
    .replace(/\([^)]*\)/g, " ")       // 괄호 안 내용(병행수입, 색상옵션 등) 제거
    .replace(/\[[^\]]*\]/g, " ")      // 대괄호도 제거
    .replace(/정품|국내|병행수입|리퍼|공식|무료배송|당일발송/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = q.split(" ").filter(Boolean);
  return tokens.slice(0, 6).join(" "); // 브랜드+모델 핵심 토큰 위주로 앞부분만
}
__name(cleanProductQuery, "cleanProductQuery");
async function naverWebResearch(productName, env) {
  // 무료 조사 — 이미 등록된 네이버 오픈API 키(쇼핑발굴용과 동일) 재사용, 추가 비용 없음
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
    console.log(`[조사] "${productName}" 스킵 — NAVER_CLIENT_ID/SECRET 미등록`);
    return { info: null, error: "NAVER_CLIENT_ID/SECRET 미등록" };
  }
  const query = cleanProductQuery(productName);
  try {
    const headers = await naverAuthHeaders(env);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let webRes, encycRes, blogRes, cafeRes;
    try {
      [webRes, encycRes, blogRes, cafeRes] = await Promise.all([
        fetch(`https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(query)}&display=8`, { headers, signal: controller.signal }),
        fetch(`https://openapi.naver.com/v1/search/encyc.json?query=${encodeURIComponent(query)}&display=3`, { headers, signal: controller.signal }),
        fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=8&sort=sim`, { headers, signal: controller.signal }),
        fetch(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(query)}&display=6&sort=sim`, { headers, signal: controller.signal })
      ]);
    } finally {
      clearTimeout(timer);
    }
    const snippets = [];
    for (const [label, res] of [["웹문서", webRes], ["지식백과", encycRes], ["블로그", blogRes], ["카페글", cafeRes]]) {
      if (!res.ok) {
        console.log(`[조사] "${query}" ${label} 실패 — HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        const text = stripNaverHtml(item.description);
        if (text) snippets.push(text);
      }
    }
    const combined = snippets.join(" / ").slice(0, 2500);
    if (!combined) {
      console.log(`[조사] "${query}" 검색결과 없음 (원본명: "${productName}")`);
      return { info: null, error: "검색결과 없음" };
    }
    console.log(`[조사] "${query}" 성공 — 스니펫 ${snippets.length}개, ${combined.length}자`);
    return { info: combined, error: null };
  } catch (e) {
    console.log(`[조사] "${query}" 예외 — ${e.message}`);
    return { info: null, error: e.message };
  }
}
__name(naverWebResearch, "naverWebResearch");
async function researchProduct(productName, env) {
  return await naverWebResearch(productName, env);
}
__name(researchProduct, "researchProduct");
async function generateArticleWithGroq(keyword, products, env) {
  const researchResults = await Promise.all(products.map((p) => researchProduct(p.productName, env)));
  const productSummary = products.map((p, i) => {
    const research = researchResults[i]?.info;
    return `${i + 1}. ${p.productName} - ${p.productPrice}원${research ? `\n   [조사된 실제 스펙 정보]: ${research}` : ""}`;
  }).join("\n");
  const hasAnyResearch = researchResults.some((r) => r.info);
  const systemPrompt = '너는 이 분야를 정말 잘 아는 전자기기 전문가인데, 어렵게 잘난 척하며 설명하지 않고 친한 친구한테 말하듯 편하고 친근하게 설명하는 필자다. 능글맞은 카피라이터처럼 영업하는 톤이 아니라, 실사용 관점에서 딱 필요한 판단을 자신 있게 짚어주면서도 부담 없이 술술 읽히게 쓴다. 주어진 실제 상품 목록을 바탕으로 밋밋한 스펙 나열이 아니라 술술 읽히는 비교/추천 글을 쓴다. 분량 규칙(중요): 이 블로그는 짧은 요약글이 아니라 읽는 재미가 있는 장문 콘텐츠가 강점이다. sections는 최소 5개 이상 만들고, 각 section의 body_html은 <p> 태그 2~4개로 구성해 충분히 깊이 있게 써라(한 줄짜리 밋밋한 문단 금지). 상품마다 최소 1개 섹션 이상 할애해서 구체적으로 다뤄라. 짧고 리듬감 있는 문장, 전문가다운 확신 있는 판단과 실용적인 팁을 적극 활용해라(예: "이 가격대에서 이 스펙이면 꽤 잘 뽑힌 편이에요", "실사용 기준으로 보면 이 부분이 은근 중요해요"). 독자가 일상에서 겪을 법한 구체적 상황(출퇴근길, 자취방, 야근 등)을 곁들여 몰입감 있게 써라. 각 상품을 최소 1번씩 본문에서 자연스럽게 언급해야 한다. 소제목도 "특징"/"장단점" 같은 딱딱한 말 대신 핵심을 짚어주는 실용적인 카피로 뽑아라(예: "이런 분들에게 딱 맞아요", "가성비로 보면 여기가 포인트", "솔직히 아쉬운 점"). 이모지는 넣어도 소제목/포인트당 1개 이내로 절제한다. 사람이 쓴 글처럼 느껴지게 하는 규칙(매우 중요): 1) 문장 길이를 일부러 들쭉날쭉하게 써라 — 짧은 단문과 긴 만연체를 섞어 쓰고, 매 문단을 비슷한 길이로 맞추지 마라 2) AI가 남발하는 상투어를 절대 쓰지 마라: "다양한", "완벽한 선택", "매력적인", "궁극적으로", "결론적으로", "요약하자면", "이는 ~때문입니다", "~라고 할 수 있습니다", "필수적인", "다시 말해", "무엇보다도" — 이런 표현 대신 훨씬 구체적이고 캐주얼한 한국어 화법을 써라 3) 모든 섹션마다 기계적으로 균형(장점 하나·단점 하나)을 맞추지 마라 4) 가끔 독자에게 직접 말 거는 문장이나 반문을 섞어라(순수하게 궁금해하는 톤으로, 예: "이거 어떨 것 같아요?") 5) 대시(—)나 콜론(:)을 남발하지 말고, 자연스러운 한국어 종결어미(다/네요/죠/거든요/더라고요 등)를 다양하게 섞어 써라 6) 매 섹션을 동일한 문형으로 시작하지 말고 도입 방식을 섹션마다 다르게 하라. 단, 다음 규칙은 톤이 발랄하고 분량이 길어도 반드시 지킨다: 1) 상품 목록에 "[조사된 실제 스펙 정보]"가 붙어있으면 그건 실제로 조사된 사실이니 적극 활용해서 구체적으로 써도 된다. 그게 없는 상품은 상품명/가격에 없는 스펙이나 성능 수치를 절대 지어내지 않는다 — 과장된 표현은 되지만 없는 사실을 만들어내면 안 된다. 분량을 채우려고 없는 스펙을 지어내는 것도 금지, 대신 비유·상황묘사·감상으로 분량을 채워라 2) 연도 규칙: "2024년", "2025년" 같은 특정 과거 연도를 단정적으로 언급하지 않는다. 확인 안 된 출시연도나 트렌드 시기를 지어내지 말고, 필요하면 "최근", "요즘" 같은 표현을 쓴다 3) 어투 규칙(매우 중요): 너는 이 상품을 직접 사거나 써본 적이 없다. "사봤는데", "써보니", "직접 사용해보니", "구매해서 써본 결과" 같은 1인칭 실사용 체험담 어투를 절대 쓰지 않는다. 대신 전문가답게 확신 있는 제3자 관점의 어투를 쓴다 4) 본문 문장은 반드시 순수 한글로만 작성한다 — 한자, 영어 단어(브랜드/제품 고유명사 제외), 일본어 등 외국어 표기를 절대 섞지 말고, 외래어도 가능하면 이미 널리 쓰이는 한글 표기로 자연스럽게 풀어 쓴다. 결과는 반드시 아래 JSON 형식으로만 출력 (다른 텍스트 절대 포함 금지):\n{"title": "블로그 제목(한국어, 후킹력 있게)", "tldr": "이 글의 핵심 결론을 1~2문장으로, 검색결과나 AI 답변에 그대로 인용될 수 있게 명확하고 단정적인 요약 문장으로 작성(과장 없이 사실 기반)", "intro_html": "<p>도입부 2~3문단, 상황묘사로 몰입감 있게</p>", "sections": [{"heading":"소제목","body_html":"<p>본문 문단1</p><p>본문 문단2</p>"}], "outro_html":"<p>마무리 2~3문단, 구매 시 체크포인트</p>", "faq": [{"q":"이 상품들과 관련해 독자가 실제로 검색할 법한 질문(한국어)","a":"1~2문장의 명확한 답변"}, {"q":"질문2","a":"답변2"}]}';
  const userPrompt = `주제 키워드: ${keyword}

실제 상품 목록:
${productSummary}${hasAnyResearch ? "" : "\n\n(주의: 조사된 스펙 정보가 없는 상품은 상품명/가격 외 정보를 알 수 없으니 추정 톤을 유지해라.)"}`;
  return callGroqChain(systemPrompt, userPrompt, env);
}
__name(generateArticleWithGroq, "generateArticleWithGroq");
async function generateProductReviewArticle(product, env) {
  const research = await researchProduct(product.productName, env);
  const systemPrompt = '너는 이 분야를 정말 잘 아는 전자기기 전문가인데, 어렵게 잘난 척하며 설명하지 않고 친한 친구한테 말하듯 편하고 친근하게 설명하는 필자다. 주어진 실제 상품 하나에 대해 밋밋한 스펙 나열이 아니라 술술 읽히는 단일 상품 리뷰를 쓴다. 분량 규칙(중요): 이 블로그는 짧은 요약글이 아니라 읽는 재미가 있는 장문 콘텐츠가 강점이다. sections는 최소 4개 이상 만들고, 각 section의 body_html은 <p> 태그 2~4개로 구성해 충분히 깊이 있게 써라(한 줄짜리 밋밋한 문단 금지). 독자가 일상에서 겪을 법한 구체적 상황(출퇴근길, 자취방, 야근 등)을 곁들여 몰입감 있게 써라. 분량을 채우려고 없는 스펙을 지어내는 건 절대 금지, 대신 비유·상황묘사·구매 고민 포인트로 자연스럽게 채워라. 아주 중요한 규칙: "[조사된 실제 스펙 정보]"가 제공되면 그건 실제로 조사된 사실이니 적극 활용해서 구체적으로 써도 된다. 그게 없으면 너에게 주어지는 정보는 상품명과 가격뿐이다. 그 경우: 1) 상품명에 명시적으로 적힌 정보(용량, 색상, 브랜드, 모델명 등)만 사실로 다룬다 2) 상품명에 없는 구체적인 스펙(배터리 시간, 방수등급, 성능 수치, 소재 등)을 절대 단정적으로 지어내지 않는다 3) 확인되지 않은 내용을 언급할 때 "일반적으로", "이 가격대에서는 보통", "제품명 기준으로 추정하면" 같은 헤지 표현을 반드시 쓰되, 밋밋하지 않게 위트있게 풀어써라(헤지 표현이라고 재미없을 필요는 없다) 4) 실사용 후기처럼 들리는 단정적 표현("배터리가 오래 간다", "소음이 적다" 등 실측 없이는 알 수 없는 주장)은 조사된 정보에 명시된 게 아니면 금지한다 5) "장점"/"단점" 섹션도 조사된 정보가 있으면 그 기반으로, 없으면 상품명·가격대에서 합리적으로 유추 가능한 특징 위주로 추정 톤을 유지하되 표현은 발랄하게. 연도 규칙(중요): "2024년", "2025년" 같은 특정 과거 연도를 단정적으로 언급하지 않는다. 확인 안 된 출시연도나 트렌드 시기를 지어내지 말고, 필요하면 "최근", "요즘" 같은 표현을 쓴다. 어투 규칙(매우 중요): 너는 이 상품을 직접 사거나 써본 적이 없다. "사봤는데", "써보니", "직접 사용해보니", "구매해서 써본 결과", "몇 주 써본 소감" 같은 1인칭 실사용 체험담 어투를 절대 쓰지 않는다. 대신 전문가답게 확신 있는 제3자 관점의 어투를 쓴다(예: "~로 되어있습니다", "~하는 분들에게 딱입니다", "~라는 점이 눈에 띕니다"). 짧고 리듬감 있는 문장과 전문가다운 확신 있는 판단을 적극 활용하되, 없는 사실을 지어내진 않는다. 상품명을 본문에서 자연스럽게 여러 번 언급한다. 소제목은 "주요 특징", "이런 분께 어울림", "구매 전 확인할 점" 같은 딱딱한 형식 대신 톡톡 튀는 카피로 뽑아도 된다. 이모지는 넣어도 소제목/포인트당 1개 이내로 절제한다. 사람이 쓴 글처럼 느껴지게 하는 규칙(매우 중요): 1) 문장 길이를 일부러 들쭉날쭉하게 써라 — 짧은 단문과 긴 만연체를 섞어 쓰고, 매 문단을 비슷한 길이로 맞추지 마라 2) AI가 남발하는 상투어를 절대 쓰지 마라: "다양한", "완벽한 선택", "매력적인", "궁극적으로", "결론적으로", "요약하자면", "이는 ~때문입니다", "~라고 할 수 있습니다", "필수적인", "다시 말해", "무엇보다도" — 이런 표현 대신 훨씬 구체적이고 캐주얼한 한국어 화법을 써라 3) 모든 섹션마다 기계적으로 균형을 맞추지 마라 4) 가끔 독자에게 직접 말 거는 문장이나 반문을 섞어라 5) 대시(—)나 콜론(:)을 남발하지 말고, 자연스러운 한국어 종결어미(다/네요/죠/거든요/더라고요 등)를 다양하게 섞어 써라 6) 매 섹션을 동일한 문형으로 시작하지 말고 도입 방식을 섹션마다 다르게 하라. 본문 문장은 반드시 순수 한글로만 작성한다 — 한자, 영어 단어(브랜드/제품 고유명사 제외), 일본어 등 외국어 표기를 절대 섞지 말고, 외래어도 가능하면 이미 널리 쓰이는 한글 표기로 자연스럽게 풀어 쓴다. 결과는 반드시 아래 JSON 형식으로만 출력 (다른 텍스트 절대 포함 금지):\n{"title": "블로그 제목(한국어, 후킹력 있게)", "tldr": "이 글의 핵심 결론을 1~2문장으로, 검색결과나 AI 답변에 그대로 인용될 수 있게 명확한 요약 문장으로(단, 확인 안 된 스펙은 단정하지 말고 추정 톤 유지)", "intro_html": "<p>도입부 2~3문단, 상황묘사로 몰입감 있게</p>", "sections": [{"heading":"소제목","body_html":"<p>본문 문단1</p><p>본문 문단2</p>"}], "outro_html":"<p>마무리 2~3문단, 구매 시 체크포인트(가급적 판매 페이지에서 실제 스펙을 직접 확인하라는 안내 포함)</p>", "faq": [{"q":"이 상품과 관련해 독자가 실제로 검색할 법한 질문(한국어)","a":"1~2문장의 명확한 답변(추정 톤 유지)"}, {"q":"질문2","a":"답변2"}]}';
  const userPrompt = `리뷰할 상품: ${product.productName}
가격: ${product.productPrice}원
${research.info ? `\n[조사된 실제 스펙 정보]: ${research.info}\n` : "\n(주의: 위 두 정보 외의 스펙/성능은 네가 알 수 없다. 상품명에 없는 사실은 지어내지 말고 추정 톤으로만 써라.)"}`;
  return callGroqChain(systemPrompt, userPrompt, env);
}
__name(generateProductReviewArticle, "generateProductReviewArticle");
var USED_PRODUCT_TTL_SECONDS = 5 * 24 * 60 * 60;
function normalizeProductName(name) {
  let s = (name || "").toLowerCase();
  s = s.replace(/[\[\(（【][^\]\)）】]*[\]\)）】]/g, " ");
  const colors = ["블랙", "화이트", "그레이", "실버", "골드", "레드", "블루", "핑크", "그린", "네이비", "베이지", "퍼플", "옐로우", "브라운", "민트", "로즈골드", "스페이스그레이", "아이보리", "그래파이트"];
  colors.forEach((c) => {
    s = s.split(c).join(" ");
  });
  s = s.replace(/\d+(\.\d+)?\s?(gb|tb|mah|w|kg|g|ml|l|인치|cm|mm|리터|개입|개)/gi, " ");
  s = s.replace(/\d+/g, " ");
  s = s.replace(/[^\p{L}\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
__name(normalizeProductName, "normalizeProductName");
function filterRelevantProductsByTokens(keyword, products) {
  const rawTokens = keyword.toLowerCase().split(/[\s,/()\-]+/).filter((t) => t.length >= 2);
  const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, "");
  if (!rawTokens.length && !normalizedKeyword) return products;
  // 2글자짜리 짧은 토큰(브랜드 이니셜/조사 등)은 신뢰도가 낮으므로, 3글자 이상 핵심 토큰이 있으면 그것만 사용
  const coreTokens = rawTokens.filter((t) => t.length >= 3);
  const meaningfulTokens = coreTokens.length ? coreTokens : rawTokens;
  const matchCountOf = (p) => {
    const name = (p.productName || "").toLowerCase();
    const normalizedName = name.replace(/\s+/g, "");
    if (normalizedKeyword && normalizedName.includes(normalizedKeyword)) return meaningfulTokens.length || 1;
    return meaningfulTokens.filter((t) => name.includes(t) || normalizedName.includes(t.replace(/\s+/g, ""))).length;
  };
  // 1차: 토큰이 2개 이상이면 과반(60%) 이상 일치를 요구하는 엄격 기준
  const strictRequired = meaningfulTokens.length >= 2 ? Math.max(2, Math.ceil(meaningfulTokens.length * 0.6)) : 1;
  const strict = products.filter((p) => matchCountOf(p) >= strictRequired);
  if (strict.length) return strict;
  // 2차(완화): 이미 쿠팡 자체 검색엔진이 이 키워드로 찾아온 결과이므로, 토큰 1개만 겹쳐도 완전 무관하진 않음.
  // 밤 시간대 등 검색결과 품질이 애매할 때 엄격 기준 때문에 전멸하는 걸 막기 위한 안전망.
  const relaxed = products.filter((p) => matchCountOf(p) >= 1);
  return relaxed;
}
__name(filterRelevantProductsByTokens, "filterRelevantProductsByTokens");
async function filterRelevantProducts(keyword, products, env) {
  return filterRelevantProductsByTokens(keyword, products);
}
__name(filterRelevantProducts, "filterRelevantProducts");
function getProductKey(p) {
  if (p.productId) return `id:${p.productId}`;
  try {
    const u = new URL(p.productUrl);
    return `url:${u.origin}${u.pathname}`;
  } catch (e) {
    return `raw:${p.productUrl || p.productName}`;
  }
}
__name(getProductKey, "getProductKey");
function dedupeSimilarProducts(products) {
  const seenIds = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  const result = [];
  for (const p of products) {
    const id = getProductKey(p);
    if (seenIds.has(id)) continue;
    const sig = normalizeProductName(p.productName);
    if (seenNames.has(sig)) continue;
    seenIds.add(id);
    seenNames.add(sig);
    result.push(p);
  }
  return result;
}
__name(dedupeSimilarProducts, "dedupeSimilarProducts");
async function filterUnusedProducts(rawProducts, env, needed) {
  let usedSet = new Set();
  try {
    const raw = await env.POSTS.get("recent-used-products");
    if (raw) {
      const cutoff = Date.now() - USED_PRODUCT_TTL_SECONDS * 1000;
      const list = JSON.parse(raw);
      usedSet = new Set(list.filter((e) => e.at >= cutoff).map((e) => e.id));
    }
  } catch (e) {}
  const unused = [];
  for (const p of rawProducts) {
    const id = getProductKey(p);
    if (!usedSet.has(id)) unused.push(p);
    if (unused.length >= needed) break;
  }
  return unused;
}
__name(filterUnusedProducts, "filterUnusedProducts");
async function markProductsUsed(products, env) {
  // 상품마다 따로 KV write 하지 않고, 하나의 목록 키로 묶어서 한 번의 read+write로 처리 (read/write 둘 다 절감)
  try {
    const raw = await env.POSTS.get("recent-used-products");
    const cutoff = Date.now() - USED_PRODUCT_TTL_SECONDS * 1000;
    const list = raw ? JSON.parse(raw).filter((e) => e.at >= cutoff) : [];
    const now = Date.now();
    for (const p of products) {
      const id = getProductKey(p);
      const existing = list.find((e) => e.id === id);
      if (existing) existing.at = now;
      else list.push({ id, at: now });
    }
    await safeKVPut(env, "recent-used-products", JSON.stringify(list.slice(-2000)));
  } catch (e) {}
}
__name(markProductsUsed, "markProductsUsed");
var MIN_PRODUCTS = 4;
var MAX_PRODUCTS = 8;
async function checkDuplicateViaVectorize(products, env) {
  const vectorMap = /* @__PURE__ */ new Map();
  if (!env?.AI || !env?.VECTORIZE || !products.length) return { kept: products, vectorMap };
  const SIMILARITY_THRESHOLD = 0.92;
  const SIMILAR_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 비슷한 제품은 30일 안에는 재게재 금지, 이후엔 허용
  const kept = [];
  try {
    const names = products.map((p) => p.productName || "");
    const embedTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("임베딩 타임아웃(8초)")), 8000));
    const response = await Promise.race([
      env.AI.run("@cf/baai/bge-m3", { text: names }, { gateway: { id: CF_AI_GATEWAY } }),
      embedTimeout
    ]);
    const vectors = response?.data;
    if (!Array.isArray(vectors) || vectors.length !== products.length) return { kept: products, vectorMap };
    for (let i = 0; i < products.length; i++) {
      vectorMap.set(getProductKey(products[i]), vectors[i]); // 나중에 최종 인덱싱시 재사용 (중복계산 방지)
      const queryTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Vectorize 조회 타임아웃(5초)")), 5000));
      let match;
      try {
        match = await Promise.race([env.VECTORIZE.query(vectors[i], { topK: 1, returnMetadata: true }), queryTimeout]);
      } catch (e) {
        console.log(`Vectorize 조회 실패/타임아웃(건너뜀): ${e.message}`);
        kept.push(products[i]);
        continue;
      }
      const topMatch = match?.matches?.[0];
      const topScore = topMatch?.score || 0;
      const indexedAt = topMatch?.metadata?.indexedAt;
      const withinWindow = !indexedAt || (Date.now() - Number(indexedAt)) < SIMILAR_PRODUCT_WINDOW_MS;
      if (topScore >= SIMILARITY_THRESHOLD && withinWindow) {
        console.log(`Vectorize 중복 발견(제외): "${products[i].productName}" (유사도 ${topScore.toFixed(3)}, 30일 이내)`);
        continue;
      }
      kept.push(products[i]);
    }
  } catch (e) {
    console.log("Vectorize 중복판단 실패, 그대로 진행: " + e.message);
    return { kept: products, vectorMap };
  }
  return { kept, vectorMap };
}
__name(checkDuplicateViaVectorize, "checkDuplicateViaVectorize");
async function indexProductsInVectorize(products, env, precomputedVectorMap) {
  if (!env?.AI || !env?.VECTORIZE || !products.length) return;
  try {
    const missing = precomputedVectorMap ? products.filter((p) => !precomputedVectorMap.has(getProductKey(p))) : products;
    let freshVectors = [];
    if (missing.length) {
      const names = missing.map((p) => p.productName || "");
      const embedTimeout2 = new Promise((_, reject) => setTimeout(() => reject(new Error("임베딩 타임아웃(8초)")), 8000));
      let response;
      try {
        response = await Promise.race([
          env.AI.run("@cf/baai/bge-m3", { text: names }, { gateway: { id: CF_AI_GATEWAY } }),
          embedTimeout2
        ]);
      } catch (e) {
        console.log("인덱싱용 임베딩 실패/타임아웃: " + e.message);
        response = null;
      }
      freshVectors = response?.data;
      if (!Array.isArray(freshVectors) || freshVectors.length !== missing.length) freshVectors = [];
    }
    let freshIdx = 0;
    const vectorObjects = [];
    for (const p of products) {
      const cached = precomputedVectorMap?.get(getProductKey(p));
      const vec = cached || freshVectors[freshIdx++];
      if (!vec) continue;
      vectorObjects.push({
        id: getProductKey(p).replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 60),
        values: vec,
        metadata: { name: (p.productName || "").slice(0, 100), indexedAt: Date.now() }
      });
    }
    if (!vectorObjects.length) return;
    await env.VECTORIZE.upsert(vectorObjects);
    const reused = products.length - missing.length;
    console.log(`Vectorize에 ${vectorObjects.length}개 상품 인덱싱 완료 (임베딩 재사용 ${reused}개, 신규계산 ${missing.length}개)`);
  } catch (e) {
    console.log("Vectorize 인덱싱 실패(발행은 계속 진행): " + e.message);
  }
}
__name(indexProductsInVectorize, "indexProductsInVectorize");
async function tryFillProducts(keyword, env) {
  const searchResult = await coupangSearchProducts(keyword, env, 10);
  if (!searchResult.products.length) {
    return { ok: false, reason: `쿠팡 상품 검색 결과 없음 — ${searchResult.error || "응답에 상품 없음"}` };
  }
  const relevant = await filterRelevantProducts(keyword, searchResult.products, env);
  if (!relevant.length) {
    return { ok: false, reason: `검색 결과가 키워드와 관련성이 낮아 전부 필터링됨 (쿠팡 검색 결과 ${searchResult.products.length}건 중 0건 통과)` };
  }
  const currentModels = relevant.filter((p) => !isOutdatedProduct(p.productName));
  const relevantFiltered = currentModels.length ? currentModels : relevant;
  let candidates = dedupeSimilarProducts(relevantFiltered);
  candidates = await filterUnusedProducts(candidates, env, MAX_PRODUCTS);
  candidates = dedupeSimilarProducts(candidates);
  const { kept: dedupedCandidates, vectorMap } = await checkDuplicateViaVectorize(candidates, env);
  candidates = dedupedCandidates;
  if (candidates.length < MIN_PRODUCTS) {
    if (candidates.length >= 1) {
      return { ok: false, reason: `상품 ${candidates.length}개밖에 안 모임 (최소 ${MIN_PRODUCTS}개 필요)`, fallbackProduct: candidates[0], vectorMap };
    }
    return { ok: false, reason: `상품 ${candidates.length}개밖에 안 모임 (최소 ${MIN_PRODUCTS}개 필요)` };
  }
  let selected = candidates.slice(0, MAX_PRODUCTS);
  if (selected.length % 2 !== 0) selected.pop();
  return { ok: true, products: selected, vectorMap };
}
__name(tryFillProducts, "tryFillProducts");
function articleNeedsReview(article) {
  const FIRST_PERSON_PATTERNS = ["사봤는데", "써보니", "직접 사용해보니", "구매해서 써본", "써본 소감", "몇 주 써본", "써본 결과", "사용해본 결과"];
  const texts = [article.title, article.tldr, article.intro_html, article.outro_html, ...(article.sections || []).flatMap((s) => [s.heading, s.body_html]), ...(article.faq || []).flatMap((f) => [f.q, f.a])].filter(Boolean);
  const combined = texts.join(" ");
  if (FIRST_PERSON_PATTERNS.some((p) => combined.includes(p))) return true;
  if (/[\u4e00-\u9fff]/.test(combined)) return true; // 한자
  if (/[\u3040-\u30ff]/.test(combined)) return true; // 히라가나/가타카나
  return false;
}
__name(articleNeedsReview, "articleNeedsReview");
async function recordModelStat(env, modelUsed, needsReview, title) {
  // 모델별 "1차 품질" 추적 — 검수(articleNeedsReview) 트리거율이 낮을수록 그 모델의 1차생성 퀄리티가 좋다는 뜻
  try {
    const raw = await env.POSTS.get("model-stats");
    const stats = raw ? JSON.parse(raw) : {};
    if (!stats[modelUsed]) stats[modelUsed] = { count: 0, needsReviewCount: 0 };
    stats[modelUsed].count += 1;
    if (needsReview) stats[modelUsed].needsReviewCount += 1;
    stats[modelUsed].lastUsedAt = Date.now();
    stats[modelUsed].lastTitle = title || "";
    await safeKVPut(env, "model-stats", JSON.stringify(stats));
  } catch (e) {}
}
__name(recordModelStat, "recordModelStat");
const AI_CLICHE_REPLACEMENTS = [
  [/다양한\s*/g, ""],
  [/완벽한\s*선택(입니다|이에요|이죠|이다)/g, "괜찮은 선택$1"],
  [/매력적인\s*/g, ""],
  [/궁극적으로,?\s*/g, ""],
  [/결론적으로,?\s*/g, ""],
  [/요약하자면,?\s*/g, ""],
  [/필수적인\s*/g, "꼭 필요한 "],
  [/다시\s*말해,?\s*/g, ""],
  [/무엇보다도,?\s*/g, ""],
  [/라고\s*할\s*수\s*있습니다/g, "습니다"],
  [/라고\s*할\s*수\s*있어요/g, "어요"]
];
function humanizeText(text) {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of AI_CLICHE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
__name(humanizeText, "humanizeText");
function humanizeArticle(article) {
  if (!article) return article;
  if (article.title) article.title = humanizeText(article.title);
  if (article.tldr) article.tldr = humanizeText(article.tldr);
  if (article.intro_html) article.intro_html = humanizeText(article.intro_html);
  if (article.outro_html) article.outro_html = humanizeText(article.outro_html);
  if (Array.isArray(article.sections)) {
    article.sections = article.sections.map((s) => ({
      ...s,
      heading: humanizeText(s.heading),
      body_html: humanizeText(s.body_html)
    }));
  }
  if (Array.isArray(article.faq)) {
    article.faq = article.faq.map((f) => ({ q: humanizeText(f.q), a: humanizeText(f.a) }));
  }
  return article;
}
__name(humanizeArticle, "humanizeArticle");
async function reviewArticleWithWorkersAI(article, env) {
  if (!env.AI) {
    console.log("Workers AI 바인딩 없음. 검수 패스 건너뜀.");
    return article;
  }
  const systemPrompt = '너는 한국어 전자기기 블로그의 editor다. 아래 JSON은 AI가 초안으로 쓴 글이다. 이 블로그는 전문성 있으면서도 친근하고 편안한 톤이 컨셉이니 그 느낌은 그대로 살리면서, 다음 기준으로만 다듬어라: 1) 어색한 문장, 반복 표현 개선(순수한 톤 자체는 유지, 밋밋하게 만들지 말 것) 2) 한자/영어/일본어가 섞여 있으면 순수 한글로 순화(브랜드명·모델명 제외) 3) 실측 없이 단정하는 사실주장(예: "배터리가 정말 오래갑니다", "소음이 거의 없어요" 같은 검증 안 된 단정)이 있으면 추정 톤으로 완화하되, 문장의 리듬감은 살린다 4) 상품명, 가격, 스펙 등 사실 정보는 절대 바꾸지 않는다 5) "사봤는데", "써보니", "직접 사용해보니" 같은 1인칭 실사용 체험담 어투가 있으면 전문가답게 확신 있는 제3자 소개 어투로 고친다 6) JSON 구조와 필드명(title, tldr, intro_html, sections, outro_html, faq, heading, body_html, q, a)은 그대로 유지한다 — tldr과 faq 필드가 있으면 삭제하지 말고 같은 방식(1인칭 어투 금지, 사실 정보 유지, 한글 순화)으로 다듬어라. 결과는 반드시 입력과 동일한 JSON 형식으로만 출력하고, 다른 설명은 절대 붙이지 않는다.';
  const userPrompt = JSON.stringify(article);
  try {
    const aiTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Workers AI 검수 타임아웃(8초)")), 8000));
    const response = await Promise.race([
      env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 3e3
      }, { gateway: { id: CF_AI_GATEWAY } }),
      aiTimeout
    ]);
    let raw = response?.response;
    if (!raw) {
      console.log("Workers AI 검수 응답 없음. 원본 유지.");
      return article;
    }
    raw = raw.trim().replace(/^```json\s*|\s*```$/gm, "").trim();
    const revised = JSON.parse(raw);
    if (!revised.title || !revised.intro_html || !Array.isArray(revised.sections)) {
      console.log("Workers AI 검수 결과 구조 이상. 원본 유지.");
      return article;
    }
    console.log("Workers AI 검수 완료.");
    return revised;
  } catch (e) {
    console.log("Workers AI 검수 실패(원본 유지): " + e.message);
    return article;
  }
}
__name(reviewArticleWithWorkersAI, "reviewArticleWithWorkersAI");
async function saveProductReviewPost(env, target, displayKeyword, markKeyword, precomputedAffiliateUrl, precomputedVectorMap) {
  const { article: draftArticle, error: groqError, modelUsed } = await generateProductReviewArticle(target, env);
  if (!draftArticle) {
    console.log("상품 리뷰 생성 실패. 종료.");
    return { ok: false, reason: `Groq 리뷰 생성 실패 — ${groqError || "알 수 없는 오류"}` };
  }
  console.log(`상품 리뷰 생성 성공 (모델: ${modelUsed})`);
  const needsReview1 = articleNeedsReview(draftArticle);
  await recordModelStat(env, modelUsed, needsReview1, draftArticle.title);
  const article = humanizeArticle(needsReview1 ? await reviewArticleWithWorkersAI(draftArticle, env) : draftArticle);
  if (article === draftArticle) console.log("검수 스킵 — 규칙위반 없음 (토큰 절약)");
  let finalAffiliateUrl = precomputedAffiliateUrl;
  if (!finalAffiliateUrl) {
    const links = await coupangDeeplinks([target.productUrl], env);
    finalAffiliateUrl = links[0]?.shortenUrl || target.productUrl;
  }
  const products = [{
    name: target.productName,
    price: target.productPrice,
    image: target.productImage,
    affiliateUrl: finalAffiliateUrl
  }];
  const metaDescription = makeExcerpt(article.tldr || article.intro_html, 150) || `${displayKeyword} 리뷰`;
  const slug = String(Date.now());
  const post = {
    slug,
    title: article.title,
    keyword: displayKeyword,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    tldr: article.tldr || "",
    intro: article.intro_html,
    sections: article.sections || [],
    outro: article.outro_html,
    faq: article.faq || [],
    products,
    metaDescription,
    type: "review"
  };
  const savedOk = await safeKVPut(env, `post:${slug}`, JSON.stringify(post));
  if (!savedOk) return { ok: false, reason: "글 저장 실패(KV 용량/한도 초과 가능성)" };
  await addToIndex(env, slug);
  await markProductsUsed([target], env);
  await indexProductsInVectorize([target], env, precomputedVectorMap);
  if (markKeyword) await markKeywordUsed(displayKeyword, env);
  console.log(`상품 리뷰 발행 완료: ${slug}`);
  return { ok: true, post };
}
__name(saveProductReviewPost, "saveProductReviewPost");
async function generateAndSavePost(env, forcedKeyword) {
  const genStartTime = Date.now();
  // cron-job.org 무료플랜 타임아웃이 30초라, 전체를 22초 예산으로 제한 — 넘으면 재시도 그만하고 지금까지 결과로 마무리
  const TIME_BUDGET_MS = 22000;
  let keyword, rawProducts, vectorMap;
  let lastReason = "알 수 없는 오류";
  if (forcedKeyword) {
    if (await isKeywordUsedRecently(forcedKeyword, env)) {
      return { ok: false, reason: `"${forcedKeyword}" 키워드는 최근 5일 이내에 이미 사용됨` };
    }
    console.log(`=== 생성 시도: ${forcedKeyword} (수동 지정) ===`);
    const result = await tryFillProducts(forcedKeyword, env);
    if (result.ok) {
      keyword = forcedKeyword;
      rawProducts = result.products;
      vectorMap = result.vectorMap;
    } else if (result.fallbackProduct) {
      console.log(`${forcedKeyword}: 비교글 부족(상품 부족), 단일 리뷰로 전환`);
      return await saveProductReviewPost(env, result.fallbackProduct, forcedKeyword, true, undefined, result.vectorMap);
    } else {
      return { ok: false, reason: result.reason };
    }
  } else {
    // -2) 예약된 쿠팡 URL이 있으면 최우선 소진 (직접 고른 상품이라 키워드보다도 우선순위 높음)
    const priorityUrlQueue = await getPriorityUrls(env);
    if (priorityUrlQueue.length > 0) {
      const priorityUrl = priorityUrlQueue[0];
      await savePriorityUrls(env, priorityUrlQueue.slice(1));
      console.log(`=== 생성 시도(예약 URL): ${priorityUrl} ===`);
      const urlResult = await generateProductReviewFromUrl(env, priorityUrl);
      if (urlResult.ok) return urlResult;
      console.log(`예약 URL "${priorityUrl}" 실패 — ${urlResult.reason}. 일반 로직으로 폴백.`);
    }

    // -1) 예약된 우선순위 키워드가 있으면 그것부터 소진 (성공/실패 여부와 무관하게 1회 소모, 실패시 아래 일반 로직으로 폴백)
    const priorityQueue = await getPriorityKeywords(env);
    if (priorityQueue.length > 0) {
      const priorityKw = priorityQueue[0];
      await savePriorityKeywords(env, priorityQueue.slice(1));
      if (await isKeywordUsedRecently(priorityKw, env)) {
        console.log(`예약 키워드 "${priorityKw}"는 최근 5일 이내 이미 사용됨 — 건너뛰고 일반 로직으로 폴백`);
      } else {
        console.log(`=== 생성 시도(예약 키워드): ${priorityKw} ===`);
        const priorityResult = await tryFillProducts(priorityKw, env);
        if (priorityResult.ok) {
          keyword = priorityKw;
          rawProducts = priorityResult.products;
          vectorMap = priorityResult.vectorMap;
        } else if (priorityResult.fallbackProduct) {
          console.log(`${priorityKw}: 비교글 부족(상품 부족), 단일 리뷰로 전환`);
          return await saveProductReviewPost(env, priorityResult.fallbackProduct, priorityKw, true, undefined, priorityResult.vectorMap);
        } else {
          console.log(`예약 키워드 "${priorityKw}" 실패 — ${priorityResult.reason}. 일반 로직으로 폴백.`);
        }
      }
    }

    // 0) 인기 플래그십(핫키워드) 우선 시도 — 25% 확률
    if (!rawProducts && Math.random() < 0.25) {
      const hotUsedFlags = await Promise.all(HOT_KEYWORDS.map((kw) => isKeywordUsedRecently(kw, env)));
      const hotPool = HOT_KEYWORDS.filter((_, i) => !hotUsedFlags[i]);
      if (hotPool.length > 0) {
        const hotKw = hotPool[Math.floor(Math.random() * hotPool.length)];
        console.log(`=== 생성 시도(핫키워드): ${hotKw} ===`);
        const hotResult = await tryFillProducts(hotKw, env);
        if (hotResult.ok) {
          keyword = hotKw;
          rawProducts = hotResult.products;
          vectorMap = hotResult.vectorMap;
        } else if (hotResult.fallbackProduct) {
          console.log(`${hotKw}: 비교글 부족(상품 부족), 단일 리뷰로 전환`);
          return await saveProductReviewPost(env, hotResult.fallbackProduct, hotKw, true, undefined, hotResult.vectorMap);
        } else {
          console.log(`핫키워드 ${hotKw} 실패 — ${hotResult.reason}. 기존 방식으로 폴백.`);
        }
      }
    }

    // Danawa 일일 제품 목록에서 랜덤 선택 (최근 4일 미사용 + 최신 등록 상품 우선)
    if (!rawProducts) {
    const danawaProducts = await getDanawaDailyProducts(env);
    if (danawaProducts.length > 0) {
      const usedFlags = await Promise.all(danawaProducts.map((p) => isProductUsedRecently(p.name, env)));
      const availableProducts = danawaProducts.filter((_, i) => !usedFlags[i]);

      if (availableProducts.length > 0) {
        // 핫키워드(아이폰/갤럭시폴드 등)와 이름이 겹치면 등록월 상관없이 최우선
        const hotMatches = availableProducts.filter((p) => HOT_KEYWORDS.some((hk) => p.name.replace(/\s/g, "").includes(hk.replace(/\s/g, ""))));
        // "26.07" 형식 등록년월 기준, 이번달/지난달 등록 상품을 그 다음 우선순위로 사용
        const now = new Date();
        const thisYm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastYm = `${String(lastMonthDate.getFullYear()).slice(2)}${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
        const recentProducts = availableProducts.filter((p) => p.regYm === thisYm || p.regYm === lastYm);
        const pickFrom = hotMatches.length > 0 ? hotMatches : recentProducts.length > 0 ? recentProducts : availableProducts;
        if (hotMatches.length === 0 && recentProducts.length === 0) {
          console.log("최근 등록 상품 없음 (등록년월 파싱 실패 포함) — 전체 후보 중 랜덤 선택으로 폴백");
        }
        const randomProduct = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        console.log(`Danawa 제품 선택: ${randomProduct.name} (카테고리: ${randomProduct.category}, 등록: ${randomProduct.regYm || "미상"}, 핫키워드매치: ${hotMatches.length > 0})`);
        await markProductAsUsed(randomProduct.name, env);
        const result = await generateProductReview(env, randomProduct.name);
        if (result.ok) return result;
        console.log(`Danawa 제품 생성 실패: ${result.reason}. 폴백 시도.`);
      } else {
        console.log("Danawa 사용가능 제품 없음 (모두 최근 4일내 사용). 폴백시도.");
      }
    }
    }
    
    if (!rawProducts && Math.random() < 0.4) {
      const trendingResult = await generateTrendingReview(env);
      if (trendingResult.ok) return trendingResult;
      console.log(`베스트카테고리 리뷰 실패 — ${trendingResult.reason}. 기존 키워드 방식으로 폴백.`);
    }
    if (!rawProducts) {
      const activePool = KEYWORDS.slice();
      const kwUsedFlags = await Promise.all(activePool.map((kw) => isKeywordUsedRecently(kw, env)));
      const attemptOrder = activePool.filter((_, i) => !kwUsedFlags[i]);
      if (!attemptOrder.length) attemptOrder.push(...activePool);
      const MAX_KEYWORD_ATTEMPTS = 8;
      for (const kw of attemptOrder.slice(0, MAX_KEYWORD_ATTEMPTS)) {
        if (Date.now() - genStartTime > TIME_BUDGET_MS) {
          console.log(`시간예산(22초) 초과 — 키워드 재시도 중단, 지금까지 사유: ${lastReason}`);
          break;
        }
        console.log(`=== 생성 시도: ${kw} ===`);
        const result = await tryFillProducts(kw, env);
        if (result.ok) {
          keyword = kw;
          rawProducts = result.products;
          vectorMap = result.vectorMap;
          break;
        }
        if (result.fallbackProduct) {
          console.log(`${kw}: 비교글 부족(상품 부족), 단일 리뷰로 전환`);
          return await saveProductReviewPost(env, result.fallbackProduct, kw, true, undefined, result.vectorMap);
        }
        lastReason = result.reason;
        console.log(`${kw} 실패 — ${result.reason}. 다음 키워드로 재시도.`);
      }
      if (!rawProducts) {
        return { ok: false, reason: `모든 키워드 시도했지만 상품을 못 채움 — 마지막 사유: ${lastReason}` };
      }
    }
  }
  const urls = rawProducts.map((p) => p.productUrl);
  const links = await coupangDeeplinks(urls, env);
  const products = rawProducts.map((p, i) => ({
    name: p.productName,
    price: p.productPrice,
    image: p.productImage,
    affiliateUrl: links[i]?.shortenUrl || p.productUrl
  }));
  const { article: draftArticle, error: groqError, modelUsed } = await generateArticleWithGroq(keyword, rawProducts, env);
  if (!draftArticle) {
    console.log("글 생성 실패. 종료.");
    return { ok: false, reason: `Groq 글 생성 실패 — ${groqError || "알 수 없는 오류"}` };
  }
  console.log(`Groq 생성 성공 (모델: ${modelUsed})`);
  const needsReview2 = articleNeedsReview(draftArticle);
  await recordModelStat(env, modelUsed, needsReview2, draftArticle.title);
  const article = humanizeArticle(needsReview2 ? await reviewArticleWithWorkersAI(draftArticle, env) : draftArticle);
  if (article === draftArticle) console.log("검수 스킵 — 규칙위반 없음 (토큰 절약)");
  const metaDescription = makeExcerpt(article.tldr || article.intro_html, 150) || `${keyword} 비교 가이드`;
  const slug = String(Date.now());
  const post = {
    slug,
    title: article.title,
    keyword,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    tldr: article.tldr || "",
    intro: article.intro_html,
    sections: article.sections || [],
    outro: article.outro_html,
    faq: article.faq || [],
    products,
    metaDescription,
    type: "comparison"
  };
  const savedOk2 = await safeKVPut(env, `post:${slug}`, JSON.stringify(post));
  if (!savedOk2) return { ok: false, reason: "글 저장 실패(KV 용량/한도 초과 가능성)" };
  await addToIndex(env, slug);
  await markProductsUsed(rawProducts, env);
  await indexProductsInVectorize(rawProducts, env, vectorMap);
  await markKeywordUsed(keyword, env);
  console.log(`발행 완료: ${slug}`);
  return { ok: true, post };
}
__name(generateAndSavePost, "generateAndSavePost");
var BRAND_USED_TTL_SECONDS = 2 * 24 * 60 * 60;
function extractBrand(productName) {
  const match = (productName || "").trim().match(/^[\p{L}\p{N}]+/u);
  return match ? match[0] : "";
}
__name(extractBrand, "extractBrand");
async function isBrandUsedRecently(brand, env) {
  if (!brand) return false;
  return !!await env.POSTS.get(`usedBrand:${brand}`);
}
__name(isBrandUsedRecently, "isBrandUsedRecently");
async function markBrandUsed(productName, env) {
  const brand = extractBrand(productName);
  if (!brand) return;
  await safeKVPut(env, `usedBrand:${brand}`, "1", { expirationTtl: BRAND_USED_TTL_SECONDS });
}
__name(markBrandUsed, "markBrandUsed");
async function generateTrendingReview(env) {
  const category = BEST_CATEGORY_IDS[Math.floor(Math.random() * BEST_CATEGORY_IDS.length)];
  const result = await coupangBestCategoryProducts(category.id, env, 20);
  if (!result.products.length) {
    return { ok: false, reason: `베스트카테고리(${category.name}) 상품 없음 — ${result.error || "응답에 상품 없음"}` };
  }
  const techOnly = result.products.filter((p) => isTechRelated(p.productName));
  if (!techOnly.length) {
    return { ok: false, reason: `베스트카테고리(${category.name})에 테크 관련 상품 없음 (${result.products.length}건 중 0건 통과)` };
  }
  const currentModels = techOnly.filter((p) => !isOutdatedProduct(p.productName));
  const techFiltered = currentModels.length ? currentModels : techOnly;
  const deduped = dedupeSimilarProducts(techFiltered);
  const unused = await filterUnusedProducts(deduped, env, 1);
  if (!unused.length) {
    return { ok: false, reason: `베스트카테고리(${category.name}) 상품이 전부 최근 5일 이내 이미 사용됨` };
  }
  const brandFresh = [];
  for (const p of unused) {
    if (!await isBrandUsedRecently(extractBrand(p.productName), env)) brandFresh.push(p);
  }
  const candidates = brandFresh.length ? brandFresh : unused;
  const pickPool = candidates.slice(0, Math.min(5, candidates.length));
  const target = pickPool[Math.floor(Math.random() * pickPool.length)];
  const displayKeyword = category.name;
  const saveResult = await saveProductReviewPost(env, target, displayKeyword, false);
  if (saveResult.ok) await markBrandUsed(target.productName, env);
  return saveResult;
}
__name(generateTrendingReview, "generateTrendingReview");
async function generateProductReview(env, productName) {
  const searchResult = await coupangSearchProducts(productName, env, 12);
  if (!searchResult.products.length) {
    return { ok: false, reason: `쿠팡 상품 검색 결과 없음 — ${searchResult.error || "응답에 상품 없음"}` };
  }
  const relevant = await filterRelevantProducts(productName, searchResult.products, env);
  if (!relevant.length) {
    return { ok: false, reason: `"${productName}"와 관련성 있는 검색 결과 없음 (쿠팡 검색 ${searchResult.products.length}건 중 0건 통과)` };
  }
  const deduped = dedupeSimilarProducts(relevant);
  const unused = await filterUnusedProducts(deduped, env, 1);
  if (!unused.length) {
    return { ok: false, reason: `"${productName}"에 해당하는 상품이 최근 5일 이내 이미 리뷰됨` };
  }
  const target = unused[0];
  return await saveProductReviewPost(env, target, productName, false);
}
__name(generateProductReview, "generateProductReview");
async function addToIndex(env, slug) {
  try {
    const idxRaw = await env.POSTS.get("index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    idx.unshift(slug);
    await safeKVPut(env, "index", JSON.stringify(idx.slice(0, 500)));
  } catch (e) {
    console.log(`[addToIndex 실패] ${slug}: ${e.message}`);
  }
}
__name(addToIndex, "addToIndex");
function renderPrivacyPage() {
  const body = `${siteHeader()}
    <div class="wrap post-body">
      <h1>개인정보처리방침</h1>
      <div class="meta">최종 수정일: 2026년 7월 12일</div>
      <p>usb.kr(이하 "사이트")은 이용자의 개인정보를 소중히 다루며, 다음과 같은 방침에 따라 정보를 처리합니다.</p>

      <h2>1. 수집하는 정보</h2>
      <p>사이트는 서비스 개선을 위해 아래와 같이 개인을 식별할 수 없는 방문 통계 정보를 수집합니다.</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:var(--text);line-height:1.7;">
        <li>방문 시각, 방문 페이지</li>
        <li>리퍼러(어느 경로로 들어왔는지)</li>
        <li>접속 국가(IP 주소 자체는 저장하지 않습니다)</li>
        <li>브라우저/기기 종류(User-Agent), 기기 유형(모바일/PC/태블릿)</li>
        <li>브라우저 언어 설정</li>
      </ul>
      <p>이름, 이메일, 전화번호 등 개인을 직접 식별할 수 있는 정보는 수집하지 않습니다.</p>

      <h2>2. 수집 목적</h2>
      <p>수집된 정보는 사이트 이용 현황 분석, 콘텐츠 품질 개선, 서비스 안정성 확보 목적으로만 사용됩니다.</p>

      <h2>3. 쿠키 및 로컬 저장소</h2>
      <p>사이트는 방문자를 추적하는 쿠키를 사용하지 않습니다. 다만 개인정보 수집 고지 배너를 다시 표시하지 않기 위한 확인 여부를, 이용자 브라우저의 로컬 저장소(localStorage)에만 저장합니다. 이 정보는 서버로 전송되지 않으며, 브라우저 데이터를 삭제하면 함께 삭제됩니다.</p>

      <h2>4. 제3자 서비스</h2>
      <p>사이트는 다음과 같은 제3자 서비스를 이용합니다.</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:var(--text);line-height:1.7;">
        <li><strong>쿠팡 파트너스</strong>: 사이트는 쿠팡 파트너스 활동을 통해 일정액의 수수료를 제공받을 수 있습니다.</li>
        <li><strong>Cloudflare Web Analytics</strong>: 쿠키 없는 방식의 방문 통계 서비스입니다.</li>
        <li>본문 콘텐츠는 AI(Groq, Google, Cloudflare Workers AI 등)를 통해 자동 생성되며, 이 과정에서 이용자의 개인정보는 사용되지 않습니다.</li>
      </ul>

      <h2>5. 정보의 보유 및 이용 기간</h2>
      <p>수집된 방문 통계 정보는 서비스 운영에 필요한 기간 동안 보관되며, 개인을 식별할 수 없는 형태로 관리됩니다.</p>

      <h2>6. 콘텐츠에 대한 안내</h2>
      <p>사이트에 게재되는 상품 비교/리뷰 콘텐츠는 AI가 자동으로 생성하며, 실제 사용 후기가 아닌 참고용 정보입니다. 스펙, 가격 등 세부 정보가 실제와 다를 수 있으니 구매 전 반드시 판매 페이지에서 정확한 정보를 확인해주시기 바랍니다.</p>

      <h2>7. 문의</h2>
      <p>개인정보 처리와 관련한 문의사항은 사이트 운영자에게 연락해주시기 바랍니다.</p>
    </div>
<footer><div class="wrap">usb.kr — 쿠팡 파트너스 활동을 통해 일정액의 수수료를 제공받을 수 있습니다. · <a href="/privacy" style="text-decoration:underline;">개인정보처리방침</a></div></footer>`;
  return new Response(page("개인정보처리방침 - usb.kr", body, {
    description: "usb.kr 개인정보처리방침",
    canonicalUrl: "https://usb.kr/privacy",
    noindex: true,
    showPrivacyNotice: false
  }), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
__name(renderPrivacyPage, "renderPrivacyPage");
function renderRobotsTxt() {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/

Sitemap: https://usb.kr/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
__name(renderRobotsTxt, "renderRobotsTxt");
async function renderLlmsTxt(env) {
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const rawRecent = await Promise.all(idx.slice(0, 30).map((slug) => env.POSTS.get(`post:${slug}`)));
  const lines = rawRecent.filter(Boolean).map((raw) => {
    const p = JSON.parse(raw);
    return `- [${p.title}](https://usb.kr/${p.slug}): ${p.tldr || p.metaDescription || ""}`;
  });
  const body = `# usb.kr

> 실시간 쿠팡 가격 데이터를 기반으로 전자기기 스펙과 가격을 비교하는 한국어 리뷰/비교 사이트입니다. 오디오, 모바일 액세서리, PC주변기기, 스마트기기 등 전자기기 카테고리를 다룹니다.

이 사이트는 AI가 자동 생성한 참고용 콘텐츠이며, 정확한 스펙은 판매 페이지에서 직접 확인을 권장합니다. 쿠팡 파트너스 활동을 통해 수수료를 제공받을 수 있습니다.

## 최근 게시글

${lines.join("\n")}

## 사이트맵
https://usb.kr/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
__name(renderLlmsTxt, "renderLlmsTxt");
async function renderSitemap(env) {
  // 크롤러가 자주 요청하는 페이지라, 15분 캐시로 감싸서 매번 전체 글을 다시 읽지 않도록 함
  const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;
  try {
    const cachedRaw = await env.POSTS.get("sitemap:cache");
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && typeof cached.generatedAt === "number" && Date.now() - cached.generatedAt < SITEMAP_CACHE_TTL_MS) {
        return new Response(cached.xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      }
    }
  } catch (e) {}
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const urls = [`<url><loc>https://usb.kr/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  for (const c of CATEGORIES) {
    urls.push(`<url><loc>https://usb.kr/category/${c.slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
  }
  // safeKVGet 사용 — KV 한도초과로 D1에만 저장된 글도 사이트맵에서 누락되지 않도록
  const rawSitemapPosts = await Promise.all(idx.map((slug) => safeKVGet(env, `post:${slug}`)));
  for (const raw of rawSitemapPosts) {
    if (!raw) continue;
    const p = JSON.parse(raw);
    const lastmod = new Date(p.createdAt).toISOString().slice(0, 10);
    urls.push(`<url><loc>https://usb.kr/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  await safeKVPut(env, "sitemap:cache", JSON.stringify({ xml, generatedAt: Date.now() }), { expirationTtl: 3600 });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
__name(renderSitemap, "renderSitemap");
async function renderRssFeed(env) {
  const RSS_CACHE_TTL_MS = 15 * 60 * 1000;
  try {
    const cachedRaw = await env.POSTS.get("rss:cache");
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && typeof cached.generatedAt === "number" && Date.now() - cached.generatedAt < RSS_CACHE_TTL_MS) {
        return new Response(cached.xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
      }
    }
  } catch (e) {}
  const idxRaw = await env.POSTS.get("index");
  const idx = (idxRaw ? JSON.parse(idxRaw) : []).slice(0, 30); // 최신 30건만
  const rawPosts = await Promise.all(idx.map((slug) => safeKVGet(env, `post:${slug}`)));
  const items = [];
  for (const raw of rawPosts) {
    if (!raw) continue;
    const p = JSON.parse(raw);
    const pubDate = new Date(p.createdAt).toUTCString();
    const desc = escapeHtml((p.metaDescription || p.tldr || "").slice(0, 300));
    items.push(`<item><title>${escapeHtml(p.title)}</title><link>https://usb.kr/${p.slug}</link><guid>https://usb.kr/${p.slug}</guid><pubDate>${pubDate}</pubDate><description>${desc}</description></item>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>usb.kr - 전자기기 비교 가이드</title>
<link>https://usb.kr/</link>
<description>실시간 쿠팡 가격 데이터를 기반으로 전자기기를 비교합니다.</description>
<language>ko-kr</language>
${items.join("\n")}
</channel></rss>`;
  await safeKVPut(env, "rss:cache", JSON.stringify({ xml, generatedAt: Date.now() }), { expirationTtl: 3600 });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
__name(renderRssFeed, "renderRssFeed");
async function buildJsonLd(post, env) {
  const productNodes = await Promise.all((post.products || []).map(async (prod) => ({
    "@type": "Product",
    name: prod.name,
    image: `https://usb.kr${imgProxy(prod.image)}`,
    offers: {
      "@type": "Offer",
      price: String(prod.price || ""),
      priceCurrency: "KRW",
      url: prod.affiliateUrl
    }
  })));
  const heroImage = post.products?.[0]?.image ? `https://usb.kr${imgProxy(post.products[0].image)}` : void 0;
  const graph = [
    {
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.createdAt,
      dateModified: post.createdAt,
      author: { "@type": "Organization", name: "usb.kr", url: "https://usb.kr" },
      publisher: { "@type": "Organization", name: "usb.kr", url: "https://usb.kr" },
      description: post.metaDescription || "",
      abstract: post.tldr || void 0,
      mainEntityOfPage: { "@type": "WebPage", "@id": `https://usb.kr/${post.slug}` },
      image: heroImage
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "usb.kr", item: "https://usb.kr/" },
        { "@type": "ListItem", position: 2, name: post.title, item: `https://usb.kr/${post.slug}` }
      ]
    },
    ...productNodes
  ];
  if (post.faq && post.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a }
      }))
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}
__name(buildJsonLd, "buildJsonLd");
function page(title, body, options = {}) {
  const { description = "실시간 쿠팡 가격 데이터를 기반으로 전자기기 스펙과 가격을 비교하는 가이드", ogImage = "", canonicalUrl = "", noindex = false, showPrivacyNotice = true, jsonLd = "" } = options;
  const meta = `<meta name="description" content="${escapeHtml(description)}">
${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ""}
<meta property="og:site_name" content="usb.kr">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${canonicalUrl && canonicalUrl !== "https://usb.kr/" ? "article" : "website"}">
${canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">` : ""}
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
${jsonLd ? `<script type="application/ld+json">${jsonLd}<\/script>` : ""}`;
  const ga4Script = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-8W82WVZTWF"><\/script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-8W82WVZTWF', { anonymize_ip: true });
<\/script>`;
  const privacyBanner = showPrivacyNotice ? `<div class="privacy-banner hidden" id="privacyBanner">
    <p>usb.kr은 서비스 개선을 위해 방문 통계(리퍼러, 국가, 기기 종류, 언어 등 개인을 식별할 수 없는 정보)를 수집합니다. 또한 쿠팡 파트너스 활동을 통해 일정액의 수수료를 제공받을 수 있습니다. <a href="/privacy" style="text-decoration:underline;color:var(--accent-text);">자세히 보기</a></p>
    <button id="privacyBannerOk" type="button">확인했습니다</button>
  </div>
  <script>
    (function(){
      try{
        if(!localStorage.getItem('usbkr_privacy_ack')){
          var b=document.getElementById('privacyBanner');
          if(b) b.classList.remove('hidden');
        }
        var okBtn=document.getElementById('privacyBannerOk');
        if(okBtn) okBtn.addEventListener('click', function(){
          try{ localStorage.setItem('usbkr_privacy_ack','1'); }catch(e){}
          var b=document.getElementById('privacyBanner');
          if(b) b.classList.add('hidden');
        });
      }catch(e){}
    })();
  <\/script>` : "";
  const animeScript = `<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js" defer><\/script>
  <script>
  (function(){
    function animateIn(root){
      root = root || document;
      if (typeof anime === 'undefined') return;
      var cards = root.querySelectorAll ? root.querySelectorAll('.entry:not([data-anim])') : [];
      cards.forEach(function(c){ c.setAttribute('data-anim','1'); });
      if (cards.length) {
        anime({ targets: cards, translateY:[24,0], opacity:[0,1], duration:520, delay: anime.stagger(60), easing:'easeOutCubic' });
      }
      var tags = root.querySelectorAll ? root.querySelectorAll('.price-tag:not([data-anim])') : [];
      tags.forEach(function(t){ t.setAttribute('data-anim','1'); });
      if (tags.length) {
        anime({ targets: tags, scale:[0,1], opacity:[0,1], duration:600, delay: anime.stagger(60,{start:180}), easing:'easeOutElastic(1, .6)' });
      }
    }
    function run(){
      if (typeof anime === 'undefined') { setTimeout(run, 60); return; }
      animateIn(document);
      var banner = document.querySelector('.top-banner-inner');
      if (banner) anime({ targets: banner, opacity:[0,1], scale:[0.96,1], duration:600, easing:'easeOutCubic' });
      var heroCards = document.querySelectorAll('.hero-carousel-card');
      if (heroCards.length) anime({ targets: heroCards, opacity:[0,1], translateY:[16,0], duration:500, delay: anime.stagger(50), easing:'easeOutCubic' });
      window.__usbkrAnimateIn = animateIn;
      document.querySelectorAll('.faq-item').forEach(function(item){
        item.addEventListener('toggle', function(){
          if (item.open) {
            var p = item.querySelector('p');
            if (p && typeof anime !== 'undefined') anime({ targets: p, opacity:[0,1], translateY:[-6,0], duration:320, easing:'easeOutCubic' });
          }
        });
      });
      // 카드 클릭시 팝 효과 후 이동 (새탭/우클릭/조합키는 그대로 통과)
      document.addEventListener('click', function(e){
        var el = e.target.closest('.entry, .top-banner-inner');
        if (!el) return;
        var href = el.getAttribute('href');
        if (!href || el.getAttribute('target') === '_blank') return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (typeof anime === 'undefined') { window.location.href = href; return; }
        el.style.transformOrigin = 'center';
        anime({
          targets: el,
          scale: [1, 0.94, 1],
          duration: 260,
          easing: 'easeOutQuad',
          complete: function(){ window.location.href = href; }
        });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  })();
  <\/script>`;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="manifest" href="/manifest.json"><link rel="alternate" type="application/rss+xml" title="usb.kr RSS" href="/feed.xml"><meta name="theme-color" content="#FF4B3E"><title>${title}</title>${meta}${ga4Script}<style>${STYLE}</style>${FONTS}</head><body>${body}${privacyBanner}${animeScript}</body></html>`;
}
__name(page, "page");
function siteHeader(compact, placeholderWord, visitStats) {
  const placeholder = placeholderWord ? `'${placeholderWord}' 검색해보기` : "쿠팡에서 상품 검색";
  const statsHtml = visitStats ? `<div class="visit-stats mono">시간 <b>${visitStats.hour}</b> · 일 <b>${visitStats.day}</b> · 주 <b>${visitStats.week}</b> · 월 <b>${visitStats.month}</b></div>` : "";
  return `<header class="site"><div class="wrap"><div class="header-left"><a class="logo${compact ? " compact" : ""}" href="/"><span class="logo-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="22" height="22" rx="6" fill="#3A2E2A" stroke="#FF4B3E" stroke-width="1.5"/><path d="M13 6.5V15" stroke="#FF4B3E" stroke-width="1.6" stroke-linecap="round"/><path d="M9.5 9L13 6.5L16.5 9" stroke="#FF4B3E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="17.5" r="1.6" fill="#FFC629"/><circle cx="16.5" cy="17.5" r="1.6" fill="#FFC629"/><path d="M13 15V17.5H9.5M13 17.5H16.5" stroke="#FFC629" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="logo-text">usb<span>.kr</span></span></a>${statsHtml}</div><form action="/go" method="GET" class="site-search" target="_blank" role="search" onsubmit="var i=this.querySelector('input[name=q]');if(!i.value.trim()){var d=i.getAttribute('data-default-q');if(d){i.value=d;}else{return false;}}"><input type="text" name="q" placeholder="${escapeHtml(placeholder)}" data-default-q="${escapeHtml(placeholderWord || "")}" autocomplete="off"><button type="submit" aria-label="검색"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></form><div class="mono" style="font-size:13px;color:var(--muted)">전자기기 비교 가이드</div></div></header>
  <style>
    header.site .wrap{ gap:20px; }
    .header-left{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .visit-stats{ font-size:11px; color:var(--muted); white-space:nowrap; }
    .visit-stats b{ color:var(--accent-text); font-weight:700; }
    .site-search{ flex:1; max-width:420px; display:flex; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:100px; padding:4px 6px 4px 16px; }
    .site-search input{ flex:1; border:none; background:transparent; outline:none; font-size:14px; color:var(--text); min-width:0; }
    .site-search input::placeholder{ color:var(--muted); }
    .site-search button{ display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; border:none; background:var(--accent); color:#fff; cursor:pointer; flex-shrink:0; }
    @media (max-width:640px){ .site-search{ max-width:none; flex-basis:100%; } header.site .wrap{ flex-wrap:wrap; } header.site .wrap > div.mono{ display:none; } .visit-stats{ font-size:10px; } }
  </style>`;
}
__name(siteHeader, "siteHeader");
function blankDayStats() {
  return {
    count: 0, hourly: new Array(24).fill(0),
    paths: {}, referrers: {}, countries: {}, devices: {}, searches: {},
    cities: {}, regions: {}, timezones: {}, isps: {},
    browsers: {}, oses: {}, languages: {}, utmSources: {}, prevUrls: {},
    searchKeywords: {}, notFoundPaths: {}, statusCodes: {}, coupangClicks: 0,
    newVisitors: 0, returningVisitors: 0
  };
}
__name(blankDayStats, "blankDayStats");
function bumpCounter(dict, key, cap = 500) {
  const k = key || "unknown";
  if (dict[k] === undefined) {
    if (Object.keys(dict).length >= cap) return; // 너무 커지는 것 방지 — 기존 키는 계속 집계, 신규 키만 무시
    dict[k] = 0;
  }
  dict[k] += 1;
}
__name(bumpCounter, "bumpCounter");
function detectDevice(ua) {
  const s = (ua || "").toLowerCase();
  if (/bot|crawl|spider|slurp|facebookexternalhit|bingpreview/.test(s)) return "bot";
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobile|iphone|android/.test(s)) return "mobile";
  return "desktop";
}
__name(detectDevice, "detectDevice");
async function ensureKvFallbackTable(env) {
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS kv_fallback (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER, updated_at INTEGER)"
    ).run();
  } catch (e) {}
}
__name(ensureKvFallbackTable, "ensureKvFallbackTable");
async function kvFallbackPut(env, key, value, opts) {
  // KV write 실패시(한도초과 등) D1으로 대신 저장 — D1 무료한도가 KV보다 훨씬 여유로움(하루 10만 write)
  try {
    if (!env.DB) return false;
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
    await env.DB.prepare(
      "INSERT INTO kv_fallback (key, value, expires_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at, updated_at=excluded.updated_at"
    ).bind(key, value, expiresAt, Date.now()).run();
    return true;
  } catch (e) {
    if (String(e.message || "").includes("no such table")) {
      await ensureKvFallbackTable(env);
      try {
        const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
        await env.DB.prepare(
          "INSERT INTO kv_fallback (key, value, expires_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at, updated_at=excluded.updated_at"
        ).bind(key, value, expiresAt, Date.now()).run();
        return true;
      } catch (e2) {
        console.log(`[D1 폴백 write 실패] key=${key}: ${e2.message}`);
        return false;
      }
    }
    console.log(`[D1 폴백 write 실패] key=${key}: ${e.message}`);
    return false;
  }
}
__name(kvFallbackPut, "kvFallbackPut");
async function kvFallbackGet(env, key) {
  try {
    if (!env.DB) return null;
    const row = await env.DB.prepare("SELECT value, expires_at FROM kv_fallback WHERE key = ?").bind(key).first();
    if (!row) return null;
    if (row.expires_at && row.expires_at < Date.now()) return null;
    return row.value;
  } catch (e) {
    return null;
  }
}
__name(kvFallbackGet, "kvFallbackGet");
async function safeKVPut(env, key, value, opts) {
  // KV write 한도 초과 등으로 실패해도 요청 전체가 죽지 않도록 방어 — 실패시 D1으로 페일오버, 그것도 실패하면 false
  try {
    await env.POSTS.put(key, value, opts);
    return true;
  } catch (e) {
    console.log(`[KV write 실패, D1 폴백 시도] key=${key}: ${e.message}`);
    return await kvFallbackPut(env, key, value, opts);
  }
}
__name(safeKVPut, "safeKVPut");
async function safeKVGet(env, key) {
  // KV에서 못 찾으면(또는 KV 자체가 에러나면) D1 폴백 테이블도 확인 — write가 D1으로 넘어갔을 수 있으므로
  try {
    const v = await env.POSTS.get(key);
    if (v !== null && v !== undefined) return v;
  } catch (e) {
    console.log(`[KV read 실패, D1 폴백 확인] key=${key}: ${e.message}`);
  }
  return await kvFallbackGet(env, key);
}
__name(safeKVGet, "safeKVGet");
function checkAdminPassword(request, env) {
  // ADMIN_PASS 시크릿과 대조 — 아이디는 무엇을 입력하든 무시하고 비밀번호만 확인
  if (!env.ADMIN_PASS) return null; // 시크릿 미설정시(설정 전 과도기) 막지 않음 — 설정 후엔 항상 걸림
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const pass = decoded.split(":").slice(1).join(":");
      if (pass === env.ADMIN_PASS) return null;
    } catch (e) {}
  }
  return new Response("인증 필요", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="usb.kr admin"' }
  });
}
__name(checkAdminPassword, "checkAdminPassword");
function isLikelyBotUA(ua) {
  const s = ua || "";
  if (!s) return true; // UA 없는 요청은 대부분 스크립트/스캐너
  return /bot|crawl|spider|slurp|curl\/|python-requests|Go-http-client|node-fetch|axios\/|okhttp|UptimeRobot|PostmanRuntime|HeadlessChrome|facebookexternalhit|Slackbot|Discordbot|TelegramBot|WhatsApp|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Yeti|Daumoa/i.test(s);
}
__name(isLikelyBotUA, "isLikelyBotUA");
function detectBrowser(ua) {
  const s = ua || "";
  if (/Edg\//.test(s)) return "Edge";
  if (/OPR\//.test(s)) return "Opera";
  if (/(Whale)\//.test(s)) return "Whale";
  if (/Chrome\//.test(s) && !/Chromium/.test(s)) return "Chrome";
  if (/CriOS\//.test(s)) return "Chrome(iOS)";
  if (/FxiOS\//.test(s)) return "Firefox(iOS)";
  if (/Firefox\//.test(s)) return "Firefox";
  if (/Safari\//.test(s) && !/Chrome/.test(s)) return "Safari";
  if (/MSIE|Trident/.test(s)) return "IE";
  // 알려진 봇/크롤러 식별 — "기타"로 뭉치지 않고 구체적으로 표시
  const knownBots = [
    ["Googlebot", /Googlebot/i], ["Bingbot", /bingbot/i], ["Yeti(네이버)", /Yeti/i],
    ["Daumoa", /Daumoa/i], ["PetalBot", /PetalBot/i], ["AhrefsBot", /AhrefsBot/i],
    ["SemrushBot", /SemrushBot/i], ["MJ12bot", /MJ12bot/i], ["DotBot", /DotBot/i],
    ["facebookexternalhit", /facebookexternalhit/i], ["Slackbot", /Slackbot/i],
    ["Discordbot", /Discordbot/i], ["TelegramBot", /TelegramBot/i], ["WhatsApp", /WhatsApp/i],
    ["curl", /curl\//i], ["python-requests", /python-requests/i], ["Go-http-client", /Go-http-client/i],
    ["node-fetch", /node-fetch/i], ["axios", /axios/i], ["okhttp", /okhttp/i],
    ["UptimeRobot", /UptimeRobot/i], ["Postman", /PostmanRuntime/i], ["헤드리스크롬", /HeadlessChrome/i]
  ];
  for (const [label, re] of knownBots) if (re.test(s)) return label;
  if (!s) return "기타:UA없음";
  // 그 외엔 UA 첫 토큰(제품명)을 그대로 라벨로 사용해 구체적으로 표시
  const firstToken = s.split(/[\s(]/)[0].slice(0, 24);
  return `기타:${firstToken || "확인불가"}`;
}
__name(detectBrowser, "detectBrowser");
function detectOS(ua) {
  const s = ua || "";
  if (/Windows/.test(s)) return "Windows";
  if (/CrOS/.test(s)) return "ChromeOS";
  if (/Android/.test(s)) return "Android";
  if (/iPhone|iPad|iPod/.test(s)) return "iOS";
  if (/Mac OS X/.test(s)) return "macOS";
  if (/Ubuntu/.test(s)) return "Ubuntu";
  if (/Linux/.test(s)) return "Linux";
  const knownBots = [
    ["Googlebot", /Googlebot/i], ["Bingbot", /bingbot/i], ["Yeti(네이버)", /Yeti/i],
    ["봇/크롤러", /bot|crawl|spider/i]
  ];
  for (const [label, re] of knownBots) if (re.test(s)) return label;
  if (!s) return "기타:UA없음";
  const firstToken = s.split(/[\s(]/)[0].slice(0, 24);
  return `기타:${firstToken || "확인불가"}`;
}
__name(detectOS, "detectOS");
function getPrimaryLanguage(request) {
  const al = request.headers.get("Accept-Language");
  if (!al) return "unknown";
  const first = al.split(",")[0].split(";")[0].trim();
  return first || "unknown";
}
__name(getPrimaryLanguage, "getPrimaryLanguage");
function getReferrerLabel(request) {
  const ref = request.headers.get("Referer") || request.headers.get("Referrer");
  if (!ref) return "direct";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h.includes("usb.kr") ? "internal" : h;
  } catch (e) {
    return "unknown";
  }
}
__name(getReferrerLabel, "getReferrerLabel");
function getPrevUrlNoQuery(request) {
  // 방문 바로 이전 페이지의 전체 URL — 개인정보 유출 방지를 위해 쿼리스트링/해시는 잘라내고 origin+path까지만
  const ref = request.headers.get("Referer") || request.headers.get("Referrer");
  if (!ref) return "direct";
  try {
    const u = new URL(ref);
    return `${u.origin}${u.pathname}`.slice(0, 200);
  } catch (e) {
    return "unknown";
  }
}
__name(getPrevUrlNoQuery, "getPrevUrlNoQuery");
var SEARCH_ENGINE_PARAMS = [
  { hosts: ["google."], param: "q" },
  { hosts: ["search.naver.com", "m.search.naver.com"], param: "query" },
  { hosts: ["search.daum.net"], param: "q" },
  { hosts: ["bing.com"], param: "q" },
  { hosts: ["search.yahoo.com"], param: "p" },
  { hosts: ["duckduckgo.com"], param: "q" }
];
function getSearchKeyword(request) {
  // 검색엔진에서 유입된 경우, 그 검색어를 추출 (검색엔진이 보내주는 공개 쿼리파라미터일 뿐 개인정보 아님)
  const ref = request.headers.get("Referer") || request.headers.get("Referrer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    const match = SEARCH_ENGINE_PARAMS.find((e) => e.hosts.some((h) => u.hostname.includes(h)));
    if (!match) return null;
    const kw = u.searchParams.get(match.param);
    return kw ? kw.slice(0, 60) : null;
  } catch (e) {
    return null;
  }
}
__name(getSearchKeyword, "getSearchKeyword");
async function bumpDailyCounter(env, keyPrefix, dictField, dictKey, ttlSeconds = 400 * 24 * 60 * 60) {
  // 방문통계 blob과 별도의 가벼운 카운터(404, 클릭수 등) — 메인 통계 쓰기와 경합(레이스컨디션) 안 나게 분리된 KV 키 사용
  try {
    const pad = (n) => String(n).padStart(2, "0");
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const dayKey = `${keyPrefix}:${kst.getFullYear()}${pad(kst.getMonth() + 1)}${pad(kst.getDate())}`;
    const raw = await env.POSTS.get(dayKey);
    const data = raw ? JSON.parse(raw) : {};
    data.count = (data.count || 0) + 1; // 총계와 세부항목을 같은 읽기/쓰기 사이클에서 함께 처리 (레이스컨디션 방지)
    if (dictField) {
      data[dictField] = data[dictField] || {};
      bumpCounter(data[dictField], dictKey, 300);
    }
    await safeKVPut(env, dayKey, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch (e) {}
}
__name(bumpDailyCounter, "bumpDailyCounter");
async function bumpLifetimeCounter(env, key, dictField, dictKey) {
  // 만료 없이 영구 누적 — 글별 실제 클릭수, 유입경로별 클릭수 등 "누적 총계"가 필요한 지표용
  try {
    const raw = await env.POSTS.get(key);
    const data = raw ? JSON.parse(raw) : {};
    data.count = (data.count || 0) + 1;
    if (dictField) {
      data[dictField] = data[dictField] || {};
      bumpCounter(data[dictField], dictKey, 3000);
    }
    await env.POSTS.put(key, JSON.stringify(data));
  } catch (e) {}
}
__name(bumpLifetimeCounter, "bumpLifetimeCounter");
async function bumpLifetimeCounterMulti(env, key, updates) {
  // 여러 필드(예: bySlug, bySrc)를 한 번의 read+write로 함께 갱신 — 클릭 1번당 write 횟수를 줄이기 위함
  try {
    const raw = await env.POSTS.get(key);
    const data = raw ? JSON.parse(raw) : {};
    data.count = (data.count || 0) + 1;
    for (const { dictField, dictKey } of updates) {
      if (!dictField) continue;
      data[dictField] = data[dictField] || {};
      bumpCounter(data[dictField], dictKey, 3000);
    }
    await safeKVPut(env, key, JSON.stringify(data));
  } catch (e) {}
}
__name(bumpLifetimeCounterMulti, "bumpLifetimeCounterMulti");
async function getLifetimeClickData(env) {
  try {
    const raw = await env.POSTS.get("clicks:lifetime");
    return raw ? JSON.parse(raw) : { count: 0, bySlug: {}, bySrc: {} };
  } catch (e) {
    return { count: 0, bySlug: {}, bySrc: {} };
  }
}
__name(getLifetimeClickData, "getLifetimeClickData");
function getRefSrcCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)refsrc=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "direct";
}
__name(getRefSrcCookie, "getRefSrcCookie");
async function handleOutboundClick(request, env, ctx) {
  const url = new URL(request.url);
  const dest = url.searchParams.get("u");
  const slug = url.searchParams.get("s") || "unknown";
  if (!dest) return new Response("Missing url", { status: 400 });
  let parsed;
  try {
    parsed = new URL(dest);
  } catch (e) {
    return new Response("Invalid url", { status: 400 });
  }
  // 쿠팡 도메인으로만 리다이렉트 허용 (오픈리다이렉트 악용 방지)
  const allowedSuffixes = [".coupang.com", "coupa.ng"];
  if (parsed.protocol !== "https:" || !allowedSuffixes.some((suf) => parsed.hostname === suf.replace(/^\./, "") || parsed.hostname.endsWith(suf))) {
    return new Response("Invalid destination", { status: 400 });
  }
  const isBot = isLikelyBotUA(request.headers.get("User-Agent"));
  const cookie = request.headers.get("Cookie") || "";
  const dedupeKey = `clk:${slug}`;
  const alreadyClicked = new RegExp(`(?:^|;\\s*)${dedupeKey}=1(?:;|$)`).test(cookie);
  const headers = { Location: dest };
  if (!isBot && !alreadyClicked) {
    ctx.waitUntil(bumpDailyCounter(env, "clicks", "bySlug", slug));
    ctx.waitUntil(bumpLifetimeCounterMulti(env, "clicks:lifetime", [
      { dictField: "bySlug", dictKey: slug },
      { dictField: "bySrc", dictKey: getRefSrcCookie(request) }
    ]));
    headers["Set-Cookie"] = `${dedupeKey}=1; Max-Age=600; Path=/; SameSite=Lax`;
  }
  return new Response(null, { status: 302, headers });
}
__name(handleOutboundClick, "handleOutboundClick");
function isOwnerRequest(request) {
  const cookie = request.headers.get("Cookie") || "";
  return /(^|;\s*)owner=1(;|$)/.test(cookie);
}
__name(isOwnerRequest, "isOwnerRequest");
const SESSION_DEDUPE_SECONDS = 1800; // 30분 내 같은 브라우저 재방문은 카운트 안 함
function hasVisitCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  return /(^|;\s*)vseen=1(;|$)/.test(cookie);
}
__name(hasVisitCookie, "hasVisitCookie");
function visitCookiePairs(visitStats) {
  if (!visitStats || !visitStats.setCookie) return [];
  const pairs = [["Set-Cookie", `vseen=1; Max-Age=${SESSION_DEDUPE_SECONDS}; Path=/; SameSite=Lax`]];
  if (visitStats.isNewVisitor) {
    pairs.push(["Set-Cookie", "vfirst=1; Max-Age=31536000; Path=/; SameSite=Lax"]);
  }
  if (visitStats.referrerLabel) {
    pairs.push(["Set-Cookie", `refsrc=${encodeURIComponent(visitStats.referrerLabel)}; Max-Age=${SESSION_DEDUPE_SECONDS}; Path=/; SameSite=Lax`]);
  }
  return pairs;
}
__name(visitCookiePairs, "visitCookiePairs");
async function recordAndGetVisitStats(env, request) {
  const pad = (n) => String(n).padStart(2, "0");
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const mo = kst.getMonth();
  const d = kst.getDate();
  const hour = kst.getHours();
  const todayKey = `visits:d:${y}${pad(mo + 1)}${pad(d)}`;

  let today = blankDayStats();
  try {
    const raw = await env.POSTS.get(todayKey);
    if (raw) today = Object.assign(blankDayStats(), JSON.parse(raw));
  } catch (e) {}
  today.hourly = today.hourly || new Array(24).fill(0);

  const isOwner = request ? isOwnerRequest(request) : false;
  const isDup = request ? hasVisitCookie(request) : false;
  const isBot = request ? isLikelyBotUA(request.headers.get("User-Agent")) : false;
  const hasVfirst = request ? /(^|;\s*)vfirst=1(;|$)/.test(request.headers.get("Cookie") || "") : false;
  const isNewVisitor = !hasVfirst;
  let referrerLabel = null;
  if (!isOwner && !isDup && !isBot) {
    today.count = (today.count || 0) + 1;
    today.hourly[hour] = (today.hourly[hour] || 0) + 1;
    if (isNewVisitor) today.newVisitors = (today.newVisitors || 0) + 1;
    else today.returningVisitors = (today.returningVisitors || 0) + 1;

    if (request) {
      try {
        const reqUrl = new URL(request.url);
        const ua = request.headers.get("User-Agent");
        const cf = request.cf || {};
        bumpCounter(today.paths, reqUrl.pathname);
        referrerLabel = getReferrerLabel(request);
        bumpCounter(today.referrers, referrerLabel);
        bumpCounter(today.prevUrls, getPrevUrlNoQuery(request));
        const searchKw = getSearchKeyword(request);
        if (searchKw) bumpCounter(today.searchKeywords, searchKw);
        bumpCounter(today.countries, cf.country || "XX");
        bumpCounter(today.devices, detectDevice(ua));
        bumpCounter(today.cities, cf.city || (cf.country ? `${cf.country}(도시미상)` : "unknown"));
        bumpCounter(today.regions, cf.region || cf.regionCode || (cf.country ? `${cf.country}(지역미상)` : "unknown"));
        bumpCounter(today.timezones, cf.timezone || (cf.country ? `${cf.country}(TZ미상)` : "unknown"));
        bumpCounter(today.isps, cf.asOrganization || (cf.asn ? `ASN ${cf.asn}` : "unknown"));
        bumpCounter(today.browsers, detectBrowser(ua));
        bumpCounter(today.oses, detectOS(ua));
        bumpCounter(today.languages, getPrimaryLanguage(request));
        const utmSource = reqUrl.searchParams.get("utm_source");
        if (utmSource) bumpCounter(today.utmSources, utmSource);
      } catch (e) {}
    }

    try {
      await safeKVPut(env, todayKey, JSON.stringify(today), { expirationTtl: 400 * 24 * 60 * 60 });
    } catch (e) {}
  }

  // 주간(최근 7일)/월간(이번달 1일~오늘) 합산 — 방문마다 매번 최대 30여개 키를 읽으면
  // KV read 한도를 순식간에 소진하므로, 5분 캐시로 감싸서 재계산 빈도를 크게 줄임
  const AGG_CACHE_TTL_MS = 5 * 60 * 1000;
  const aggCacheKey = "visits:week-month-cache";
  let weekTotal = null, monthTotal = null;
  try {
    const cachedRaw = await env.POSTS.get(aggCacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && typeof cached.computedAt === "number" && Date.now() - cached.computedAt < AGG_CACHE_TTL_MS) {
        weekTotal = cached.week;
        monthTotal = cached.month;
      }
    }
  } catch (e) {}
  if (weekTotal === null || monthTotal === null) {
    const weekKeys = [];
    for (let i = 1; i < 7; i++) {
      const dd = new Date(kst);
      dd.setDate(dd.getDate() - i);
      weekKeys.push(`visits:d:${dd.getFullYear()}${pad(dd.getMonth() + 1)}${pad(dd.getDate())}`);
    }
    const monthKeys = [];
    for (let dayNum = 1; dayNum <= d; dayNum++) {
      monthKeys.push(`visits:d:${y}${pad(mo + 1)}${pad(dayNum)}`);
    }
    const [weekRaws, monthRaws] = await Promise.all([
      Promise.all(weekKeys.map((k) => env.POSTS.get(k).catch(() => null))),
      Promise.all(monthKeys.map((k) => env.POSTS.get(k).catch(() => null)))
    ]);
    weekTotal = today.count;
    for (const raw of weekRaws) {
      if (raw) {
        try {
          weekTotal += JSON.parse(raw).count || 0;
        } catch (e) {}
      }
    }
    monthTotal = 0;
    for (const raw of monthRaws) {
      if (raw) {
        try {
          monthTotal += JSON.parse(raw).count || 0;
        } catch (e) {}
      }
    }
    try {
      await safeKVPut(env, aggCacheKey, JSON.stringify({ week: weekTotal, month: monthTotal, computedAt: Date.now() }), { expirationTtl: 3600 });
    } catch (e) {}
  }

  return { hour: today.hourly[hour] || 0, day: today.count, week: weekTotal, month: monthTotal, setCookie: !isDup && !isOwner && !!request, isNewVisitor, referrerLabel };
}
__name(recordAndGetVisitStats, "recordAndGetVisitStats");
async function recordSearchQuery(env, query) {
  if (!query) return;
  const pad = (n) => String(n).padStart(2, "0");
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const todayKey = `visits:d:${kst.getFullYear()}${pad(kst.getMonth() + 1)}${pad(kst.getDate())}`;
  let today = blankDayStats();
  try {
    const raw = await env.POSTS.get(todayKey);
    if (raw) today = Object.assign(blankDayStats(), JSON.parse(raw));
  } catch (e) {}
  bumpCounter(today.searches, query.slice(0, 60));
  try {
    await safeKVPut(env, todayKey, JSON.stringify(today), { expirationTtl: 400 * 24 * 60 * 60 });
  } catch (e) {}
}
__name(recordSearchQuery, "recordSearchQuery");
async function getVisitStatsOnly(env) {
  const pad = (n) => String(n).padStart(2, "0");
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const mo = kst.getMonth();
  const d = kst.getDate();
  const hour = kst.getHours();
  const todayKey = `visits:d:${y}${pad(mo + 1)}${pad(d)}`;
  let today = blankDayStats();
  try {
    const raw = await env.POSTS.get(todayKey);
    if (raw) today = Object.assign(blankDayStats(), JSON.parse(raw));
  } catch (e) {}
  const weekKeys = [];
  for (let i = 1; i < 7; i++) {
    const dd = new Date(kst);
    dd.setDate(dd.getDate() - i);
    weekKeys.push(`visits:d:${dd.getFullYear()}${pad(dd.getMonth() + 1)}${pad(dd.getDate())}`);
  }
  const monthKeys = [];
  for (let dayNum = 1; dayNum <= d; dayNum++) {
    monthKeys.push(`visits:d:${y}${pad(mo + 1)}${pad(dayNum)}`);
  }
  const [weekRaws, monthRaws] = await Promise.all([
    Promise.all(weekKeys.map((k) => env.POSTS.get(k).catch(() => null))),
    Promise.all(monthKeys.map((k) => env.POSTS.get(k).catch(() => null)))
  ]);
  let weekTotal = today.count || 0;
  for (const raw of weekRaws) {
    if (raw) {
      try {
        weekTotal += JSON.parse(raw).count || 0;
      } catch (e) {}
    }
  }
  let monthTotal = 0;
  for (const raw of monthRaws) {
    if (raw) {
      try {
        monthTotal += JSON.parse(raw).count || 0;
      } catch (e) {}
    }
  }
  return { hour: (today.hourly && today.hourly[hour]) || 0, day: today.count || 0, week: weekTotal, month: monthTotal };
}
__name(getVisitStatsOnly, "getVisitStatsOnly");
function topEntries(dict, n = 8) {
  return Object.entries(dict || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
}
__name(topEntries, "topEntries");
async function renderStatsPage(env) {
  const pad = (n) => String(n).padStart(2, "0");
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const mo = kst.getMonth();
  const d = kst.getDate();
  const hour = kst.getHours();
  const todayKey = `visits:d:${y}${pad(mo + 1)}${pad(d)}`;

  let today = blankDayStats();
  try {
    const raw = await env.POSTS.get(todayKey);
    if (raw) today = Object.assign(blankDayStats(), JSON.parse(raw));
  } catch (e) {}

  const weekKeys = [];
  for (let i = 1; i < 7; i++) {
    const dd = new Date(kst);
    dd.setDate(dd.getDate() - i);
    weekKeys.push(`visits:d:${dd.getFullYear()}${pad(dd.getMonth() + 1)}${pad(dd.getDate())}`);
  }
  const monthKeys = [];
  for (let dayNum = 1; dayNum <= d; dayNum++) {
    monthKeys.push(`visits:d:${y}${pad(mo + 1)}${pad(dayNum)}`);
  }
  const [weekRaws, monthRaws] = await Promise.all([
    Promise.all(weekKeys.map((k) => env.POSTS.get(k).catch(() => null))),
    Promise.all(monthKeys.map((k) => env.POSTS.get(k).catch(() => null)))
  ]);
  let weekTotal = today.count || 0;
  for (const raw of weekRaws) {
    if (raw) {
      try {
        weekTotal += JSON.parse(raw).count || 0;
      } catch (e) {}
    }
  }
  let monthTotal = 0;
  for (const raw of monthRaws) {
    if (raw) {
      try {
        monthTotal += JSON.parse(raw).count || 0;
      } catch (e) {}
    }
  }

  const notfoundKey = `notfound:${y}${pad(mo + 1)}${pad(d)}`;
  const clicksKey = `clicks:${y}${pad(mo + 1)}${pad(d)}`;
  const [notfoundRaw, clicksRaw, lifetimeClicks] = await Promise.all([
    env.POSTS.get(notfoundKey).catch(() => null),
    env.POSTS.get(clicksKey).catch(() => null),
    getLifetimeClickData(env)
  ]);
  const notfoundData = notfoundRaw ? JSON.parse(notfoundRaw) : {};
  const clicksData = clicksRaw ? JSON.parse(clicksRaw) : {};
  // slug만 있으면 어떤 글인지 알 수 없으므로, 상위 클릭 slug들의 실제 글 제목을 KV에서 조회해서 붙임
  const clickTopEntries = topEntries(clicksData.bySlug || {}, 8);
  const clickTitleDict = {};
  await Promise.all(clickTopEntries.map(async ([slug, cnt]) => {
    let label;
    try {
      const raw = await env.POSTS.get(`post:${slug}`);
      const title = raw ? JSON.parse(raw).title : null;
      const trimmed = title ? (title.length > 28 ? title.slice(0, 28) + "…" : title) : null;
      label = trimmed ? `${trimmed} #${slug.slice(-6)}` : `(삭제된 글) #${slug.slice(-6)}`;
    } catch (e) {
      label = `(조회오류) #${slug.slice(-6)}`;
    }
    clickTitleDict[label] = cnt;
  }));
  // 유입경로별 실제 클릭수 → bySrc는 클릭 시점의 refsrc 쿠키(방문시 유입경로) 기준 누적
  const srcCtr = {};
  for (const [src, clicks] of Object.entries(lifetimeClicks.bySrc || {})) {
    srcCtr[`${src} (누적클릭 ${clicks}건)`] = clicks;
  }

  const row = (label, val) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">${escapeHtml(label)}</span><b>${val}건</b></div>`;
  const dimBlock = (title, dict) => {
    const entries = topEntries(dict, 8);
    if (!entries.length) return "";
    const rows = entries.map(([k, v]) => row(k, v)).join("");
    return `<div style="margin:24px 0;"><h3 style="font-size:15px;margin-bottom:4px;">${escapeHtml(title)}</h3>${rows}</div>`;
  };

  const body = `<div class="wrap" style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:22px;margin-bottom:20px;">📊 방문자 통계</h1>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">이 시간</div><div style="font-size:20px;font-weight:800;">${today.hourly[hour] || 0}</div></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">오늘</div><div style="font-size:20px;font-weight:800;">${today.count || 0}</div></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">이번주</div><div style="font-size:20px;font-weight:800;">${weekTotal}</div></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">이번달</div><div style="font-size:20px;font-weight:800;">${monthTotal}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px;">
      <div style="background:var(--accent);color:#fff;border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;opacity:0.9;">🛒 오늘 쿠팡 클릭수</div><div style="font-size:20px;font-weight:800;">${clicksData.count || 0}</div></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">⚠️ 오늘 404 발생</div><div style="font-size:20px;font-weight:800;">${notfoundData.count || 0}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">🆕 오늘 신규방문</div><div style="font-size:20px;font-weight:800;">${today.newVisitors || 0}</div></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;"><div style="font-size:11px;color:var(--muted);">🔁 오늘 재방문</div><div style="font-size:20px;font-weight:800;">${today.returningVisitors || 0}</div></div>
    </div>
    ${dimBlock("🔥 오늘 많이 본 페이지", today.paths)}
    ${dimBlock("🔗 오늘 유입경로", today.referrers)}
    ${dimBlock("💰 유입경로별 누적 클릭전환 (어떤 경로가 돈이 되는지)", srcCtr)}
    ${dimBlock("🔎 오늘 검색유입 키워드", today.searchKeywords)}
    ${dimBlock("🌏 오늘 국가", today.countries)}
    ${dimBlock("📱 오늘 기기", today.devices)}
    ${dimBlock("🔍 오늘 사이트 내 검색어", today.searches)}
    ${dimBlock("🏙️ 오늘 도시", today.cities)}
    ${dimBlock("📍 오늘 지역", today.regions)}
    ${dimBlock("🕒 오늘 타임존", today.timezones)}
    ${dimBlock("📡 오늘 통신사/ISP", today.isps)}
    ${dimBlock("🧭 오늘 브라우저", today.browsers)}
    ${dimBlock("💻 오늘 OS", today.oses)}
    ${dimBlock("🈺 오늘 언어설정", today.languages)}
    ${dimBlock("📣 오늘 UTM 유입", today.utmSources)}
    ${dimBlock("🔗 오늘 직전 방문 URL", today.prevUrls)}
    ${dimBlock("🛒 오늘 클릭된 상품글", clickTitleDict)}
    ${dimBlock("⚠️ 오늘 404 페이지", notfoundData.paths || {})}
  </div>`;
  return new Response(page("방문자 통계", body, { noindex: true, showPrivacyNotice: false }), { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } });
}
__name(renderStatsPage, "renderStatsPage");
async function getRandomItSearchWord(env) {
  try {
    const products = await getDanawaDailyProducts(env);
    if (!products || !products.length) return null;
    const pick = products[Math.floor(Math.random() * products.length)];
    return pick.name.length > 22 ? pick.name.slice(0, 22).trim() : pick.name;
  } catch (e) {
    return null;
  }
}
__name(getRandomItSearchWord, "getRandomItSearchWord");
async function renderEntries(posts, env) {
  const htmlList = await Promise.all(posts.map(async (p, i) => {
    const firstProduct = p.products?.[0];
    const excerpt = makeExcerpt(p.intro);
    const dateStr = new Date(p.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
    const imgAttrs = i === 0 ? 'loading="eager" fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
    const typeTag = p.type === "review" ? `<span class="mono" style="background:var(--amber);color:#3A2E2A;font-size:10px;padding:2px 8px;border-radius:100px;font-weight:700;margin-left:8px;">단일 리뷰</span>` : "";
    const thumbSrc = firstProduct ? imgProxy(firstProduct.image, { removeBg: true }) : "";
    const shapeHash = Math.abs([...p.slug].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)); // slug 기반이라 새로고침해도 같은 카드는 같은 모양 유지
    const shapeVariant = shapeHash % 5 + 1;
    const colorVariant = Math.floor(shapeHash / 5) % 5 + 1;
    const fontVariant = Math.floor(shapeHash / 25) % 3 + 1;
    const thumbHash = Math.abs([...p.slug].reduce((h, c) => h * 17 + c.charCodeAt(0) + 3, 11));
    const thumbDeco = thumbHash % 5 + 1;
    const priceTag = firstProduct?.price ? `<div class="price-tag v${shapeVariant} c${colorVariant} f${fontVariant} mono">${Number(firstProduct.price).toLocaleString()}원</div>` : "";
    return `<a class="entry" href="/${p.slug}">
      ${firstProduct ? `<div class="entry-thumb d${thumbDeco}"><img src="${thumbSrc}" alt="${firstProduct.altText || p.title}" width="220" height="220" ${imgAttrs}>${priceTag}</div>` : ""}
      <div class="entry-main">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <div class="entry-eyebrow" style="margin-bottom:0;">${p.keyword}</div>${typeTag}
        </div>
        <h2 class="entry-title">${p.title}</h2>
        ${excerpt ? `<p class="entry-excerpt">${excerpt}</p>` : ""}
        <div class="entry-meta">${dateStr}</div>
      </div>
    </a>`;
  }));
  return htmlList.join("");
}
__name(renderEntries, "renderEntries");
function renderCategoryNav(activeSlug) {
  const pills = CATEGORIES.map((c) => {
    const isActive = c.slug === activeSlug;
    return `<a href="/category/${c.slug}" class="mono" style="display:inline-block;padding:6px 14px;border-radius:100px;font-size:12px;border:1px solid ${isActive ? "var(--accent)" : "var(--border)"};background:${isActive ? "var(--accent)" : "var(--surface)"};color:${isActive ? "#fff" : "var(--text)"};font-weight:${isActive ? "700" : "400"};white-space:nowrap;">${c.name}</a>`;
  }).join("");
  return `<div style="display:flex;gap:8px;overflow-x:auto;padding:4px 0 4px;margin-bottom:8px;">${pills}</div>`;
}
__name(renderCategoryNav, "renderCategoryNav");
var HOME_PAGE_SIZE = 20;
async function handleApiMorePosts(request, env) {
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const pageSlugs = idx.slice(offset, offset + HOME_PAGE_SIZE);
  const rawResults = await Promise.all(pageSlugs.map((slug) => env.POSTS.get(`post:${slug}`)));
  const posts = rawResults.filter(Boolean).map((raw) => JSON.parse(raw));
  const clickCounts = await getClickCounts(env, posts.map((p) => p.slug));
  posts.forEach((p) => {
    p.clickCount = clickCounts[p.slug] || 0;
  });
  const entries = await renderEntries(posts, env);
  const hasMore = offset + HOME_PAGE_SIZE < idx.length;
  return new Response(JSON.stringify({ html: entries, hasMore, nextOffset: offset + HOME_PAGE_SIZE }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(handleApiMorePosts, "handleApiMorePosts");
function renderHeroCarousel(posts) {
  if (!posts.length) return "";
  const cards = posts.map((p, i) => {
    const firstProduct = p.products?.[0];
    if (!firstProduct) return "";
    const thumbSrc = imgProxy(firstProduct.image, { removeBg: true });
    const priceStr = firstProduct.price ? `${Number(firstProduct.price).toLocaleString()}원` : "";
    return `<a class="hero-carousel-card" href="/${p.slug}" data-idx="${i}">
      <div class="hero-carousel-tag mono">PICK ${String(i + 1).padStart(2, "0")}</div>
      <div class="hero-carousel-imgbox"><img src="${thumbSrc}" alt="${firstProduct.altText || p.title}" width="180" height="180" loading="lazy" decoding="async"></div>
      <div class="hero-carousel-info">
        <div class="hero-carousel-title">${p.title}</div>
        ${priceStr ? `<div class="hero-carousel-price mono">${priceStr}</div>` : ""}
      </div>
    </a>`;
  }).filter(Boolean).join("");
  if (!cards) return "";
  // 무한 루프용: 마지막에 첫 카드 클론을 하나 추가 (사용자가 끝까지 스크롤하면 이걸 거쳐 첫 카드로 순간이동)
  const firstProduct0 = posts[0].products?.[0];
  const cloneCard = firstProduct0 ? `<a class="hero-carousel-card" href="/${posts[0].slug}" data-idx="0" data-clone="1" tabindex="-1" aria-hidden="true">
      <div class="hero-carousel-tag mono">PICK 01</div>
      <div class="hero-carousel-imgbox"><img src="${imgProxy(firstProduct0.image)}" alt="" width="180" height="180" loading="lazy" decoding="async"></div>
      <div class="hero-carousel-info">
        <div class="hero-carousel-title">${posts[0].title}</div>
        ${firstProduct0.price ? `<div class="hero-carousel-price mono">${Number(firstProduct0.price).toLocaleString()}원</div>` : ""}
      </div>
    </a>` : "";
  const dots = posts.map((_, i) => `<span class="hero-carousel-dot" data-dot="${i}"></span>`).join("");
  return `<div class="hero-carousel-outer">
    <div class="hero-carousel-wrap" id="heroCarouselWrap">
      <div class="hero-carousel-track" id="heroCarouselTrack">${cards}${cloneCard}</div>
    </div>
    <div class="hero-carousel-dots" id="heroCarouselDots">${dots}</div>
  </div>
  <style>
    .hero-carousel-outer{position:relative;padding:28px 0 8px;background:radial-gradient(ellipse at 50% 0%,rgba(255,75,62,0.07),transparent 70%);}
    .hero-carousel-wrap{overflow-x:auto;overflow-y:hidden;padding:8px 0 20px;position:relative;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .hero-carousel-wrap::-webkit-scrollbar{display:none;}
    .hero-carousel-track{display:flex;gap:var(--hc-gap,16px);padding:0 24px;}
    .hero-carousel-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;background:rgba(236,237,230,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid var(--border);border-radius:16px;padding:var(--hc-pad-v,22px) var(--hc-pad-h,24px) 20px;text-decoration:none;color:var(--text);flex-shrink:0;width:var(--hc-card-w,300px);scroll-snap-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.05);position:relative;opacity:0.55;transform:scale(0.9);transition:opacity 0.4s ease,transform 0.4s ease,box-shadow 0.4s ease,background 0.4s ease;}
    .hero-carousel-card.active{opacity:1;transform:scale(1.05);box-shadow:0 12px 32px rgba(0,0,0,0.09);border-color:var(--accent);z-index:1;}
    .hero-carousel-tag{position:absolute;top:10px;left:10px;font-size:9px;letter-spacing:0.03em;color:var(--accent-text);font-weight:700;background:rgba(255,255,255,0.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:3px 8px;border-radius:100px;border:1px solid rgba(255,122,133,0.35);}
    .hero-carousel-card.active .hero-carousel-tag{background:rgba(255,198,92,0.4);color:#8a5a12;border-color:rgba(255,198,92,0.5);}
    .hero-carousel-imgbox{width:var(--hc-img,150px);height:var(--hc-img,150px);display:flex;align-items:center;justify-content:center;margin:12px 0 10px;}
    .hero-carousel-card img{max-width:100%;max-height:100%;object-fit:contain;}
    .hero-carousel-info{width:100%;}
    .hero-carousel-title{font-size:var(--hc-title-fs,15px);font-weight:700;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.35;min-height:2.7em;}
    .hero-carousel-price{font-size:var(--hc-price-fs,18px);color:var(--amber-text,#b5750a);margin-top:6px;font-weight:800;}
    .hero-carousel-dots{display:flex;justify-content:center;gap:7px;padding-bottom:4px;}
    .hero-carousel-dot{width:6px;height:6px;border-radius:100px;background:var(--border);transition:all 0.35s ease;}
    .hero-carousel-dot.active{width:20px;background:var(--accent);}
  </style>
  <script>
  (function(){
    var wrap = document.getElementById('heroCarouselWrap');
    var track = document.getElementById('heroCarouselTrack');
    var dotsWrap = document.getElementById('heroCarouselDots');
    if (!wrap || !track) return;
    var allEls = Array.prototype.slice.call(track.children);
    var clone = allEls.filter(function(c){ return c.dataset.clone === '1'; })[0] || null;
    var cards = allEls.filter(function(c){ return c.dataset.clone !== '1'; });
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
    if (cards.length < 2) return;
    var n = cards.length;
    var current = 0;
    var userInteracting = false;
    var resumeTimer = null;
    var loopTimer = null;

    var show3 = false;
    function computeLayout(){
      var w = wrap.clientWidth;
      var gap = w < 420 ? 10 : 16;
      show3 = n >= 3;
      // 화면 폭을 항상 정확히 3등분 (모바일 포함) — 클램프 없이 꽉 채워서 3개만 보이게
      var cardW = show3 ? Math.max(92, Math.floor((w - gap * 2) / 3)) : Math.min(300, w - 48);
      track.style.setProperty('--hc-card-w', cardW + 'px');
      track.style.setProperty('--hc-gap', gap + 'px');
      // 카드가 좁아질수록 이미지/여백/폰트도 같이 축소
      track.style.setProperty('--hc-img', Math.max(56, Math.round(cardW * 0.62)) + 'px');
      track.style.setProperty('--hc-pad-h', Math.max(8, Math.round(cardW * 0.08)) + 'px');
      track.style.setProperty('--hc-pad-v', Math.max(10, Math.round(cardW * 0.07)) + 'px');
      track.style.setProperty('--hc-title-fs', Math.max(11, Math.min(15, Math.round(cardW * 0.075))) + 'px');
      track.style.setProperty('--hc-price-fs', Math.max(12, Math.min(18, Math.round(cardW * 0.09))) + 'px');
      var pad = Math.max(10, (w - cardW) / 2);
      track.style.paddingLeft = pad + 'px';
      track.style.paddingRight = pad + 'px';
    }
    function scrollToCard(el, behavior){
      var target = el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2;
      target = Math.max(0, Math.min(target, wrap.scrollWidth - wrap.clientWidth));
      wrap.scrollTo({ left: target, behavior: behavior || 'smooth' });
    }
    function setActive(i){
      current = (i + n) % n;
      cards.forEach(function(c, idx){ c.classList.toggle('active', idx === current); });
      dots.forEach(function(d, idx){ d.classList.toggle('active', idx === current); });
    }
    function goTo(i, behavior){
      setActive(i);
      scrollToCard(cards[current], behavior);
    }
    function scheduleNext(){
      clearInterval(window.__heroCarouselInterval);
      window.__heroCarouselInterval = setInterval(function(){
        if (!userInteracting) goTo(current + 1);
      }, 5000);
    }
    function onUserInteract(){
      userInteracting = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function(){ userInteracting = false; }, 4000);
    }
    wrap.addEventListener('touchstart', onUserInteract, { passive: true });
    wrap.addEventListener('mousedown', onUserInteract);
    wrap.addEventListener('wheel', onUserInteract, { passive: true });
    dots.forEach(function(d, idx){ d.addEventListener('click', function(){ onUserInteract(); goTo(idx); }); });

    function updateActiveByPosition(){
      var wrapRect = wrap.getBoundingClientRect();
      var centerX = wrapRect.left + wrapRect.width / 2;
      var closestIdx = current;
      var closestDist = Infinity;
      cards.forEach(function(c, idx){
        var r = c.getBoundingClientRect();
        var dist = Math.abs((r.left + r.width / 2) - centerX);
        if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
      });
      setActive(closestIdx);
    }
    var scrollRaf = null;
    wrap.addEventListener('scroll', function(){
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function(){
        scrollRaf = null;
        updateActiveByPosition();
      });
    }, { passive: true });

    // 클론 카드(첫 카드 복제, 맨 끝에 위치)에 도달하면 잠깐 뒤 첫 카드로 순간이동 → 무한 루프처럼 보임
    if (clone) {
      var cloneIO = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            clone.classList.add('active');
            clearTimeout(loopTimer);
            loopTimer = setTimeout(function(){
              goTo(0, 'auto');
            }, 450);
          }
        });
      }, { root: wrap, threshold: [0.6] });
      cloneIO.observe(clone);
    }

    computeLayout();
    var resizeTimer = null;
    var lastWidth = wrap.clientWidth;
    window.addEventListener('resize', function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        var w = wrap.clientWidth;
        if (w === lastWidth) return; // 세로 높이만 바뀐 경우(모바일 주소창 접힘 등)는 무시
        lastWidth = w;
        computeLayout();
        goTo(current, 'auto');
      }, 150);
    });

    var startIdx = show3 ? 1 : 0;
    setActive(startIdx);
    scrollToCard(cards[startIdx], 'auto');
    scheduleNext();
  })();
  </script>`;
}
__name(renderHeroCarousel, "renderHeroCarousel");
function buildTopBannerHtml(candidatePosts) {
  const bannerPool = (candidatePosts || []).filter((p) => p.products?.[0]?.image && p.products?.[0]?.price);
  if (!bannerPool.length) return "";
  const bannerPost = bannerPool[Math.floor(Math.random() * bannerPool.length)];
  const bp = bannerPost.products[0];
  return `<div class="top-banner"><a href="/${bannerPost.slug}" class="top-banner-inner">
      <img class="top-banner-bg" src="${imgProxy(bp.image)}" alt="" aria-hidden="true" loading="eager">
      <div class="top-banner-scrim"></div>
      <img class="top-banner-fg" src="${imgProxy(bp.image, { removeBg: true })}" alt="${bp.altText || bannerPost.title}" loading="eager">
      <div class="top-banner-info">
        <div class="top-banner-eyebrow">✦ 오늘의 추천템</div>
        <div class="top-banner-title">${bannerPost.title}</div>
        <div class="price-tag">${Number(bp.price).toLocaleString()}원</div>
      </div>
    </a></div>`;
}
__name(buildTopBannerHtml, "buildTopBannerHtml");
async function renderHomePage(env, request) {
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const mainSlugs = idx.slice(0, HOME_PAGE_SIZE);
  const mainRaws = await Promise.all(mainSlugs.map((slug) => env.POSTS.get(`post:${slug}`)));
  const posts = mainRaws.filter(Boolean).map((raw) => JSON.parse(raw));
  const clickCounts = await getClickCounts(env, posts.map((p) => p.slug));
  posts.forEach((p) => {
    p.clickCount = clickCounts[p.slug] || 0;
  });
  const entries = await renderEntries(posts, env);
  const hasMoreInitially = idx.length > HOME_PAGE_SIZE;

  // 히어로 캐러셀용: 현재 화면 리스트(상위 20개)에 없는 글 중 랜덤 9개
  const remainingSlugs = idx.slice(HOME_PAGE_SIZE);
  const shuffledRemaining = remainingSlugs.sort(() => Math.random() - 0.5).slice(0, 9);
  const carouselRaws = await Promise.all(shuffledRemaining.map((slug) => env.POSTS.get(`post:${slug}`)));
  const carouselPosts = carouselRaws.filter(Boolean).map((raw) => JSON.parse(raw));
  const heroCarousel = renderHeroCarousel(carouselPosts);
  const [searchWord, visitStats] = await Promise.all([getRandomItSearchWord(env), recordAndGetVisitStats(env, request)]);
  const bannerPool = posts.filter((p) => p.products?.[0]?.image && p.products?.[0]?.price);
  const topBanner = buildTopBannerHtml(bannerPool);
  const body = `${topBanner}${siteHeader(false, searchWord)}
    <div class="hero"><div class="wrap">
      ${heroCarousel}
    </div></div>
    <div class="wrap" style="padding-top:20px;">${renderCategoryNav(null)}</div>
    <div class="wrap">
      <div class="index" id="postIndex">${entries || '<p style="color:var(--muted)">아직 글이 없습니다.</p>'}</div>
      <div id="infiniteScrollSentinel" style="height:1px;"></div>
      <div id="infiniteScrollLoading" style="display:none;text-align:center;padding:20px;color:var(--muted);font-size:13px;">불러오는 중…</div>
    </div>
    <footer><div class="wrap">usb.kr — 전자기기 스펙과 가격을 비교합니다. · <a href="/privacy" style="text-decoration:underline;">개인정보처리방침</a></div></footer>
    <script>
    (function(){
      var offset = ${HOME_PAGE_SIZE};
      var hasMore = ${hasMoreInitially ? "true" : "false"};
      var loading = false;
      var listEl = document.getElementById('postIndex');
      var loadingEl = document.getElementById('infiniteScrollLoading');
      var sentinel = document.getElementById('infiniteScrollSentinel');
      if (!hasMore || !sentinel) return;
      async function loadMore(){
        if (loading || !hasMore) return;
        loading = true;
        loadingEl.style.display = 'block';
        try {
          var res = await fetch('/api/posts?offset=' + offset);
          var data = await res.json();
          if (data.html) {
            listEl.insertAdjacentHTML('beforeend', data.html);
            if (window.__usbkrAnimateIn) window.__usbkrAnimateIn(listEl);
          }
          offset = data.nextOffset;
          hasMore = data.hasMore;
        } catch(e) {
          hasMore = false;
        }
        loading = false;
        loadingEl.style.display = 'none';
        if (!hasMore && observer) observer.disconnect();
      }
      var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting) loadMore();
        });
      }, { rootMargin: '400px' });
      observer.observe(sentinel);
    })();
    </script>`;
  return new Response(page("usb.kr - 전자기기 비교 가이드", body, {
    description: "실시간 쿠팡 가격 데이터를 기반으로, 광고 없이 스펙과 가격만 놓고 전자기기를 비교합니다.",
    canonicalUrl: "https://usb.kr/"
  }), {
    headers: [["Content-Type", "text/html; charset=utf-8"], ...visitCookiePairs(visitStats)]
  });
}
__name(renderHomePage, "renderHomePage");
async function renderCategoryPage(env, slug, request, ctx) {
  const category = getCategoryBySlug(slug);
  if (!category) {
    if (ctx?.waitUntil && !isLikelyBotUA(request?.headers.get("User-Agent"))) ctx.waitUntil(bumpDailyCounter(env, "notfound", "paths", `/category/${slug}`));
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const idxSlice = idx.slice(0, 200);
  const rawPosts = await Promise.all(idxSlice.map((s) => env.POSTS.get(`post:${s}`)));
  const posts = [];
  for (const raw of rawPosts) {
    if (!raw) continue;
    const p = JSON.parse(raw);
    if (category.keywords.includes(p.keyword)) posts.push(p);
    if (posts.length >= 30) break;
  }
  const clickCounts = await getClickCounts(env, posts.map((p) => p.slug));
  posts.forEach((p) => {
    p.clickCount = clickCounts[p.slug] || 0;
  });
  const entries = await renderEntries(posts, env);
  const [searchWord, visitStats] = await Promise.all([getRandomItSearchWord(env), recordAndGetVisitStats(env, request)]);
  const body = `${siteHeader(false, searchWord)}
    <div class="hero"><div class="wrap">
      <span class="eyebrow">Category</span>
      <h1>${category.name}</h1>
      <p class="sub">${category.name} 카테고리에서 비교/리뷰한 글 모음입니다.</p>
      <div class="meta-line"><b>${posts.length}</b>건</div>
    </div></div>
    <div class="wrap" style="padding-top:20px;">${renderCategoryNav(category.slug)}</div>
    <div class="wrap"><div class="index">${entries || '<p style="color:var(--muted)">아직 이 카테고리에 글이 없습니다.</p>'}</div></div>
    <footer><div class="wrap">usb.kr — 전자기기 스펙과 가격을 비교합니다. · <a href="/privacy" style="text-decoration:underline;">개인정보처리방침</a></div></footer>`;
  return new Response(page(`${category.name} - usb.kr`, body, {
    description: `${category.name} 카테고리 전자기기 비교/리뷰 모음`,
    canonicalUrl: `https://usb.kr/category/${category.slug}`
  }), {
    headers: [["Content-Type", "text/html; charset=utf-8"], ...visitCookiePairs(visitStats)]
  });
}
__name(renderCategoryPage, "renderCategoryPage");
function detectDeviceType(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|android|blackberry|windows phone/.test(ua)) return "mobile";
  return "desktop";
}
__name(detectDeviceType, "detectDeviceType");
async function recordVisit(env, slug, request) {
  if (isLikelyBotUA(request.headers.get("User-Agent"))) return; // 봇/크롤러는 조회수에 안 잡히게
  const existing = await env.DB.prepare("SELECT count, referrers FROM visits WHERE slug = ?").bind(slug).first();
  let count = existing ? existing.count : 0;
  let referrers = [];
  if (existing) {
    try {
      referrers = JSON.parse(existing.referrers || "[]");
    } catch (e) {
      referrers = [];
    }
  }
  count += 1;
  const referrer = request.headers.get("Referer") || "direct";
  referrers.unshift(referrer);
  referrers = referrers.slice(0, 20);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(
    "INSERT INTO visits (slug, count, last_visited_at, referrers) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET count = excluded.count, last_visited_at = excluded.last_visited_at, referrers = excluded.referrers"
  ).bind(slug, count, now, JSON.stringify(referrers)).run();
  const country = request.headers.get("CF-IPCountry") || request.cf?.country || "unknown";
  const userAgent = request.headers.get("User-Agent") || "unknown";
  const language = (request.headers.get("Accept-Language") || "unknown").split(",")[0].trim();
  const deviceType = detectDeviceType(userAgent);
  await env.DB.prepare(
    "INSERT INTO visit_log (slug, visited_at, referrer, country, user_agent, language, device_type) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(slug, now, referrer, country, userAgent, language, deviceType).run();
  return count;
}
__name(recordVisit, "recordVisit");
async function getClickCounts(env, slugs) {
  if (!slugs.length) return {};
  const placeholders = slugs.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`SELECT slug, count FROM visits WHERE slug IN (${placeholders})`).bind(...slugs).all();
  const map = {};
  for (const row of results) map[row.slug] = row.count;
  return map;
}
__name(getClickCounts, "getClickCounts");
async function renderPostPage(env, slug, request, ctx) {
  const raw = await safeKVGet(env, `post:${slug}`);
  if (!raw) {
    if (ctx?.waitUntil && !isLikelyBotUA(request?.headers.get("User-Agent"))) ctx.waitUntil(bumpDailyCounter(env, "notfound", "paths", `/${slug}`));
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }
  const p = JSON.parse(raw);
  const isPreview = new URL(request.url).searchParams.get("preview") === "1";
  if (!isPreview) {
    // DB 읽기+쓰기라 페이지 응답을 기다리게 하지 않고 백그라운드로 넘김 (로딩속도에 영향 없게)
    const visitPromise = recordVisit(env, slug, request);
    if (ctx?.waitUntil) ctx.waitUntil(visitPromise);
    else await visitPromise;
  }
  const products = p.products || [];
  const productGroups = [];
  for (let i = 0; i < products.length; i += 2) {
    productGroups.push(products.slice(i, i + 2));
  }
  const productGroupHtml = /* @__PURE__ */ __name(async (group) => {
    const blocks = await Promise.all(group.map(async (prod) => `<div class="product-block">
      <div class="thumb"><img class="thumb-bg" src="${imgProxy(prod.image)}" alt="" aria-hidden="true" loading="lazy"><img class="thumb-fg" src="${imgProxy(prod.image, { removeBg: true })}" alt="${prod.altText || prod.name}" loading="lazy" decoding="async"></div>
      <div class="pb-scrim"></div>
      <div class="pb-info">
        <h3 style="font-size:16px;margin-bottom:6px;">${prod.name}</h3>
        <div class="price-tag mono" style="margin-bottom:12px;">${Number(prod.price).toLocaleString()}원</div>
        <a class="cta" href="/out?u=${encodeURIComponent(prod.affiliateUrl)}&s=${encodeURIComponent(p.slug)}" target="_blank" rel="nofollow sponsored">상품보기</a>
      </div>
    </div>`));
    return blocks.join("");
  }, "productGroupHtml");
  const productGroupHtmlList = await Promise.all(productGroups.map((g) => productGroupHtml(g)));
  const introParas = splitParagraphs(p.intro);
  const sectionSegments = [];
  (p.sections || []).forEach((s) => {
    const paras = splitParagraphs(s.body_html);
    if (paras.length) {
      sectionSegments.push(`<h2>${s.heading}</h2>${paras[0]}`);
      for (let i = 1; i < paras.length; i++) sectionSegments.push(paras[i]);
    } else {
      sectionSegments.push(`<h2>${s.heading}</h2>`);
    }
  });
  const allSegments = [...introParas, ...sectionSegments];
  const totalSegments = allSegments.length;
  const totalGroups = productGroups.length;
  const insertPoints = [];
  const usedPoints = /* @__PURE__ */ new Set();
  if (totalGroups > 0 && totalSegments > 0) {
    for (let g = 0; g < totalGroups; g++) {
      let target = Math.round((g + 1) * totalSegments / (totalGroups + 1));
      target = Math.max(1, Math.min(totalSegments, target));
      while (usedPoints.has(target) && target < totalSegments) target++;
      usedPoints.add(target);
      insertPoints.push(target);
    }
  }
  let groupPtr = 0;
  let flowHtml = "";
  allSegments.forEach((seg, idx) => {
    flowHtml += seg;
    while (groupPtr < totalGroups && insertPoints[groupPtr] === idx + 1) {
      flowHtml += `<div class="product-pair">${productGroupHtmlList[groupPtr]}</div>`;
      groupPtr++;
    }
  });
  while (groupPtr < totalGroups) {
    flowHtml += `<div class="product-pair">${productGroupHtmlList[groupPtr]}</div>`;
    groupPtr++;
  }
  const videoBlocks = [];
  if (p.videoTextToVideo) videoBlocks.push(`<video controls autoplay muted playsinline loop preload="auto" style="width:100%;border-radius:10px;background:#000;" src="/video/${p.videoTextToVideo}"></video>`);
  if (p.videoImageToVideo) videoBlocks.push(`<video controls autoplay muted playsinline loop preload="auto" style="width:100%;border-radius:10px;background:#000;" src="/video/${p.videoImageToVideo}"></video>`);
  if (!videoBlocks.length && p.type === "review" && p.products?.[0]?.image) {
    const heroImg = p.products[0];
    const kbClass = "kb" + (Math.floor(Math.random() * 4) + 1);
    videoBlocks.push(`<div class="kenburns-wrap" style="aspect-ratio:16/9;"><img class="${kbClass}" src="${imgProxy(heroImg.image)}" alt="${heroImg.altText || heroImg.name}"></div>`);
  }
  const videoSection = videoBlocks.length ? `<div style="display:grid;grid-template-columns:repeat(${videoBlocks.length}, 1fr);gap:16px;margin:24px 0;">${videoBlocks.join("")}</div>` : "";
  const [searchWord, visitStats] = await Promise.all([getRandomItSearchWord(env), isPreview ? getVisitStatsOnly(env) : recordAndGetVisitStats(env, request)]);
  const idxForBanner = JSON.parse(await env.POSTS.get("index") || "[]").filter((s) => s !== slug);
  const bannerSlugs = idxForBanner.sort(() => Math.random() - 0.5).slice(0, 6);
  const bannerRaws = await Promise.all(bannerSlugs.map((s) => env.POSTS.get(`post:${s}`)));
  const bannerPool = bannerRaws.filter(Boolean).map((raw) => JSON.parse(raw));
  const topBanner = buildTopBannerHtml(bannerPool);
  const tldrBlock = p.tldr ? `<div class="tldr-box"><span class="tldr-label">✦ 한줄요약</span><p>${p.tldr}</p></div>` : "";
  const faqBlock = (p.faq && p.faq.length) ? `<div class="faq-section">
      <h2>자주 묻는 질문</h2>
      ${p.faq.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("")}
    </div>` : "";
  const body = `${topBanner}${siteHeader(true, searchWord)}
    <div class="wrap post-body">
      <h1>${p.title}</h1>
      <div class="meta">${p.keyword} · ${new Date(p.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</div>
      ${tldrBlock}
      ${videoSection}
      ${flowHtml}
      ${p.outro}
      <div style="display:flex;gap:12px;align-items:flex-start;background:#FFFBEB;border:1.5px solid var(--amber);border-radius:10px;padding:16px 18px;margin:32px 0 0;">
        <span style="font-size:22px;line-height:1;">⚠️</span>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#7C2D12;font-weight:500;">
          이 글은 AI가 자동 생성한 참고용 콘텐츠입니다. 스펙·가격 등 일부 정보가 실제와 다를 수 있으니, <strong>구매 전 반드시 판매 페이지에서 정확한 정보를 직접 확인해주세요.</strong>
        </p>
      </div>
      ${faqBlock}
    </div>
<footer><div class="wrap">usb.kr — 쿠팡 파트너스 활동을 통해 일정액의 수수료를 제공받을 수 있습니다. · <a href="/privacy" style="text-decoration:underline;">개인정보처리방침</a></div></footer>`;
  const postExcerpt = p.metaDescription || makeExcerpt(p.intro, 150) || `${p.keyword} 비교 가이드`;
  const ogImage = p.products?.[0]?.image ? `https://usb.kr${imgProxy(p.products[0].image)}` : "";
  return new Response(page(`${p.title} - usb.kr`, body, {
    description: postExcerpt,
    canonicalUrl: `https://usb.kr/${p.slug}`,
    ogImage,
    jsonLd: await buildJsonLd(p, env)
  }), {
    headers: [["Content-Type", "text/html; charset=utf-8"], ...visitCookiePairs(visitStats)]
  });
}
__name(renderPostPage, "renderPostPage");
function makeExcerpt(html, maxLen = 130) {
  const text = (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen).trim() + "…" : text;
}
__name(makeExcerpt, "makeExcerpt");
function splitParagraphs(html) {
  if (!html) return [];
  const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  return matches && matches.length ? matches : [html];
}
__name(splitParagraphs, "splitParagraphs");
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(escapeHtml, "escapeHtml");
async function renderAdminPage(env, url) {
  const idxRaw = await env.POSTS.get("index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const msg = url?.searchParams.get("msg");
  // Danawa 제품은 매일 새로 갱신되므로 활성/대기 구분 없음
  const priorityQueue = await getPriorityKeywords(env);
  let kvFallbackCount = 0;
  try {
    const cnt = env.DB ? await env.DB.prepare("SELECT COUNT(*) as c FROM kv_fallback").first() : null;
    kvFallbackCount = cnt?.c || 0;
  } catch (e) {}
  const kvFallbackBlock = kvFallbackCount > 0 ? `<div class="admin-card alert">
    <div class="mono" style="font-size:13px;color:#c0392b;">⚠️ KV 한도 초과로 D1에 임시 저장된 항목 ${kvFallbackCount}건 대기중 — 5분마다 자동으로 KV 복구 시도됨</div>
  </div>` : "";
  let brokenLinks = [];
  try {
    if (env.DB) {
      const res = await env.DB.prepare("SELECT slug, product_name, url, status_code, fail_count FROM broken_links WHERE fail_count >= ? ORDER BY checked_at DESC LIMIT 20").bind(LINK_CHECK_FAIL_THRESHOLD).all();
      brokenLinks = res.results || [];
    }
  } catch (e) {}
  const brokenLinksBlock = brokenLinks.length ? `<div class="admin-card alert">
    <details><summary class="mono title" style="cursor:pointer;">🔗 끊긴 쿠팡 링크 감지 ${brokenLinks.length}건 (연속 ${LINK_CHECK_FAIL_THRESHOLD}회 이상 실패, 5분마다 순환 점검)</summary>
    <div style="margin-top:10px;">${brokenLinks.map((b) => `<div class="mono" style="font-size:12px;color:#c0392b;padding:4px 0;"><a href="/${escapeHtml(b.slug)}" target="_blank" style="color:#c0392b;text-decoration:underline;">${escapeHtml(b.product_name || b.slug)}</a> — 상태코드 ${b.status_code || "네트워크오류"} (연속 ${b.fail_count}회 실패)</div>`).join("")}</div>
    </details>
  </div>` : "";
  const priorityRows = priorityQueue.map((kw, i) => `<div class="mono pkw-badge" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--accent);color:#fff;border-radius:100px;font-size:12px;font-weight:700;transition:transform .15s,box-shadow .15s;">${i + 1}. <span class="pkw-text">${escapeHtml(kw)}</span><button type="button" class="pkw-remove" data-kw="${escapeHtml(kw)}" title="예약 취소" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:700;padding:0;font-size:13px;">✕</button></div>`).join("");
  const priorityBlock = `<div class="admin-card">
    <div class="admin-card-head"><div class="title">📌 다음 게시물 예약 키워드</div><div class="mono" style="font-size:11px;color:var(--muted);">순서대로 소진 · 실패시 자동 스킵 · 길게 누르면 1순위로</div></div>
    <form id="pkw-add-form" style="display:flex;gap:8px;margin-bottom:12px;"><input type="text" id="pkw-input" name="priorityKeyword" placeholder="예약할 키워드 입력" maxlength="50" class="mono" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;flex:1;max-width:280px;"><button type="submit">예약 추가</button></form>
    <div id="pkw-list" style="display:flex;flex-wrap:wrap;gap:8px;">${priorityRows}</div>
    <div id="pkw-empty" class="mono" style="color:var(--muted);font-size:12px;${priorityRows ? "display:none;" : ""}">예약된 키워드 없음</div>
    <script>
    (function(){
      var list = document.getElementById('pkw-list');
      var empty = document.getElementById('pkw-empty');
      function renumber(){
        var badges = list.querySelectorAll('.pkw-badge');
        badges.forEach(function(b, i){
          var firstNode = b.childNodes[0];
          if (firstNode && firstNode.nodeType === 3) firstNode.textContent = (i+1) + '. ';
        });
        empty.style.display = badges.length ? 'none' : '';
      }
      function makeBadge(kw){
        var div = document.createElement('div');
        div.className = 'mono pkw-badge';
        div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--accent);color:#fff;border-radius:100px;font-size:12px;font-weight:700;transition:transform .15s,box-shadow .15s;';
        div.appendChild(document.createTextNode('. '));
        var span = document.createElement('span');
        span.className = 'pkw-text';
        span.textContent = kw;
        div.appendChild(span);
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'pkw-remove'; btn.dataset.kw = kw; btn.title = '예약 취소';
        btn.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-weight:700;padding:0;font-size:13px;';
        btn.textContent = '✕';
        div.appendChild(btn);
        return div;
      }
      document.getElementById('pkw-add-form').addEventListener('submit', function(e){
        e.preventDefault();
        var input = document.getElementById('pkw-input');
        var kw = input.value.trim();
        if (!kw) return;
        var fd = new FormData(); fd.append('priorityKeyword', kw);
        fetch('/admin/priority-keyword/add', { method: 'POST', body: fd }).then(function(r){
          if (r.ok) { list.appendChild(makeBadge(kw)); input.value=''; renumber(); }
        });
      });
      list.addEventListener('click', function(e){
        var btn = e.target.closest('.pkw-remove');
        if (!btn) return;
        var kw = btn.dataset.kw;
        var fd = new FormData(); fd.append('priorityKeyword', kw);
        fetch('/admin/priority-keyword/remove', { method: 'POST', body: fd }).then(function(r){
          if (r.ok) { btn.closest('.pkw-badge').remove(); renumber(); }
        });
      });
      // 롱프레스(마우스 오래누름 / 터치 오래누름)로 1순위 승격 — 맨 앞으로 부드럽게 이동 + 골드 펄스
      var pressTimer = null;
      function startPress(badge){
        badge.style.transform = 'scale(1.08)';
        badge.style.boxShadow = '0 0 0 2px #fff inset';
        pressTimer = setTimeout(function(){
          badge.style.transform = '';
          badge.style.boxShadow = '';
          var span = badge.querySelector('.pkw-text');
          var kw = span ? span.textContent : '';
          if (!kw) return;
          var fd = new FormData(); fd.append('priorityKeyword', kw);
          fetch('/admin/priority-keyword/promote', { method: 'POST', body: fd }).then(function(r){
            if (!r.ok) return;
            var firstRect = badge.getBoundingClientRect();
            list.insertBefore(badge, list.firstChild);
            renumber();
            var lastRect = badge.getBoundingClientRect();
            var dx = firstRect.left - lastRect.left, dy = firstRect.top - lastRect.top;
            if (badge.animate) {
              badge.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
                { transform: 'translate(0,0)' }
              ], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
            }
            badge.classList.remove('promoted');
            void badge.offsetWidth;
            badge.classList.add('promoted');
          });
        }, 500);
      }
      function cancelPress(badge){
        clearTimeout(pressTimer);
        if (badge) { badge.style.transform = ''; badge.style.boxShadow = ''; }
      }
      list.addEventListener('mousedown', function(e){
        var badge = e.target.closest('.pkw-badge');
        if (!badge || e.target.closest('.pkw-remove')) return;
        startPress(badge);
      });
      list.addEventListener('touchstart', function(e){
        var badge = e.target.closest('.pkw-badge');
        if (!badge || e.target.closest('.pkw-remove')) return;
        startPress(badge);
      }, { passive: true });
      ['mouseup','mouseleave'].forEach(function(evt){
        list.addEventListener(evt, function(e){ cancelPress(e.target.closest('.pkw-badge')); });
      });
      ['touchend','touchcancel'].forEach(function(evt){
        list.addEventListener(evt, function(e){ cancelPress(e.target.closest('.pkw-badge')); });
      });
    })();
    <\/script>
  </div>`;
  const priorityUrlQueue = await getPriorityUrls(env);
  const priorityUrlRows = priorityUrlQueue.map((u, i) => `<div class="mono purl-badge" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--ink-chip);color:#fff;border-radius:100px;font-size:12px;font-weight:700;transition:transform .15s,box-shadow .15s;max-width:100%;">${i + 1}. <span class="purl-text" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;" title="${escapeHtml(u)}">${escapeHtml(u)}</span><button type="button" class="purl-remove" data-url="${escapeHtml(u)}" title="예약 취소" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:700;padding:0;font-size:13px;flex-shrink:0;">✕</button></div>`).join("");
  const priorityUrlBlock = `<div class="admin-card">
    <div class="admin-card-head"><div class="title">🔗 예약 쿠팡 URL</div><div class="mono" style="font-size:11px;color:var(--muted);">예약 키워드보다 먼저 소진 · 길게 누르면 1순위로</div></div>
    <form id="purl-add-form" style="display:flex;gap:8px;margin-bottom:12px;"><input type="url" id="purl-input" name="priorityUrl" placeholder="쿠팡 상품 URL 붙여넣기" class="mono" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;flex:1;max-width:360px;"><button type="submit">예약 추가</button></form>
    <div id="purl-list" style="display:flex;flex-wrap:wrap;gap:8px;">${priorityUrlRows}</div>
    <div id="purl-empty" class="mono" style="color:var(--muted);font-size:12px;${priorityUrlRows ? "display:none;" : ""}">예약된 URL 없음</div>
    <script>
    (function(){
      var list = document.getElementById('purl-list');
      var empty = document.getElementById('purl-empty');
      function renumber(){
        var badges = list.querySelectorAll('.purl-badge');
        badges.forEach(function(b, i){
          var firstNode = b.childNodes[0];
          if (firstNode && firstNode.nodeType === 3) firstNode.textContent = (i+1) + '. ';
        });
        empty.style.display = badges.length ? 'none' : '';
      }
      function makeBadge(u){
        var div = document.createElement('div');
        div.className = 'mono purl-badge';
        div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--ink-chip);color:#fff;border-radius:100px;font-size:12px;font-weight:700;transition:transform .15s,box-shadow .15s;max-width:100%;';
        div.appendChild(document.createTextNode('. '));
        var span = document.createElement('span');
        span.className = 'purl-text';
        span.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;';
        span.title = u;
        span.textContent = u;
        div.appendChild(span);
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'purl-remove'; btn.dataset.url = u; btn.title = '예약 취소';
        btn.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-weight:700;padding:0;font-size:13px;flex-shrink:0;';
        btn.textContent = '✕';
        div.appendChild(btn);
        return div;
      }
      document.getElementById('purl-add-form').addEventListener('submit', function(e){
        e.preventDefault();
        var input = document.getElementById('purl-input');
        var u = input.value.trim();
        if (!u) return;
        var fd = new FormData(); fd.append('priorityUrl', u);
        fetch('/admin/priority-url/add', { method: 'POST', body: fd }).then(function(r){
          if (r.ok) { list.appendChild(makeBadge(u)); input.value=''; renumber(); }
        });
      });
      list.addEventListener('click', function(e){
        var btn = e.target.closest('.purl-remove');
        if (!btn) return;
        var u = btn.dataset.url;
        var fd = new FormData(); fd.append('priorityUrl', u);
        fetch('/admin/priority-url/remove', { method: 'POST', body: fd }).then(function(r){
          if (r.ok) { btn.closest('.purl-badge').remove(); renumber(); }
        });
      });
      var pressTimer = null;
      function startPress(badge){
        badge.style.transform = 'scale(1.08)';
        badge.style.boxShadow = '0 0 0 2px #fff inset';
        pressTimer = setTimeout(function(){
          badge.style.transform = '';
          badge.style.boxShadow = '';
          var span = badge.querySelector('.purl-text');
          var u = span ? span.title : '';
          if (!u) return;
          var fd = new FormData(); fd.append('priorityUrl', u);
          fetch('/admin/priority-url/promote', { method: 'POST', body: fd }).then(function(r){
            if (!r.ok) return;
            var firstRect = badge.getBoundingClientRect();
            list.insertBefore(badge, list.firstChild);
            renumber();
            var lastRect = badge.getBoundingClientRect();
            var dx = firstRect.left - lastRect.left, dy = firstRect.top - lastRect.top;
            if (badge.animate) {
              badge.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
                { transform: 'translate(0,0)' }
              ], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
            }
            badge.classList.remove('promoted');
            void badge.offsetWidth;
            badge.classList.add('promoted');
          });
        }, 500);
      }
      function cancelPress(badge){
        clearTimeout(pressTimer);
        if (badge) { badge.style.transform = ''; badge.style.boxShadow = ''; }
      }
      list.addEventListener('mousedown', function(e){
        var badge = e.target.closest('.purl-badge');
        if (!badge || e.target.closest('.purl-remove')) return;
        startPress(badge);
      });
      list.addEventListener('touchstart', function(e){
        var badge = e.target.closest('.purl-badge');
        if (!badge || e.target.closest('.purl-remove')) return;
        startPress(badge);
      }, { passive: true });
      ['mouseup','mouseleave'].forEach(function(evt){
        list.addEventListener(evt, function(e){ cancelPress(e.target.closest('.purl-badge')); });
      });
      ['touchend','touchcancel'].forEach(function(evt){
        list.addEventListener(evt, function(e){ cancelPress(e.target.closest('.purl-badge')); });
      });
    })();
    <\/script>
  </div>`;
  const activeKeywords = [];
  const waitingKeywords = KEYWORDS;
  const keywordButton = /* @__PURE__ */ __name((kw, label, activeStyle) => `<form method="POST" action="/admin/generate" style="margin:0;"><input type="hidden" name="keyword" value="${escapeHtml(kw)}"><button type="submit" class="mono" style="background:${activeStyle ? "var(--accent)" : "var(--surface)"};border:1px solid ${activeStyle ? "var(--accent)" : "var(--border)"};color:${activeStyle ? "#fff" : "var(--text)"};font-weight:${activeStyle ? "700" : "400"};padding:6px 12px;border-radius:100px;font-size:12px;cursor:pointer;">${label}${escapeHtml(kw)}</button></form>`, "keywordButton");
  const activeButtons = activeKeywords.map((kw, i) => keywordButton(kw, `${i + 1}. `, true)).join("");
  const waitingButtons = waitingKeywords.map((kw) => keywordButton(kw, "", false)).join("");
  const rawPostList = await Promise.all(idx.slice(0, 50).map((slug) => env.POSTS.get(`post:${slug}`)));
  const posts = rawPostList.filter(Boolean).map((raw) => JSON.parse(raw));
  const viewCounts = await getClickCounts(env, posts.map((p) => p.slug));
  const lifetimeClicks = await getLifetimeClickData(env);
  const pendingVideoJobs = await env.POSTS.list({ prefix: "videoJob:" });
  const pendingByField = { videoTextToVideo: /* @__PURE__ */ new Set(), videoImageToVideo: /* @__PURE__ */ new Set() };
  for (const k of pendingVideoJobs.keys) {
    const [, slug, field] = k.name.split(":");
    if (pendingByField[field]) pendingByField[field].add(slug);
  }
  const rows = posts.map((p) => {
    const viewCount = viewCounts[p.slug] || 0;
    const realClickCount = (lifetimeClicks.bySlug || {})[p.slug] || 0;
    const ctr = viewCount ? Math.round(realClickCount / viewCount * 1000) / 10 : 0;
    const isReview = p.type === "review";
    const typeBadge = isReview ? `<span class="mono" style="background:var(--amber);color:#3A2E2A;font-size:11px;padding:2px 8px;border-radius:100px;font-weight:700;">리뷰</span>` : `<span class="mono" style="background:var(--accent);color:#fff;font-size:11px;padding:2px 8px;border-radius:100px;font-weight:700;">비교</span>`;
    const isPendingT2v = pendingByField.videoTextToVideo.has(p.slug) && !p.videoTextToVideo;
    const isPendingI2v = pendingByField.videoImageToVideo.has(p.slug) && !p.videoImageToVideo;
    const videoBtn = /* @__PURE__ */ __name((label, mode, done, pending) => {
      if (done) return `<span class="mono" style="font-size:10px;color:var(--accent-text);">🎬 ${label} 완료</span>`;
      if (pending) return `<span class="mono" style="font-size:10px;color:var(--amber-text);">⏳ ${label} 생성중</span>`;
      return `<form method="POST" action="/admin/generate-video" style="margin:0;"><input type="hidden" name="slug" value="${p.slug}"><input type="hidden" name="mode" value="${mode}"><button type="submit" class="mono" style="font-size:10px;padding:3px 7px;">🎬 ${label}</button></form>`;
    }, "videoBtn");
    const videoCell = isReview ? `<div style="display:flex;flex-direction:column;gap:4px;">
      ${videoBtn("이미지→영상", "i2v", !!p.videoImageToVideo, isPendingI2v)}
      ${videoBtn("텍스트→영상", "t2v", !!p.videoTextToVideo, isPendingT2v)}
    </div>` : `<span class="mono" style="font-size:10px;color:var(--muted);">비교글은 미지원</span>`;
    return `<tr><td>${p.title}</td><td class="mono">${p.keyword}</td><td>${typeBadge}</td><td class="mono">${viewCount}</td><td class="mono">${realClickCount}</td><td class="mono">${ctr}%</td><td class="mono">${new Date(p.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td>${videoCell}</td><td><a href="/${p.slug}?preview=1" target="_blank">보기</a></td><td><form method="POST" action="/admin/delete" style="margin:0;"><input type="hidden" name="slug" value="${p.slug}"><button class="danger" type="submit">삭제</button></form></td></tr>`;
  });
  const rowsFirst = rows.slice(0, 3).join("");
  const rowsRest = rows.slice(3).join("");
  const postsTableHtml = rows.length
    ? `<div class="table-scroll"><table><thead><tr><th>제목</th><th>키워드</th><th>유형</th><th>조회수</th><th>클릭수</th><th>전환율</th><th>작성일</th><th>영상</th><th></th><th></th></tr></thead><tbody>${rowsFirst}</tbody><tbody id="posts-more-rows" style="display:none;">${rowsRest}</tbody></table></div>${rowsRest ? `<div class="mono" id="posts-more-toggle" onclick="document.getElementById('posts-more-rows').style.display='table-row-group';this.style.display='none';" style="cursor:pointer;font-size:13px;color:var(--muted);margin-top:8px;">▸ 나머지 ${rows.length - 3}건 더 보기</div>` : ""}`
    : '<table><tbody><tr><td>글이 없습니다.</td></tr></tbody></table>';
  const modelStatsRaw = await env.POSTS.get("model-stats");
  const modelStats = modelStatsRaw ? JSON.parse(modelStatsRaw) : {};
  const lastGenHistRaw = await safeKVGet(env, "cron:generate-history");
  const lastGenHist = lastGenHistRaw ? JSON.parse(lastGenHistRaw) : [];
  const lastGenRowsAll = lastGenHist.slice(0, 15).map((g) => {
    const statusCell = g.ok ? `<span class="mono" style="color:var(--accent-text);">✅ 성공</span>` : `<span class="mono" style="color:#c0392b;">❌ 실패</span>`;
    const detail = g.ok ? escapeHtml(g.title || g.slug || "") : escapeHtml(g.reason || "알 수 없는 오류");
    return `<tr><td class="mono" style="white-space:nowrap;">${escapeHtml(g.at || "")}</td><td>${statusCell}</td><td>${detail}</td></tr>`;
  });
  const lastGenRowsFirst = lastGenRowsAll.slice(0, 1).join("");
  const lastGenRowsRest = lastGenRowsAll.slice(1).join("");
  const lastGenBlock = lastGenHist.length ? `<div class="admin-card">
    <div class="admin-card-head"><div class="title">🕐 자동생성(2시간 크론) 최근 실행 이력</div></div>
    <div class="table-scroll"><table><thead><tr><th>시각</th><th>결과</th><th>내용</th></tr></thead><tbody>${lastGenRowsFirst}</tbody><tbody id="gen-hist-more-rows" style="display:none;">${lastGenRowsRest}</tbody></table></div>
    ${lastGenRowsRest ? `<div class="mono" id="gen-hist-more-toggle" onclick="document.getElementById('gen-hist-more-rows').style.display='table-row-group';this.style.display='none';" style="cursor:pointer;font-size:12px;color:var(--muted);margin-top:6px;">▸ 나머지 ${lastGenRowsAll.length - 1}건 더 보기</div>` : ""}
  </div>` : "";
  const modelStatsRows = Object.entries(modelStats)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([model, s]) => {
      const rate = s.count ? Math.round(s.needsReviewCount / s.count * 100) : 0;
      const lastUsed = s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
      const lastTitle = s.lastTitle ? escapeHtml(s.lastTitle.slice(0, 40)) : "-";
      return `<tr><td class="mono">${escapeHtml(model)}</td><td class="mono">${s.count}</td><td class="mono">${s.needsReviewCount}</td><td class="mono">${rate}%</td><td class="mono" style="white-space:nowrap;">${lastUsed}</td><td>${lastTitle}</td></tr>`;
    }).join("");
  const cerebrasOn = !!env.CEREBRAS_API_KEY;
  const groqOn = !!env.GROQ_API_KEY;
  const workersAiOn = !!env.AI;
  const modelEntries = Object.entries(modelStats).sort((a, b) => b[1].count - a[1].count);
  const topModel = modelEntries[0];
  const statusChip = (label, on) => `<span class="mono" style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:100px;font-size:12px;background:${on ? "var(--green)" : "var(--surface)"};color:${on ? "#0d3d2c" : "var(--muted)"};border:1px solid ${on ? "var(--green)" : "var(--border)"};">${on ? "🟢" : "⚪"} ${label} ${on ? "설정됨" : "미설정"}</span>`;
  const aiStatusBlock = `<div class="admin-card">
    <div class="admin-card-head"><div class="title">🤖 AI 모델 설정 상태</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      ${statusChip("Cerebras", cerebrasOn)}
      ${statusChip("Groq", groqOn)}
      ${statusChip("Workers AI(최후폴백)", workersAiOn)}
    </div>
    <div class="mono" style="font-size:13px;color:${topModel ? "var(--accent-text)" : "var(--muted)"};">
      ${topModel ? `현재 실제로 가장 많이 쓰이는 모델: <b>${escapeHtml(topModel[0])}</b> (누적 ${topModel[1].count}회 생성)` : "아직 생성 이력 없음 — 글을 하나 생성해보면 여기 모델명이 표시됩니다."}
    </div>
  </div>`;
  const modelStatsTable = modelStatsRows ? `<div class="admin-card"><div class="admin-card-head"><div class="title">🎯 모델별 1차품질 통계 (검수 필요율 낮을수록 좋음)</div></div><div class="table-scroll"><table><thead><tr><th>모델</th><th>생성횟수</th><th>검수필요</th><th>검수필요율</th><th>마지막 사용</th><th>마지막 제목</th></tr></thead><tbody>${modelStatsRows}</tbody></table></div></div>` : "";
  const lastGen0 = lastGenHist[0];
  const cronStatCls = lastGen0 ? (lastGen0.ok ? "ok" : "warn") : "";
  const cronStatText = lastGen0 ? (lastGen0.ok ? "성공" : "실패") : "-";
  const statStrip = `<div class="admin-stat-strip">
    <div class="admin-stat"><div class="num">${idx.length}</div><div class="label mono">총 발행 글</div></div>
    <div class="admin-stat ${cronStatCls}"><div class="num">${cronStatText}</div><div class="label mono">최근 크론 결과</div></div>
    <div class="admin-stat ${kvFallbackCount > 0 ? "warn" : "ok"}"><div class="num">${kvFallbackCount}</div><div class="label mono">KV 폴백 대기</div></div>
    <div class="admin-stat ${brokenLinks.length > 0 ? "warn" : "ok"}"><div class="num">${brokenLinks.length}</div><div class="label mono">끊긴 링크</div></div>
  </div>`;
  const topActions = `<div class="admin-actions">
    <form method="POST" action="/admin/generate"><input type="text" name="keyword" placeholder="키워드 (비우면 랜덤)" maxlength="50" class="mono"><button type="submit">지금 1건 생성</button></form>
    <form method="POST" action="/admin/generate"><input type="text" name="productName" placeholder="특정 상품명 (단일 리뷰 작성)" maxlength="50" class="mono" style="min-width:200px;"><button type="submit">상품 리뷰 작성</button></form>
    <form method="POST" action="/admin/generate-trending" style="margin:0;"><button type="submit" style="background:var(--amber);color:#3A2E2A;">🔥 베스트상품 랜덤 리뷰</button></form>
    <form method="POST" action="/admin/generate-from-url"><input type="url" name="coupangUrl" placeholder="쿠팡 상품 URL 붙여넣기" required class="mono" style="min-width:240px;"><button type="submit">🔗 URL로 리뷰 생성</button></form>
    <form id="ext-auto-generate-form" style="align-items:center;"><input type="url" id="ext-coupang-url" placeholder="쿠팡 상품 URL (확장 자동생성)" required class="mono" style="min-width:240px;"><button type="submit">🧩 확장으로 자동 생성</button><span id="ext-status" class="mono" style="font-size:12px;color:var(--muted);"></span></form>
  </div>`;
  const keywordCard = `<div class="admin-card">
    <div class="admin-card-head"><div class="mono" style="color:var(--accent-text);font-size:13px;">🟢 활성 키워드 · 쿠팡 베스트카테고리 실시간 반영 (지금 로테이션 중, 클릭시 즉시 발행)</div></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${activeButtons}</div>
    <details style="margin:0;"><summary class="mono" style="cursor:pointer;font-size:13px;color:var(--muted);">⚪ 고정 폴백 후보 ${waitingKeywords.length}개 (쿠팡 수집 실패시에만 사용, 클릭하면 지금 바로 발행도 가능 — 펼치려면 클릭)</summary><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">${waitingButtons}</div></details>
  </div>`;
  const postsCard = `<div class="admin-card"><div class="admin-card-head"><div class="title">📝 발행된 글 목록</div></div>${postsTableHtml}</div>`;
  const body = `${siteHeader()}<div class="wrap admin-shell">${msg ? `<div class="mono" style="padding:10px 14px;margin-bottom:16px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--amber-text);font-size:13px;word-break:break-all;">${escapeHtml(msg)}</div>` : ""}<div class="admin-topbar"><div><div class="eyebrow">Admin Console</div><h2>usb.kr 관리자 대시보드</h2></div></div>${statStrip}${topActions}${kvFallbackBlock}${brokenLinksBlock}${priorityUrlBlock}${priorityBlock}${keywordCard}${lastGenBlock}${aiStatusBlock}${modelStatsTable}${postsCard}</div>`;
  return new Response(page("관리자 - usb.kr", body, { noindex: true, showPrivacyNotice: false }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(renderAdminPage, "renderAdminPage");
async function handleTrendingGenerate(env) {
  const result = await generateTrendingReview(env);
  const msg = result?.ok ? `발행 완료: ${result.post.title}` : `생성 실패 — ${result?.reason || "알 수 없는 오류"}`;
  return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent(msg) } });
}
__name(handleTrendingGenerate, "handleTrendingGenerate");
function decodeHtmlEntities(str) {
  return str.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
async function scrapeCoupangProduct(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { ok: false, error: "URL 형식이 올바르지 않음" };
  }
  if (!/(^|\.)coupang\.com$/i.test(parsed.hostname)) {
    return { ok: false, error: "coupang.com 도메인 URL만 지원함" };
  }
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.coupang.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"'
  };
  async function tryFetch(targetUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const r = await fetch(targetUrl, { headers: browserHeaders, signal: controller.signal });
      return { r, error: null };
    } catch (e) {
      return { r: null, error: "페이지 요청 네트워크 오류: " + e.message };
    } finally {
      clearTimeout(timer);
    }
  }
  let { r: res, error: fetchErr } = await tryFetch(url);
  if (fetchErr) return { ok: false, error: fetchErr };
  if (!res.ok && parsed.hostname !== "m.coupang.com") {
    // www/기본 도메인이 막히면 모바일 페이지로 한 번 더 시도 (봇 차단 우회용)
    const mobileUrl = url.replace(parsed.hostname, "m.coupang.com");
    const retry = await tryFetch(mobileUrl);
    if (retry.r && retry.r.ok) res = retry.r;
  }
  if (!res.ok) {
    return { ok: false, error: `상품 페이지 요청 실패: HTTP ${res.status} (쿠팡 봇 차단으로 추정)` };
  }
  const html = await res.text();
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const priceMatch = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i) || html.match(/"salePrice"\s*:\s*"?(\d+)"?/) || html.match(/"finalPrice"\s*:\s*"?(\d+)"?/);
  const productName = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s*-\s*쿠팡!?$/i, "").trim() : null;
  const productImage = imageMatch ? imageMatch[1] : null;
  const productPrice = priceMatch ? parseInt(priceMatch[1].replace(/[^\d]/g, ""), 10) : null;
  if (!productName) {
    return { ok: false, error: "상품명을 페이지에서 찾지 못함(og:title 없음) — 로그인/캡차 페이지로 리다이렉트됐을 수 있음" };
  }
  const idMatch = parsed.pathname.match(/products\/(\d+)/);
  const productId = idMatch ? idMatch[1] : null;
  return { ok: true, product: { productName, productImage, productPrice, productUrl: url, productId } };
}
__name(scrapeCoupangProduct, "scrapeCoupangProduct");
async function generateProductReviewFromUrl(env, url) {
  const scraped = await scrapeCoupangProduct(url);
  if (!scraped.ok) return { ok: false, reason: scraped.error };
  const target = scraped.product;
  if (!target.productImage) return { ok: false, reason: "상품 이미지를 페이지에서 찾지 못함" };
  return await saveProductReviewPost(env, target, target.productName, false);
}
__name(generateProductReviewFromUrl, "generateProductReviewFromUrl");
async function handleGenerateFromUrl(request, env) {
  const form = await request.formData();
  const coupangUrl = (form.get("coupangUrl") || "").toString().trim();
  if (!coupangUrl) {
    return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent("쿠팡 URL을 입력하세요") } });
  }
  const result = await generateProductReviewFromUrl(env, coupangUrl);
  const msg = result?.ok ? `발행 완료: ${result.post.title}` : `생성 실패 — ${result?.reason || "알 수 없는 오류"}`;
  return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent(msg) } });
}
__name(handleGenerateFromUrl, "handleGenerateFromUrl");
async function handleGenerateFromExtension(request, env) {
  const extKey = request.headers.get("X-Ext-Key") || "";
  if (!env.EXTENSION_API_KEY || extKey !== env.EXTENSION_API_KEY) {
    return new Response(JSON.stringify({ ok: false, reason: "인증 실패 (X-Ext-Key 불일치)" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: "JSON 파싱 실패" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const { productName, productImage, productPrice, productUrl, affiliateUrl } = body || {};
  if (!productName || !productImage || !productUrl || !affiliateUrl) {
    return new Response(JSON.stringify({ ok: false, reason: "필수 필드 누락 (productName/productImage/productUrl/affiliateUrl)" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const target = {
    productName,
    productImage,
    productPrice: productPrice ? Number(productPrice) : null,
    productUrl,
    productId: (() => {
      const m = (() => {
        try {
          return new URL(productUrl).pathname;
        } catch (e) {
          return "";
        }
      })().match(/products\/(\d+)/);
      return m ? m[1] : null;
    })()
  };
  const result = await saveProductReviewPost(env, target, productName, false, affiliateUrl);
  return new Response(JSON.stringify(result?.ok ? { ok: true, title: result.post.title, slug: result.post.slug } : { ok: false, reason: result?.reason || "알 수 없는 오류" }), {
    status: result?.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleGenerateFromExtension, "handleGenerateFromExtension");
async function getPriorityKeywords(env) {
  try {
    const raw = await env.POSTS.get("priority-keywords");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
__name(getPriorityKeywords, "getPriorityKeywords");
async function savePriorityKeywords(env, list) {
  await safeKVPut(env, "priority-keywords", JSON.stringify(list.slice(0, 50)));
}
__name(savePriorityKeywords, "savePriorityKeywords");
async function handleAddPriorityKeyword(request, env) {
  const form = await request.formData();
  const kw = (form.get("priorityKeyword") || "").toString().trim();
  if (kw) {
    const list = await getPriorityKeywords(env);
    if (!list.includes(kw)) list.push(kw);
    await savePriorityKeywords(env, list);
  }
  return new Response(kw ? "ok" : "empty", { status: kw ? 200 : 400 });
}
__name(handleAddPriorityKeyword, "handleAddPriorityKeyword");
async function handleRemovePriorityKeyword(request, env) {
  const form = await request.formData();
  const kw = (form.get("priorityKeyword") || "").toString();
  const list = (await getPriorityKeywords(env)).filter((k) => k !== kw);
  await savePriorityKeywords(env, list);
  return new Response("ok", { status: 200 });
}
__name(handleRemovePriorityKeyword, "handleRemovePriorityKeyword");
async function handlePromotePriorityKeyword(request, env) {
  const form = await request.formData();
  const kw = (form.get("priorityKeyword") || "").toString();
  const list = await getPriorityKeywords(env);
  const filtered = list.filter((k) => k !== kw);
  if (filtered.length !== list.length) filtered.unshift(kw); // 목록에 있었을 때만 맨 앞으로 이동
  await savePriorityKeywords(env, filtered);
  return new Response("ok", { status: 200 });
}
__name(handlePromotePriorityKeyword, "handlePromotePriorityKeyword");
async function getPriorityUrls(env) {
  try {
    const raw = await env.POSTS.get("priority-urls");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
__name(getPriorityUrls, "getPriorityUrls");
async function savePriorityUrls(env, list) {
  await safeKVPut(env, "priority-urls", JSON.stringify(list.slice(0, 50)));
}
__name(savePriorityUrls, "savePriorityUrls");
async function handleAddPriorityUrl(request, env) {
  const form = await request.formData();
  const u = (form.get("priorityUrl") || "").toString().trim();
  if (u) {
    const list = await getPriorityUrls(env);
    if (!list.includes(u)) list.push(u);
    await savePriorityUrls(env, list);
  }
  return new Response(u ? "ok" : "empty", { status: u ? 200 : 400 });
}
__name(handleAddPriorityUrl, "handleAddPriorityUrl");
async function handleRemovePriorityUrl(request, env) {
  const form = await request.formData();
  const u = (form.get("priorityUrl") || "").toString();
  const list = (await getPriorityUrls(env)).filter((x) => x !== u);
  await savePriorityUrls(env, list);
  return new Response("ok", { status: 200 });
}
__name(handleRemovePriorityUrl, "handleRemovePriorityUrl");
async function handlePromotePriorityUrl(request, env) {
  const form = await request.formData();
  const u = (form.get("priorityUrl") || "").toString();
  const list = await getPriorityUrls(env);
  const filtered = list.filter((x) => x !== u);
  if (filtered.length !== list.length) filtered.unshift(u);
  await savePriorityUrls(env, filtered);
  return new Response("ok", { status: 200 });
}
__name(handlePromotePriorityUrl, "handlePromotePriorityUrl");
async function handleManualGenerate(request, env) {
  const form = await request.formData();
  const customKeyword = (form.get("keyword") || "").toString().trim();
  const productName = (form.get("productName") || "").toString().trim();
  let result;
  if (productName) {
    await markProductAsUsed(productName, env);
    result = await generateProductReview(env, productName);
  } else {
    result = await generateAndSavePost(env, customKeyword || void 0);
  }
  const msg = result?.ok ? `발행 완료: ${result.post.title}` : `생성 실패 — ${result?.reason || "알 수 없는 오류"}`;
  return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent(msg) } });
}
__name(handleManualGenerate, "handleManualGenerate");
async function handleGenerateVideo(request, env) {
  const form = await request.formData();
  const slug = (form.get("slug") || "").toString();
  const mode = (form.get("mode") || "").toString();
  const raw = await safeKVGet(env, `post:${slug}`);
  if (!raw) {
    return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent("영상 생성 실패 — 글을 찾을 수 없음") } });
  }
  const post = JSON.parse(raw);
  if (post.type !== "review") {
    return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent("영상 생성 실패 — 비교글은 영상 제작을 지원하지 않음 (리뷰글만 가능)") } });
  }
  const firstProduct = post.products?.[0];
  if (!firstProduct) {
    return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent("영상 생성 실패 — 상품 이미지 없음") } });
  }
  let result;
  if (mode === "t2v") {
    result = await startVideoJob({ prompt: buildVideoPrompt(firstProduct.name, false), imageUrl: null, r2Key: `${slug}-t2v.mp4`, slug, field: "videoTextToVideo" }, env);
  } else {
    result = await startVideoJob({ prompt: buildVideoPrompt(firstProduct.name, true), imageUrl: firstProduct.image, r2Key: `${slug}-i2v.mp4`, slug, field: "videoImageToVideo" }, env);
  }
  if (!result.ok) {
    return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent("영상 생성 시작 실패 — " + result.error) } });
  }
  const modeLabel = mode === "t2v" ? "텍스트→영상" : "이미지→영상";
  const msg = `영상 생성 시작됨 (${modeLabel}) — 5분마다 자동 확인해서 완료되면 저장됩니다. (${slug})`;
  return new Response(null, { status: 302, headers: { Location: "/admin?msg=" + encodeURIComponent(msg) } });
}
__name(handleGenerateVideo, "handleGenerateVideo");
async function handleDelete(request, env) {
  const form = await request.formData();
  const slug = form.get("slug");
  try {
    await env.POSTS.delete(`post:${slug}`);
    const idxRaw = await env.POSTS.get("index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    await safeKVPut(env, "index", JSON.stringify(idx.filter((s) => s !== slug)));
  } catch (e) {
    console.log(`[handleDelete 실패] ${slug}: ${e.message}`);
  }
  return new Response(null, { status: 302, headers: { Location: "/admin" } });
}
__name(handleDelete, "handleDelete");

export {
  worker_default as default
};
