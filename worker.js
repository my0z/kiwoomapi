/**
 * 키움 REST API 기반 5~15% 상승 종목 스크리너
 * - cron으로 키움 ka10027(전일대비등락률상위요청)을 호출해 KOSPI/KOSDAQ 5~15% 구간 종목을 D1에 저장
 * - / 로 접속하면 대시보드 표시 (최상단: 5연속/3연속 상승, 그 아래: 직전 대비 TOP5, 전체 목록)
 * - 예전엔 네이버 금융 페이지를 스크래핑했으나, 네이버가 Cloudflare 계열 IP를 차단하는 것으로
 *   보여 키움 REST API(시세조회 TR)로 전환함. 매수/매도 주문에 쓰던 앱키/시크릿을 그대로 재사용.
 *
 * 배포: GitHub 연동 (Cloudflare Workers Builds) 사용
 * - wrangler.toml 에 D1 바인딩 / cron 트리거가 정의되어 있음
 * - D1 스키마(snapshots 테이블)는 별도 schema.sql로 미리 생성해둘 것
 * - KIWOOM_APP_KEY / KIWOOM_APP_SECRET 시크릿 필요 (Cloudflare 대시보드에서 Secret으로 등록)
 *
 * Cron (UTC 기준, 평일 KST 09:01~15:15 커버):
 *   2분 간격으로 실행 (UTC 0-6시 범위, 실제 경계는 isMarketHoursKST()에서 처리)
 *   (키움 TR 초당1건 제한에는 여유있게 안 걸림. D1 무료플랜 일 5만건 쓰기 제한 감안한 값)
 * (코드 안에서도 09:01~15:15 KST가 아니면 스킵하므로 이중 안전장치)
 */

import { unzipSync } from "fflate";

const MIN_RATE = 5;
const MAX_RATE = 15;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 일반종목 필터 (ETF/ETN/인버스/레버리지 등 제외) ----------
const NON_STOCK_KEYWORD = /(ETN|ETF|인버스|레버리지|선물|커버드콜|합성|파생결합|TDF|액티브|스팩|리츠|맥쿼리인프라)/i;
const ETF_BRAND_PREFIX =
  /^(KODEX|TIGER|KBSTAR|KIWOOM|ACE|SOL|RISE|PLUS|HANARO|KOSEF|KINDEX|TIMEFOLIO|마이다스|파워|WOORI|히어로즈|신한|대신|KTOP|FOCUS|네비게이터|파빌리온|우리|코세프|VITA|1Q|삼성|미래에셋|한투|마이티|WON|IBK|메리츠)\s?[0-9A-Za-z가-힣]*(200|100|150|300|배당|채권|국고채|MSCI|합성)/i;

function isRegularStock(name) {
  if (!name) return false;
  if (NON_STOCK_KEYWORD.test(name)) return false;
  if (ETF_BRAND_PREFIX.test(name)) return false;
  return true;
}

// ---------- 키움 REST API: 등락률 상위 조회 (ka10027) ----------
// mrktTp: "001"=코스피, "101"=코스닥
async function kiwoomRankingUp(env, token, mrktTp) {
  const res = await kiwoomRelayFetch(env, "/api/dostk/rkinfo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      authorization: `Bearer ${token}`,
      "cont-yn": "N",
      "next-key": "",
      "api-id": "ka10027", // 전일대비등락률상위요청
    },
    body: JSON.stringify({
      mrkt_tp: mrktTp,
      sort_tp: "1", // 1: 상승률
      trde_qty_cnd: "0000", // 거래량조건: 전체조회
      updown_incls: "1", // 상하한 포함
      stk_cnd: "0", // 종목조건: 전체조회
      crd_cnd: "0", // 신용조건: 전체조회
      pric_cnd: "0", // 가격조건: 전체조회
      trde_prica_cnd: "0", // 거래대금조건: 전체조회
      flu_cnd: "1", // 등락구분: 상승
      stex_tp: "3", // 거래소구분: 통합
    }),
  });
  const data = await res.json();
  if (!res.ok || data.return_code !== 0) {
    throw new Error(`ka10027 실패(mrkt_tp=${mrktTp}): ${JSON.stringify(data)}`);
  }
  return data;
}

// 응답에서 return_code/return_msg를 제외한 첫 배열 필드를 데이터로 간주 후 필드명 유연 매핑
function parseKiwoomRankingRows(json) {
  let rows = [];
  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) {
      rows = json[key];
      break;
    }
  }
  return rows
    .map((row) => {
      const code = (row.stk_cd || row.stk_no || "").split("_")[0];
      const name = row.stk_nm || row.stk_name || "";
      const price =
        Math.abs(parseInt(String(row.cur_prc ?? "0").replace(/[^\d-]/g, ""), 10)) || 0;
      const rate = parseFloat(row.flu_rt ?? row.updn_rt ?? "0") || 0;
      const volume =
        Math.abs(
          parseInt(String(row.now_trde_qty ?? row.trde_qty ?? "0").replace(/[^\d-]/g, ""), 10)
        ) || 0;
      const cntrStr = parseFloat(row.cntr_str ?? "0") || 0; // 체결강도 (100 초과: 매수세 우위)
      const buyReq =
        Math.abs(parseInt(String(row.buy_req ?? "0").replace(/[^\d-]/g, ""), 10)) || 0; // 매수잔량
      const selReq =
        Math.abs(parseInt(String(row.sel_req ?? "0").replace(/[^\d-]/g, ""), 10)) || 0; // 매도잔량
      return { code, name, price, rate, volume, cntrStr, buyReq, selReq };
    })
    .filter((r) => r.code);
}

async function fetchRiseListKiwoom(env, token, mrktTp, market) {
  const json = await kiwoomRankingUp(env, token, mrktTp);
  const rows = parseKiwoomRankingRows(json);
  return rows
    .filter((r) => r.rate >= MIN_RATE && r.rate <= MAX_RATE && isRegularStock(r.name))
    .map((r) => ({ ...r, market }));
}

// ---------- KST 시간 체크 ----------
function isMarketHoursKST(date) {
  const kst = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const day = kst.getDay(); // 0=Sun
  if (day === 0 || day === 6) return false;
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  return minutes >= 9 * 60 + 1 && minutes <= 15 * 60 + 46; // 09:01 ~ 15:46 (15:38~46은 놓친 종가 재시도용)
}

// 15:50 이후 전체 매매(신규 자동편입 + 익절/손절 자동삭제) 중지 - 데이터 조회/표시는 그대로 유지,
// 실제 매매 관련 로직만 이 시간 이후 멈춤. isMarketHoursKST와 별개로 매매 전용 게이트.
function isTradingActiveKST(date) {
  const kst = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const day = kst.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  return minutes >= 9 * 60 + 1 && minutes < 15 * 60 + 50; // 09:01 ~ 15:50 미만
}

// 장마감(15:30) 직후, 그 시점 화면에 떠 있던 종목들을 하나씩 정확하게 재조회해서
// 배치 수집(2분 간격이라 정각과 살짝 어긋날 수 있음)보다 정확한 최종 종가를 남김.
// ka10027(배치) 대신 종목별 ka10007(개별 시세)이라 초당1건 제한 때문에 종목당 1.1초 걸림.
// 관심종목이 ATR 기반 손절/익절 라인에 도달했는지 cron이 대신 체크해서 D1에 남김.
// 원래는 모달을 직접 열어야만 알 수 있었던 것 - watchlist_risk_status 테이블 필요(schema.sql 참고).
// 관심종목은 보통 소수(몇 개)라 종목당 1.1초 순차조회를 매 틱마다 해도 부담 적음.
// 관심종목이 손절 등으로 삭제되기 직전에 호출 - 삭제되면 watchlist에서 사라져 trackWatchlistPerformance가
// 더 이상 추적을 못 하게 되므로, 아직 기록 안 된 horizon(30/60분)에 대해 삭제 시점 가격을 "확정 결과"로 남겨둠.
// 그래야 performance-report가 "살아남은 것만" 좋게 보이는 왜곡(생존 편향) 없이 실제 승률을 반영함.
async function recordWatchlistExitPerformance(env, w, exitPrice, actualPnlPct) {
  try {
    for (const horizon of [30, 60]) {
      const already = await env.DB.prepare(
        `SELECT 1 FROM watchlist_performance WHERE code = ? AND added_at = ? AND horizon_min = ?`
      )
        .bind(w.code, w.added_at, horizon)
        .first()
        .catch(() => null);
      if (already) continue; // 이미 정상 경로로 기록됐으면 덮어쓰지 않음
      await env.DB.prepare(
        `INSERT OR REPLACE INTO watchlist_performance
         (code, name, added_at, horizon_min, entry_price, later_price, pnl_pct, source_board, added_state, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          w.code, w.name, w.added_at, horizon, w.entry_price, exitPrice,
          +actualPnlPct.toFixed(3), w.source_board || "", (w.added_state || "") + ",손절삭제", new Date().toISOString()
        )
        .run()
        .catch(() => {});
    }
  } catch (e) {
    // 기록 실패해도 삭제 자체는 진행 - 통계 누락보다 손절 지연이 더 나쁨
  }
}

async function checkWatchlistRiskLevels(env) {
  if (!isTradingActiveKST(new Date())) return { checked: 0, skipped: "15:50 이후 매매 중지" };
  const wlRes = await env.DB.prepare(`SELECT code, name, entry_price, added_at, source_board, added_state FROM watchlist`).all();
  const items = wlRes.results;
  if (!items.length) return { checked: 0 };

  const token = await kiwoomIssueToken(env);
  let checked = 0;
  const AUTO_REMOVE_PNL_PCT = -1.5; // 이 손익률 이하로 떨어지면 관심종목에서 자동 삭제 (손절)
  const AUTO_TAKE_PROFIT_PNL_PCT = 2.5; // 이 손익률 이상 오르면 관심종목에서 자동 삭제 (익절)
  for (const w of items) {
    try {
      // 일봉은 캐싱된 걸 우선 씀(10분 이내면 재조회 생략, 그 경우 대기도 안 함 - 캐시 함수 내부에서 처리)
      const ohlc = await getCachedDailyOHLC(env, token, w.code);
      const quoteRaw = await kiwoomQuote(env, token, w.code);
      const atr = computeATR(ohlc, 14);
      if (!atr) continue; // ATR 계산 불가 - 아래 finally에서 대기는 그대로 실행됨
      const quote = parseKiwoomQuote(quoteRaw);
      const stopLoss = Math.round(quote.price - atr * 1.5);
      const takeProfit = Math.round(quote.price + atr * 2);
      let status = "safe";
      if (quote.price <= stopLoss) status = "stop_loss_hit";
      else if (quote.price >= takeProfit) status = "take_profit_hit";

      // 손익률 -1.5% 이하(손절) 또는 +1.5% 이상(익절) - 관심종목에서 바로 제거 (risk_status도 같이 정리)
      if (w.entry_price && w.entry_price > 0) {
        const pnlPct = ((quote.price - w.entry_price) / w.entry_price) * 100;
        if (pnlPct <= AUTO_REMOVE_PNL_PCT || pnlPct >= AUTO_TAKE_PROFIT_PNL_PCT) {
          const reason = pnlPct >= AUTO_TAKE_PROFIT_PNL_PCT ? "익절" : "손절";
          // 삭제되면 watchlist에서 사라져서 trackWatchlistPerformance가 못 보게 됨 -
          // 확정 손익을 먼저 기록해둬야 성과 통계가 "살아남은 것만" 반영하는 왜곡을 피함
          await recordWatchlistExitPerformance(env, w, quote.price, pnlPct);
          await env.DB.prepare(`DELETE FROM watchlist WHERE code = ?`).bind(w.code).run();
          await env.DB.prepare(`DELETE FROM watchlist_risk_status WHERE code = ?`).bind(w.code).run();
          await logSystemEvent(env, "watchlist_auto_removed", `${w.name}(${w.code}) 손익률 ${pnlPct.toFixed(2)}% 자동삭제[${reason}] [cron]`);
          checked++;
          continue;
        }
      }

      await env.DB.prepare(
        `INSERT INTO watchlist_risk_status (code, status, price, stop_loss, take_profit, checked_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           status = excluded.status, price = excluded.price,
           stop_loss = excluded.stop_loss, take_profit = excluded.take_profit, checked_at = excluded.checked_at`
      )
        .bind(w.code, status, quote.price, stopLoss, takeProfit, new Date().toISOString())
        .run();
      checked++;
    } catch (e) {
      // 이 종목만 이번 틱에 실패, 다음 틱에 다시 시도됨
    } finally {
      await sleep(1100); // 키움 TR 초당1건 제한 - continue/에러로 건너뛰지 않도록 finally에 둠
    }
  }
  return { checked };
}

// 관심종목 성과 추적: 담은 시점 이후 30분/60분/장마감에 실제로 어떻게 됐는지 자동 기록.
// - 목적: source_board/added_state(어느 보드에서, 어떤 신호였는지)와 결과를 묶어서
//   "어떤 신호가 실제로 돈이 됐는지"를 감이 아니라 본인 데이터로 알 수 있게 하는 것
// - 추가 키움 조회 없음: 이미 수집된 snapshots에서 해당 시점 가격을 찾아 씀
//   (밴드 밖으로 나간 종목은 스냅샷이 없을 수 있어 null로 남고, 다음 틱에 다시 시도됨)
async function trackWatchlistPerformance(env) {
  const wlRes = await env.DB.prepare(
    `SELECT code, name, added_at, entry_price, source_board, added_state FROM watchlist WHERE entry_price > 0`
  ).all();
  const items = wlRes.results;
  if (!items.length) return { tracked: 0 };

  const now = Date.now();
  let tracked = 0;
  for (const w of items) {
    const addedMs = new Date(w.added_at).getTime();
    const elapsedMin = (now - addedMs) / 60000;

    for (const horizon of [30, 60]) {
      if (elapsedMin < horizon) continue; // 아직 그 시점에 도달 안 함
      const already = await env.DB.prepare(
        `SELECT 1 FROM watchlist_performance WHERE code = ? AND added_at = ? AND horizon_min = ?`
      )
        .bind(w.code, w.added_at, horizon)
        .first()
        .catch(() => null);
      if (already) continue; // 이미 기록됨

      // 담은 시점 + horizon분 근처의 스냅샷 가격을 찾음 (그 이후 첫 스냅샷)
      const targetIso = new Date(addedMs + horizon * 60000).toISOString();
      const row = await env.DB.prepare(
        `SELECT price, change_rate, captured_at FROM snapshots
         WHERE code = ? AND captured_at >= ? ORDER BY captured_at ASC LIMIT 1`
      )
        .bind(w.code, targetIso)
        .first()
        .catch(() => null);
      if (!row) continue; // 그 시점 데이터 아직 없음(또는 밴드 밖) - 다음 틱에 다시 시도

      const pnlPct = ((row.price - w.entry_price) / w.entry_price) * 100;
      await env.DB.prepare(
        `INSERT OR REPLACE INTO watchlist_performance
         (code, name, added_at, horizon_min, entry_price, later_price, pnl_pct, source_board, added_state, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          w.code, w.name, w.added_at, horizon, w.entry_price, row.price,
          +pnlPct.toFixed(3), w.source_board || "", w.added_state || "", new Date().toISOString()
        )
        .run()
        .catch(() => {});
      tracked++;
    }
  }
  return { tracked };
}

// 조용히 묻히던 수집 실패를 D1에 남겨서 나중에 확인 가능하게 함 (system_events 테이블 필요 - schema.sql 참고)
// 로깅 자체가 실패해도(테이블 없음 등) 전체 흐름을 막으면 안 되니 조용히 무시
async function logSystemEvent(env, kind, message) {
  try {
    await env.DB.prepare(`INSERT INTO system_events (kind, message, created_at) VALUES (?, ?, ?)`)
      .bind(kind, String(message).slice(0, 2000), new Date().toISOString())
      .run();
  } catch (e) {
    // 로깅 실패는 무시 (system_events 테이블이 아직 없을 수 있음)
  }
}

// ---------- Cron: 저장 ----------
async function collectAndStore(env) {
  const now = new Date();
  const capturedAt = now.toISOString();

  const token = await kiwoomIssueToken(env);
  const kospi = await fetchRiseListKiwoom(env, token, "001", "KOSPI");
  await sleep(1100); // ka10027은 초당 1건 제한 -> 여유있게 1.1초 대기
  const kosdaq = await fetchRiseListKiwoom(env, token, "101", "KOSDAQ");
  const all = [...kospi, ...kosdaq];
  if (all.length === 0) return { saved: 0 };

  const stmt = env.DB.prepare(
    `INSERT INTO snapshots (code, name, price, change_rate, volume, market, captured_at, cntr_str, buy_req, sel_req)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const batch = all.map((s) =>
    stmt.bind(
      s.code, s.name, s.price, s.rate, s.volume, s.market, capturedAt,
      s.cntrStr, s.buyReq, s.selReq
    )
  );
  await env.DB.batch(batch);

  const deleted = await purgeOldRows(env);
  return { saved: all.length, capturedAt, deleted };
}

// 7일 지난 데이터 삭제
async function purgeOldRows(env) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    `DELETE FROM snapshots WHERE captured_at < ?`
  )
    .bind(cutoff)
    .run();

  // 새로 추가된 캐시/로그 테이블들도 같이 정리 (없어도 에러 없이 넘어가게 각각 try)
  // pattern_scan_cache/latest_extras_cache는 특정 틱 하나만을 위한 임시 캐시라 하루만 지나도 무의미해서 더 짧게(2일) 지움
  const shortCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`DELETE FROM pattern_scan_cache WHERE captured_at < ?`).bind(shortCutoff).run().catch(() => {});
  await env.DB.prepare(`DELETE FROM latest_extras_cache WHERE captured_at < ?`).bind(shortCutoff).run().catch(() => {});
  // market_index_cache는 30초마다 행이 생기므로 더 짧게(6시간) 정리
  const indexCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`DELETE FROM market_index_cache WHERE captured_at < ?`).bind(indexCutoff).run().catch(() => {});
  // signal_backtest_history는 하루 1행이라 부담 적지만, 60일 넘은 건 정리
  const historyCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await env.DB.prepare(`DELETE FROM signal_backtest_history WHERE date < ?`).bind(historyCutoff).run().catch(() => {});
  // daily_ohlc_cache도 하루 지나면 무의미 (다음날은 또 새 일봉이라 어차피 재조회됨)
  await env.DB.prepare(`DELETE FROM daily_ohlc_cache WHERE updated_at < ?`).bind(shortCutoff).run().catch(() => {});
  // watchlist_fine_snapshots는 30초마다 쌓여서 금방 커짐 - 2일만 유지
  const fineCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`DELETE FROM watchlist_fine_snapshots WHERE captured_at < ?`).bind(fineCutoff).run().catch(() => {});
  await env.DB.prepare(`DELETE FROM system_events WHERE created_at < ?`).bind(cutoff).run().catch(() => {});

  return result.meta?.changes ?? 0;
}

// N번 연속 상승 종목 계산 (times[0]이 최신). requiredUps번의 구간이 전부 상승이어야 함
function computeStreak(times, snapByTime, requiredUps) {
  if (times.length < requiredUps + 1) return [];
  const result = [];
  for (const code of snapByTime[times[0]].keys()) {
    const rows = [];
    let ok = true;
    for (let i = 0; i <= requiredUps; i++) {
      const row = snapByTime[times[i]]?.get(code);
      if (!row) { ok = false; break; }
      rows.push(row);
    }
    if (!ok) continue;

    let allUp = true;
    for (let i = 0; i < requiredUps; i++) {
      if (rows[i].change_rate <= rows[i + 1].change_rate) { allUp = false; break; }
    }
    if (allUp) {
      result.push({ ...rows[0], totalGain: rows[0].change_rate - rows[requiredUps].change_rate });
    }
  }
  result.sort((a, b) => b.totalGain - a.totalGain);
  return result;
}

// ---------- API: 최신 스냅샷 + 상승 TOP5 + 3/5연속 상승 ----------
async function getLatest(env) {
  const timesRes = await env.DB.prepare(
    `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT 6`
  ).all();
  const times = timesRes.results.map((r) => r.captured_at);
  if (times.length === 0) {
    return { latest: [], risingTop5: [], streak3: [], streak5: [], pullbackCandidates: [], capturedAt: null };
  }

  // 아래 쿼리들은 서로 독립적이라 순차 대기 없이 한 번에 병렬 실행
  const [latestRes, prevRes, snapRows] = await Promise.all([
    env.DB.prepare(`SELECT * FROM snapshots WHERE captured_at = ? ORDER BY change_rate DESC`)
      .bind(times[0])
      .all(),
    times.length > 1
      ? env.DB.prepare(`SELECT code, change_rate FROM snapshots WHERE captured_at = ?`).bind(times[1]).all()
      : Promise.resolve({ results: [] }),
    Promise.all(
      times.map((t) =>
        env.DB.prepare(
          `SELECT code, name, price, change_rate, volume, cntr_str, buy_req, sel_req FROM snapshots WHERE captured_at = ?`
        )
          .bind(t)
          .all()
      )
    ),
  ]);

  const latest = latestRes.results;

  // 3연속/5연속 상승 계산에 필요한 스냅샷 (위에서 이미 병렬로 받아온 결과 매핑만)
  const snapByTime = {};
  times.forEach((t, i) => {
    snapByTime[t] = new Map(snapRows[i].results.map((row) => [row.code, row]));
  });

  // 최근 5틱(수집주기 2분이라 실제로는 대략 2/4/6/8/10분전) 구간별 등락률 변화
  // - "N분전 delta"는 그 구간 자체(N분전~(N-2)분전)의 변화량. "지금까지 누적"이 아님 -
  //   누적으로 하면 계속 오르는 종목은 기간이 긴 쪽(10분전) 숫자가 항상 더 커 보여서
  //   실제 그래프 기울기(최근이 더 가팔랐는지)와 반대로 보이는 착시가 생김
  // - 추가 조회 없이 위에서 받아온 snapByTime 재사용, TOP20/전체목록/연속상승/TOP5 전부 공유
  const now = new Date(times[0]);
  const momentumMap = new Map();
  for (const [code] of snapByTime[times[0]]) {
    const momentum = [];
    for (let i = 1; i < times.length; i++) {
      const curRow = snapByTime[times[i - 1]]?.get(code); // 이 구간의 최신쪽 끝
      const prevRow = snapByTime[times[i]]?.get(code); // 이 구간의 과거쪽 끝
      if (!curRow || !prevRow) break; // 그 시점에 없던 종목(리스트 진입 전)이면 더 과거는 의미 없으니 중단
      const minutesAgo = Math.round((now - new Date(times[i])) / 60000);
      momentum.push({ minutesAgo, delta: curRow.change_rate - prevRow.change_rate });
    }
    momentumMap.set(code, momentum);
  }
  const withMomentum = (r) => ({ ...r, momentum: momentumMap.get(r.code) || [] });

  // ---------- 추가 지표들 (전부 이미 있는 snapshots 데이터로만 계산 - 추가 키움 조회 없음) ----------
  // 이 계산(당일 종목별 최고치, 3일간 반복출현)은 하루치 데이터를 GROUP BY로 훑어야 해서 꽤 무거움.
  // 화면이 10초마다 /api/latest를 다시 부르므로, 같은 틱(captured_at)에서는 재계산 없이 캐시 재사용.
  const todayPrefix = times[0].slice(0, 10); // YYYY-MM-DD (KST 장중은 항상 같은 UTC 날짜라 안전)
  let todayMaxMap, repeatMap;
  const extrasCached = await env.DB.prepare(`SELECT today_max_json, repeat_json FROM latest_extras_cache WHERE captured_at = ?`)
    .bind(times[0])
    .first()
    .catch(() => null); // latest_extras_cache 테이블이 아직 없어도(마이그레이션 전) 매번 계산으로 자연스럽게 폴백
  if (extrasCached) {
    todayMaxMap = new Map(JSON.parse(extrasCached.today_max_json));
    repeatMap = new Map(JSON.parse(extrasCached.repeat_json));
  } else {
    const threeDaysAgoIso = new Date(new Date(times[0]).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const [todayMaxRes, repeatRes] = await Promise.all([
      // 당일 종목별 등락률 최고치 - 지금이 그 최고치를 찍고 있는 중인지(신고가 경신) 판단용
      // LIKE 프리픽스매칭은 인덱스를 못 타서 전체 스캔이 됨(D1 read 폭증의 원인이었음) - range 비교로 변경
      env.DB.prepare(`SELECT code, MAX(change_rate) AS maxRate FROM snapshots WHERE captured_at >= ? AND captured_at < ? GROUP BY code`)
        .bind(todayPrefix, todayPrefix + "\uFFFF")
        .all(),
      // 최근 3일간 이 종목이 급등리스트(5%+)에 며칠 등장했는지 - 일회성 vs 지속 관심 구분용
      env.DB.prepare(
        `SELECT code, COUNT(DISTINCT substr(captured_at,1,10)) AS dayCount
         FROM snapshots WHERE captured_at >= ? AND change_rate >= 5 GROUP BY code`
      )
        .bind(threeDaysAgoIso)
        .all(),
    ]);
    todayMaxMap = new Map(todayMaxRes.results.map((r) => [r.code, r.maxRate]));
    repeatMap = new Map(repeatRes.results.map((r) => [r.code, r.dayCount]));
    await env.DB.prepare(
      `INSERT OR REPLACE INTO latest_extras_cache (captured_at, today_max_json, repeat_json, created_at) VALUES (?, ?, ?, ?)`
    )
      .bind(
        times[0],
        JSON.stringify([...todayMaxMap]),
        JSON.stringify([...repeatMap]),
        new Date().toISOString()
      )
      .run()
      .catch(() => {}); // 캐시 저장 실패해도(테이블 없음 등) 이번 요청 자체는 정상 진행
  }
  const avgRateNow = latest.length ? latest.reduce((s, r) => s + r.change_rate, 0) / latest.length : 0;

  const withExtras = (r) => {
    const withMom = withMomentum(r);
    const prevRow = snapByTime[times[1]]?.get(r.code); // 직전 틱(약 2분전) - 거래량/체결강도/호가잔량 비교용
    const volumeSpikeRatio = prevRow && prevRow.volume > 0 ? r.volume / prevRow.volume : null;
    const todayMaxRate = todayMaxMap.get(r.code) ?? r.change_rate;

    // 15:36 마감 정밀조회(relay의 runFinalQuoteReconcile)는 가격/등락률/거래량만 받고 체결강도·매수잔량·매도잔량은
    // 항상 0으로 저장함(ka10007 개별조회라 그 필드들을 안 받아옴). 그 틱이 "지금"이나 "직전"으로 잡히면
    // 수급기반 배지가 전부 오판됨(매도잔량이 실제값->0으로 "급감"한 걸로 잘못 계산됨) - 그래서 셋 다 0인 틱은 걸러냄.
    const isPlaceholderRow = (row) => !row || (row.cntr_str === 0 && row.buy_req === 0 && row.sel_req === 0);
    const hasOrderFlowData = !isPlaceholderRow(r) && !isPlaceholderRow(prevRow);

    // 매수전환: 직전엔 매도잔량이 더 많았는데 지금 막 매수잔량 우위로 뒤집힌 것 - 초반 반전 신호
    const bidTurnedPositive = !!(
      hasOrderFlowData &&
      (r.buy_req || 0) > (r.sel_req || 0) &&
      (prevRow.buy_req || 0) <= (prevRow.sel_req || 0)
    );
    // 체결강도개선: 직전 틱보다 지금 체결강도가 더 세짐 - 매수 압력이 커지는 중이라는 신호
    const cntrStrRising = !!(hasOrderFlowData && (r.cntr_str || 0) > (prevRow.cntr_str || 0));
    // 매수잔량급증: 직전 틱 대비 매수잔량이 1.5배 이상 - 매수 대기 물량이 갑자기 쌓이는 중
    const buyReqSpike = !!(hasOrderFlowData && prevRow.buy_req > 0 && (r.buy_req || 0) / prevRow.buy_req >= 1.5);
    // 매도잔량급감: 직전 틱 대비 매도잔량이 절반 이하로 줄어듦 - 매도 대기 물량이 빠지는 중.
    // 매수전환/매수잔량급증과 같은 "새로 유입되는 수급 변화" 계열 신호(백테스트에서 이 계열만 효과 확인됨) - 아직 자체 백테스트는 안 함
    const sellReqThinning = !!(hasOrderFlowData && prevRow.sel_req > 0 && (r.sel_req || 0) / prevRow.sel_req <= 0.5);
    // 신규진입: 직전 틱엔 이 종목이 5~15% 밴드에 없었음 - 방금 막 새로 터진 종목
    const freshEntry = withMom.momentum.length === 0;

    return {
      ...withMom,
      volumeSpikeRatio, // 2 이상이면 직전 틱 대비 거래량 2배 이상 튄 것
      isTodayHigh: r.change_rate >= todayMaxRate - 0.001, // 오늘 등락률 최고치를 지금 찍고 있는 중
      todayMaxRate,
      repeatDays: repeatMap.get(r.code) || 1, // 최근 3일간 급등리스트 등장 일수
      relativeStrength: +(r.change_rate - avgRateNow).toFixed(2), // 지금 틱 전체 평균 대비 상대강도
      bidTurnedPositive,
      cntrStrRising,
      buyReqSpike,
      sellReqThinning,
      freshEntry,
    };
  };

  let risingTop5 = [];
  if (times.length > 1) {
    const prevMap = new Map(prevRes.results.map((r) => [r.code, r.change_rate]));
    risingTop5 = latest
      .filter((r) => prevMap.has(r.code))
      .map((r) => ({ ...withExtras(r), delta: r.change_rate - prevMap.get(r.code) }))
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);
  }

  const streak3 = computeStreak(times, snapByTime, 3).map(withExtras);
  const streak5 = computeStreak(times, snapByTime, 5).map(withExtras);
  const latestWithMomentum = latest.map(withExtras);

  // 눌림목 후보: 오늘 고점 대비 1~4%p 밀렸다가, 최근 구간(2분전) momentum이 다시 양전환된 종목
  // (상승 후 잠깐 쉬고 재상승 시도하는 지점 - 무작정 고점 추격매수보다 나은 진입 타이밍 후보)
  const pullbackCandidates = latestWithMomentum
    .filter((r) => {
      const pullback = r.todayMaxRate - r.change_rate;
      const recentMomentum = r.momentum[0]?.delta; // 가장 최근 구간(2분전)
      return pullback >= 1 && pullback <= 4 && recentMomentum !== undefined && recentMomentum > 0;
    })
    .map((r) => ({ ...r, pullbackPct: +(r.todayMaxRate - r.change_rate).toFixed(2) }))
    .sort((a, b) => (b.momentum[0]?.delta || 0) - (a.momentum[0]?.delta || 0))
    .slice(0, 10);

  return {
    latest: latestWithMomentum,
    risingTop5,
    streak3,
    streak5,
    pullbackCandidates,
    capturedAt: times[0],
  };
}

// ---------- 클라이언트 JS (/app.js로 서빙, HTML과 분리해서 diff/유지보수 쉽게) ----------
function clientScript() {
  return `
function fmt(n){ return Number(n).toLocaleString(); }

// ---------- 종목 클릭 모달 ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalName = document.getElementById('modalName');

// 종목명 탭하면 키움 앱 실행 (heromts://heromtshost는 APK 매니페스트에서 직접 확인한 실제 등록 스킴)
// 종목코드로 특정 화면 이동은 안 됨(과거에 후보 URL들 실기기 테스트로 확인됨) - 앱만 켜짐
const KIWOOM_SCHEME_URL = 'heromts://heromtshost';
function openKiwoomApp() {
  window.location.href = KIWOOM_SCHEME_URL;
}
modalName.style.cursor = 'pointer';
modalName.addEventListener('click', openKiwoomApp);

const modalPrice = document.getElementById('modalPrice');
const modalRate = document.getElementById('modalRate');
const modalDetail = document.getElementById('modalDetail');
const modalCodeBadge = document.getElementById('modalCodeBadge');
const periodRow = document.getElementById('periodRow');
const modalPriceBtn = document.getElementById('modalPriceBtn');
const modalRiskBtn = document.getElementById('modalRiskBtn');
const modalAiBtn = document.getElementById('modalAiBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
let currentModalCode = null;
let currentModalName = null;
let currentModalSourceBoard = ''; // 모달을 어느 보드에서 열었는지 - 관심종목 추가 시 기록용
let currentModalAddedState = ''; // 모달 열 때의 배지 상태 - 관심종목 추가 시 기록용
let currentModalPeriod = '5';
let currentModalView = 'chart'; // 'chart' | 'quote' - 자동갱신이 어느 화면을 새로고침할지
let chartRefreshTimer = null;
const CHART_REFRESH_MS = 3000; // 3초마다 자동 갱신 (ka10079~83 / ka10007, TR당 초당1건 제한에 여유있게 준수)

function openStockModal(item) {
  // 모달 뜨기 전에 종목코드부터 클립보드로 복사
  if (navigator.clipboard) {
    navigator.clipboard.writeText(item.code).catch(() => {});
  }
  currentModalName = item.name;
  currentModalCode = item.code;
  currentModalPeriod = '1';
  currentModalView = 'chart';
  modalName.textContent = item.name;
  modalCodeBadge.textContent = item.code + ' (복사됨)';
  modalPrice.textContent = fmt(item.price) + '원';
  const modalRateVal = Number(item.rate) || 0;
  modalRate.textContent = (modalRateVal >= 0 ? '+' : '') + modalRateVal.toFixed(2) + '%';
  modalRate.classList.toggle('up', modalRateVal >= 0);
  modalRate.classList.toggle('down', modalRateVal < 0);
  renderOrderBook(item.buyReq, item.selReq);
  renderNewsLinks(item.name, item.code);
  periodRow.querySelectorAll('.periodBtn').forEach(b => b.classList.toggle('active', b.dataset.period === '1'));
  modalPriceBtn.onclick = () => { currentModalView = 'quote'; showQuote(item.code); };
  modalRiskBtn.onclick = () => { currentModalView = 'risk'; showRiskLevels(item.code); };
  modalAiBtn.onclick = () => { currentModalView = 'ai'; showAiAnalysis(item); };
  updateStarButton(item.code, item.name, item.price);
  modalOverlay.classList.add('open');
  setHeavyButtonsDisabled(true);
  chartFullPrices = []; chartWindowSize = 0; chartOffsetFromEnd = 0;
  showChart(item.code, '1');
  startChartAutoRefresh();
  if (!history.state || !history.state.modalOpen) {
    history.pushState({ modalOpen: true }, ''); // 모바일 뒤로가기 버튼으로 모달만 닫히게 하기 위한 히스토리 항목
  }
}

function setHeavyButtonsDisabled(disabled) {
  const patternBtn = document.getElementById('patternScanBtn');
  if (patternBtn) patternBtn.disabled = disabled;
}

// ---------- 실시간 WebSocket 관련 코드는 제거됨 ----------
// Cloudflare Workers의 fetch()/WebSocket 아웃바운드 연결이 비표준 포트(10000)를
// 프로덕션에서 지원하지 않아(80/443만 허용) 구현이 불가능하다고 확인됨.
// 3초 폴링(startChartAutoRefresh)만으로 갱신함.
periodRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.periodBtn');
  if (!btn || !currentModalCode) return;
  periodRow.querySelectorAll('.periodBtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentModalPeriod = btn.dataset.period;
  currentModalView = 'chart';
  chartFullPrices = []; chartWindowSize = 0; chartOffsetFromEnd = 0;
  showChart(currentModalCode, currentModalPeriod);
  startChartAutoRefresh(); // 기간 바뀌면 갱신 타이머 리셋
});

// 모달 상단 가격/등락률 + 관심종목 리스트 캐시를 한 값으로 동기화 (모달이랑 리스트가 서로 다른 값 보여주는 것 방지)
function syncPriceEverywhere(code, price, rate) {
  if (currentModalCode === code) {
    modalPrice.textContent = fmt(price) + '원';
    const rateVal = Number(rate) || 0;
    modalRate.textContent = (rateVal >= 0 ? '+' : '') + rateVal.toFixed(2) + '%';
    modalRate.classList.toggle('up', rateVal >= 0);
    modalRate.classList.toggle('down', rateVal < 0);
  }
  liveQuoteCache[code] = { price, rate, fetchedAt: Date.now() };
  updateWatchlistPriceCells(code);
}

function refreshModalQuoteAndSync(code) {
  fetch('/api/quote?code=' + code)
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return;
      syncPriceEverywhere(code, data.price, data.rate);
    })
    .catch(() => {});
}

function startChartAutoRefresh() {
  stopChartAutoRefresh();
  chartRefreshTimer = setInterval(() => {
    if (!currentModalCode || !modalOverlay.classList.contains('open')) {
      stopChartAutoRefresh();
      return;
    }
    if (document.hidden) return; // 탭이 백그라운드면 갱신 스킵 (불필요한 API 호출 방지)
    if (currentModalView === 'quote') {
      showQuote(currentModalCode, true); // 이 안에서 자체적으로 syncPriceEverywhere 호출함 (중복 조회 방지)
    } else {
      refreshModalQuoteAndSync(currentModalCode); // chart/risk 뷰는 별도로 상단 가격만 동기화
      if (currentModalView === 'chart') {
        showChart(currentModalCode, currentModalPeriod, true);
      }
    }
  }, CHART_REFRESH_MS);
}

function stopChartAutoRefresh() {
  if (chartRefreshTimer) {
    clearInterval(chartRefreshTimer);
    chartRefreshTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  // 다시 화면으로 돌아왔을 때, 모달이 열려있으면 현재 보고 있던 화면 기준으로 바로 한 번 최신화
  if (!document.hidden && currentModalCode && modalOverlay.classList.contains('open')) {
    if (currentModalView === 'quote') {
      showQuote(currentModalCode, true);
    } else if (currentModalView === 'chart') {
      showChart(currentModalCode, currentModalPeriod, true);
    }
  }
});

function closeStockModal() {
  modalOverlay.classList.remove('open');
  stopChartAutoRefresh();
  setHeavyButtonsDisabled(false);
}

function closeStockModalAndHistory() {
  closeStockModal();
  if (history.state && history.state.modalOpen) {
    history.back(); // 뒤로가기 버튼 눌렀을 때 엉뚱한 페이지로 안 가도록 히스토리 항목 정리
  }
}

window.addEventListener('popstate', () => {
  if (modalOverlay.classList.contains('open')) {
    closeStockModal(); // 모바일 뒤로가기 버튼으로 도착한 경우 - 히스토리는 이미 넘어갔으니 UI만 닫음
  }
});

modalCancelBtn.addEventListener('click', closeStockModalAndHistory);
document.getElementById('modalTopClose').addEventListener('click', closeStockModalAndHistory);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeStockModalAndHistory();
});

function renderOrderBook(buyReq, selReq) {
  const el = document.getElementById('modalOrderBook');
  const total = (buyReq || 0) + (selReq || 0);
  if (!total) { el.innerHTML = ''; return; }
  const buyPct = (buyReq / total * 100).toFixed(1);
  const sellPct = (100 - buyPct).toFixed(1);
  el.innerHTML =
    '<div class="orderBookBar">' +
      '<div class="orderBookBuy" style="width:' + buyPct + '%"></div>' +
      '<div class="orderBookSell" style="width:' + sellPct + '%"></div>' +
    '</div>' +
    '<div class="orderBookLabel">' +
      '<span class="buyLabel">매수잔량 ' + fmt(buyReq) + ' (' + buyPct + '%)</span>' +
      '<span class="sellLabel">매도잔량 ' + fmt(selReq) + ' (' + sellPct + '%)</span>' +
    '</div>';
}

function renderNewsLinks(name, code) {
  const el = document.getElementById('modalNewsLinks');
  const q = encodeURIComponent(name);
  const dartQ = encodeURIComponent(name + ' 공시 dart');
  el.innerHTML =
    '<a class="newsLink" href="https://search.naver.com/search.naver?where=news&query=' + q + '" target="_blank" rel="noopener">📰 뉴스 검색</a>' +
    '<a class="newsLink" href="https://search.naver.com/search.naver?query=' + dartQ + '" target="_blank" rel="noopener">📋 DART 공시</a>';

  const summaryEl = document.getElementById('modalNewsSummary');
  summaryEl.innerHTML = '<div class="detailLoading">뉴스 불러오는 중...</div>';
  fetch('/api/news?q=' + encodeURIComponent(name))
    .then(res => res.json())
    .then(data => {
      if (!data.ok || !data.items.length) {
        summaryEl.innerHTML = '';
        return;
      }
      summaryEl.innerHTML = data.items.map(item => {
        const tagClass = item.sentiment === '호재' ? 'sentimentUp' : item.sentiment === '악재' ? 'sentimentDown' : 'sentimentNeutral';
        const tagHtml = item.sentiment ? '<span class="sentimentTag ' + tagClass + '">' + item.sentiment + '</span>' : '';
        return '<a class="newsItem" href="' + item.link + '" target="_blank" rel="noopener">' +
          '<div class="newsItemTitle">' + tagHtml + ' ' + item.title + '</div>' +
          '<div class="newsItemDesc">' + item.description + '</div>' +
        '</a>';
      }).join('');
    })
    .catch(() => { summaryEl.innerHTML = ''; });

  const dartEl = document.getElementById('modalDartSummary');
  dartEl.innerHTML = '';
  fetch('/api/disclosures?code=' + code)
    .then(res => res.json())
    .then(data => {
      if (!data.ok || !data.items || !data.items.length) return;
      dartEl.innerHTML = data.items.map(item =>
        '<a class="newsItem dartItem" href="' + item.link + '" target="_blank" rel="noopener">' +
          '<div class="newsItemTitle">📋 ' + item.title + '</div>' +
          '<div class="newsItemDesc">' + item.date + '</div>' +
        '</a>'
      ).join('');
    })
    .catch(() => {});
}

function showAiAnalysis(item) {
  modalDetail.innerHTML = '<div class="detailLoading">🤖 AI가 뉴스·공시·시세 종합 분석 중... (몇 초 소요)</div>';
  fetch('/api/ai-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: item.code, name: item.name,
      cntrStr: item.cntrStr, buyReq: item.buyReq, selReq: item.selReq,
      signalChecks: item.signalChecks,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (!data.ok) {
        modalDetail.innerHTML = '<div class="detailError">분석 실패: ' + (data.error || '알 수 없는 오류') + '</div>';
        return;
      }
      modalDetail.innerHTML =
        '<div class="aiAnalysisCard">' + data.analysis + '</div>' +
        '<div class="aiAnalysisNote">⚠️ AI가 생성한 참고용 요약이며, 매매 추천이 아닙니다. 데이터 누락·오류 가능성 있음.</div>';
    })
    .catch(err => {
      modalDetail.innerHTML = '<div class="detailError">요청 오류: ' + err.message + '</div>';
    });
}

function showRiskLevels(code, silent) {
  if (!silent) modalDetail.innerHTML = '<div class="detailLoading">변동성(ATR) 계산 중...</div>';
  fetch('/api/risk-levels?code=' + code)
    .then(res => res.json())
    .then(data => {
      if (!data.ok) {
        if (!silent) modalDetail.innerHTML = '<div class="detailError">계산 실패: ' + (data.error || '알 수 없는 오류') + '</div>';
        return;
      }
      const riskPct = ((data.currentPrice - data.stopLoss) / data.currentPrice * 100).toFixed(2);
      const rewardPct = ((data.takeProfit - data.currentPrice) / data.currentPrice * 100).toFixed(2);
      let gcHtml = '';
      if (data.goldenCross) {
        const gc = data.goldenCross;
        const label = gc.justCrossed ? '🌟 골든크로스 발생 (5일선이 20일선 방금 돌파)'
          : gc.justCrossedDown ? '💀 데드크로스 발생 (5일선이 20일선 아래로)'
          : gc.isAligned ? '📈 정배열 (5일선 > 20일선)'
          : '📉 역배열 (5일선 < 20일선)';
        gcHtml =
          '<div class="gcCard ' + (gc.isAligned ? 'gcUp' : 'gcDown') + '">' +
          label +
          '<div class="gcDetail">5일선 ' + fmt(Math.round(gc.sma5)) + '원 · 20일선 ' + fmt(Math.round(gc.sma20)) + '원</div>' +
          '</div>';
      }
      modalDetail.innerHTML =
        '<div class="riskGrid">' +
        '<div>현재가<b>' + fmt(data.currentPrice) + '원</b></div>' +
        '<div>14일 ATR<b>' + fmt(Math.round(data.atr)) + '원</b></div>' +
        '<div class="stopLoss">손절 라인 (-' + riskPct + '%)<b>' + fmt(data.stopLoss) + '원</b></div>' +
        '<div class="takeProfit">익절 라인 (+' + rewardPct + '%)<b>' + fmt(data.takeProfit) + '원</b></div>' +
        '</div>' +
        gcHtml;
    })
    .catch(err => {
      if (!silent) modalDetail.innerHTML = '<div class="detailError">요청 오류: ' + err.message + '</div>';
    });
}

function showQuote(code, silent) {
  if (!silent) modalDetail.innerHTML = '<div class="detailLoading">불러오는 중...</div>';
  fetch('/api/quote?code=' + code)
    .then(res => res.json())
    .then(data => {
      if (!data.ok) {
        if (!silent) modalDetail.innerHTML = '<div class="detailError">조회 실패: ' + (data.error || '알 수 없는 오류') + '</div>';
        return;
      }
      syncPriceEverywhere(code, data.price, data.rate);
      const gapFromHigh = data.high ? (((data.price - data.high) / data.high) * 100) : 0;
      const now = new Date().toLocaleTimeString('ko-KR');
      const cntrStr = (byCodeMap[code] && byCodeMap[code].cntrStr) || 0;

      const warnings = [];
      if (gapFromHigh <= -3) warnings.push('고점 대비 ' + gapFromHigh.toFixed(2) + '% 밀림');
      if (cntrStr > 0 && cntrStr < 95) warnings.push('체결강도 매도세 전환(' + cntrStr.toFixed(1) + ')');
      if ((byCodeMap[code] && byCodeMap[code].selReq > byCodeMap[code].buyReq)) warnings.push('매도잔량 우위 전환');
      const sellWarningHtml = warnings.length
        ? '<div class="sellWarning">⚠️ 매도 고려 신호: ' + warnings.join(' · ') + '</div>'
        : '<div class="sellOk">✅ 특별한 매도 경고 신호 없음</div>';

      modalDetail.innerHTML =
        '<div class="detailGrid">' +
        '<div>현재가<b>' + fmt(data.price) + '원</b></div>' +
        '<div>등락률<b class="up">' + data.rate.toFixed(2) + '%</b></div>' +
        '<div>시가<b>' + fmt(data.open) + '원</b></div>' +
        '<div>고가<b>' + fmt(data.high) + '원</b></div>' +
        '<div>저가<b>' + fmt(data.low) + '원</b></div>' +
        '<div>거래량<b>' + fmt(data.volume) + '</b></div>' +
        '</div>' +
        '<div class="highGap">오늘 고점 대비 <b>' + gapFromHigh.toFixed(2) + '%</b></div>' +
        sellWarningHtml +
        '<div class="chartRange"><span class="liveDot">●</span> 실시간 · ' + now + '</div>';
    })
    .catch(err => {
      if (!silent) modalDetail.innerHTML = '<div class="detailError">조회 요청 오류: ' + err.message + '</div>';
    });
}

const PERIOD_LABEL = { 'T':'틱차트', '1':'1분봉', '5':'5분봉', '15':'15분봉', '30':'30분봉', 'D':'일봉', 'W':'주봉', 'M':'월봉' };

// ---------- 차트 확대/축소/드래그 (구간을 실제로 좁혀서 그 구간의 최고/최저로 y축을 다시 잡음) ----------
let chartFullPrices = [];       // 서버에서 받은 전체 가격 배열 (과거→최신 순)
let chartFullTimes = [];        // 가격과 짝을 이루는 시간 배열
let chartWindowSize = 0;        // 현재 화면에 보여줄 포인트 개수 (작을수록 확대된 상태)
let chartOffsetFromEnd = 0;     // 최신 시점 기준으로 몇 칸 뒤로 가있는지 (0 = 최신 시점이 오른쪽 끝)
let chartDragging = false, chartDragStartX = 0, chartDragStartOffset = 0;
let chartPinchStartDist = 0, chartPinchStartWindow = 0;
const CHART_MIN_WINDOW = 6; // 이보다 더 좁게는 확대 안 함 (최소 6개 포인트는 보여줌)

function resetChartZoom() {
  chartWindowSize = chartFullPrices.length;
  chartOffsetFromEnd = 0;
  renderCurrentWindow();
}

function clampChartWindow() {
  const total = chartFullPrices.length;
  chartWindowSize = Math.max(CHART_MIN_WINDOW, Math.min(total, Math.round(chartWindowSize)));
  const maxOffset = Math.max(0, total - chartWindowSize);
  chartOffsetFromEnd = Math.max(0, Math.min(maxOffset, Math.round(chartOffsetFromEnd)));
}

function getVisibleSlice() {
  const total = chartFullPrices.length;
  const end = total - chartOffsetFromEnd; // 잘라낼 구간의 끝(미포함)
  const start = Math.max(0, end - chartWindowSize);
  return {
    prices: chartFullPrices.slice(start, end),
    times: chartFullTimes.slice(start, end),
  };
}

function renderCurrentWindow() {
  if (!chartFullPrices.length) return;
  clampChartWindow();
  const slice = getVisibleSlice();
  updateChartDOM(slice.prices, slice.times, currentModalPeriod, chartWindowSize < chartFullPrices.length);
}

// 시간 문자열(YYYYMMDDHHMMSS 또는 YYYYMMDD)을 기간에 맞게 짧은 라벨로 변환
function formatChartTime(t, period) {
  if (!t) return '';
  if (period === 'D' || period === 'W' || period === 'M') {
    return t.length >= 8 ? t.slice(4, 6) + '/' + t.slice(6, 8) : t;
  }
  const hhmmss = t.length >= 14 ? t.slice(8, 14) : t;
  return hhmmss.length >= 4 ? hhmmss.slice(0, 2) + ':' + hhmmss.slice(2, 4) : t;
}


// 드래그/핀치 중에는 DOM을 통째로 갈아끼우지 않고 기존 svg의 좌표만 갱신
// (모바일 터치는 원래 터치한 요소가 사라지면 이후 touchmove가 안 들어옴 -> PC에서만 되던 버그의 원인)
function pickLabelIndices(len) {
  if (len <= 1) return [0, 0, 0];
  return [0, Math.floor((len - 1) / 2), len - 1];
}

function updateChartDOM(prices, times, period, isZoomed) {
  const existingWrap = modalDetail.querySelector('#chartWrap');
  if (!existingWrap) {
    // 최초 렌더(새 종목/기간/차트 첫 표시)일 때만 전체 새로 그림
    modalDetail.innerHTML = renderSparkline(prices, times, period, isZoomed);
    return;
  }

  const w = 340, h = 120, pad = 6;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = (max - min) || 1;
  const stepX = prices.length > 1 ? (w - pad * 2) / (prices.length - 1) : 0;
  const points = prices.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const up = prices[prices.length - 1] >= prices[0];

  const polyline = existingWrap.querySelector('polyline');
  if (polyline) {
    polyline.setAttribute('points', points);
    polyline.setAttribute('stroke', up ? '#ff6b6b' : '#4d9fff');
  }

  const timeLabelSpans = modalDetail.querySelectorAll('.chartTimeLabels span');
  if (timeLabelSpans.length === 3) {
    pickLabelIndices(times.length).forEach((idx, i) => {
      timeLabelSpans[i].textContent = formatChartTime(times[idx], period);
    });
  }

  const rangeDiv = modalDetail.querySelector('.chartRange');
  if (rangeDiv) {
    const now = new Date().toLocaleTimeString('ko-KR');
    rangeDiv.innerHTML = fmt(min) + '원 ~ ' + fmt(max) + '원 (' + (PERIOD_LABEL[period] || period) +
      (isZoomed ? ' · ' + prices.length + '개 구간 확대중' : '') + ')' +
      ' <span class="liveDot">●</span> 실시간 · ' + now +
      (isZoomed ? ' · <span class="chartResetBtn" id="chartResetBtn">전체보기</span>' : '');
  }
}


function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

modalDetail.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#chartWrap')) return;
  chartDragging = true;
  chartDragStartX = e.clientX;
  chartDragStartOffset = chartOffsetFromEnd;
});
modalDetail.addEventListener('pointermove', (e) => {
  if (!chartDragging || !chartFullPrices.length) return;
  const wrap = modalDetail.querySelector('#chartWrap');
  const widthPx = wrap ? wrap.clientWidth : 340;
  const deltaPx = e.clientX - chartDragStartX;
  const indicesPerPx = chartWindowSize / widthPx;
  // 오른쪽으로 드래그(과거를 보고 싶음) -> offset 증가
  chartOffsetFromEnd = chartDragStartOffset + Math.round(deltaPx * indicesPerPx);
  renderCurrentWindow();
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => {
  modalDetail.addEventListener(ev, () => { chartDragging = false; });
});

modalDetail.addEventListener('wheel', (e) => {
  if (!e.target.closest('#chartWrap') || !chartFullPrices.length) return;
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 0.85 : 1 / 0.85; // 위로 스크롤 = 확대(구간 축소)
  chartWindowSize = chartWindowSize * zoomFactor;
  renderCurrentWindow();
}, { passive: false });

modalDetail.addEventListener('touchstart', (e) => {
  if (!e.target.closest('#chartWrap')) return;
  if (e.touches.length === 2) {
    chartPinchStartDist = touchDist(e.touches);
    chartPinchStartWindow = chartWindowSize;
  }
}, { passive: true });
modalDetail.addEventListener('touchmove', (e) => {
  if (!e.target.closest('#chartWrap') || !chartFullPrices.length) return;
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = touchDist(e.touches);
    if (chartPinchStartDist > 0) {
      // 손가락을 벌릴수록(dist 커짐) 구간을 좁혀서(확대) 세밀하게 보여줌
      chartWindowSize = chartPinchStartWindow / (dist / chartPinchStartDist);
      renderCurrentWindow();
    }
  }
}, { passive: false });

modalDetail.addEventListener('dblclick', (e) => {
  if (!e.target.closest('#chartWrap')) return;
  resetChartZoom();
});

modalDetail.addEventListener('click', (e) => {
  if (e.target.id === 'chartResetBtn') resetChartZoom();
});

function showChart(code, period, silent) {
  if (!silent) modalDetail.innerHTML = '<div class="detailLoading">차트 불러오는 중...</div>';
  fetch('/api/chart?code=' + code + '&period=' + period)
    .then(res => res.json())
    .then(data => {
      if (!data.ok || !data.prices || data.prices.length < 2) {
        if (!silent) {
          modalDetail.innerHTML = '<div class="detailError">차트 데이터 없음' + (data.error ? (': ' + data.error) : '') + '</div>';
        }
        return;
      }
      const wasFullView = chartWindowSize === 0 || chartWindowSize >= chartFullPrices.length;
      chartFullPrices = data.prices;
      chartFullTimes = data.times || [];
      if (!silent || wasFullView) {
        // 새로 열었거나 이전에 확대 안 한 상태였으면 항상 전체 보기 유지
        chartWindowSize = chartFullPrices.length;
        chartOffsetFromEnd = 0;
      }
      renderCurrentWindow();
    })
    .catch(err => {
      if (!silent) {
        modalDetail.innerHTML = '<div class="detailError">차트 요청 오류: ' + err.message + '</div>';
      }
    });
}

function renderSparkline(prices, times, period, isZoomed) {
  const w = 340, h = 120, pad = 6;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = (max - min) || 1;
  const stepX = prices.length > 1 ? (w - pad * 2) / (prices.length - 1) : 0;
  const points = prices.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? '#ff6b6b' : '#4d9fff';
  const now = new Date().toLocaleTimeString('ko-KR');
  const labelIdxs = pickLabelIndices(times.length);
  const timeLabelsHtml = '<div class="chartTimeLabels">' +
    labelIdxs.map(idx => '<span>' + formatChartTime(times[idx], period) + '</span>').join('') +
    '</div>';
  return '<div class="chartWrap" id="chartWrap">' +
    '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' +
    '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="1.5" vector-effect="non-scaling-stroke" />' +
    '</svg>' +
    '</div>' +
    timeLabelsHtml +
    '<div class="chartRange">' + fmt(min) + '원 ~ ' + fmt(max) + '원 (' + (PERIOD_LABEL[period] || period) +
    (isZoomed ? ' · ' + prices.length + '개 구간 확대중' : '') + ')' +
    ' <span class="liveDot">●</span> 실시간 · ' + now +
    (isZoomed ? ' · <span class="chartResetBtn" id="chartResetBtn">전체보기</span>' : '') + '</div>';
}

let latestList = [];
let byCodeMap = {};
let currentSort = 'momentum';

function computeMomentumScores(latest, streak3Codes, streak5Codes) {
  if (!latest.length) return;
  const rates = latest.map(r => r.change_rate);
  const cntrs = latest.map(r => r.cntr_str || 0);
  const vols = latest.map(r => Math.log((r.volume || 0) + 1));
  const norm = (v, min, max) => (max > min ? (v - min) / (max - min) : 0.5);
  const rMin = Math.min(...rates), rMax = Math.max(...rates);
  const cMin = Math.min(...cntrs), cMax = Math.max(...cntrs);
  const vMin = Math.min(...vols), vMax = Math.max(...vols);

  latest.forEach(r => {
    let score =
      norm(r.change_rate, rMin, rMax) * 0.25 +
      norm(r.cntr_str || 0, cMin, cMax) * 0.35 +
      norm(Math.log((r.volume || 0) + 1), vMin, vMax) * 0.20;
    if (streak3Codes.has(r.code)) score += 0.10;
    if (streak5Codes.has(r.code)) score += 0.15;
    r.momentumScore = score;
  });
}

// 신호 점수: 4개 조건 체크(검증된 전략 아님, 참고용 필터일 뿐)
// 1) 체결강도 105 이상  2) 매수잔량>매도잔량  3) 거래량 상위 30% 이내  4) 3연속 이상 상승중
// 지금까지 만든 지표(신호점수/종합점수/연속상승) + 저가 동전주 감점(작전주 위험, 나무위키 단타매매 기법)
// TOP20에서 쓰던 것과 똑같은 별표 마크업을 모든 리스트에서 공용으로 사용
function starHtml(item, boardLabel) {
  const active = watchlistCodes.has(item.code);
  const badgesText = activeBadgeLabels(item).join(',');
  return '<span class="topPickStar noRowClick ' + (active ? 'active' : '') +
    '" data-code="' + item.code + '" data-name="' + (item.name || '').replace(/"/g, '&quot;') +
    '" data-board="' + (boardLabel || '').replace(/"/g, '&quot;') +
    '" data-badges="' + badgesText.replace(/"/g, '&quot;') + '">' +
    (active ? '★' : '☆') + '</span> ';
}

function computeTopPicks(latest, streak5Codes) {
  return [...latest]
    .map(r => {
      let score = (r.signalScore || 0) * 10 + (r.momentumScore || 0) * 5 + (streak5Codes.has(r.code) ? 3 : 0);
      if ((r.price || 0) < 2000) score -= 3; // 천원대 동전주는 작전주/불안정 위험 높다고 알려짐
      return { ...r, topScore: score };
    })
    .sort((a, b) => b.topScore - a.topScore)
    .slice(0, 20);
}

// 추천 종목 TOP10: topScore(momentumScore+signalScore+연속상승)에 배지 신호(당일신고가/거래량급증/상대강도)를
// 더 얹은 것. 매매 추천이 아니라 이미 있는 지표들을 하나로 합친 알고리즘 정렬일 뿐 - UI에도 그렇게 명시함.
// 추천 종목 TOP10: "지금 얼마나 강해 보이나"가 아니라 "조회 시점 이후로도 이어질 가능성이 있나"를 봄.
// - 가장 최근 구간(momentum[0], 약 2분전)의 방향/속도를 최우선으로 봄 - 조회 순간 이후를 보려면
//   과거 누적보다 지금 이 순간의 방향이 훨씬 중요함
// - 가속 중(최근 구간이 예전 구간보다 빠름)이면 관성이 이어질 가능성으로 가점
// - 눌림목 재상승 패턴이면 이미 한 번 힘을 보여주고 쉬었다가 다시 도는 것이라 진입 근거가 더 명확 - 가장 크게 가점
// - 지금 이 순간 이미 꺾이고 있거나(recentDelta<0) 상한가 임박(위쪽 여력 없음)이면 확실히 감점/제외 성격
// 코스피/코스닥 둘 다 마이너스면 true - renderMarketIndexBar()가 채우고 추천점수 감점에 사용
// (computeRecommendations보다 먼저 선언되어야 TDZ 에러가 안 남)
let weakMarket = false;

function computeRecommendations(latest, pullbackCodes) {
  // 14:30 이후는 마감까지 시간이 짧아 물렸을 때 회복 기회가 부족 - 신규 진입 후보 점수를 전반적으로 낮춤
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const kstMinutes = kstNow.getHours() * 60 + kstNow.getMinutes();
  const isLateSession = kstMinutes >= 14 * 60 + 30;
  // 09:00~09:30은 나무위키 단타매매 기법 기준 가장 활발한 시간대(골든타임 배너와 동일 기준) -
  // 지금까지는 배너로 알려주기만 하고 정작 점수엔 반영을 안 하고 있었음
  const isGoldenTime = kstMinutes >= 9 * 60 && kstMinutes <= 9 * 60 + 30;

  return [...latest]
    .map(r => {
      const mom = r.momentum || [];
      const recentDelta = mom[0] ? mom[0].delta : 0; // 가장 최근 구간(2분전) - 지금 이 순간의 방향
      const olderDelta = mom.length ? mom[mom.length - 1].delta : recentDelta; // 가장 오래된 구간(약10분전)
      const accelerating = recentDelta > olderDelta; // 갈수록 빨라지는 중인지 (배지 표시용으로만 씀, 아래 참고)

      // ---- 2026-08-05 backtest-signals(ticks=300) 실측 기준 가중치 ----
      // (edgeVsBaseline: 그 신호가 있었을 때 다음 틱 평균 등락이 전체 평균보다 얼마나 높았는지)
      //   bidTurnedPositive +0.036(표본4630) / buyReqSpike +0.024(표본6409) -> 실제 효과 있음, 가중치 유지·상향
      //   accelerating -0.016(표본30207) / cntrStrRising -0.011(표본29817)
      //   isTodayHigh -0.064(표본9322) / pullbackLike -0.040(표본9235) -> 오히려 역효과라 가중치 제거
      //   volumeSpike는 표본 17개뿐이라(30 미만) 판단 보류, 기존 가중치 유지
      // 하루치 데이터라 확정은 아님 - ticks 늘려서 며칠 더 쌓인 뒤 재검증 필요.
      // 2026-08-06 performance-report: 추천종목TOP10 표본20 avgPnlPct -0.837%/승률45% - overall(50.9%)보다 계속 나쁨.
      // recentDelta*8은 백테스트 미검증 신호인데 가중치가 제일 커서(0.5%차이=4점) 검증된 수급신호를 압도하고 있었음.
      // recentDelta 비중 축소 + 검증된 수급신호(bidTurnedPositive/buyReqSpike) 비중 상향으로 균형 조정.
      let score = 0;
      score += recentDelta * 4; // 미검증 신호라 가중치 축소 (기존 8 -> 4)
      if (r.bidTurnedPositive) score += 5.5; // 실측 근거 있음 - 기존 4에서 상향
      if (r.buyReqSpike) score += 3.5; // 실측 근거 있음 - 기존 2.5에서 상향
      if (r.sellReqThinning) score += 1.5; // 매수잔량급증과 같은 계열(수급유입) 신호지만 이건 아직 자체 백테스트 전 - 신중하게 작게
      // 복합신호(강한매수세): 매수전환+매수잔량급증이 동시에 뜨면 개별 신호보다 훨씬 강한 확인 -
      // 둘 다 검증된 신호가 동시에 나타나는 거라 우연히 겹칠 확률이 낮고, 방향성 있는 진짜 수급일 가능성이 큼
      if (r.bidTurnedPositive && r.buyReqSpike) score += 2;
      // 거래량 동반 확인: 호가잔량 신호(매수전환/매수잔량급증)는 취소되는 허수주문에 흔들릴 수 있다는 게
      // 정석적인 주의사항 - 실제 체결거래량도 같이 튀는 경우만 "진짜 수급"으로 더 신뢰해서 추가 가점
      const volumeConfirmed = (r.bidTurnedPositive || r.buyReqSpike) && r.volumeSpikeRatio && r.volumeSpikeRatio >= 1.5;
      if (volumeConfirmed) score += 1.5;
      // 체결강도 절대수준: 100 넘는지(방향)뿐 아니라 얼마나 강한지도 봄 - 150 이상은 "강한 매수세 유입"이 통상적 해석 기준
      if ((r.cntr_str || 0) >= 150) score += 1.5;
      score += (r.relativeStrength || 0) * 0.5;
      if ((r.change_rate || 0) >= 28) score -= 5; // 상한가 임박 - 위쪽 여력 거의 없어서 "이후 상승여력" 신호로 부적합
      if ((r.price || 0) < 2000) score -= 3; // 동전주 위험
      // 거래대금 10억 미만은 슬리피지로 수익이 깎일 위험 - 진입 자체를 신중히
      if (typeof r.tradeValue === 'number' && r.tradeValue > 0 && r.tradeValue < 1000000000) score -= 2;
      if (recentDelta < 0) score -= 4; // 지금 이 순간 이미 꺾이는 중이면 감점
      if (isLateSession) score -= 2; // 오후 늦은 시각 - 마감까지 회복 시간이 부족
      if (isGoldenTime) score += 1.5; // 09:00~09:30 - 가장 활발한 시간대(골든타임 배너와 동일 기준)
      if (weakMarket) score -= 1.5; // 코스피/코스닥 동반 약세 - 급등주 신호 신뢰도 하락
      return { ...r, recoScore: score, accelerating, comboBuySignal: !!(r.bidTurnedPositive && r.buyReqSpike), volumeConfirmed: !!volumeConfirmed };
    })
    .sort((a, b) => b.recoScore - a.recoScore)
    .slice(0, 10);
}

function computeSignalScores(latest, streak3Codes, streak5Codes) {
  if (!latest.length) return;
  const volSorted = [...latest].map(r => r.volume || 0).sort((a, b) => b - a);
  const top30Cutoff = volSorted[Math.max(0, Math.floor(volSorted.length * 0.3) - 1)] || 0;
  const tradeValSorted = [...latest].map(r => (r.price || 0) * (r.volume || 0)).sort((a, b) => b - a);
  const tradeVal30Cutoff = tradeValSorted[Math.max(0, Math.floor(tradeValSorted.length * 0.3) - 1)] || 0;

  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const kstMinutes = kst.getHours() * 60 + kst.getMinutes();
  const isGoldenTime = kstMinutes >= 9 * 60 && kstMinutes <= 9 * 60 + 30;

  latest.forEach(r => {
    let n = 0;
    const checks = [];
    const tradeValue = (r.price || 0) * (r.volume || 0);
    if ((r.cntr_str || 0) >= 105) { n++; checks.push('체결강도 105+'); }
    if ((r.buy_req || 0) > (r.sel_req || 0)) { n++; checks.push('매수잔량 우위'); }
    if ((r.volume || 0) >= top30Cutoff) { n++; checks.push('거래량 상위30%'); }
    if (streak3Codes.has(r.code) || streak5Codes.has(r.code)) { n++; checks.push('연속상승 중'); }
    if (tradeValue >= tradeVal30Cutoff) { n++; checks.push('거래대금 상위30%'); }
    if (isGoldenTime) { n++; checks.push('골든타임(09:00~09:30) 중'); }
    r.signalScore = n;
    r.signalChecks = checks;
    r.tradeValue = tradeValue;
    r.lowPriceWarning = (r.price || 0) < 2000; // 감점 대신 별도 경고 표시(동전주 위험)
  });
}

// 테이블을 통째로 갈아엎지 않고, 바뀐 셀만 업데이트 + 신규/삭제 행만 추가/제거
// (기존 DOM 노드를 최대한 재사용해서 화면 깜빡임 없이 데이터만 바뀌게)
function patchTable(tbody, items, renderCells, emptyMessage, onRowClick) {
  onRowClick = onRowClick || (item => { const mapped = byCodeMap[item.code]; if (mapped) openStockModal(mapped); });
  if (!items.length) {
    if (tbody.children.length !== 1 || !tbody.querySelector('.empty')) {
      tbody.innerHTML = '<tr><td class="empty">' + emptyMessage + '</td></tr>';
    }
    return;
  }

  const existing = {};
  tbody.querySelectorAll('tr[data-code]').forEach(tr => { existing[tr.dataset.code] = tr; });
  // 빈 상태 플레이스홀더가 남아있으면 제거
  const placeholder = tbody.querySelector('td.empty');
  if (placeholder) placeholder.closest('tr').remove();

  let prevNode = null;
  items.forEach(item => {
    const cells = renderCells(item);
    let tr = existing[item.code];
    if (tr) {
      const tds = tr.children;
      cells.forEach((html, i) => {
        if (tds[i] && tds[i].innerHTML !== html) tds[i].innerHTML = html;
      });
      delete existing[item.code];
    } else {
      tr = document.createElement('tr');
      tr.className = 'clickable';
      tr.dataset.code = item.code;
      cells.forEach(html => {
        const td = document.createElement('td');
        td.innerHTML = html;
        tr.appendChild(td);
      });
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.noRowClick')) return;
        onRowClick(item);
      });
    }
    const wantedNext = prevNode ? prevNode.nextSibling : tbody.firstChild;
    if (wantedNext !== tr) tbody.insertBefore(tr, wantedNext);
    prevNode = tr;
  });

  Object.values(existing).forEach(tr => tr.remove());
}

// 거래량급증/당일신고가/상한가임박/반복출현/상대강도 배지 - 서버가 계산해준 값 그대로 표시만 함
function renderBadges(r) {
  const badges = [];
  if (r.volumeSpikeRatio && r.volumeSpikeRatio >= 2) {
    badges.push('<span class="badge badgeVolume">💥거래량 ' + r.volumeSpikeRatio.toFixed(1) + '배</span>');
  }
  if (r.isTodayHigh) badges.push('<span class="badge badgeHigh">🆕당일신고가</span>');
  if ((r.change_rate || 0) >= 28) badges.push('<span class="badge badgeLimit">🔺상한가 임박</span>');
  if (r.repeatDays > 1) badges.push('<span class="badge badgeRepeat">' + r.repeatDays + '일째 등장</span>');
  if (r.bidTurnedPositive) badges.push('<span class="badge badgeBid">🔄매수전환</span>');
  if (r.cntrStrRising) badges.push('<span class="badge badgeCntr">💪체결강도개선</span>');
  if (r.buyReqSpike) badges.push('<span class="badge badgeBid">📥매수잔량급증</span>');
  if (r.sellReqThinning) badges.push('<span class="badge badgeBid">📤매도잔량급감</span>');
  if (r.freshEntry) badges.push('<span class="badge badgeFresh">✨신규진입</span>');
  // 거래대금이 너무 작으면 사고팔 때 슬리피지로 수익이 깎임 (동전주 필터와 별개 문제)
  if (typeof r.tradeValue === 'number' && r.tradeValue > 0 && r.tradeValue < 1000000000) {
    badges.push('<span class="badge badgeLimit">💧거래대금 ' + Math.round(r.tradeValue / 100000000) + '억</span>');
  }
  if (typeof r.relativeStrength === 'number' && r.relativeStrength !== 0) {
    const cls = r.relativeStrength > 0 ? 'up' : 'down';
    badges.push('<span class="badge">RS <span class="' + cls + '">' + (r.relativeStrength >= 0 ? '+' : '') + r.relativeStrength.toFixed(2) + '</span></span>');
  }
  return badges.length ? '<div class="badgeRow">' + badges.join('') + '</div>' : '';
}

// renderBadges와 동일한 조건들을 HTML 없이 순수 텍스트 라벨 배열로 반환
// - 관심종목에 추가하는 "그 순간"의 신호 상태를 기록해서 나중에 왜 담았는지 되돌아볼 때 씀
function activeBadgeLabels(r) {
  const labels = [];
  if (r.volumeSpikeRatio && r.volumeSpikeRatio >= 2) labels.push('거래량' + r.volumeSpikeRatio.toFixed(1) + '배');
  if (r.isTodayHigh) labels.push('당일신고가');
  if ((r.change_rate || 0) >= 28) labels.push('상한가임박');
  if (r.repeatDays > 1) labels.push(r.repeatDays + '일째등장');
  if (r.bidTurnedPositive) labels.push('매수전환');
  if (r.cntrStrRising) labels.push('체결강도개선');
  if (r.buyReqSpike) labels.push('매수잔량급증');
  if (r.sellReqThinning) labels.push('매도잔량급감');
  if (r.freshEntry) labels.push('신규진입');
  if (r.accelerating) labels.push('가속중'); // 추천종목 보드에서만 존재하는 필드
  return labels;
}

// 최근 5틱(약 2/4/6/8/10분전) 대비 등락률 변화를 buildLine2 다음 줄에 공용으로 표시
function renderMomentumLine(momentum) {
  if (!momentum || !momentum.length) return '';
  const parts = momentum.map(m => {
    const cls = m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : '';
    const sign = m.delta > 0 ? '+' : '';
    return m.minutesAgo + '분전 <span class="' + cls + '">' + sign + m.delta.toFixed(2) + '%p</span>';
  });
  return '<div class="momentumLine">' + parts.join(' · ') + '</div>';
}

// 1줄: 별표+종목명+현재가, 2줄: 나머지 정보 — 모든 리스트(TOP20/연속상승/전체목록)가 공용으로 사용
// 종합신호등: 배지 9개를 일일이 조합해서 읽지 않아도, 한눈에 강세/중립/주의를 판단할 수 있게 함.
// 백테스트로 검증된 방향(매수전환/매수잔량급증 = 긍정, 당일신고가 = 부정)에 가중치를 크게 두고,
// 검증 안 된 신호(가속중 등)는 아예 안 씀 - 확실한 근거만 반영.
function computeVerdict(r) {
  let score = 0;
  const mom = r.momentum || [];
  const recentDelta = mom[0] ? mom[0].delta : 0;
  score += recentDelta * 2; // 지금 이 순간의 방향
  if (r.bidTurnedPositive) score += 2;
  if (r.buyReqSpike) score += 1.5;
  if (r.sellReqThinning) score += 1;
  if (r.isTodayHigh) score -= 1.5; // 백테스트상 역효과 - 이미 고점이라 되레 감점
  if ((r.change_rate || 0) >= 28) score -= 3; // 상한가 임박 - 여력 없음
  if ((r.price || 0) < 2000) score -= 1.5; // 동전주 위험
  if (recentDelta < 0) score -= 2; // 지금 꺾이는 중

  if (score >= 3) return { emoji: '🟢', cls: 'verdictUp' };
  if (score <= -3) return { emoji: '🔴', cls: 'verdictDown' };
  return { emoji: '🟡', cls: 'verdictMid' };
}

function renderTwoLineList(tbody, items, buildLine2, emptyMessage, onRowClick, boardLabel) {
  onRowClick = onRowClick || (item => {
    const mapped = byCodeMap[item.code];
    if (mapped) {
      currentModalSourceBoard = boardLabel || ''; // 모달 안 별표를 눌렀을 때도 어디서 열었는지 알 수 있게
      currentModalAddedState = activeBadgeLabels(item).join(',');
      openStockModal(mapped);
    }
  });
  if (!items.length) {
    if (tbody.children.length !== 1 || !tbody.querySelector('.empty')) {
      tbody.innerHTML = '<tr><td class="empty">' + emptyMessage + '</td></tr>';
    }
    return;
  }

  const existingMain = {};
  tbody.querySelectorAll('tr.twoLineRow[data-code]').forEach(tr => { existingMain[tr.dataset.code] = tr; });
  const placeholder = tbody.querySelector('td.empty');
  if (placeholder) placeholder.closest('tr').remove();

  let prevNode = null; // 직전 항목의 sub row (다음 항목의 main row가 이 바로 뒤에 와야 함)
  items.forEach(item => {
    const verdict = computeVerdict(item);
    const nameHtml = '<span class="verdictIcon ' + verdict.cls + '">' + verdict.emoji + '</span>' +
      starHtml(item, boardLabel) + item.name + '<span class="rowPrice">' + fmt(item.price) + '원</span>';
    const line2Html = buildLine2(item) + renderMomentumLine(item.momentum) + renderBadges(item);
    let mainTr = existingMain[item.code];
    let subTr;

    if (mainTr) {
      const td = mainTr.children[0];
      if (td.innerHTML !== nameHtml) td.innerHTML = nameHtml; // 안 바뀌었으면 손 안 댐 (깜빡임 방지)
      subTr = mainTr.nextElementSibling;
      if (!subTr || !subTr.classList.contains('twoLineSubRow')) {
        subTr = document.createElement('tr');
        subTr.className = 'twoLineSubRow';
        subTr.appendChild(document.createElement('td'));
      }
      const subTd = subTr.children[0];
      if (subTd.innerHTML !== line2Html) subTd.innerHTML = line2Html;
      delete existingMain[item.code];
    } else {
      mainTr = document.createElement('tr');
      mainTr.className = 'clickable twoLineRow';
      mainTr.dataset.code = item.code;
      const td = document.createElement('td');
      td.innerHTML = nameHtml;
      mainTr.appendChild(td);
      mainTr.addEventListener('click', (e) => {
        if (e.target.closest('.noRowClick')) return;
        onRowClick(item);
      });

      subTr = document.createElement('tr');
      subTr.className = 'twoLineSubRow';
      const subTd = document.createElement('td');
      subTd.innerHTML = line2Html;
      subTr.appendChild(subTd);
    }

    const wantedMainNext = prevNode ? prevNode.nextSibling : tbody.firstChild;
    if (wantedMainNext !== mainTr) tbody.insertBefore(mainTr, wantedMainNext);
    if (mainTr.nextSibling !== subTr) tbody.insertBefore(subTr, mainTr.nextSibling);
    prevNode = subTr;
  });

  Object.values(existingMain).forEach(tr => {
    const sub = tr.nextElementSibling;
    if (sub && sub.classList.contains('twoLineSubRow')) sub.remove();
    tr.remove();
  });
}

function renderAllTable() {
  const sorted = [...latestList].sort((a, b) =>
    currentSort === 'volumeDesc' ? b.volume - a.volume
    : currentSort === 'volumeAsc' ? a.volume - b.volume
    : currentSort === 'cntrStr' ? (b.cntr_str || 0) - (a.cntr_str || 0)
    : currentSort === 'momentum' ? (b.momentumScore || 0) - (a.momentumScore || 0)
    : currentSort === 'signal' ? (b.signalScore || 0) - (a.signalScore || 0)
    : currentSort === 'tradeValue' ? (b.tradeValue || 0) - (a.tradeValue || 0)
    : b.change_rate - a.change_rate
  );
  const allBody = document.querySelector('#all tbody');
  renderTwoLineList(allBody, sorted, r =>
    '<span class="' + (r.change_rate >= 0 ? 'up' : 'down') + '">' + (r.change_rate >= 0 ? '+' : '') + r.change_rate.toFixed(2) + '%</span>' +
    ' · 거래량 ' + fmt(r.volume) +
    ' · 체결강도 <span class="' + (r.cntr_str >= 100 ? 'up' : 'down') + '">' + (r.cntr_str || 0).toFixed(1) + '</span>' +
    ' · <span title="' + ((r.signalChecks || []).join(', ') || '조건 없음') + '">' + '🔥'.repeat(r.signalScore || 0) + (r.lowPriceWarning ? ' ⚠️' : '') + '</span>',
  '데이터 없음', undefined, '전체목록');
}

document.getElementById('sortByMomentum').addEventListener('click', (e) => {
  currentSort = 'momentum';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortByRate').addEventListener('click', (e) => {
  currentSort = 'rate';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortByVolumeDesc').addEventListener('click', (e) => {
  currentSort = 'volumeDesc';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortByVolumeAsc').addEventListener('click', (e) => {
  currentSort = 'volumeAsc';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortByCntrStr').addEventListener('click', (e) => {
  currentSort = 'cntrStr';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortBySignal').addEventListener('click', (e) => {
  currentSort = 'signal';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});
document.getElementById('sortByTradeValue').addEventListener('click', (e) => {
  currentSort = 'tradeValue';
  document.querySelectorAll('.sortBtn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderAllTable();
});

let realtimeListCodes = []; // 실시간 구독 대상 종목 - load()에서 화면에 렌더된 종목들로 채워짐
let conditionCodes = []; // 조건검색으로 실시간 포착된 종목 - renderConditionDock()에서 채워짐

async function load() {
  const __loadStart = performance.now();
  // 관심종목은 /api/latest(연속상승/눌림목/TOP5 등 무거운 계산 포함)와 별개로,
  // 초경량 전용 엔드포인트에서 가장 먼저 가져와서 최우선으로 그림.
  const __wlFetchStart = performance.now();
  let __wlFetchEnd = null, __wlJsonEnd = null, __watchlistDone = null;
  const watchlistQuotesPromise = fetch('/api/watchlist-quotes')
    .then(r => { __wlFetchEnd = performance.now(); return r.json(); })
    .then(wq => {
      __wlJsonEnd = performance.now();
      if (wq.ok) {
        watchlistLastKnownMap = {};
        (wq.watchlistLastKnown || []).forEach(r => { watchlistLastKnownMap[r.code] = r; });
        watchlistRiskMap = {};
        watchlistRiskLevelMap = {};
        (wq.watchlistRisk || []).forEach(r => {
          watchlistRiskMap[r.code] = r.status;
          watchlistRiskLevelMap[r.code] = { stopLoss: r.stop_loss, takeProfit: r.take_profit };
        });
        watchlistExitMap = {};
        (wq.watchlistExitSignals || []).forEach(r => { watchlistExitMap[r.code] = r.reasons; });
        renderWatchlist(wq.watchlist || []);
        __watchlistDone = performance.now();

        // 화면에 직접 소요시간 표시 (모바일에서 개발자도구 없이도 확인 가능하도록)
        const __timingEl = document.getElementById('loadTiming') || (() => {
          const el = document.createElement('div');
          el.id = 'loadTiming';
          el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;font-size:11px;padding:4px 8px;font-family:monospace;';
          document.body.prepend(el);
          return el;
        })();
        __timingEl.textContent =
          '[관심종목 ' + (wq.watchlist || []).length + '개] fetch: ' + (__wlFetchEnd - __wlFetchStart).toFixed(0) + 'ms | ' +
          'json: ' + (__wlJsonEnd - __wlFetchEnd).toFixed(0) + 'ms | ' +
          '렌더: ' + (__watchlistDone - __wlJsonEnd).toFixed(0) + 'ms | ' +
          '총: ' + (__watchlistDone - __loadStart).toFixed(0) + 'ms';

        // D1에도 시세가 없던 관심종목(막 추가된 종목 등)은 별도 요청으로 채움
        if (Array.isArray(wq.watchlistMissingCodes) && wq.watchlistMissingCodes.length > 0) {
          fetch('/api/watchlist-fill-missing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: wq.watchlistMissingCodes })
          })
            .then(r => r.json())
            .then(json => {
              if (json.ok && json.filled && json.filled.length > 0) {
                json.filled.forEach(f => { watchlistLastKnownMap[f.code] = f; });
                renderWatchlist(wq.watchlist || []);
              }
            })
            .catch(() => {});
        }
      }
      return wq;
    })
    .catch(() => ({ ok: false }));

  // /api/latest는 미니차트를 절대 기다리지 않음 - relay가 느리거나(재시작 직후 워밍업 등) 응답이
  // 늦어지면 그게 전체 페이지 로딩을 통째로 붙잡는 게 예전 방식의 문제였음. 이제 가격/종목명 등
  // 핵심 데이터는 항상 즉시 뜨고, 미니차트 전체(mini-candles-all)는 완전히 별도의 병렬 요청으로
  // 동시에 쏴서 "차트만 나중에 채워지는" 방식으로 감. 관심종목 자체는 이미 즉시 렌더링됨.
  const miniPromise = fetch('/api/mini-candles-all')
    .then(r => {
      console.log('[미니차트 디버그] fetch status=', r.status, 'ok=', r.ok);
      return r.json();
    })
    .then(json => {
      console.log('[미니차트 디버그] json 파싱 성공, ok=', json.ok, 'cache키개수=', json.cache ? Object.keys(json.cache).length : 'cache없음');
      return json;
    })
    .catch(err => {
      console.log('[미니차트 디버그] fetch/파싱 실패:', err.message || err);
      return { ok: false };
    });
  const res = await fetch('/api/latest');
  const data = await res.json();
  await watchlistQuotesPromise; // 이미 끝나 있을 가능성이 높음(더 가벼운 쿼리라서) - 렌더 순서만 보장

  document.getElementById('ts').textContent = data.capturedAt
    ? '기준 시각: ' + new Date(data.capturedAt).toLocaleString('ko-KR')
    : '아직 저장된 데이터가 없습니다';

  const streak5Body = document.querySelector('#streak5 tbody');
  renderTwoLineList(streak5Body, data.streak5, r =>
    '<span class="up">+' + r.change_rate.toFixed(2) + '%</span>' +
    ' · <span class="delta">5연속<span class="streakBadge">▲' + r.totalGain.toFixed(2) + '%p</span></span>',
  '5연속 상승 종목 없음', undefined, '5연속상승');

  const streak3Body = document.querySelector('#streak3 tbody');
  renderTwoLineList(streak3Body, data.streak3, r =>
    '<span class="up">+' + r.change_rate.toFixed(2) + '%</span>' +
    ' · <span class="delta">3연속<span class="streakBadge">▲' + r.totalGain.toFixed(2) + '%p</span></span>',
  '3연속 상승 종목 없음', undefined, '3연속상승');

  const top5Body = document.querySelector('#top5 tbody');
  renderTwoLineList(top5Body, data.risingTop5, r =>
    '<span class="up">+' + r.change_rate.toFixed(2) + '%</span>' +
    ' · <span class="delta">▲' + r.delta.toFixed(2) + '%p</span>',
  '직전 스냅샷 대비 상승 종목 없음', undefined, '2분전보다TOP5');

  const pullbackBody = document.querySelector('#pullback tbody');
  renderTwoLineList(pullbackBody, data.pullbackCandidates || [], r =>
    '<span class="up">+' + r.change_rate.toFixed(2) + '%</span>' +
    ' · 고점 ' + r.todayMaxRate.toFixed(2) + '%에서 <span class="down">-' + r.pullbackPct.toFixed(2) + '%p</span> 조정 후 재상승중',
  '눌림목 후보 없음', undefined, '눌림목후보');

  latestList = data.latest;
  const streak3Codes = new Set(data.streak3.map(r => r.code));
  const streak5Codes = new Set(data.streak5.map(r => r.code));
  computeMomentumScores(latestList, streak3Codes, streak5Codes);
  computeSignalScores(latestList, streak3Codes, streak5Codes);

  const pullbackCodes = new Set((data.pullbackCandidates || []).map(r => r.code));
  const recommended = computeRecommendations(latestList, pullbackCodes);
  const recommendedBody = document.querySelector('#recommended tbody');
  renderTwoLineList(recommendedBody, recommended, r =>
    '<span class="' + (r.change_rate >= 0 ? 'up' : 'down') + '">' + (r.change_rate >= 0 ? '+' : '') + r.change_rate.toFixed(2) + '%</span>' +
    ' · 거래량 ' + fmt(r.volume) +
    ' · 체결강도 <span class="' + (r.cntr_str >= 100 ? 'up' : 'down') + '">' + (r.cntr_str || 0).toFixed(1) + '</span>' +
    ((r.accelerating || r.comboBuySignal || r.volumeConfirmed || pullbackCodes.has(r.code))
      ? '<div class="momentumLine">' +
        (r.comboBuySignal ? '<span class="delta">🔥강한매수세</span>' : '') +
        (r.comboBuySignal && (r.volumeConfirmed || r.accelerating || pullbackCodes.has(r.code)) ? ' · ' : '') +
        (r.volumeConfirmed ? '<span class="delta">✅거래량동반확인</span>' : '') +
        (r.volumeConfirmed && (r.accelerating || pullbackCodes.has(r.code)) ? ' · ' : '') +
        (r.accelerating ? '<span class="delta">⚡가속중</span>' : '') +
        (r.accelerating && pullbackCodes.has(r.code) ? ' · ' : '') +
        (pullbackCodes.has(r.code) ? '<span class="delta">🌊눌림목재상승</span>' : '') +
        '</div>'
      : ''),
  '데이터 없음', undefined, '추천종목TOP10');

  const topPicks = computeTopPicks(latestList, streak5Codes);
  const topPicksBody = document.querySelector('#topPicks tbody');
  renderTwoLineList(topPicksBody, topPicks, r =>
    '<span class="' + (r.change_rate >= 0 ? 'up' : 'down') + '">' + (r.change_rate >= 0 ? '+' : '') + r.change_rate.toFixed(2) + '%</span>' +
    ' · 거래량 ' + fmt(r.volume) +
    ' · 체결강도 <span class="' + (r.cntr_str >= 100 ? 'up' : 'down') + '">' + (r.cntr_str || 0).toFixed(1) + '</span>' +
    ' · ' + '🔥'.repeat(Math.max(1, Math.min(5, Math.round(r.topScore / 10)))),
  '데이터 없음', undefined, '오늘의TOP20');

  // 클릭용 종목 정보 매핑 (streak5 + streak3 + top5 + all 합쳐서)
  byCodeMap = {};
  [...data.streak5, ...data.streak3, ...data.risingTop5, ...data.latest].forEach(r => {
    byCodeMap[r.code] = {
      code: r.code, name: r.name, price: r.price, rate: r.change_rate, change_rate: r.change_rate,
      buyReq: r.buy_req || 0, selReq: r.sel_req || 0, cntrStr: r.cntr_str || 0,
      signalChecks: r.signalChecks || [], volume: r.volume || 0,
      // 신호등(computeVerdict) 계산에 필요한 필드들 - 실시간포착 패널에서도 신호등 쓰려고 같이 담아둠
      momentum: r.momentum || [], isTodayHigh: r.isTodayHigh, bidTurnedPositive: r.bidTurnedPositive,
      buyReqSpike: r.buyReqSpike, sellReqThinning: r.sellReqThinning,
    };
  });

  renderAllTable();

  // 실시간 구독 대상: 실제로 자주 보는 리스트 우선 (그룹당 200종목 제한이라 우선순위 필요)
  // 추천TOP10 -> 눌림목 -> 5연속 -> 3연속 -> 2분전TOP5 -> TOP20 -> 전체목록 순
  const priorityCodes = [];
  const pushCodes = (arr) => (arr || []).forEach(r => {
    if (r && r.code && !priorityCodes.includes(r.code)) priorityCodes.push(r.code);
  });
  // 조건검색으로 방금 포착된 종목이 최우선 (아직 cron 스냅샷에 없을 수 있어서 시세가 꼭 필요)
  conditionCodes.forEach(c => { if (!priorityCodes.includes(c)) priorityCodes.push(c); });
  pushCodes(recommended);
  pushCodes(data.pullbackCandidates);
  pushCodes(data.streak5);
  pushCodes(data.streak3);
  pushCodes(data.risingTop5);
  pushCodes(topPicks);
  pushCodes(latestList);
  realtimeListCodes = priorityCodes.slice(0, 180);

  // 일괄조회 결과로 캐시를 채우고, 그래도 relay 쪽에도 캐시가 없던 종목(진짜 신규 편입 등)만
  // 개별조회로 폴백함 - 예전엔 이 폴백이 관심종목 전체에 대해 무조건 돌아서 일괄조회와 겹치며
  // 수십 개 동시요청이 쌓였던 게 체감 렉의 진짜 원인이었음. 이제 "정말 없는 것"만 나감.
  miniPromise.then(mcData => {
    const cache = (mcData && mcData.ok && mcData.cache) || {};
    console.log('[미니차트 디버그] mcData.ok=', mcData && mcData.ok, 'cache종목수=', Object.keys(cache).length);
    Object.keys(cache).forEach(code => {
      if (!(code in miniCandleCache)) {
        miniCandleCache[code] = cache[code].candles;
        updateMiniChartCell(code);
      }
    });
    const stillMissing = (data.watchlist || []).map(w => w.code).filter(code => !(code in miniCandleCache));
    console.log('[미니차트 디버그] 관심종목수=', (data.watchlist || []).length, 'stillMissing수=', stillMissing.length, stillMissing);
    if (stillMissing.length) queueMiniCandleFetches(stillMissing);
  });
}

// ---------- 내 매매 기록 ----------
// ---------- 관심종목(즐겨찾기) ----------
let watchlistCodes = new Set();
let watchlistItems = []; // 관심종목 원본 데이터 (낙관적 업데이트 시 이 배열을 직접 조작)
let watchlistSort = 'added'; // 'added' | 'pnlDesc' | 'pnlAsc'

// 실질 수익률 계산: 정수 주식 매수, 매수/매도 수수료 각 0.015%, 매도 시 증권거래세 0.20%(2026년 기준, 코스피/코스닥 동일)
const KIWOOM_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0020;

function computeRealisticPnl(entryPrice, currentPrice, budget) {
  const qty = Math.floor(budget / entryPrice); // 소수점 주식 매수 불가능
  if (qty <= 0) return null;
  const investedAmount = qty * entryPrice;
  const buyFee = investedAmount * KIWOOM_FEE_RATE;
  const currentValue = qty * currentPrice;
  const sellFee = currentValue * KIWOOM_FEE_RATE;
  const sellTax = currentValue * SELL_TAX_RATE;
  const netProceeds = currentValue - sellFee - sellTax;
  const totalCost = investedAmount + buyFee;
  const netPnlAmount = Math.round(netProceeds - totalCost);
  const netPnlPct = (netPnlAmount / totalCost) * 100;
  return { qty, investedAmount, netPnlAmount, netPnlPct };
}

function formatAddedDate(isoString) {
  const d = new Date(isoString);
  const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const min = String(kst.getMinutes()).padStart(2, '0');
  return mm + '/' + dd + ' ' + hh + ':' + min + ' 추가';
}

let watchlistLastKnownMap = {}; // 밴드 밖 종목의 D1 마지막 저장 시세 (load()에서 채워짐)
let watchlistRiskMap = {}; // { code: 'safe'|'stop_loss_hit'|'take_profit_hit' } - cron이 미리 체크해둔 것 (load()에서 채워짐)
let watchlistRiskLevelMap = {}; // { code: { stopLoss, takeProfit } } - 손절/익절 라인 인라인 표시용 (load()에서 채워짐)
let prevRiskState = {}; // { code: status } - 손절/익절 알림 중복 방지용
let watchlistExitMap = {}; // { code: [이탈신호 사유들] } - 손절선 전 미리 나타나는 약세 징후 (load()에서 채워짐)

// ---------- 관심종목 미니 캔들차트 (1분봉) ----------
const miniCandleCache = {}; // { code: candles[] }

function queueMiniCandleFetches(codes) {
  // relay(Oracle VM)가 미리 갱신해둔 캐시를 즉시 반환하므로 순차대기 없이 병렬요청.
  // 실패(relay 캐시 미스 + 폴백 조회까지 실패)했을 땐 빈 배열로 영구 고정하지 않고 재시도 대상으로
  // 남겨둠 - 그래야 relay가 다음 갱신 주기(최대 1분)에 캐시를 채운 뒤 자동으로 회복됨.
  const toFetch = codes.filter(c => !(c in miniCandleCache));
  if (!toFetch.length) return;
  toFetch.forEach(code => {
    fetch('/api/mini-candles?code=' + code)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          miniCandleCache[code] = data.candles;
          updateMiniChartCell(code);
        } else {
          // 실패는 캐싱하지 않음 - 다음 renderWatchlist 때 다시 시도됨
          setTimeout(() => { if (!(code in miniCandleCache)) queueMiniCandleFetches([code]); }, 5000);
        }
      })
      .catch(() => {
        setTimeout(() => { if (!(code in miniCandleCache)) queueMiniCandleFetches([code]); }, 5000);
      });
  });
}

function updateMiniChartCell(code) {
  const row = document.querySelector('#watchlist tr.miniChartRow[data-code="' + code + '"] td');
  const w = watchlistItems.find(x => x.code === code);
  if (row) row.innerHTML = renderMiniCandles(miniCandleCache[code], w ? w.added_at : null);
}

// 관심종목 실시간 시세 캐시 - refreshRealtimeWatchlist()가 relay 웹소켓 값으로 채움
const liveQuoteCache = {}; // { code: { price, rate, fetchedAt } }

function updateWatchlistPriceCells(code) {
  const tr = document.querySelector('#watchlist tr.watchlistRow[data-code="' + code + '"]');
  if (!tr) return;
  const w = watchlistItems.find(x => x.code === code);
  if (!w) return;
  const liveQuote = liveQuoteCache[code];
  const live = byCodeMap[code];
  const currentPrice = liveQuote ? liveQuote.price : (live ? live.price : null);
  const currentRate = liveQuote ? liveQuote.rate : (live ? live.rate : null);
  const entryPrice = w.entry_price || 0;
  const pnl = (currentPrice !== null && entryPrice > 0) ? computeRealisticPnl(entryPrice, currentPrice, 1000000) : null;
  const tds = tr.children;
  tds[1].innerHTML = currentPrice !== null ? fmt(currentPrice) : '<span class="empty">시세 없음</span>';
  tds[2].innerHTML = currentRate !== null
    ? '<span class="' + (currentRate >= 0 ? 'up' : 'down') + '">' + (currentRate >= 0 ? '+' : '') + currentRate.toFixed(2) + '%</span>'
    : '<span class="empty">-</span>';
  tds[4].innerHTML = pnl
    ? '<span class="' + (pnl.netPnlPct >= 0 ? 'pnlPositive' : 'pnlNegative') + '">' +
      (pnl.netPnlPct >= 0 ? '+' : '') + pnl.netPnlPct.toFixed(2) + '% (' + (pnl.netPnlAmount >= 0 ? '+' : '') + fmt(pnl.netPnlAmount) + '원)</span>'
    : '<span class="empty">시세 없음</span>';

  updatePeakDrawdown(code, currentPrice, entryPrice);
}

// 담은 뒤 실시간 최고가 대비 지금 몇 % 빠졌는지 - 문턱값(-2% 등) 넘기 전부터 항상 보여줌.
// 기존 이탈신호는 문턱값을 넘어야만 뜨는데, 정작 중요한 건 "꺾이기 시작하는 그 순간"이라
// 매 3초 실시간 틱마다 고점을 갱신하며 지금 낙폭을 계속 노출함 (2분 cron보다 훨씬 빠른 반응).
const watchlistPeakPrice = {}; // { code: peakPriceSinceTracking } - 페이지를 새로고침하면 그 시점부터 다시 추적됨
function updatePeakDrawdown(code, currentPrice, entryPrice) {
  const el = document.querySelector('.peakDrawdownLine[data-code="' + code + '"]');
  if (!el || !currentPrice) return;

  const baseline = entryPrice > 0 ? entryPrice : currentPrice; // 진입가가 있으면 진입가부터, 없으면 지금 가격부터 추적 시작
  if (!watchlistPeakPrice[code] || currentPrice > watchlistPeakPrice[code]) {
    watchlistPeakPrice[code] = Math.max(watchlistPeakPrice[code] || baseline, currentPrice);
  }
  const peak = watchlistPeakPrice[code];
  const drawdownPct = ((currentPrice - peak) / peak) * 100;

  if (drawdownPct >= -0.15) {
    // 고점 근처(0.15% 이내)면 굳이 안 보여줌 - 노이즈만 되니까
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  const cls = drawdownPct <= -2 ? 'down' : drawdownPct <= -1 ? 'peakWarnMid' : 'peakWarnLight';
  el.innerHTML = '<span class="' + cls + '">고점(' + fmt(peak) + ') 대비 ' + drawdownPct.toFixed(2) + '%</span>';
}

// watchlist.added_at(UTC ISO) -> 키움 차트 시간 포맷(KST YYYYMMDDHHMMSS)으로 변환
// (candle.time이 이 포맷이라 위치 비교하려면 같은 포맷으로 맞춰야 함)
function isoToKstYYYYMMDDHHMMSS(iso) {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    kst.getUTCFullYear() +
    pad(kst.getUTCMonth() + 1) +
    pad(kst.getUTCDate()) +
    pad(kst.getUTCHours()) +
    pad(kst.getUTCMinutes()) +
    pad(kst.getUTCSeconds())
  );
}

function renderMiniCandles(candles, addedAt) {
  if (!candles || candles.length < 2) return '<span class="empty">차트 로딩중(오늘 09:00~)</span>';
  const w = 220, h = 70, pad = 2;
  const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
  const min = Math.min(...lows), max = Math.max(...highs);
  const range = (max - min) || 1;
  const candleW = (w - pad * 2) / candles.length;
  let bars = '', hitAreas = '';
  candles.forEach((c, i) => {
    const x = pad + i * candleW;
    const yOpen = h - pad - ((c.open - min) / range) * (h - pad * 2);
    const yClose = h - pad - ((c.close - min) / range) * (h - pad * 2);
    const yHigh = h - pad - ((c.high - min) / range) * (h - pad * 2);
    const yLow = h - pad - ((c.low - min) / range) * (h - pad * 2);
    const up = c.close >= c.open;
    const color = up ? '#ff6b6b' : '#4d9fff';
    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    const cx = x + candleW / 2;
    bars += '<line x1="' + cx + '" y1="' + yHigh.toFixed(1) + '" x2="' + cx + '" y2="' + yLow.toFixed(1) + '" stroke="' + color + '" stroke-width="1"/>' +
      '<rect x="' + x.toFixed(1) + '" y="' + bodyTop.toFixed(1) + '" width="' + (candleW * 0.7).toFixed(1) + '" height="' + bodyH.toFixed(1) + '" fill="' + color + '"/>';
    // 캔들 하나당 투명 히트영역을 전체 높이로 깔아서 몸통이 짧아도(거의 안 움직인 구간) 호버/터치가 잘 잡히게 함.
    // data-tip에 시간/가격/거래량을 미리 문자열로 담아둠 - 이벤트 위임 핸들러가 그대로 꺼내 씀.
    // data-cx는 이 캔들의 중심 x좌표(SVG viewBox 기준) - 호버 시 크로스헤어 세로선을 정확히 그 위치에 그리는 데 씀.
    const tip = formatChartTime(c.time, '1') + '  ' + fmt(c.close) + '원  거래량 ' + fmt(c.volume || 0);
    hitAreas += '<rect class="miniChartHit" data-tip="' + tip.replace(/"/g, '&quot;') + '" data-cx="' + cx.toFixed(1) + '" ' +
      'x="' + x.toFixed(1) + '" y="0" width="' + candleW.toFixed(1) + '" height="' + h + '" fill="transparent"/>';
  });

  // 즐겨찾기에 추가된 순간을 세로 점선으로 표시 (그 시각과 가장 가까운 캔들 위치를 찾아서)
  let addedMarkerHtml = '';
  if (addedAt) {
    const addedKst = isoToKstYYYYMMDDHHMMSS(addedAt);
    let nearestIdx = -1, nearestDiff = Infinity;
    candles.forEach((c, i) => {
      const diff = Math.abs(Number(c.time) - Number(addedKst));
      if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = i; }
    });
    // 추가 시점이 차트 범위 안이면 정확한 위치에, 범위를 벗어나면(장마감 후 추가 등)
    // 가장 가까운 쪽 끝 캔들에 표시 - 정확한 시각은 아니어도 "그 근처에 추가됐다"는 사실은 전달됨
    const firstTime = Number(candles[0].time), lastTime = Number(candles[candles.length - 1].time);
    const addedNum = Number(addedKst);
    if (nearestIdx >= 0) {
      const clampedIdx = addedNum < firstTime ? 0 : (addedNum > lastTime ? candles.length - 1 : nearestIdx);
      const markerX = pad + clampedIdx * candleW + candleW / 2;
      addedMarkerHtml =
        '<line x1="' + markerX.toFixed(1) + '" y1="0" x2="' + markerX.toFixed(1) + '" y2="' + h + '" stroke="#ffd43b" stroke-width="1" stroke-dasharray="3,2"/>' +
        '<text x="' + markerX.toFixed(1) + '" y="9" fill="#ffd43b" font-size="8" text-anchor="middle">★</text>';
    }
  }

  const labelIdxs = pickLabelIndices(candles.length);
  const timeLabelsHtml = '<div class="chartTimeLabels">' +
    labelIdxs.map(idx => '<span>' + formatChartTime(candles[idx].time, '1') + '</span>').join('') +
    '</div>';
  // 크로스헤어(현재 커서/터치 위치 세로선) - 미리 그려두고 숨겨놓은 뒤, 호버 시 x좌표만 갱신해서 보여줌.
  // 매 mousemove마다 새 엘리먼트를 만들지 않고 속성만 바꾸는 방식이라 가벼움.
  const crosshairHtml = '<line class="miniChartCrosshair" x1="0" y1="0" x2="0" y2="' + h + '" stroke="#fff" stroke-width="1" stroke-dasharray="2,2" opacity="0" pointer-events="none"/>';

  // 현재가(마지막 캔들 종가)가 오늘 차트 구간의 최고가/최저가 대비 몇 % 위치인지, 실제 최고가/최저가
  // 캔들이 있는 y좌표 옆에 라벨로 표시(하단 별도 텍스트가 아니라 그 값이 실제로 찍힌 자리에).
  // SVG <text>는 preserveAspectRatio="none"으로 가로가 늘어날 때 글자도 같이 옆으로 늘어나 보이는
  // 문제가 있어서, 비율 왜곡 없는 HTML 절대위치 오버레이로 그림(퍼센트 좌표라 컨테이너 크기 무관).
  const currentPrice = candles[candles.length - 1].close;
  const fromHighPct = ((currentPrice - max) / max) * 100;
  const fromLowPct = ((currentPrice - min) / min) * 100;
  // 최고가/최저가가 여러 캔들에 걸쳐 있으면(동률) 가장 최근(오른쪽) 캔들을 대표로 삼음
  let highIdx = 0, lowIdx = 0;
  candles.forEach((c, i) => {
    if (c.high >= candles[highIdx].high) highIdx = i;
    if (c.low <= candles[lowIdx].low) lowIdx = i;
  });
  const highXPct = ((pad + highIdx * candleW + candleW / 2) / w) * 100;
  const lowXPct = ((pad + lowIdx * candleW + candleW / 2) / w) * 100;
  // 최고가는 차트 맨 위, 최저가는 차트 맨 아래 - 라벨이 서로 가까운 x위치에 있으면(구간이 짧은 차트)
  // 위아래로 확실히 벌려서 겹치지 않게 함. 화면 오른쪽 끝에 붙지 않도록 clamp.
  const highLeftPct = Math.min(88, Math.max(2, highXPct));
  const lowLeftPct = Math.min(88, Math.max(2, lowXPct));
  const closeX = Math.abs(highXPct - lowXPct) < 15;
  const rangeLabelsHtml =
    '<div class="miniChartRangeLabel down" style="left:' + highLeftPct.toFixed(1) + '%; top:' + (closeX ? '14px' : '1px') + ';">' +
    fmt(max) + '(' + fromHighPct.toFixed(1) + '%)</div>' +
    '<div class="miniChartRangeLabel up" style="left:' + lowLeftPct.toFixed(1) + '%; bottom:' + (closeX ? '12px' : '1px') + ';">' +
    fmt(min) + '(+' + fromLowPct.toFixed(1) + '%)</div>';

  return '<div class="miniChartWrap"><div class="miniChartTip" style="display:none;"></div>' + rangeLabelsHtml +
    '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
    bars + addedMarkerHtml + crosshairHtml + hitAreas + '</svg>' + timeLabelsHtml + '</div>';
}

// 관심종목 삭제는 낙관적 업데이트(서버 응답 기다리지 않고 화면 먼저 반영)라 실패해도 사용자가
// 모를 수 있음(화면엔 지워졌는데 서버엔 남아있어서 다음 새로고침 때 도로 나타남) - 실패 시
// 로컬 배열에 되돌리고 사용자에게 알려서 D1과 화면 상태가 어긋난 채로 방치되지 않게 함.
function deleteWatchlistItem(code, removedItem, removedIndex) {
  fetch('/api/watchlist?code=' + code, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw new Error('삭제 실패 (' + res.status + ')');
    })
    .catch(() => {
      if (removedItem && !watchlistItems.some(w => w.code === code)) {
        const idx = Math.min(removedIndex, watchlistItems.length);
        watchlistItems.splice(idx, 0, removedItem);
        renderWatchlist(watchlistItems);
      }
      alert('관심종목 삭제에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.');
    });
}

function renderWatchlist(items) {
  watchlistItems = items;
  watchlistCodes = new Set(items.map(w => w.code));
  const tbody = document.querySelector('#watchlist tbody');
  const rows = items.map(w => {
    const live = byCodeMap[w.code];
    const liveQuote = liveQuoteCache[w.code];
    const lastKnown = watchlistLastKnownMap[w.code];
    // 관심종목은 전용 실시간 재조회(liveQuote)가 배치 데이터(live)보다 항상 정확도가 높음
    // (배치 데이터는 오늘자 마지막 5~15% 스냅샷일 뿐이라, 그 이후 밴드를 벗어나며 크게 움직이면 낡은 값일 수 있음)
    const currentPrice = liveQuote ? liveQuote.price : (live ? live.price : (lastKnown ? lastKnown.price : null));
    const currentRate = liveQuote ? liveQuote.rate : (live ? live.rate : (lastKnown ? lastKnown.change_rate : null));
    const entryPrice = w.entry_price; // null(확정중)과 0(조회실패)을 구분하기 위해 그대로 둠
    let pnl = null;
    if (currentPrice !== null && entryPrice > 0) {
      pnl = computeRealisticPnl(entryPrice, currentPrice, 1000000);
    }
    return {
      code: w.code, name: w.name,
      price: currentPrice, rate: currentRate, volume: live ? live.volume : (lastKnown ? lastKnown.volume : null),
      entryPrice, pnl, addedAt: w.added_at,
      sourceBoard: w.source_board, addedState: w.added_state,
    };
  });

  if (watchlistSort === 'pnlDesc') {
    rows.sort((a, b) => (b.pnl ? b.pnl.netPnlPct : -Infinity) - (a.pnl ? a.pnl.netPnlPct : -Infinity));
  } else if (watchlistSort === 'pnlAsc') {
    rows.sort((a, b) => (a.pnl ? a.pnl.netPnlPct : Infinity) - (b.pnl ? b.pnl.netPnlPct : Infinity));
  }

  if (!rows.length) {
    tbody.innerHTML = '<tr><td class="empty">별표 눌러서 종목을 추가해보세요</td></tr>';
  } else {
    tbody.innerHTML = rows.map(r => {
      const rateHtml = r.rate !== null
        ? '<span class="' + (r.rate >= 0 ? 'up' : 'down') + '">' + (r.rate >= 0 ? '+' : '') + r.rate.toFixed(2) + '%</span>'
        : '<span class="empty">-</span>';
      const pnlHtml = r.pnl
        ? '<span class="' + (r.pnl.netPnlPct >= 0 ? 'pnlPositive' : 'pnlNegative') + '">' +
          (r.pnl.netPnlPct >= 0 ? '+' : '') + r.pnl.netPnlPct.toFixed(2) + '% (' + (r.pnl.netPnlAmount >= 0 ? '+' : '') + fmt(r.pnl.netPnlAmount) + '원)</span>'
        : (r.entryPrice === null ? '<span class="empty">진입가 확정중</span>' : '<span class="empty">시세 없음</span>');
      const riskStatus = watchlistRiskMap[r.code];
      prevRiskState[r.code] = riskStatus;
      const riskBadgeHtml = riskStatus === 'stop_loss_hit'
        ? '<div class="riskBadge riskBadgeDown">⚠️ 손절선 도달</div>'
        : riskStatus === 'take_profit_hit'
        ? '<div class="riskBadge riskBadgeUp">🎯 익절선 도달</div>'
        : '';
      const exitReasons = watchlistExitMap[r.code];
      const exitBadgeHtml = exitReasons && exitReasons.length
        ? '<div class="riskBadge riskBadgeExit">🔻이탈신호: ' + exitReasons.join(' · ') + '</div>'
        : '';
      const levels = watchlistRiskLevelMap[r.code];
      const riskLevelHtml = (levels && levels.stopLoss && levels.takeProfit)
        ? '<div class="riskLevelLine">손절 ' + fmt(levels.stopLoss) + ' · 익절 ' + fmt(levels.takeProfit) + '</div>'
        : '';
      const addedContextHtml = (r.sourceBoard || r.addedState)
        ? '<div class="addedContext">' +
          (r.sourceBoard || '') +
          (r.sourceBoard && r.addedState ? ' · ' : '') +
          (r.addedState ? r.addedState.split(',').filter(Boolean).join(', ') : '') +
          '</div>'
        : '';
      return (
        '<tr class="clickable watchlistRow" data-code="' + r.code + '">' +
          '<td>' + r.name + (r.addedAt ? '<div class="addedDate">' + formatAddedDate(r.addedAt) + '</div>' : '') + addedContextHtml + riskLevelHtml + riskBadgeHtml + exitBadgeHtml +
          '<div class="riskBadge riskBadgeExit realtimeExitBadge" data-code="' + r.code + '" style="display:none;"></div>' +
          '<div class="peakDrawdownLine" data-code="' + r.code + '" style="display:none;"></div>' +
          '</td>' +
          '<td>' + (r.price !== null ? fmt(r.price) : '<span class="empty">시세 없음</span>') + '</td>' +
          '<td>' + rateHtml + '</td>' +
          '<td>' + (r.entryPrice ? fmt(r.entryPrice) + '원' : (r.entryPrice === null ? '<span class="empty">확정중</span>' : '-')) + '</td>' +
          '<td>' + pnlHtml + '</td>' +
          '<td><span class="tradeDelBtn noRowClick" data-code="' + r.code + '">🗑️</span></td>' +
        '</tr>' +
        '<tr class="miniChartRow" data-code="' + r.code + '"><td colspan="6">' + renderMiniCandles(miniCandleCache[r.code], r.addedAt) + '</td></tr>'
      );
    }).join('');

    tbody.querySelectorAll('tr.watchlistRow').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.noRowClick')) return;
        const code = tr.dataset.code;
        const item = watchlistItems.find(w => w.code === code);
        const live = byCodeMap[code];
        const liveQuote = liveQuoteCache[code];
        const lastKnown = watchlistLastKnownMap[code];
        const fallbackPrice = liveQuote ? liveQuote.price : (lastKnown ? lastKnown.price : 0);
        const fallbackRate = liveQuote ? liveQuote.rate : (lastKnown ? lastKnown.change_rate : 0);
        openStockModal(live || { code, name: item ? item.name : code, price: fallbackPrice, rate: fallbackRate, buyReq: 0, selReq: 0 });
      });
    });
  }

  // 미니차트는 여기서 개별조회하지 않음 - load()의 일괄조회(mini-candles-all) 하나가 전담.
  // 예전엔 renderWatchlist가 다시 그려질 때마다(15초마다) 캐시 없는 종목 전부를 동시에
  // fetch해서, 일괄조회와 겹치며 수십 개 동시요청이 쌓이는 게 체감 렉의 진짜 원인이었음.
  refreshRealtimeWatchlist(); // 실시간 시세 즉시 1회 (이후는 3초 타이머가 담당)
  tbody.querySelectorAll('.tradeDelBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      const removedIndex = watchlistItems.findIndex(w => w.code === code);
      const removedItem = removedIndex >= 0 ? watchlistItems[removedIndex] : null;
      watchlistItems = watchlistItems.filter(w => w.code !== code);
      renderWatchlist(watchlistItems); // 즉시 반영, 응답 안 기다림
      if (currentModalCode === code) updateStarButton(code, currentModalName);
      deleteWatchlistItem(code, removedItem, removedIndex);
    });
  });
}

document.getElementById('wlSortByAdded').addEventListener('click', (e) => {
  watchlistSort = 'added';
  document.querySelectorAll('#wlSortByAdded, #wlSortByPnlDesc, #wlSortByPnlAsc').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderWatchlist(watchlistItems);
});
document.getElementById('wlSortByPnlDesc').addEventListener('click', (e) => {
  watchlistSort = 'pnlDesc';
  document.querySelectorAll('#wlSortByAdded, #wlSortByPnlDesc, #wlSortByPnlAsc').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderWatchlist(watchlistItems);
});
document.getElementById('wlSortByPnlAsc').addEventListener('click', (e) => {
  watchlistSort = 'pnlAsc';
  document.querySelectorAll('#wlSortByAdded, #wlSortByPnlDesc, #wlSortByPnlAsc').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  renderWatchlist(watchlistItems);
});

// 관심종목 단독 새로고침 (별표 토글 직후처럼 즉시 반영이 필요할 때만 사용,
// 평상시 10초 주기 갱신은 /api/latest 응답에 묻어오는 데이터로 처리해서 별도 요청 안 나감)
function loadWatchlist() {
  fetch('/api/watchlist')
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return;
      renderWatchlist(data.items);
    })
    .catch(() => {});
}

function updateStarButton(code, name, price) {
  const starBtn = document.getElementById('modalStarBtn');
  const isStarred = watchlistCodes.has(code);
  starBtn.textContent = isStarred ? '★' : '☆';
  starBtn.classList.toggle('active', isStarred);
  starBtn.onclick = () => {
    if (watchlistCodes.has(code)) {
      const removedIndex = watchlistItems.findIndex(w => w.code === code);
      const removedItem = removedIndex >= 0 ? watchlistItems[removedIndex] : null;
      watchlistItems = watchlistItems.filter(w => w.code !== code);
      renderWatchlist(watchlistItems); // 서버 응답 기다리지 않고 로컬에서 즉시 반영 (깜빡임 없음)
      updateStarButton(code, name, price);
      deleteWatchlistItem(code, removedItem, removedIndex);
    } else {
      // entry_price는 아직 미확정(null) — 화면엔 별표만 즉시 반영, 진입가는 서버 응답 오면 정확한 값으로 채움
      const sourceBoard = currentModalSourceBoard;
      const addedState = currentModalAddedState;
      watchlistItems = [{ code, name, entry_price: null, added_at: new Date().toISOString(), source_board: sourceBoard, added_state: addedState }, ...watchlistItems];
      renderWatchlist(watchlistItems);
      updateStarButton(code, name, price);
      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, sourceBoard, addedState }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            const w = watchlistItems.find(x => x.code === code);
            if (w) { w.entry_price = data.entryPrice; renderWatchlist(watchlistItems); }
          }
        })
        .catch(() => {});
    }
  };
}

// (초기 관심종목 표시는 아래 load() 최초 호출에 포함되어 처리됨 - 중복 요청 방지)

// TOP10 표 안 별표 클릭 (행 전체 클릭인 코드복사+앱실행과 분리)
document.body.addEventListener('click', (e) => {
  const star = e.target.closest('.topPickStar');
  if (!star) return;
  e.stopPropagation();
  const code = star.dataset.code, name = star.dataset.name;
  const sourceBoard = star.dataset.board || '';
  const addedState = star.dataset.badges || '';

  if (watchlistCodes.has(code)) {
    const removedIndex = watchlistItems.findIndex(w => w.code === code);
    const removedItem = removedIndex >= 0 ? watchlistItems[removedIndex] : null;
    watchlistItems = watchlistItems.filter(w => w.code !== code);
    star.classList.remove('active');
    star.textContent = '☆';
    renderWatchlist(watchlistItems); // 서버 재조회 없이 로컬에서 즉시 반영
    deleteWatchlistItem(code, removedItem, removedIndex);
  } else {
    // entry_price는 아직 미확정(null) — 별표만 즉시 반영, 진입가는 서버 응답 오면 정확한 값으로 채움
    watchlistItems = [{ code, name, entry_price: null, added_at: new Date().toISOString(), source_board: sourceBoard, added_state: addedState }, ...watchlistItems];
    star.classList.add('active');
    star.textContent = '★';
    renderWatchlist(watchlistItems);
    fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, sourceBoard, addedState }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          const w = watchlistItems.find(x => x.code === code);
          if (w) { w.entry_price = data.entryPrice; renderWatchlist(watchlistItems); }
        }
      })
      .catch(() => {});
  }
});

document.getElementById('patternScanBtn').addEventListener('click', (e) => {
  const btn = e.target;
  const tbody = document.querySelector('#patternScan tbody');
  btn.disabled = true;
  btn.textContent = '스캔 중...';
  tbody.innerHTML = '<tr><td class="empty">지난 1주일 데이터와 비교 중... (20~30초 소요)</td></tr>';

  fetch('/api/pattern-scan')
    .then(res => res.json())
    .then(data => {
      if (!data.ok) {
        tbody.innerHTML = '<tr><td class="empty">스캔 실패: ' + (data.error || '알 수 없는 오류') + '</td></tr>';
        return;
      }
      const results = data.results.filter(r => r.score >= 0.5);
      tbody.innerHTML = results.length
        ? results.map(r => {
            const d = r.matchDate;
            const dateLabel = d.slice(4,6) + '/' + d.slice(6,8);
            const pct = (r.score * 100).toFixed(1);
            return '<tr class="clickable" data-code="' + r.code + '">' +
              '<td>' + r.name + '</td>' +
              '<td>' + dateLabel + '</td>' +
              '<td class="' + (r.score >= 0.8 ? 'up' : '') + '">' + pct + '%</td>' +
            '</tr>';
          }).join('')
        : '<tr><td class="empty">유사도 50% 이상인 종목 없음 (' + data.scanned + '종목 스캔)</td></tr>';

      tbody.querySelectorAll('tr.clickable').forEach(tr => {
        tr.addEventListener('click', () => {
          const item = byCodeMap[tr.dataset.code];
          if (item) openStockModal(item);
        });
      });
    })
    .catch(err => {
      tbody.innerHTML = '<tr><td class="empty">스캔 요청 오류: ' + err.message + '</td></tr>';
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = '스캔 시작';
    });
});

// 조건검색 실시간 포착 - 조건에 편입되는 순간 즉시 화면에 뜸 (2분 cron 대기 없음)
// 키움 실시간 시각은 "125003"(HHMMSS) 형태로 옴
function fmtHHMM(t) {
  const s = String(t || '');
  return s.length >= 4 ? s.slice(0, 2) + ':' + s.slice(2, 4) : s;
}

// 조건검색 신규편입 종목 관심종목 자동추가 - "이미 충족중이던 것"(initial)은 새 신호가 아니라서 제외,
// 이번 세션에서 한 번 처리한 code는 autoAddedCondCodes에 남겨서 재편입/재렌더링 때 중복 추가 안 되게 함.
const autoAddedCondCodes = new Set();
const AUTO_ADD_MAX = 10; // 관심종목 무한정 늘어나는 것 방지 - 동시 보유 상한
function autoAddConditionHits(history, condName) {
  const label = '자동편입' + (condName ? '(' + condName + ')' : '');
  for (const h of history) {
    if (h.initial || !h.time) continue; // 최초 스냅샷부터 있던 건 "신규 편
