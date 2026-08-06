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

// 장마감(15:30) 직후, 그 시점 화면에 떠 있던 종목들을 하나씩 정확하게 재조회해서
// 배치 수집(2분 간격이라 정각과 살짝 어긋날 수 있음)보다 정확한 최종 종가를 남김.
// ka10027(배치) 대신 종목별 ka10007(개별 시세)이라 초당1건 제한 때문에 종목당 1.1초 걸림.
// 관심종목이 ATR 기반 손절/익절 라인에 도달했는지 cron이 대신 체크해서 D1에 남김.
// 원래는 모달을 직접 열어야만 알 수 있었던 것 - watchlist_risk_status 테이블 필요(schema.sql 참고).
// 관심종목은 보통 소수(몇 개)라 종목당 1.1초 순차조회를 매 틱마다 해도 부담 적음.
async function checkWatchlistRiskLevels(env) {
  const wlRes = await env.DB.prepare(`SELECT code, name FROM watchlist`).all();
  const items = wlRes.results;
  if (!items.length) return { checked: 0 };

  const token = await kiwoomIssueToken(env);
  let checked = 0;
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

async function collectFinalAccurateQuotes(env) {
  const capturedAt = new Date().toISOString();
  const timesRes = await env.DB.prepare(
    `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT 1`
  ).all();
  if (!timesRes.results.length) return { saved: 0 };
  const lastTime = timesRes.results[0].captured_at;
  const codesRes = await env.DB.prepare(
    `SELECT DISTINCT code, name, market FROM snapshots WHERE captured_at = ?`
  )
    .bind(lastTime)
    .all();
  let targets = codesRes.results;
  if (!targets.length) return { saved: 0 };

  // Cloudflare Workers는 호출당 서브리퀘스트 개수에 상한이 있어서(실측상 약 50개),
  // 종목이 많으면 뒤쪽 종목들은 애초에 처리가 안 됨. 그러니 관심종목을 먼저 처리해서
  // 한도에 걸리더라도 실제로 중요한(담아둔) 종목들만은 정확한 종가를 확보하게 함.
  try {
    const wlRes = await env.DB.prepare(`SELECT code FROM watchlist`).all();
    const wlCodes = new Set(wlRes.results.map((r) => r.code));
    if (wlCodes.size) {
      targets = [...targets].sort((a, b) => (wlCodes.has(b.code) ? 1 : 0) - (wlCodes.has(a.code) ? 1 : 0));
    }
  } catch (e) {
    // 우선순위 정렬 실패해도 전체 흐름엔 지장 없음 - 원래 순서로 진행
  }

  const token = await kiwoomIssueToken(env);
  const rows = [];
  const failedCodes = [];
  let hitSubrequestLimit = false;
  for (const t of targets) {
    try {
      const raw = await kiwoomQuote(env, token, t.code);
      const q = parseKiwoomQuote(raw);
      rows.push({ code: t.code, name: t.name, price: q.price, rate: q.rate, volume: q.volume, market: t.market });
    } catch (e) {
      const msg = String(e.message || e);
      if (/Too many subrequests/i.test(msg)) {
        // 이 시점부터는 뭘 시도해도 똑같이 실패함(플랫폼 한도) - 나머지 종목을 헛되이 순회하지 않고 바로 중단
        hitSubrequestLimit = true;
        break;
      }
      // 개별 종목 조회 실패는 건너뜀 (그 종목만 최종 갱신 안 됨, 나머지는 계속 진행) - 아래에서 모아서 로그만 남김
      failedCodes.push(t.code + ":" + msg.slice(0, 80));
    }
    await sleep(1100); // 키움 TR 초당1건 제한
  }
  const skippedCount = targets.length - rows.length - failedCodes.length;
  if (failedCodes.length || hitSubrequestLimit) {
    await logSystemEvent(
      env,
      "final_quote_partial_failure",
      `${rows.length}/${targets.length}종목만 최종시세 재조회 성공` +
        (hitSubrequestLimit ? ` (서브리퀘스트 한도 도달, ${skippedCount}종목 시도 자체를 안 함)` : "") +
        (failedCodes.length ? ` - 개별실패: ${failedCodes.slice(0, 15).join(", ")}` : "")
    );
  }

  // 이번에 못 받은 종목은 D1에 남겨둠 - 15:38/40/42/44 틱에서 자동으로 이어서 재시도함
  // (매번 새 호출이라 서브리퀘스트 한도가 리셋되므로, 나눠서 하면 결국 더 많이 받아올 수 있음)
  const succeededCodes = new Set(rows.map((r) => r.code));
  const leftover = targets.filter((t) => !succeededCodes.has(t.code));
  await env.DB.prepare(`DELETE FROM final_quote_pending`).run().catch(() => {}); // 어제 남은 게 있으면 정리
  if (leftover.length) {
    const pendStmt = env.DB.prepare(
      `INSERT INTO final_quote_pending (code, name, market, captured_at) VALUES (?, ?, ?, ?)`
    );
    await env.DB.batch(leftover.map((t) => pendStmt.bind(t.code, t.name, t.market, capturedAt))).catch(() => {});
  }

  if (!rows.length) return { saved: 0 };

  const stmt = env.DB.prepare(
    `INSERT INTO snapshots (code, name, price, change_rate, volume, market, captured_at, cntr_str, buy_req, sel_req)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`
  );
  const batch = rows.map((s) => stmt.bind(s.code, s.name, s.price, s.rate, s.volume, s.market, capturedAt));
  await env.DB.batch(batch);
  return { saved: rows.length, capturedAt, leftover: leftover.length };
}

// 15:36에 서브리퀘스트 한도나 개별 오류로 못 받은 종목들을 15:38/40/42/44 틱에서 이어서 재시도.
// 매 호출이 새 Worker invocation이라 서브리퀘스트 한도가 그때마다 리셋되므로, 나눠서 시도하면 더 많이 채울 수 있음.
async function retryFinalQuotePending(env) {
  const pendRes = await env.DB.prepare(`SELECT code, name, market, captured_at FROM final_quote_pending`).all();
  let targets = pendRes.results;
  if (!targets.length) return { retried: 0 };

  try {
    const wlRes = await env.DB.prepare(`SELECT code FROM watchlist`).all();
    const wlCodes = new Set(wlRes.results.map((r) => r.code));
    if (wlCodes.size) {
      targets = [...targets].sort((a, b) => (wlCodes.has(b.code) ? 1 : 0) - (wlCodes.has(a.code) ? 1 : 0));
    }
  } catch (e) {}

  const token = await kiwoomIssueToken(env);
  const rows = [];
  const stillFailed = [];
  for (const t of targets) {
    try {
      const raw = await kiwoomQuote(env, token, t.code);
      const q = parseKiwoomQuote(raw);
      rows.push({ ...t, price: q.price, rate: q.rate, volume: q.volume });
    } catch (e) {
      if (/Too many subrequests/i.test(String(e.message || e))) break; // 이번 틱도 한도 도달 - 다음 틱에 또 시도
      stillFailed.push(t);
    }
    await sleep(1100);
  }

  if (rows.length) {
    const stmt = env.DB.prepare(
      `INSERT INTO snapshots (code, name, price, change_rate, volume, market, captured_at, cntr_str, buy_req, sel_req)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`
    );
    await env.DB.batch(
      rows.map((s) => stmt.bind(s.code, s.name, s.price, s.rate, s.volume, s.market, s.captured_at))
    );
    const doneCodes = rows.map((r) => r.code);
    const ph = doneCodes.map(() => "?").join(",");
    await env.DB.prepare(`DELETE FROM final_quote_pending WHERE code IN (${ph})`).bind(...doneCodes).run();
  }

  if (rows.length) {
    await logSystemEvent(env, "final_quote_retry_success", `재시도로 ${rows.length}종목 추가 확보 (남은 ${targets.length - rows.length}종목)`);
  }
  return { retried: rows.length, stillPending: targets.length - rows.length };
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
      env.DB.prepare(`SELECT code, MAX(change_rate) AS maxRate FROM snapshots WHERE captured_at LIKE ? GROUP BY code`)
        .bind(todayPrefix + "%")
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

    // 15:36 마감 정밀조회(collectFinalAccurateQuotes)는 가격/등락률/거래량만 받고 체결강도·매수잔량·매도잔량은
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
  const collectBtn = document.getElementById('collectBtn');
  if (patternBtn) patternBtn.disabled = disabled;
  if (collectBtn) collectBtn.disabled = disabled;
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
      let score = 0;
      score += recentDelta * 8; // 지금 이 순간의 방향/속도에 가장 큰 가중치 (이번 백테스트 대상 아님, 유지)
      if (r.bidTurnedPositive) score += 4; // 실측 근거 있음 - 기존 3에서 상향
      if (r.buyReqSpike) score += 2.5; // 실측 근거 있음 - 기존 1.5에서 상향
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
      if (r.volumeSpikeRatio && r.volumeSpikeRatio >= 2) score += 2; // 표본 부족으로 판단 보류, 기존 유지
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
  const res = await fetch('/api/latest');
  const data = await res.json();

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

  watchlistLastKnownMap = {};
  (data.watchlistLastKnown || []).forEach(r => { watchlistLastKnownMap[r.code] = r; });
  watchlistRiskMap = {};
  watchlistRiskLevelMap = {}; // { code: { stopLoss, takeProfit } } - 손절/익절 라인 인라인 표시용
  (data.watchlistRisk || []).forEach(r => {
    watchlistRiskMap[r.code] = r.status;
    watchlistRiskLevelMap[r.code] = { stopLoss: r.stop_loss, takeProfit: r.take_profit };
  });
  watchlistExitMap = {};
  (data.watchlistExitSignals || []).forEach(r => { watchlistExitMap[r.code] = r.reasons; });
  renderWatchlist(data.watchlist || []);
}

document.getElementById('reloadBtn').addEventListener('click', (e) => {
  e.target.classList.add('spinning');
  load().finally(() => setTimeout(() => e.target.classList.remove('spinning'), 600));
});

document.getElementById('fullReloadBtn').addEventListener('click', (e) => {
  e.target.classList.add('spinning');
  location.reload();
});

// ---------- 내 매매 기록 ----------
// ---------- 관심종목(즐겨찾기) ----------
let watchlistCodes = new Set();
let watchlistItems = []; // 관심종목 원본 데이터 (낙관적 업데이트 시 이 배열을 직접 조작)

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
let miniCandleQueueRunning = false;

function queueMiniCandleFetches(codes) {
  const toFetch = codes.filter(c => !miniCandleCache[c]);
  if (!toFetch.length || miniCandleQueueRunning) return;
  miniCandleQueueRunning = true;
  let i = 0;
  function next() {
    if (i >= toFetch.length) { miniCandleQueueRunning = false; return; }
    const code = toFetch[i++];
    fetch('/api/mini-candles?code=' + code)
      .then(res => res.json())
      .then(data => {
        miniCandleCache[code] = data.ok ? data.candles : [];
        updateMiniChartCell(code); // 이 종목 차트 셀만 갱신 (다른 행은 안 건드림)
      })
      .catch(() => { miniCandleCache[code] = []; })
      .finally(() => setTimeout(next, 1100)); // 키움 TR 초당1건 제한 준수
  }
  next();
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
  const bars = candles.map((c, i) => {
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
    return '<line x1="' + cx + '" y1="' + yHigh.toFixed(1) + '" x2="' + cx + '" y2="' + yLow.toFixed(1) + '" stroke="' + color + '" stroke-width="1"/>' +
      '<rect x="' + x.toFixed(1) + '" y="' + bodyTop.toFixed(1) + '" width="' + (candleW * 0.7).toFixed(1) + '" height="' + bodyH.toFixed(1) + '" fill="' + color + '"/>';
  }).join('');

  // 즐겨찾기에 추가된 순간을 세로 점선으로 표시 (그 시각과 가장 가까운 캔들 위치를 찾아서)
  let addedMarkerHtml = '';
  if (addedAt) {
    const addedKst = isoToKstYYYYMMDDHHMMSS(addedAt);
    let nearestIdx = -1, nearestDiff = Infinity;
    candles.forEach((c, i) => {
      const diff = Math.abs(Number(c.time) - Number(addedKst));
      if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = i; }
    });
    // 추가 시점이 이 차트가 보여주는 시간 범위 안에 있을 때만 표시 (범위 밖이면 마커가 엉뚱한 끝에 붙어 오해를 줌)
    const firstTime = Number(candles[0].time), lastTime = Number(candles[candles.length - 1].time);
    const addedNum = Number(addedKst);
    if (nearestIdx >= 0 && addedNum >= firstTime && addedNum <= lastTime) {
      const markerX = pad + nearestIdx * candleW + candleW / 2;
      addedMarkerHtml =
        '<line x1="' + markerX.toFixed(1) + '" y1="0" x2="' + markerX.toFixed(1) + '" y2="' + h + '" stroke="#ffd43b" stroke-width="1" stroke-dasharray="3,2"/>' +
        '<text x="' + markerX.toFixed(1) + '" y="9" fill="#ffd43b" font-size="8" text-anchor="middle">★</text>';
    }
  }

  const labelIdxs = pickLabelIndices(candles.length);
  const timeLabelsHtml = '<div class="chartTimeLabels">' +
    labelIdxs.map(idx => '<span>' + formatChartTime(candles[idx].time, '1') + '</span>').join('') +
    '</div>';
  return '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + bars + addedMarkerHtml + '</svg>' + timeLabelsHtml;
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
      if ((riskStatus === 'stop_loss_hit' || riskStatus === 'take_profit_hit') && prevRiskState[r.code] !== riskStatus) {
        sendNotify(
          (riskStatus === 'stop_loss_hit' ? '⚠️ ' : '🎯 ') + r.name + (riskStatus === 'stop_loss_hit' ? ' 손절선 도달' : ' 익절선 도달'),
          fmt(r.price || 0) + '원'
        );
      }
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

  queueMiniCandleFetches(items.map(w => w.code));
  refreshRealtimeWatchlist(); // 실시간 시세 즉시 1회 (이후는 3초 타이머가 담당)
  tbody.querySelectorAll('.tradeDelBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      watchlistItems = watchlistItems.filter(w => w.code !== code);
      renderWatchlist(watchlistItems); // 즉시 반영, 응답 안 기다림
      if (currentModalCode === code) updateStarButton(code, currentModalName);
      fetch('/api/watchlist?code=' + code, { method: 'DELETE' }).catch(() => {});
    });
  });
}

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
      watchlistItems = watchlistItems.filter(w => w.code !== code);
      renderWatchlist(watchlistItems); // 서버 응답 기다리지 않고 로컬에서 즉시 반영 (깜빡임 없음)
      updateStarButton(code, name, price);
      fetch('/api/watchlist?code=' + code, { method: 'DELETE' }).catch(() => {});
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
    watchlistItems = watchlistItems.filter(w => w.code !== code);
    star.classList.remove('active');
    star.textContent = '☆';
    renderWatchlist(watchlistItems); // 서버 재조회 없이 로컬에서 즉시 반영
    fetch('/api/watchlist?code=' + code, { method: 'DELETE' }).catch(() => {});
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

document.getElementById('collectBtn').addEventListener('click', (e) => {
  const btn = e.target;
  btn.classList.add('spinning');
  btn.disabled = true;
  fetch('/api/run-now')
    .then(res => {
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('서버가 JSON이 아닌 응답을 보냄 (일시적인 타임아웃/네트워크 문제일 가능성, 잠시 후 다시 시도해보세요)');
      }
      return res.json();
    })
    .then(data => {
      if (data.saved !== undefined) {
        return load().then(() => {
          alert('시세 수집 완료: ' + data.saved + '종목 저장됨');
        });
      } else {
        alert('수집 실패: ' + (data.error || JSON.stringify(data)));
      }
    })
    .catch(err => alert('수집 요청 오류: ' + err.message))
    .finally(() => {
      btn.classList.remove('spinning');
      btn.disabled = false;
    });
});

// 조건검색 실시간 포착 - 조건에 편입되는 순간 즉시 화면에 뜸 (2분 cron 대기 없음)
// 키움 실시간 시각은 "125003"(HHMMSS) 형태로 옴
function fmtHHMM(t) {
  const s = String(t || '');
  return s.length >= 4 ? s.slice(0, 2) + ':' + s.slice(2, 4) : s;
}

function renderConditionDock(cond) {
  const board = document.getElementById('conditionDock');
  if (!cond || !cond.seq) { board.style.display = 'none'; return; }
  board.style.display = 'block';

  const tbody = document.querySelector('#conditionList tbody');
  const codes = cond.codes || [];
  conditionCodes = codes.slice(0, 50); // 실시간 시세 구독 우선순위에 쓰임
  conditionCodes.forEach(c => {
    if (!realtimeListCodes.includes(c)) realtimeListCodes.unshift(c);
  });
  if (realtimeListCodes.length > 180) realtimeListCodes.length = 180;

  // 편입 이력 기준으로 표시 - 조건에서 금방 빠져나간 종목도 사라지지 않고 남음
  const history = cond.history || [];
  const countEl = document.getElementById('conditionDockCount');
  if (countEl) countEl.textContent = history.length ? '(' + history.length + '건 · 현재 조건 ' + (cond.count || 0) + ')' : '';
  if (!history.length) {
    tbody.innerHTML = '<tr><td class="empty">아직 포착된 종목 없음 (감시 중)</td></tr>';
    return;
  }

  // 한 줄 표시: 별표 · 종목명(+신호아이콘) · 등락률 · 포착시각
  tbody.innerHTML = history.slice(0, 25).map(h => {
    const live = liveQuoteCache[h.code];
    const rate = live ? live.rate : h.rate;
    const name = h.name || (byCodeMap[h.code] && byCodeMap[h.code].name) || h.code;
    const rateHtml = (rate !== null && rate !== undefined)
      ? '<span class="' + (rate >= 0 ? 'up' : 'down') + '">' + (rate >= 0 ? '+' : '') + Number(rate).toFixed(2) + '%</span>'
      : '<span class="empty">-</span>';
    // 다음 2분 cron이 이 종목을 한 번이라도 스캔해서 byCodeMap에 들어왔으면, 그 신호들을 압축 아이콘으로 붙임
    // (한 줄 레이아웃이라 전체 배지는 못 넣고, 강한 신호 몇 개만 아이콘 하나씩)
    const info = byCodeMap[h.code];
    let icons = '';
    if (info) {
      if (info.cntrStr >= 105) icons += '💪';
      if (info.buyReq > info.selReq) icons += '🔄';
    }
    const verdictHtml = info ? '<span class="verdictIcon">' + computeVerdict(info).emoji + '</span>' : '';
    return '<tr class="clickable dockRow' + (h.stillIn ? '' : ' dockRowOut') + '" data-code="' + h.code + '">' +
      '<td class="dockStar">' + starHtml({ code: h.code, name: name }, '실시간포착') + '</td>' +
      '<td class="dockName">' + verdictHtml + name + (icons ? ' <span class="dockIcons">' + icons + '</span>' : '') + '</td>' +
      '<td class="dockRate">' + rateHtml + '</td>' +
      '<td class="dockTime">' + (h.initial ? '<span class="empty">충족중</span>' : '⚡' + fmtHHMM(h.time)) + '</td>' +
      '</tr>';
  }).join('');

  tbody.querySelectorAll('tr.dockRow').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.noRowClick')) return;
      const code = tr.dataset.code;
      const h = history.find(x => x.code === code);
      const live = liveQuoteCache[code];
      const item = byCodeMap[code] || {
        code: code,
        name: (h && h.name) || code,
        price: live ? live.price : (h ? h.price : 0),
        rate: live ? live.rate : (h ? h.rate : 0),
        buyReq: 0, selReq: 0, cntrStr: 0, signalChecks: [], volume: 0,
      };
      currentModalSourceBoard = '실시간포착';
      currentModalAddedState = '';
      openStockModal(item);
    });
  });
}

function renderMarketIndexBar(index) {
  if (!index || !index.kospi || !index.kosdaq) return;
  const bar = document.getElementById('marketIndexBar');
  const fmtIdx = (label, d) => {
    const cls = d.rate >= 0 ? 'up' : 'down';
    return '<span>' + label + ' <b>' + d.price.toFixed(2) + '</b> ' +
      '<span class="' + cls + '">' + (d.rate >= 0 ? '+' : '') + d.rate.toFixed(2) + '%</span></span>';
  };
  weakMarket = index.kospi.rate < 0 && index.kosdaq.rate < 0;
  bar.innerHTML = fmtIdx('KOSPI', index.kospi) + fmtIdx('KOSDAQ', index.kosdaq) +
    (weakMarket ? '<span class="weakMarketNote">⚠️ 시장 약세 - 급등주 신호 신뢰도 하락</span>' : '');
  bar.style.display = 'flex';
}

function applyRealtimeStocks(stocks) {
  if (!stocks) return;
  for (const code of Object.keys(stocks)) {
    const s = stocks[code];
    if (!s || !s.price) continue;
    liveQuoteCache[code] = { price: s.price, rate: s.rate, fetchedAt: Date.now() };
    updateWatchlistPriceCells(code);
    updateListRowRealtime(code, s);
    updateRealtimeExitSignal(code, s);
    if (currentModalCode === code) syncPriceEverywhere(code, s.price, s.rate);
  }
}

// 지수/실시간포착/관심종목시세 - 예전엔 API 3개를 따로(2~3초 간격씩) 폴링했는데, 전부 relay 메모리에서
// 읽는 거라 나눌 이유가 없어서 하나로 합침 (Cloudflare Worker 호출 3회 -> 1회, relay 왕복도 3회 -> 1회)
function pollRealtimeAll() {
  const listParam = realtimeListCodes.slice(0, 180).join(',');
  fetch('/api/realtime-all?list=' + encodeURIComponent(listParam))
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return;
      renderMarketIndexBar(data.index);
      renderConditionDock(data.condition);
      applyRealtimeStocks(data.stocks);
    })
    .catch(() => {});
}
pollRealtimeAll();
setInterval(() => { if (!document.hidden) pollRealtimeAll(); }, 2000); // 통합 폴링 2초 (relay 메모리 읽기라 부담 없음, 실제 수신 간격이 약 2초)

// 관심종목의 실시간 이탈신호 - 2분 cron을 기다리지 않고 3초 주기로 즉시 감지.
// cron 기반 이탈신호(체결강도꺾임/매도잔량역전/3틱연속하락)를 대체하는 게 아니라,
// "진입가 대비 손실"과 "체결강도 급락"만 더 빠르게 잡아서 추가로 보여줌 (서로 다른 판단 근거이므로 병행).
const prevCntrStrMap = {}; // 직전 체결강도 - 급락 감지에 씀
// 브라우저 알림 - 탭을 안 보고 있어도 강한 신호(관심종목 이탈신호, 손절/익절 도달)를 놓치지 않게 함.
// 매매 자동실행은 안 함 - 알림만 주고 판단/실행은 사람이 함.

// 하단 실시간 포착 패널 접기/펼치기 (화면 좁을 때 방해되지 않게)
document.getElementById('conditionDockHead').addEventListener('click', () => {
  const dock = document.getElementById('conditionDock');
  dock.classList.toggle('collapsed');
  document.getElementById('conditionDockToggle').textContent =
    dock.classList.contains('collapsed') ? '▲' : '▼';
  // 접으면 본문 여백도 줄여서 화면을 넓게 씀
  document.body.style.paddingBottom = dock.classList.contains('collapsed') ? '80px' : '195px';
});

// 시장 전체 지수 표시 - 지수가 빠지는 날엔 급등주 신호 신뢰도가 떨어지므로 그 맥락을 같이 보여줌
// (렌더링은 renderMarketIndexBar가 담당, 폴링은 아래 통합 pollRealtimeAll이 담당)


// 지난 24시간 안에 확인할 이상상황(relay 끊김/cron실패/메모리경고 등)이 있으면 상단에 배너로 알려줌.
// 사람이 매번 system-events를 열어보지 않아도 되게 하는 게 목적.
// Cloudflare 사용량 바로가기 - GraphQL API 인증이 계속 막혀서(계정 권한 이슈),
// 커스텀 패널 대신 Cloudflare가 이미 잘 보여주는 실제 대시보드로 바로 이동하는 링크로 대체함.
// 평소엔 숨겨두고 탭하면 펼쳐짐.
document.getElementById('cfUsageToggle').addEventListener('click', () => {
  const panel = document.getElementById('cfUsagePanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.innerHTML =
    '<div style="color:#eee; font-weight:600; margin-bottom:6px;">Cloudflare 사용량 바로가기</div>' +
    '<a href="https://dash.cloudflare.com/709dcc6af36c8ee7b6d3d99e7a9fe422/workers/services/view/kiwoomapi/production" target="_blank" rel="noopener" class="cfUsageLink">📈 Workers 요청/CPU 사용량</a>' +
    '<a href="https://dash.cloudflare.com/709dcc6af36c8ee7b6d3d99e7a9fe422/workers/d1" target="_blank" rel="noopener" class="cfUsageLink">🗄️ D1 데이터베이스 사용량</a>';
});

function loadSystemStatusBanner() {
  fetch('/api/system-status-summary')
    .then(res => res.json())
    .then(data => {
      const banner = document.getElementById('systemStatusBanner');
      if (!data.ok || !data.hasIssues) { banner.style.display = 'none'; return; }
      const summary = data.kinds.map(k => k.kind + ' ' + k.count + '건').join(' · ');
      banner.textContent = '⚠️ 최근 24시간 확인 필요: ' + summary;
      banner.style.display = 'block';
    })
    .catch(() => {});
}
loadSystemStatusBanner();
setInterval(() => { if (!document.hidden) loadSystemStatusBanner(); }, 120000); // 2분마다

// 나무위키 단타매매 기법: "장 개장~9시30분이 가장 활발한 시간대"
function updateGoldenWindowBanner() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  const banner = document.getElementById('goldenWindowBanner');
  if (minutes >= 9 * 60 && minutes <= 9 * 60 + 30) {
    banner.style.display = 'block';
    banner.className = '';
    banner.textContent = '⏰ 09:00~09:30 활발 시간대';
  } else {
    banner.style.display = 'none';
  }
}
updateGoldenWindowBanner();
setInterval(updateGoldenWindowBanner, 30000);

load();
let mainRefreshTimer = setInterval(() => {
  if (document.hidden) return; // 백그라운드면 새로고침 스킵
  load();
}, 15000); // 10초->15초 (momentum/연속상승 등 D1 지표는 cron이 2분마다만 갱신하므로 이보다 자주 당겨도 새 데이터가 없음 - 그만큼 아낀 여유를 실시간쪽에 씀)

// 관심종목 + 화면 리스트 종목 실시간 시세 - relay가 웹소켓으로 물고 있는 체결값을 읽어옴.
// 키움 TR 호출 0건이라 3초마다 갱신 가능. 리스트 종목은 지금 화면에 떠 있는 것만 보냄(그룹당 200 제한).
// 관심종목 추가 직후 즉시 1회 조회용 (그 뒤 주기적 갱신은 pollRealtimeAll이 담당)
function refreshRealtimeWatchlist() {
  const listParam = realtimeListCodes.slice(0, 180).join(',');
  fetch('/api/realtime-watchlist?list=' + encodeURIComponent(listParam))
    .then(res => res.json())
    .then(data => { if (data.ok) applyRealtimeStocks(data.stocks); })
    .catch(() => {});
}

// 관심종목의 실시간 이탈신호 - 2분 cron을 기다리지 않고 3초 주기로 즉시 감지.
// cron 기반 이탈신호(체결강도꺾임/매도잔량역전/3틱연속하락)를 대체하는 게 아니라,
// "진입가 대비 손실"과 "체결강도 급락"만 더 빠르게 잡아서 추가로 보여줌 (서로 다른 판단 근거이므로 병행).
// 브라우저 알림 - 탭을 안 보고 있어도 강한 신호(관심종목 이탈신호, 손절/익절 도달)를 놓치지 않게 함.
// 매매 자동실행은 안 함 - 알림만 주고 판단/실행은 사람이 함.
let notifyEnabled = false;
function requestNotifyPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => { notifyEnabled = perm === 'granted'; updateNotifyButton(); });
}
function updateNotifyButton() {
  const btn = document.getElementById('notifyToggleBtn');
  if (!btn) return;
  btn.textContent = notifyEnabled ? '🔔 알림 켜짐' : '🔕 알림 꺼짐';
  btn.classList.toggle('active', notifyEnabled);
}
function sendNotify(title, body) {
  // 탭을 보고 있을 때는 화면 배지로 이미 보이니 중복 알림 안 함 - 백그라운드일 때만 브라우저 알림
  if (!notifyEnabled || !document.hidden) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: body, tag: title }); // tag로 같은 종목 알림 중복 안 쌓이게
  } catch (e) {}
}

function updateRealtimeExitSignal(code, s) {
  const badge = document.querySelector('.realtimeExitBadge[data-code="' + code + '"]');
  if (!badge) return; // 관심종목이 아니면(리스트 종목이면) 해당 없음

  const w = watchlistItems.find(x => x.code === code);
  const reasons = [];

  if (w && w.entry_price > 0 && s.price) {
    const pnlPct = ((s.price - w.entry_price) / w.entry_price) * 100;
    if (pnlPct <= -2) reasons.push('진입가대비 ' + pnlPct.toFixed(2) + '%');
  }

  const prevCntr = prevCntrStrMap[code];
  if (prevCntr !== undefined && prevCntr >= 105 && (s.cntrStr || 0) < 100) {
    reasons.push('체결강도 급락(' + prevCntr.toFixed(0) + '→' + (s.cntrStr || 0).toFixed(0) + ')');
  }
  if (typeof s.cntrStr === 'number') prevCntrStrMap[code] = s.cntrStr;

  if (reasons.length) {
    badge.style.display = '';
    badge.innerHTML = '⚡실시간: ' + reasons.join(' · ');
    // 새로 생긴 이탈신호일 때만 알림 (매 갱신마다 반복 알림 안 되게, 직전엔 없었던 경우만)
    if (!prevRealtimeExitState[code]) {
      const name = (w && w.name) || (byCodeMap[code] && byCodeMap[code].name) || code;
      sendNotify('⚡ ' + name + ' 이탈신호', reasons.join(' · '));
    }
    prevRealtimeExitState[code] = true;
  } else {
    badge.style.display = 'none';
    prevRealtimeExitState[code] = false;
  }
}
const prevRealtimeExitState = {}; // { code: true|false } - 알림 중복 방지용

// 리스트(전체목록/추천/TOP20 등)에 이미 그려진 행의 가격·등락률만 실시간 값으로 갈아끼움.
// 행 전체를 다시 그리지 않아서 스크롤/깜빡임 없음.
function updateListRowRealtime(code, s) {
  const rows = document.querySelectorAll('tr.twoLineRow[data-code="' + code + '"]');
  rows.forEach(tr => {
    const priceEl = tr.querySelector('.rowPrice');
    if (priceEl) priceEl.textContent = fmt(s.price) + '원';
    const sub = tr.nextElementSibling;
    if (!sub || !sub.classList.contains('twoLineSubRow')) return;
    const rateEl = sub.querySelector('td > span:first-child');
    if (rateEl && typeof s.rate === 'number') {
      rateEl.textContent = (s.rate >= 0 ? '+' : '') + s.rate.toFixed(2) + '%';
      rateEl.className = s.rate >= 0 ? 'up' : 'down';
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load(); // 화면 복귀 시 즉시 최신화
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// 홈 화면에 설치되어 standalone/fullscreen으로 실행 중일 때만 시스템 내비게이션 바 숨김 재시도
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches
  || window.navigator.standalone === true;

if (isStandalone && document.documentElement.requestFullscreen) {
  const tryFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    document.removeEventListener('click', tryFullscreen);
  };
  document.addEventListener('click', tryFullscreen, { once: true });
}

// 크롬이 자동으로 띄우는 PWA 설치 배너 억제 (설치 유도 기능 자체를 없앰)
window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());
`;
}

// ---------- 대시보드 HTML ----------
function renderDashboard() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>급등주 스크리너 (5~15%)</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#111111">
<meta name="apple-mobile-web-app-title" content="급등주">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.svg">
<style>
  body { font-family: -apple-system, sans-serif; background:#111; color:#eee; margin:0; padding:16px 16px 195px; }
  h1 { font-size:18px; margin:0 0 4px; }
  #notifyToggleBtn {
    font-size:11px; background:#232323; color:#888; border:none; border-radius:8px;
    padding:4px 8px; margin-left:8px; vertical-align:middle; cursor:pointer;
  }
  #notifyToggleBtn.active { background:#1c2a1c; color:#69db7c; }
  .sub { color:#888; font-size:12px; margin-bottom:16px; }
  .freshnessLegend { color:#666; font-size:10px; margin-bottom:14px; }
  .board { background:#1c1c1c; border-radius:12px; padding:12px; margin-bottom:20px; }
  .board h2 { font-size:14px; margin:0 0 8px; color:#ff6b6b; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { padding:6px 4px; text-align:right; border-bottom:1px solid #2a2a2a; }
  th:first-child, td:first-child { text-align:left; }
  tr.twoLineRow td { padding-bottom:2px; font-size:14px; }
  tr.twoLineRow .rowPrice { float:right; font-weight:700; font-size:15px; color:#eee; }
  tr.twoLineSubRow td { padding-top:0; padding-bottom:10px; border-bottom:1px solid #232323; font-size:12px; color:#999; }
  tr.twoLineSubRow { cursor:default; }
  .up { color:#ff6b6b; }
  .down { color:#4d9fff; }
  .delta { color:#ffd43b; }
  .momentumLine { font-size:11px; color:#888; margin-top:2px; }
  .badgeRow { margin-top:3px; display:flex; flex-wrap:wrap; gap:4px; }
  .badge { font-size:10px; background:#232323; color:#aaa; padding:2px 6px; border-radius:6px; }
  .badgeVolume { background:#2a2110; color:#ffa94d; }
  .badgeHigh { background:#16241c; color:#69db7c; }
  .badgeLimit { background:#2a1616; color:#ff8787; }
  .badgeRepeat { background:#1a1c2a; color:#8ea8ff; }
  .badgeBid { background:#1c1a2a; color:#c48eff; }
  .badgeCntr { background:#2a1a24; color:#ff8ec4; }
  .badgeFresh { background:#132a1a; color:#5ce0a0; }
  .empty { color:#666; padding:12px 0; }
  tr.clickable { cursor:pointer; }
  tr.clickable:active { background:#2a2a2a; }

  /* 모달 */
  #modalOverlay {
    display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6);
    z-index:100; align-items:flex-end; justify-content:center;
  }
  #modalOverlay.open { display:flex; }
  #modalBox {
    background:#1c1c1c; width:100%; max-width:420px; border-radius:16px 16px 0 0;
    padding:20px 16px 24px; animation:slideUp .15s ease-out;
  }
  @keyframes slideUp { from{ transform:translateY(20px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
  #modalBox h3 { margin:0; font-size:22px; font-weight:700; white-space:nowrap; }
  .clickableName { cursor:pointer; text-decoration:underline dotted; font-size:12px; color:#999; white-space:nowrap; }
  .clickableName:active { opacity:0.6; }
  .modalHeadRow {
    display:flex; align-items:center; flex-wrap:wrap; gap:6px 10px;
    margin-bottom:4px;
  }
  #modalCodeBadge { font-size:12px; color:#999; white-space:nowrap; }
  #modalTopClose {
    margin-left:auto; color:#888; font-size:20px; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    min-width:40px; min-height:40px;
  }
  #modalTopClose:active { color:#eee; }
  .modalPriceRow {
    display:flex; align-items:baseline; gap:10px;
    margin-bottom:16px;
  }
  .modalPriceInline { font-size:20px; color:#eee; font-weight:700; }
  .starBtn {
    font-size:26px; cursor:pointer; color:#666;
    display:inline-flex; align-items:center; justify-content:center;
    min-width:40px; min-height:40px; padding:4px;
  }
  .starBtn.active { color:#ffd43b; }
  .topPickStar {
    font-size:20px; cursor:pointer; color:#666;
    display:inline-flex; align-items:center; justify-content:center;
    min-width:36px; min-height:36px; padding:6px; vertical-align:middle;
  }
  .topPickStar.active { color:#ffd43b; }
  .modalPriceRow .up { color:#ff6b6b; font-size:16px; }
  #modalDetail:empty { display:none; }
  #modalOrderBook { margin-bottom:12px; }
  .orderBookBar { display:flex; height:10px; border-radius:5px; overflow:hidden; background:#151515; }
  .orderBookBuy { background:#ff6b6b; }
  .orderBookSell { background:#4d9fff; }
  .orderBookLabel { display:flex; justify-content:space-between; font-size:11px; color:#888; margin-top:4px; }
  .orderBookLabel .buyLabel { color:#ff6b6b; }
  .orderBookLabel .sellLabel { color:#4d9fff; }
  #modalNewsLinks { display:flex; gap:8px; margin-bottom:12px; }
  .newsLink {
    flex:1; text-align:center; padding:8px 6px; border-radius:8px;
    background:#2a2a2a; color:#aaa; font-size:12px; text-decoration:none;
  }
  #modalNewsSummary { margin-bottom:12px; max-height:78px; overflow-y:auto; }
  .newsItem {
    display:block; background:#151515; border-radius:8px; padding:8px 10px;
    margin-bottom:6px; text-decoration:none;
  }
  .newsItemTitle { font-size:12px; color:#eee; font-weight:600; margin-bottom:2px; }
  .newsItemDesc { font-size:11px; color:#888; line-height:1.4; }
  .sentimentTag { display:inline-block; font-size:10px; padding:1px 6px; border-radius:8px; font-weight:700; margin-right:2px; }
  .sentimentTag.sentimentUp { background:#2a1616; color:#ff8787; }
  .sentimentTag.sentimentDown { background:#16243a; color:#4d9fff; }
  .sentimentTag.sentimentNeutral { background:#222; color:#999; }
  #modalDartSummary { margin-bottom:12px; max-height:78px; overflow-y:auto; }
  .dartItem { border-left:2px solid #ffd43b; }
  .highGap { font-size:11px; color:#888; margin-top:2px; }
  .sellWarning { font-size:12px; color:#ff8787; background:#2a1616; border-radius:8px; padding:8px 10px; margin-top:8px; }
  .sellOk { font-size:12px; color:#69db7c; background:#16241c; border-radius:8px; padding:8px 10px; margin-top:8px; }
  .highGap b { color:#ffa94d; }
  #modalDetail { margin-bottom:14px; }
  .detailLoading, .detailError { color:#888; font-size:13px; padding:8px 0; }
  .detailError { color:#ff8787; }
  .detailGrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#151515; border-radius:10px; padding:10px 12px; font-size:12px; color:#999; }
  .detailGrid b { display:block; font-size:14px; color:#eee; margin-top:2px; }
  .detailGrid b.up { color:#ff6b6b; }
  .chartRange { font-size:11px; color:#888; text-align:center; margin-top:4px; }
  .chartTimeLabels { display:flex; justify-content:space-between; font-size:10px; color:#666; padding:2px 6px 0; }
  .liveDot { color:#69db7c; animation:blink 1.5s ease-in-out infinite; }
  @keyframes blink { 0%,100%{ opacity:1; } 50%{ opacity:0.2; } }
  .chartWrap { overflow:hidden; touch-action:none; cursor:grab; border-radius:8px; background:#151515; }
  .chartWrap:active { cursor:grabbing; }
  .chartWrap svg { display:block; will-change:transform; }
  .chartResetBtn { color:#4d9fff; text-decoration:underline dotted; cursor:pointer; }
  .periodRow { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
  .periodBtn {
    flex:1; min-width:40px; padding:8px 4px; border-radius:8px; border:none;
    background:#2a2a2a; color:#aaa; font-size:12px; cursor:pointer;
  }
  .periodBtn.active { background:#ff6b6b; color:#111; font-weight:600; }
  .boardHeadRow { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .boardHeadRow h2 { margin:0; }
  .sortToggle { display:flex; gap:6px; }
  .sortBtn { background:#2a2a2a; color:#aaa; border:none; border-radius:6px; padding:5px 10px; font-size:11px; cursor:pointer; }
  .sortBtn.active { background:#ff6b6b; color:#111; font-weight:600; }
  .tradeDelBtn { color:#666; cursor:pointer; font-size:14px; }
  .pnlPositive { color:#ff6b6b; }
  .pnlNegative { color:#4d9fff; }
  .addedDate { font-size:10px; color:#666; font-weight:normal; }
  .addedContext { font-size:10px; color:#8ea8ff; font-weight:normal; margin-top:1px; }
  .riskLevelLine { font-size:10px; color:#888; margin-top:1px; }
  .peakDrawdownLine { font-size:10px; margin-top:1px; }
  .peakWarnLight { color:#888; } /* -0.15%~-1% : 아직 크게 걱정할 단계는 아니지만 꺾이는 중 */
  .peakWarnMid { color:#ffa94d; } /* -1%~-2% : 주의 */
  .verdictIcon { margin-right:2px; font-size:12px; }
  .riskBadge { font-size:10px; font-weight:700; margin-top:2px; }
  .riskBadgeDown { color:#4d9fff; }
  .riskBadgeUp { color:#ff6b6b; }
  .riskBadgeExit { color:#ffa94d; }
  .miniChartRow td { border-bottom:1px solid #2a2a2a; padding:0 4px 8px; }
  .miniChartRow { background:transparent; }
  .modalBtn {
    display:block; width:100%; box-sizing:border-box; text-align:center;
    padding:14px; margin-bottom:10px; border-radius:10px; border:none;
    font-size:15px; font-weight:600; text-decoration:none; cursor:pointer;
  }
  .modalBtn.price { background:#2a2a2a; color:#eee; }
  .modalBtn.risk { background:#2a2a2a; color:#ffa94d; }
  .modalBtn.ai { background:#2a2a2a; color:#a78bfa; }
  .actionRow { display:flex; gap:8px; margin-bottom:10px; }
  .actionRow .modalBtn {
    flex:1; width:auto; margin-bottom:0; padding:10px 4px;
    font-size:12px; white-space:nowrap;
  }
  .aiAnalysisCard {
    background:#17141f; border:1px solid #4c3a80; border-radius:10px;
    padding:12px; font-size:13px; line-height:1.6; color:#ddd; margin-bottom:12px;
    white-space:pre-wrap; max-height:340px; overflow-y:auto;
  }
  .aiAnalysisNote { font-size:10px; color:#666; margin-top:6px; }
  .riskGrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#151515; border-radius:10px; padding:10px 12px; font-size:12px; color:#999; margin-bottom:12px; }
  .riskGrid b { display:block; font-size:15px; margin-top:2px; }
  .riskGrid .stopLoss b { color:#4d9fff; }
  .riskGrid .takeProfit b { color:#ff6b6b; }
  .riskNote { font-size:10px; color:#666; margin-top:6px; grid-column:1 / -1; }
  .gcCard { border-radius:10px; padding:10px 12px; font-size:13px; font-weight:600; margin-bottom:12px; }
  .gcCard.gcUp { background:#1c2a1c; color:#69db7c; }
  .gcCard.gcDown { background:#2a1c1c; color:#ff8787; }
  .gcDetail { font-size:11px; color:#999; font-weight:normal; margin-top:4px; }
  .modalBtn.cancel { background:transparent; color:#888; margin-bottom:0; padding:10px; }
  .streakBoard h2 { color:#ffd43b; }
  .streakBoard.streak5 h2 { color:#69db7c; }
  .topPicksBoard { border:1px solid #ffd43b; background:linear-gradient(180deg,#1c1a0f,#1c1c1c); }
  .topPicksBoard h2 { color:#ffd43b; }
  .topPicksBoard tr.clickable:active { background:#2a2410; }
  .intervalTag { font-size:11px; color:#888; font-weight:normal; }
  #conditionDock {
    position:fixed; left:0; right:0; bottom:0; z-index:80;
    background:#17171a; border-top:1px solid #333;
    box-shadow:0 -2px 10px rgba(0,0,0,0.5);
  }
  #conditionDockHead {
    display:flex; justify-content:space-between; align-items:center;
    padding:7px 12px; font-size:12px; font-weight:600; color:#ffd43b;
    cursor:pointer; user-select:none;
  }
  #conditionDockCount { color:#888; font-weight:normal; font-size:11px; margin-left:4px; }
  #conditionDockToggle { color:#888; font-size:11px; }
  #conditionDockBody {
    max-height:161px; /* 한 줄 표시 기준 약 7종목, 나머지는 스크롤 */
    overflow-y:auto; -webkit-overflow-scrolling:touch;
    padding:0 12px 8px;
    transition:max-height .15s ease;
  }
  #conditionDock.collapsed #conditionDockBody {
    max-height:24px; /* 접으면 1종목만 보이게 (완전히 숨기지 않음) */
    overflow:hidden;
    padding-bottom:2px;
  }
  #conditionDockBody table { width:100%; border-collapse:collapse; font-size:13px; }
  #conditionDockBody td { padding:0px 4px; line-height:1.2; border-bottom:1px solid #232323; }
  #conditionDockBody tr.dockRow { cursor:pointer; }
  #conditionDockBody tr.dockRow:active { background:#2a2a2a; }
  #conditionDockBody tr.dockRowOut { opacity:0.45; } /* 조건에서 이탈한 종목은 흐리게 */
  .dockStar { width:34px; padding-right:0 !important; }
  .dockName { text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:0; }
  .dockRate { text-align:right; white-space:nowrap; width:72px; }
  .dockTime { text-align:right; white-space:nowrap; width:64px; font-size:11px; color:#888; }
  .dockIcons { font-size:11px; }
  #systemStatusBanner {
    background:#2a1616; color:#ff8787; font-weight:600;
    font-size:12px; padding:8px 12px; border-radius:10px; margin-bottom:14px;
    cursor:pointer;
  }
  #cfUsageToggle {
    position:fixed; left:14px; top:14px; z-index:95;
    width:32px; height:32px; border-radius:50%; background:#232323;
    display:flex; align-items:center; justify-content:center; font-size:14px;
    opacity:0.5; cursor:pointer;
  }
  #cfUsageToggle:active { opacity:1; }
  #cfUsagePanel {
    position:fixed; left:14px; top:52px; z-index:95;
    background:#1c1c1c; border:1px solid #333; border-radius:10px;
    padding:10px 12px; font-size:11px; color:#aaa; width:220px;
    box-shadow:0 2px 10px rgba(0,0,0,0.5);
  }
  #cfUsagePanel .cfUsageRow { display:flex; justify-content:space-between; margin-top:4px; }
  #cfUsagePanel .cfUsageBar { background:#333; border-radius:4px; height:4px; margin-top:2px; overflow:hidden; }
  #cfUsagePanel .cfUsageBarFill { height:100%; background:#69db7c; }
  #cfUsagePanel .cfUsageBarFill.warn { background:#ffa94d; }
  #cfUsagePanel .cfUsageBarFill.danger { background:#ff6b6b; }
  #cfUsagePanel .cfUsageLink {
    display:block; background:#232323; color:#8ea8ff; text-decoration:none;
    padding:8px 10px; border-radius:8px; margin-top:6px; font-size:12px;
  }
  #cfUsagePanel .cfUsageLink:active { background:#2a2a2a; }
  #goldenWindowBanner {
    background:linear-gradient(90deg,#ff6b6b,#ffa94d); color:#111; font-weight:600;
    font-size:12px; padding:8px 12px; border-radius:10px; margin-bottom:14px;
  }
  #marketIndexBar {
    display:flex; gap:14px; font-size:12px; color:#aaa;
    background:#1c1c1c; border-radius:10px; padding:8px 12px; margin-bottom:14px;
  }
  #marketIndexBar .weakMarketNote { color:#ffa94d; }
  .streakBadge { color:#ffd43b; font-size:11px; margin-left:6px; }
  #reloadBtn {
    position:fixed; right:14px; top:calc(50% - 30px); transform:translateY(-50%);
    width:50px; height:50px; border-radius:50%; border:none;
    background:#ff6b6b; color:#111; font-size:22px; z-index:90;
    box-shadow:0 2px 8px rgba(0,0,0,0.4); cursor:pointer;
  }
  #reloadBtn.spinning { animation:spin 0.6s linear; }
  @keyframes spin { from{ transform:translateY(-50%) rotate(0deg); } to{ transform:translateY(-50%) rotate(360deg); } }
  #collectBtn:disabled, #patternScanBtn:disabled { opacity:0.35; cursor:not-allowed; }
  #collectBtn {
    position:fixed; right:14px; top:calc(50% + 30px); transform:translateY(-50%);
    width:50px; height:50px; border-radius:50%; border:none;
    background:#69db7c; color:#111; font-size:20px; z-index:90;
    box-shadow:0 2px 8px rgba(0,0,0,0.4); cursor:pointer;
  }
  #collectBtn.spinning { animation:spin 0.9s linear infinite; }
  #fullReloadBtn {
    position:fixed; right:14px; top:calc(50% + 90px); transform:translateY(-50%);
    width:50px; height:50px; border-radius:50%; border:none;
    background:#4d9fff; color:#111; font-size:20px; z-index:90;
    box-shadow:0 2px 8px rgba(0,0,0,0.4); cursor:pointer;
  }
  #fullReloadBtn.spinning { animation:spin 0.6s linear; }
</style>
</head>
<body>
  <button id="reloadBtn" title="화면 새로고침">🔄</button>
  <button id="collectBtn" title="지금 시세 즉시 수집">⚡</button>
  <button id="fullReloadBtn" title="전체 페이지 리로드">🔁</button>
  <h1>🔥 급등주 스크리너 <button id="notifyToggleBtn" onclick="requestNotifyPermission()">🔕 알림 꺼짐</button></h1>
  <div class="sub" id="ts">불러오는 중...</div>
  <div class="freshnessLegend"><span class="liveDot">●</span> 가격·등락률·지수·실시간포착: 실시간(초단위) &nbsp;·&nbsp; momentum/연속상승/신고가 등 지표: 2분 기준</div>
  <div id="marketIndexBar" style="display:none;"></div>
  <div id="cfUsageToggle" title="Cloudflare 사용량 보기">📊</div>
  <div id="cfUsagePanel" style="display:none;"></div>

  <div id="systemStatusBanner" style="display:none;"></div>
  <div id="goldenWindowBanner" style="display:none;"></div>

  <div class="board">
    <h2>⭐ 관심종목 <span class="intervalTag">(100만원 매수 가정, 수수료·세금 반영)</span></h2>
    <table id="watchlist">
      <thead><tr><th>종목</th><th>현재가</th><th>등락률</th><th>진입가</th><th>수익률</th><th></th></tr></thead>
      <tbody><tr><td class="empty">별표 눌러서 종목을 추가해보세요</td></tr></tbody>
    </table>
  </div>

  <div class="board topPicksBoard">
    <h2>🎯 추천 종목 TOP10 <span class="intervalTag">(알고리즘 종합점수 - 매매 추천 아님, 참고용)</span></h2>
    <table id="recommended">
      <tbody><tr><td class="empty">데이터 없음</td></tr></tbody>
    </table>
  </div>

  <div class="board topPicksBoard">
    <h2>🏆 오늘의 TOP 20</h2>
    <table id="topPicks">
      <tbody><tr><td class="empty">데이터 없음</td></tr></tbody>
    </table>
  </div>

  <div class="board">
    <div class="boardHeadRow">
      <h2>🔍 지난 1주일 패턴 유사 종목</h2>
      <button id="patternScanBtn" class="sortBtn">스캔 시작</button>
    </div>
    <table id="patternScan">
      <thead><tr><th>종목</th><th>유사한 날</th><th>유사도</th></tr></thead>
      <tbody><tr><td class="empty">스캔 시작 버튼을 눌러주세요</td></tr></tbody>
    </table>
  </div>

  <div class="board streakBoard streak5">
    <h2>🚀 5연속 상승 종목 <span class="intervalTag">(2분간격)</span></h2>
    <table id="streak5"><tbody><tr><td class="empty">데이터 없음</td></tr></tbody></table>
  </div>

  <div class="board streakBoard">
    <h2>⚡ 3연속 상승 종목 <span class="intervalTag">(2분간격)</span></h2>
    <table id="streak3"><tbody><tr><td class="empty">데이터 없음</td></tr></tbody></table>
  </div>

  <div class="board">
    <h2>2분 전보다 더 오른 TOP5</h2>
    <table id="top5"><tbody><tr><td class="empty">데이터 없음</td></tr></tbody></table>
  </div>

  <div class="board">
    <h2>🌊 눌림목 후보 <span class="intervalTag">(고점대비 1~4%p 조정 후 재상승 시도)</span></h2>
    <table id="pullback"><tbody><tr><td class="empty">데이터 없음</td></tr></tbody></table>
  </div>

  <div class="board">
    <div class="boardHeadRow">
      <h2>전체 목록 (등락률 5~15%)</h2>
      <div class="sortToggle">
        <button class="sortBtn active" id="sortByMomentum">종합점수순</button>
        <button class="sortBtn" id="sortByRate">등락률순</button>
        <button class="sortBtn" id="sortByVolumeDesc">거래량 많은순</button>
        <button class="sortBtn" id="sortByVolumeAsc">거래량 적은순</button>
        <button class="sortBtn" id="sortByCntrStr">체결강도순</button>
        <button class="sortBtn" id="sortBySignal">신호점수순</button>
        <button class="sortBtn" id="sortByTradeValue">거래대금순</button>
      </div>
    </div>
    <table id="all">
      <tbody><tr><td class="empty">데이터 없음</td></tr></tbody>
    </table>
  </div>

  <div id="conditionDock" style="display:none;">
    <div id="conditionDockHead">
      <span>⚡ 실시간 포착 <span id="conditionDockCount"></span></span>
      <span id="conditionDockToggle">▼</span>
    </div>
    <div id="conditionDockBody">
      <table id="conditionList"><tbody><tr><td class="empty">감시 중...</td></tr></tbody></table>
    </div>
  </div>

  <div id="modalOverlay">
    <div id="modalBox">
      <div class="modalHeadRow">
        <span id="modalStarBtn" class="starBtn">☆</span>
        <h3 id="modalName">-</h3>
        <span id="modalCodeBadge">-</span>
        <span id="modalTopClose">✕</span>
      </div>
      <div class="modalPriceRow">
        <span id="modalPrice" class="modalPriceInline">-</span>
        <span class="up" id="modalRate">-</span>
      </div>
      <div id="modalOrderBook"></div>
      <div id="modalNewsLinks"></div>
      <div id="modalNewsSummary"></div>
      <div id="modalDartSummary"></div>
      <div id="modalDetail"></div>
      <div class="periodRow" id="periodRow">
        <button class="periodBtn" data-period="T">틱</button>
        <button class="periodBtn active" data-period="1">1분</button>
        <button class="periodBtn" data-period="5">5분</button>
        <button class="periodBtn" data-period="15">15분</button>
        <button class="periodBtn" data-period="30">30분</button>
        <button class="periodBtn" data-period="D">일봉</button>
        <button class="periodBtn" data-period="W">주봉</button>
        <button class="periodBtn" data-period="M">월봉</button>
      </div>
      <div class="actionRow">
        <button class="modalBtn price" id="modalPriceBtn">💰 현재가</button>
        <button class="modalBtn risk" id="modalRiskBtn">🎯 손절/익절</button>
        <button class="modalBtn ai" id="modalAiBtn">🤖 AI 분석</button>
      </div>
      <button class="modalBtn cancel" id="modalCancelBtn">닫기</button>
    </div>
  </div>

<script src="/app.js"></script>
</body>
</html>`;
}

// 조회(시세/차트/랭킹 등)는 정확도를 위해 실전 서버+실전키를 씀.
// 매수/매도 주문은 기존 모의투자 키/서버 그대로 유지 (kind === "order"일 때만).
function kiwoomHost(env, kind) {
  if (kind === "order") {
    return env.KIWOOM_MOCK === "false" ? "https://api.kiwoom.com" : "https://mockapi.kiwoom.com";
  }
  return "https://api.kiwoom.com"; // 조회는 항상 실전 서버
}

// 조회(실전) 요청은 고정 IP 중계서버를 거쳐서 나감 (Cloudflare Workers는 IP가 안 고정돼서
// 키움의 "지정단말기" 제한을 직접 통과할 수 없음 - 대신 고정 IP 서버가 중간에서 대신 요청함)
async function kiwoomRelayFetch(env, path, options) {
  if (!env.RELAY_URL || !env.RELAY_SECRET) {
    throw new Error("RELAY_URL / RELAY_SECRET 시크릿이 설정되지 않았습니다.");
  }
  return fetch(`${env.RELAY_URL}${path}`, {
    ...options,
    headers: {
      ...(options && options.headers),
      "X-Relay-Secret": env.RELAY_SECRET,
    },
  });
}

function kiwoomCreds(env, kind) {
  if (kind === "order") {
    return { appkey: env.KIWOOM_APP_KEY, secretkey: env.KIWOOM_APP_SECRET }; // 기존 모의투자 키
  }
  return { appkey: env.KIWOOM_APP_KEY_REAL, secretkey: env.KIWOOM_APP_SECRET_REAL }; // 새로 발급받은 실전키
}

// 토큰 캐시: 조회용(실전)/주문용(모의)을 따로 관리 (키가 다르므로 토큰도 따로 발급받아야 함)
let cachedToken = null;
let cachedTokenExpiryMs = 0;
let cachedOrderToken = null;
let cachedOrderTokenExpiryMs = 0;
const TOKEN_CACHE_MS = 3 * 60 * 60 * 1000; // 3시간 (실제 유효기간보다 넉넉히 짧게 잡아 안전마진)

async function kiwoomIssueToken(env, forceRefresh, kind) {
  const isOrder = kind === "order";
  if (!isOrder && (!env.KIWOOM_APP_KEY_REAL || !env.KIWOOM_APP_SECRET_REAL)) {
    throw new Error("KIWOOM_APP_KEY_REAL / KIWOOM_APP_SECRET_REAL 시크릿이 설정되지 않았습니다. (조회는 실전키가 필요합니다)");
  }
  const now = Date.now();
  if (!forceRefresh) {
    if (isOrder && cachedOrderToken && now < cachedOrderTokenExpiryMs) return cachedOrderToken;
    if (!isOrder && cachedToken && now < cachedTokenExpiryMs) return cachedToken;
  }
  const creds = kiwoomCreds(env, kind);
  const tokenBody = JSON.stringify({
    grant_type: "client_credentials",
    appkey: creds.appkey,
    secretkey: creds.secretkey,
  });
  const res = isOrder
    ? await fetch(`${kiwoomHost(env, kind)}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: tokenBody,
      })
    : await kiwoomRelayFetch(env, "/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: tokenBody,
      });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  }
  if (isOrder) {
    cachedOrderToken = data.token;
    cachedOrderTokenExpiryMs = now + TOKEN_CACHE_MS;
    return cachedOrderToken;
  }
  cachedToken = data.token;
  cachedTokenExpiryMs = now + TOKEN_CACHE_MS;
  return cachedToken;
}

async function kiwoomBuyOrder(env, code) {
  if (!env.KIWOOM_APP_KEY || !env.KIWOOM_APP_SECRET) {
    throw new Error("KIWOOM_APP_KEY / KIWOOM_APP_SECRET 시크릿이 설정되지 않았습니다.");
  }
  const qty = parseInt(env.KIWOOM_BUY_QTY || "1", 10);
  const token = await kiwoomIssueToken(env, false, "order");

  const res = await fetch(`${kiwoomHost(env, "order")}/api/dostk/ordr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      authorization: `Bearer ${token}`,
      "cont-yn": "N",
      "next-key": "",
      "api-id": "kt10000", // 주식 매수주문
    },
    body: JSON.stringify({
      dmst_stex_tp: "KRX",
      stk_cd: code,
      ord_qty: String(qty),
      ord_uv: "0", // 시장가는 주문단가 0
      trde_tp: "3", // 3: 시장가
    }),
  });
  const data = await res.json();
  return { ok: res.ok && data.return_code === 0, qty, mock: env.KIWOOM_MOCK !== "false", raw: data };
}

async function kiwoomSellOrder(env, code) {
  if (!env.KIWOOM_APP_KEY || !env.KIWOOM_APP_SECRET) {
    throw new Error("KIWOOM_APP_KEY / KIWOOM_APP_SECRET 시크릿이 설정되지 않았습니다.");
  }
  const qty = parseInt(env.KIWOOM_SELL_QTY || env.KIWOOM_BUY_QTY || "1", 10);
  const token = await kiwoomIssueToken(env, false, "order");

  const res = await fetch(`${kiwoomHost(env, "order")}/api/dostk/ordr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      authorization: `Bearer ${token}`,
      "cont-yn": "N",
      "next-key": "",
      "api-id": "kt10001", // 주식 매도주문
    },
    body: JSON.stringify({
      dmst_stex_tp: "KRX",
      stk_cd: code,
      ord_qty: String(qty),
      ord_uv: "0", // 시장가는 주문단가 0
      trde_tp: "3", // 3: 시장가
    }),
  });
  const data = await res.json();
  return { ok: res.ok && data.return_code === 0, qty, mock: env.KIWOOM_MOCK !== "false", raw: data };
}

// ---------- 키움 REST API: 현재가(시세표성정보) ----------
// ---------- 네이버 뉴스 검색 API ----------
function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

// ---------- DART: corp_code 매핑 동기화 + 공시 조회 ----------
function parseCorpCodeXml(xmlText) {
  const entries = [];
  const re = /<list>\s*<corp_code>([^<]*)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<stock_code>([^<]*)<\/stock_code>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const stockCode = m[3].trim();
    if (stockCode.length === 6) {
      entries.push({ corp_code: m[1].trim(), corp_name: m[2].trim(), stock_code: stockCode });
    }
  }
  return entries;
}

async function syncDartCorpCodes(env) {
  if (!env.DART_API_KEY) {
    throw new Error("DART_API_KEY 시크릿이 설정되지 않았습니다.");
  }
  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${env.DART_API_KEY}`);
  if (!res.ok) {
    throw new Error(`DART corpCode 다운로드 실패: ${res.status}`);
  }
  const zipBytes = new Uint8Array(await res.arrayBuffer());
  const unzipped = unzipSync(zipBytes);
  const xmlBytes = unzipped["CORPCODE.xml"];
  if (!xmlBytes) {
    throw new Error("zip 안에 CORPCODE.xml이 없습니다: " + Object.keys(unzipped).join(", "));
  }
  const xmlText = new TextDecoder("utf-8").decode(xmlBytes);
  const entries = parseCorpCodeXml(xmlText);
  if (entries.length === 0) {
    throw new Error("파싱된 종목이 0개입니다. XML 형식이 예상과 다를 수 있습니다.");
  }

  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO dart_corp_codes (stock_code, corp_code, corp_name) VALUES (?, ?, ?)`
  );
  const CHUNK = 50;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK).map((e) => stmt.bind(e.stock_code, e.corp_code, e.corp_name));
    await env.DB.batch(chunk);
  }
  return entries.length;
}

async function getDartCorpCode(env, stockCode) {
  const row = await env.DB.prepare(`SELECT corp_code, corp_name FROM dart_corp_codes WHERE stock_code = ?`)
    .bind(stockCode)
    .first();
  return row || null;
}

async function fetchDartDisclosures(env, corpCode) {
  const end = todayYYYYMMDD();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const start = startDate.toISOString().slice(0, 10).replace(/-/g, "");
  const url =
    `https://opendart.fss.or.kr/api/list.json?crtfc_key=${env.DART_API_KEY}` +
    `&corp_code=${corpCode}&bgn_de=${start}&end_de=${end}&page_count=5` +
    `&sort=date&sort_mth=desc`; // 접수일자 기준 최신순
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "000" && data.status !== "013") {
    // 013 = 조회된 데이터 없음 (정상 케이스)
    throw new Error(`DART 공시 조회 실패: ${JSON.stringify(data)}`);
  }
  return (data.list || [])
    .map((item) => ({
      title: item.report_nm,
      date: item.rcept_dt,
      link: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // API 응답 순서와 무관하게 서버에서도 최신순 보장
}

// ---------- 주식 분석 에이전트 (Claude API) ----------
async function askStockExpert(env, promptText) {
  if (!env.AI) {
    throw new Error("AI 바인딩이 설정되지 않았습니다. wrangler.toml에 [ai] binding=\"AI\" 필요.");
  }
  const systemPrompt =
    "당신은 한국 주식시장 데이터를 해석하는 보조 도구입니다. " +
    "주어진 항목(가격, 등락률, 체결강도, 호가잔량, 뉴스, 공시)을 그대로 다시 나열하지 마세요 — " +
    "이미 사용자가 화면에서 다 보고 있는 정보입니다. 대신 항목들을 서로 연결지어 깊이 있게 해석하세요. " +
    "다음 구조로 답하세요:\n" +
    "**긍정적 신호**: 지금 상황에서 우호적으로 보이는 부분과 그 이유\n" +
    "**주의할 점**: 앞뒤가 안 맞거나 리스크로 보이는 부분과 그 이유\n" +
    "**뉴스/공시 연관성**: 최근 뉴스나 공시가 오늘 등락률과 시점상 관련 있어 보이는지, " +
    "관련 있다면 어떻게 관련 있는지 구체적으로. 관련 없어 보이면 '특별한 연관성 확인 안 됨'이라고 명시\n" +
    "**참고**: 이런 유형의 급등 이후 통상적으로 나타나는 패턴이나 유의사항\n" +
    "각 섹션은 2~4문장으로 구체적으로 설명하세요. 애매하게 얼버무리지 말고, " +
    "왜 그렇게 판단했는지 근거를 같이 말하세요. " +
    "'사세요', '파세요', '지금이 매수 타이밍입니다' 같은 직접적인 매매 추천이나 " +
    "확정적인 가격 전망은 절대 하지 마세요. 데이터에 없는 내용은 추측하지 말고, " +
    "확실하지 않으면 그렇다고 밝히세요. " +
    "인사말, 서론, '알겠습니다' 같은 도입부나 마무리 멘트 없이 바로 본론만 말하세요. " +
    "전체 800자 내외로 답하세요.";

  // Cloudflare Workers AI 무료 티어 (하루 1만 뉴런) - Llama 3.1 8B
  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: promptText },
    ],
    max_tokens: 700,
  });
  const text = result && (result.response || result.result || result.text);
  if (!text) {
    throw new Error(`Workers AI 응답 이상: ${JSON.stringify(result)}`);
  }
  return text;
}

async function naverNewsSearch(env, query) {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 시크릿이 설정되지 않았습니다.");
  }
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=5&sort=date`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`네이버 뉴스 API 실패: ${JSON.stringify(data)}`);
  }
  return (data.items || [])
    .map((item) => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.originallink || item.link,
      pubDate: item.pubDate,
    }))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)); // API 응답 순서와 무관하게 서버에서도 최신순 보장
}

// 뉴스 헤드라인들을 한 번에 호재/악재/중립으로 분류 (뉴런 절약을 위해 개별 호출 대신 일괄 처리)
async function classifyNewsSentiment(env, items) {
  if (!items.length || !env.AI) return items;
  const listText = items.map((n, i) => `${i + 1}. ${n.title}`).join("\n");
  const prompt =
    `다음 주식 관련 뉴스 제목들을 각각 "호재", "악재", "중립" 중 하나로 분류하세요. ` +
    `설명 없이 정확히 "번호: 분류" 형식으로 한 줄씩만 답하세요.\n\n${listText}`;
  try {
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    });
    const text = (result && (result.response || result.result || result.text)) || "";
    const tags = {};
    text.split("\n").forEach((line) => {
      const m = line.match(/(\d+)\s*[:.\-]\s*(호재|악재|중립)/);
      if (m) tags[m[1]] = m[2];
    });
    items.forEach((item, i) => {
      item.sentiment = tags[String(i + 1)] || null;
    });
  } catch (e) {
    // 감성분석 실패해도 뉴스 자체는 그대로 보여줌 (sentiment: null)
  }
  return items;
}

// 키움이 "토큰이 유효하지 않습니다" 류의 인증 에러를 주면 true
function isTokenInvalidError(data) {
  return data && (data.return_code === 3 || /토큰|Token/i.test(JSON.stringify(data.return_msg || "")));
}

// kiwoomQuote/kiwoomChart가 거의 똑같이 반복하던 부분(relay 호출 -> JSON파싱 -> 실패시 토큰 재발급 후 1회 재시도)
// 을 한 곳으로 모음. path/apiId/body만 다르고 나머지 흐름은 동일해서 여기 고치면 둘 다 적용됨.
async function kiwoomApiCall(env, token, path, apiId, body, extraHeaders) {
  const call = async (tok) => {
    const res = await kiwoomRelayFetch(env, path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        authorization: `Bearer ${tok}`,
        "cont-yn": "N",
        "next-key": "",
        "api-id": apiId,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // 키움이 JSON 대신 HTML(세션 만료 등)을 준 경우 - 토큰 무효와 동일하게 재시도 대상으로 처리
      const err = new Error(`${apiId} 응답이 JSON이 아님: ${rawText.slice(0, 200)}`);
      err.kiwoomData = { return_code: 3, return_msg: "JSON 파싱 실패(비정상 응답)" };
      throw err;
    }
    if (!res.ok || data.return_code !== 0) {
      const err = new Error(`${apiId} 실패: ${JSON.stringify(data)}`);
      err.kiwoomData = data;
      throw err;
    }
    return data;
  };
  try {
    return await call(token);
  } catch (e) {
    if (isTokenInvalidError(e.kiwoomData)) {
      const freshToken = await kiwoomIssueToken(env, true); // 캐시된 토큰이 무효화됐으므로 강제 재발급 후 한 번 더 시도
      return await call(freshToken);
    }
    throw e;
  }
}

async function kiwoomQuote(env, token, code) {
  return kiwoomApiCall(env, token, "/api/dostk/mrkcond", "ka10007", { stk_cd: code });
}

function abs(v) {
  return Math.abs(parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10)) || 0;
}

function parseKiwoomQuote(json) {
  return {
    price: abs(json.cur_prc),
    rate: parseFloat(json.flu_rt ?? "0") || 0,
    open: abs(json.open_pric),
    high: abs(json.high_pric),
    low: abs(json.low_pric),
    volume: abs(json.trde_qty ?? json.now_trde_qty),
    raw: json,
  };
}

// ---------- 키움 REST API: 차트 (분/일/주/월봉 통합) ----------
function todayYYYYMMDD() {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// period: "1"|"3"|"5"|"10"|"15"|"30"|"45"|"60" (분봉) 또는 "D"(일봉)|"W"(주봉)|"M"(월봉)
async function kiwoomChart(env, token, code, period) {
  let apiId, body;
  if (period === "T") {
    apiId = "ka10079"; // 주식틱차트조회요청
    body = { stk_cd: code, tic_scope: "1", upd_stkpc_tp: "1" };
  } else if (period === "D") {
    apiId = "ka10081"; // 주식일봉차트조회요청
    body = { stk_cd: code, base_dt: todayYYYYMMDD(), upd_stkpc_tp: "1" };
  } else if (period === "W") {
    apiId = "ka10082"; // 주식주봉차트조회요청
    body = { stk_cd: code, base_dt: todayYYYYMMDD(), upd_stkpc_tp: "1" };
  } else if (period === "M") {
    apiId = "ka10083"; // 주식월봉차트조회요청
    body = { stk_cd: code, base_dt: todayYYYYMMDD(), upd_stkpc_tp: "1" };
  } else {
    apiId = "ka10080"; // 주식분봉차트조회요청
    body = { stk_cd: code, tic_scope: period, upd_stkpc_tp: "1" };
  }
  return kiwoomApiCall(env, token, "/api/dostk/chart", apiId, body);
}

// ---------- 손절/익절 라인 계산 (ATR 기반) ----------
async function kiwoomDailyOHLC(env, token, code) {
  const raw = await kiwoomChart(env, token, code, "D");
  let rows = [];
  for (const key of Object.keys(raw)) {
    if (Array.isArray(raw[key])) { rows = raw[key]; break; }
  }
  return rows
    .map((r) => ({
      high: abs(r.high_pric),
      low: abs(r.low_pric),
      close: abs(r.cur_prc ?? r.close_pric),
    }))
    .filter((r) => r.high > 0 && r.low > 0)
    .reverse(); // 과거 -> 최신
}

// 일봉은 당일 캔들 빼고는 하루 종일 안 바뀌므로, 2분마다 매번 새로 받을 필요 없음.
// 10분 캐싱으로 호출 횟수를 5분의 1로 줄임 (ATR 14일 평균값 특성상 10분 정도 지연은 실질적 영향 없음).
const DAILY_OHLC_CACHE_MS = 10 * 60 * 1000;
async function getCachedDailyOHLC(env, token, code) {
  const cached = await env.DB.prepare(`SELECT ohlc_json, updated_at FROM daily_ohlc_cache WHERE code = ?`)
    .bind(code)
    .first()
    .catch(() => null);
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < DAILY_OHLC_CACHE_MS) {
    return JSON.parse(cached.ohlc_json);
  }
  const ohlc = await kiwoomDailyOHLC(env, token, code);
  await sleep(1100); // 키움 TR 초당1건 제한 - 방금 실제로 호출했을 때만 대기 (캐시 히트면 이 함수 자체가 여기까지 안 옴)
  await env.DB.prepare(
    `INSERT INTO daily_ohlc_cache (code, ohlc_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET ohlc_json = excluded.ohlc_json, updated_at = excluded.updated_at`
  )
    .bind(code, JSON.stringify(ohlc), new Date().toISOString())
    .run()
    .catch(() => {}); // 캐시 저장 실패해도 방금 받아온 ohlc는 그대로 반환하면 됨
  return ohlc;
}

function computeATR(ohlc, period) {
  if (ohlc.length < 2) return null;
  const trs = [];
  for (let i = 1; i < ohlc.length; i++) {
    const cur = ohlc[i], prev = ohlc[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

// 5일선/20일선 골든크로스(정배열 전환) 계산
function computeGoldenCross(ohlc) {
  if (ohlc.length < 22) return null; // 20일선 계산 + 전날 비교를 위해 최소 22개 필요
  const sma = (arr, n, endIdx) => {
    const slice = arr.slice(endIdx - n + 1, endIdx + 1);
    return slice.reduce((s, v) => s + v.close, 0) / n;
  };
  const lastIdx = ohlc.length - 1;
  const sma5Today = sma(ohlc, 5, lastIdx);
  const sma20Today = sma(ohlc, 20, lastIdx);
  const sma5Yesterday = sma(ohlc, 5, lastIdx - 1);
  const sma20Yesterday = sma(ohlc, 20, lastIdx - 1);

  const isAligned = sma5Today > sma20Today; // 정배열 (5일선이 20일선 위)
  const justCrossed = sma5Yesterday <= sma20Yesterday && sma5Today > sma20Today; // 어제까지 아니었는데 오늘 처음 뚫음
  const justCrossedDown = sma5Yesterday >= sma20Yesterday && sma5Today < sma20Today; // 데드크로스

  return { sma5: sma5Today, sma20: sma20Today, isAligned, justCrossed, justCrossedDown };
}

function parseKiwoomChart(json) {
  let rows = [];
  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) {
      rows = json[key];
      break;
    }
  }
  return rows
    .map((row) => ({
      price: abs(row.cur_prc ?? row.close_pric),
      time: row.cntr_tm || row.dt || row.stk_dt || row.trde_dt || row.date || "",
    }))
    .filter((r) => r.price > 0)
    .reverse(); // 응답이 최신순이면 시간순으로 뒤집기
}

// 관심종목 미니 캔들차트용: OHLC 전체 보존
function parseKiwoomChartOHLC(json) {
  let rows = [];
  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) {
      rows = json[key];
      break;
    }
  }
  return rows
    .map((row) => ({
      open: abs(row.open_pric),
      high: abs(row.high_pric),
      low: abs(row.low_pric),
      close: abs(row.cur_prc ?? row.close_pric),
      time: row.cntr_tm || "",
    }))
    .filter((r) => r.close > 0 && r.high > 0 && r.low > 0)
    .reverse();
}

// ---------- 오늘 vs 지난 1주일 장중 패턴 유사도 스캔 ----------
function parseKiwoomMinuteHistory(json) {
  let rows = [];
  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) { rows = json[key]; break; }
  }
  return rows
    .map((r) => {
      const tm = r.cntr_tm || "";
      return {
        date: tm.slice(0, 8),
        time: tm.slice(8, 14),
        price: abs(r.cur_prc ?? r.close_pric),
      };
    })
    .filter((r) => r.date && r.price > 0)
    .reverse(); // 응답이 최신순 -> 시간순(과거->현재)으로 뒤집기
}

function groupByDate(rows) {
  const map = {};
  for (const r of rows) {
    if (!map[r.date]) map[r.date] = [];
    map[r.date].push(r);
  }
  for (const d in map) map[d].sort((a, b) => a.time.localeCompare(b.time));
  return map;
}

// 첫 값 대비 %변화율로 정규화 (절대가격이 달라도 '모양'만 비교)
function normalizeSeries(prices) {
  if (!prices.length) return [];
  const base = prices[0] || 1;
  return prices.map((p) => ((p - base) / base) * 100);
}

// 피어슨 상관계수 (-1~1, 1에 가까울수록 모양이 비슷)
function pearsonCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 4) return null;
  a = a.slice(0, n);
  b = b.slice(0, n);
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  if (denomA === 0 || denomB === 0) return null;
  return num / Math.sqrt(denomA * denomB);
}

async function scanPatternMatches(env, candidates) {
  const token = await kiwoomIssueToken(env);
  const todayStr = todayYYYYMMDD();
  const results = [];
  const debugInfo = [];

  for (const c of candidates) {
    const dbg = { code: c.code, name: c.name, todayStr };
    try {
      const raw = await kiwoomChart(env, token, c.code, "5");
      const rows = parseKiwoomMinuteHistory(raw);
      const byDate = groupByDate(rows);
      dbg.availableDates = Object.keys(byDate);
      const todayRows = byDate[todayStr];
      dbg.todayRowCount = todayRows ? todayRows.length : 0;

      if (todayRows && todayRows.length >= 4) {
        const todaySeries = normalizeSeries(todayRows.map((r) => r.price));
        let best = null;
        let comparedDays = 0;
        for (const d of Object.keys(byDate)) {
          if (d === todayStr) continue;
          const histRows = byDate[d];
          if (histRows.length < todaySeries.length) continue; // 오늘 진행분만큼 데이터 없는 날은 제외
          comparedDays++;
          const histSeries = normalizeSeries(histRows.slice(0, todaySeries.length).map((r) => r.price));
          const score = pearsonCorrelation(todaySeries, histSeries);
          if (score !== null && (!best || score > best.score)) {
            best = { date: d, score };
          }
        }
        dbg.comparedDays = comparedDays;
        if (best) {
          dbg.bestScore = best.score;
          results.push({ code: c.code, name: c.name, matchDate: best.date, score: best.score });
        }
      }
    } catch (e) {
      dbg.error = String(e.message || e);
    }
    debugInfo.push(dbg);
    await sleep(1100); // ka10080 초당 1건 제한
  }

  results.sort((a, b) => b.score - a.score);
  return { results, debugInfo };
}

// ---------- 디버그: 키움 ka10027 응답이 실제로 어떻게 오는지 확인 ----------
async function debugFetch(env) {
  const out = {};
  try {
    const token = await kiwoomIssueToken(env);
    out.tokenIssued = true;
    for (const [mrktTp, market] of [["001", "KOSPI"], ["101", "KOSDAQ"]]) {
      try {
        const json = await kiwoomRankingUp(env, token, mrktTp);
        const rows = parseKiwoomRankingRows(json);
        out[market] = {
          returnCode: json.return_code,
          returnMsg: json.return_msg,
          parsedRowCount: rows.length,
          sampleParsedRows: rows.slice(0, 3),
          rawKeys: Object.keys(json),
          rawSample: JSON.stringify(json).slice(0, 1000),
        };
      } catch (e) {
        out[market] = { error: String(e.message || e) };
      }
      await sleep(1100);
    }
  } catch (e) {
    out.tokenIssued = false;
    out.tokenError = String(e.message || e);
  }
  return out;
}

// ---------- 관리자 키 검증 (매수/매도/DART 동기화 보호) ----------
// ADMIN_KEY 시크릿이 설정 안 돼있으면 무조건 거부 (fail closed)
// 호출 방법: 헤더 X-Admin-Key: <키> 또는 쿼리스트링 ?key=<키>
function checkAdminKey(request, url, env) {
  if (!env.ADMIN_KEY) return false;
  const headerKey = request.headers.get("X-Admin-Key");
  const queryKey = url.searchParams.get("key");
  return headerKey === env.ADMIN_KEY || queryKey === env.ADMIN_KEY;
}

// 실거래 주문(매수/매도) 전용 - 쿼리스트링은 서버 로그/브라우저 히스토리에 그대로 남을 수 있어서
// 헤더(X-Admin-Key)로만 인증 허용. 위 checkAdminKey보다 엄격한 버전.
function checkAdminKeyHeaderOnly(request, env) {
  if (!env.ADMIN_KEY) return false;
  return request.headers.get("X-Admin-Key") === env.ADMIN_KEY;
}

// ---------- 엔트리포인트 ----------
// relay/웹소켓이 죽어있으면 조용히 묻히지 않게 system_events에 기록.
// 매 틱마다 기록하면 로그가 도배되니, 상태가 "바뀐 순간"에만 남김 (정상->비정상, 비정상->정상).
let lastKnownRelayHealthy = null;
let lastKnownMemoryHigh = false; // 메모리 위험 상태도 변화 시점에만 기록 (매 틱마다 도배 방지)
async function checkRelayHealthForCron(env) {
  let healthy = false;
  let detail = "";
  try {
    const res = await kiwoomRelayFetch(env, "/realtime/status", { method: "GET" });
    const data = await res.json();
    healthy = !!(data.wsConnected && data.wsLoggedIn);
    detail = `wsConnected=${data.wsConnected} wsLoggedIn=${data.wsLoggedIn} lastMessageAt=${data.lastMessageAt}`;

    // Oracle E2.1.Micro는 메모리 1GB - 상시 웹소켓+REST중계+종목명조회까지 얹혀있어서
    // 여유 없이 죽을 수 있음. 위험 수준이면 알아채기 전에 미리 기록해둠.
    const memoryHigh = typeof data.memoryRssMb === "number" && data.memoryRssMb >= 400;
    if (memoryHigh && !lastKnownMemoryHigh) {
      await logSystemEvent(env, "relay_memory_high", `relay 메모리 사용량 ${data.memoryRssMb}MB (1GB 중) - 여유 확인 필요`);
    } else if (!memoryHigh && lastKnownMemoryHigh) {
      await logSystemEvent(env, "relay_memory_normal", `relay 메모리 정상화: ${data.memoryRssMb}MB`);
    }
    lastKnownMemoryHigh = memoryHigh;
  } catch (e) {
    detail = "relay 접속 실패: " + (e.message || e);
  }

  if (lastKnownRelayHealthy === null) {
    lastKnownRelayHealthy = healthy; // 최초 1회는 상태만 기억, 로그는 비정상일 때만
    if (!healthy) await logSystemEvent(env, "relay_unhealthy", detail);
    return;
  }
  if (lastKnownRelayHealthy && !healthy) {
    await logSystemEvent(env, "relay_unhealthy", "웹소켓이 끊긴 것으로 보임: " + detail);
  } else if (!lastKnownRelayHealthy && healthy) {
    await logSystemEvent(env, "relay_recovered", "웹소켓 복구됨: " + detail);
  }
  lastKnownRelayHealthy = healthy;
}

// backtest-signals의 실측 로직 - HTTP 엔드포인트와 매일 자동 실행 cron 둘 다에서 씀
async function computeSignalBacktest(env, tickLimit) {
  const timesRes = await env.DB.prepare(
    `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT ?`
  )
    .bind(tickLimit)
    .all();
  const times = timesRes.results.map((r) => r.captured_at).reverse(); // 과거 -> 최신
  if (times.length < 4) {
    return { ok: false, error: "분석할 틱이 부족합니다 (최소 4틱 필요)" };
  }

  // times는 같은 테이블에서 뽑은 연속된 captured_at 값들이라, IN절 대신 범위(BETWEEN)로 조회해도
  // 결과가 동일함 - 파라미터를 300개씩 바인딩하면 D1 변수 개수 제한에 걸려서 이렇게 바꿈
  const rowsRes = await env.DB.prepare(
    `SELECT code, change_rate, volume, cntr_str, buy_req, sel_req, captured_at
     FROM snapshots WHERE captured_at >= ? AND captured_at <= ?`
  )
    .bind(times[0], times[times.length - 1])
    .all();

  const byCode = new Map();
  for (const r of rowsRes.results) {
    if (!byCode.has(r.code)) byCode.set(r.code, new Map());
    byCode.get(r.code).set(r.captured_at, r);
  }

  const signalNames = [
    "accelerating", "bidTurnedPositive", "cntrStrRising",
    "buyReqSpike", "volumeSpike", "isTodayHigh", "pullbackLike",
    "sellReqThinning", "realPullback", "comboBuySignal", "isGoldenTime", "volumeConfirmed", "strongCntrStr",
  ];
  const stats = {};
  signalNames.forEach((name) => {
    stats[name] = { trueCount: 0, trueForwardSum: 0, falseCount: 0, falseForwardSum: 0 };
  });
  let baselineCount = 0, baselineForwardSum = 0;

  for (const [code, rowByTime] of byCode) {
    let runningMaxRate = -Infinity;
    for (let i = 2; i < times.length - 1; i++) {
      const older = rowByTime.get(times[i - 2]);
      const prev = rowByTime.get(times[i - 1]);
      const cur = rowByTime.get(times[i]);
      const next = rowByTime.get(times[i + 1]);
      if (!older || !prev || !cur) continue;
      if (cur.change_rate > runningMaxRate) runningMaxRate = cur.change_rate;
      if (!next) continue;

      const forwardDelta = next.change_rate - cur.change_rate;
      baselineCount++;
      baselineForwardSum += forwardDelta;

      const recentDelta = cur.change_rate - prev.change_rate;
      const olderDelta = prev.change_rate - older.change_rate;
      // 15:36 마감 정밀조회는 체결강도/매수잔량/매도잔량을 항상 0으로 저장함 - 그 틱이 cur나 prev로 잡히면
      // 수급신호가 전부 오판되므로(실제값->0을 "급감"으로 착각) 걸러냄
      const isPlaceholderRow = (row) => row.cntr_str === 0 && row.buy_req === 0 && row.sel_req === 0;
      const hasOrderFlowData = !isPlaceholderRow(cur) && !isPlaceholderRow(prev);
      const bidTurnedPositive = hasOrderFlowData && (cur.buy_req || 0) > (cur.sel_req || 0) && (prev.buy_req || 0) <= (prev.sel_req || 0);
      const buyReqSpike = hasOrderFlowData && prev.buy_req > 0 && (cur.buy_req || 0) / prev.buy_req >= 1.5;
      const sellReqThinning = hasOrderFlowData && prev.sel_req > 0 && (cur.sel_req || 0) / prev.sel_req <= 0.5;
      const pullbackLike = runningMaxRate - cur.change_rate >= 1 && runningMaxRate - cur.change_rate <= 4 && recentDelta > 0;
      const signals = {
        accelerating: recentDelta > olderDelta,
        bidTurnedPositive,
        cntrStrRising: hasOrderFlowData && (cur.cntr_str || 0) > (prev.cntr_str || 0),
        buyReqSpike,
        volumeSpike: prev.volume > 0 && (cur.volume || 0) / prev.volume >= 2,
        isTodayHigh: cur.change_rate >= runningMaxRate - 0.001,
        pullbackLike,
        sellReqThinning,
        // 개선된 눌림목: 단순 되돌림+재상승이 아니라, 수급 유입 신호(매수전환/매수잔량급증/매도잔량급감) 중
        // 하나라도 동반됐을 때만 인정 - pullbackLike가 역효과였던 것을 이걸로 보완할 수 있는지 검증용
        realPullback: pullbackLike && (bidTurnedPositive || buyReqSpike || sellReqThinning),
        // 복합신호: 매수전환+매수잔량급증이 동시에 뜨는 경우 - 개별보다 강한 확인 신호일 가능성 검증용
        comboBuySignal: bidTurnedPositive && buyReqSpike,
        // 허수주문 방어: 호가잔량 신호가 실제 체결거래량 증가와 같이 왔을 때만 "확인된" 신호로 봄
        volumeConfirmed: (bidTurnedPositive || buyReqSpike) && prev.volume > 0 && (cur.volume || 0) / prev.volume >= 1.5,
        // 체결강도 150 이상 - "강한 매수세 유입"의 통상적 해석 기준
        strongCntrStr: hasOrderFlowData && (cur.cntr_str || 0) >= 150,
        // 09:00~09:30 골든타임에 발생한 신호인지 (그 자체를 하나의 "신호"로 보고 효과 검증)
        isGoldenTime: (() => {
          const kst = new Date(new Date(cur.captured_at).getTime() + 9 * 3600 * 1000);
          const m = kst.getUTCHours() * 60 + kst.getUTCMinutes();
          return m >= 9 * 60 && m <= 9 * 60 + 30;
        })(),
      };

      signalNames.forEach((name) => {
        const bucket = signals[name] ? "true" : "false";
        stats[name][bucket + "Count"]++;
        stats[name][bucket + "ForwardSum"] += forwardDelta;
      });
    }
  }

  const baselineAvg = baselineCount ? +(baselineForwardSum / baselineCount).toFixed(4) : null;
  const results = {};
  signalNames.forEach((name) => {
    const s = stats[name];
    const trueAvg = s.trueCount ? +(s.trueForwardSum / s.trueCount).toFixed(4) : null;
    const falseAvg = s.falseCount ? +(s.falseForwardSum / s.falseCount).toFixed(4) : null;
    results[name] = {
      sampleSize: s.trueCount,
      avgForwardDeltaWhenTrue: trueAvg,
      avgForwardDeltaWhenFalse: falseAvg,
      edgeVsBaseline: trueAvg !== null && baselineAvg !== null ? +(trueAvg - baselineAvg).toFixed(4) : null,
    };
  });

  return {
    ok: true,
    ticksAnalyzed: times.length,
    baselineAvgForwardDeltaPct: baselineAvg,
    signals: results,
  };
}

// 매일 장마감 후 한 번, 그날치 신호 검증 결과를 자동으로 남김 - 사람이 매번 URL 안 열어봐도 이력이 쌓이게 함
async function runDailySignalBacktest(env) {
  const result = await computeSignalBacktest(env, 300);
  if (!result.ok) return;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO signal_backtest_history (date, result_json, created_at) VALUES (?, ?, ?)`
  )
    .bind(new Date().toISOString().slice(0, 10), JSON.stringify(result), new Date().toISOString())
    .run()
    .catch(() => {});
}

// 관심종목 30초 촘촘 기록 - 전체 150~200종목을 이 주기로 D1에 쓰면 하루 쓰기 한도(10만행)를 넘기지만,
// 관심종목은 보통 15~20개뿐이라 여유 충분함. 새 cron을 안 만들고, 화면이 열려있는 동안 이미 2초마다
// 도는 실시간 폴링(이 함수를 부르는 /api/realtime-all)에 편승 - 화면 안 보고 있으면 자연히 기록도 안 됨
// (Cloudflare cron 최소 단위가 1분이라 cron으로는 애초에 30초 주기가 불가능함)
const FINE_SNAPSHOT_INTERVAL_MS = 30000;
async function maybeWriteFineWatchlistSnapshot(env, codes, stocks) {
  if (!codes.length) return;
  try {
    // 마지막 기록 시각을 D1에 저장해두고, 이번 요청이 그로부터 30초 이상 지났을 때만 씀
    // (Worker는 요청마다 새 인스턴스일 수 있어서 메모리로는 상태를 못 지킴 - D1에 저장)
    const stateRow = await env.DB.prepare(`SELECT last_written_at FROM fine_snapshot_state WHERE id = 1`).first().catch(() => null);
    const lastWritten = stateRow ? new Date(stateRow.last_written_at).getTime() : 0;
    if (Date.now() - lastWritten < FINE_SNAPSHOT_INTERVAL_MS) return;

    const now = new Date().toISOString();
    const validRows = codes.filter((c) => stocks[c] && stocks[c].price).map((c) => ({ code: c, ...stocks[c] }));
    if (!validRows.length) return;

    const stmt = env.DB.prepare(
      `INSERT INTO watchlist_fine_snapshots (code, price, rate, cntr_str, buy_req, sel_req, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    await env.DB.batch(validRows.map((r) => stmt.bind(r.code, r.price, r.rate || 0, r.cntrStr || 0, 0, 0, now)));

    await env.DB.prepare(
      `INSERT INTO fine_snapshot_state (id, last_written_at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET last_written_at = excluded.last_written_at`
    )
      .bind(now)
      .run();
  } catch (e) {
    // 기록 실패해도 실시간 화면 표시 자체엔 지장 없어야 하므로 조용히 무시
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/manifest.json") {
        return Response.json({
          name: "급등주 스크리너",
          short_name: "급등주",
          description: "5~15% 상승 종목 실시간 스크리너",
          start_url: "/",
          scope: "/",
          display: "browser",
          display_override: ["browser"],
          orientation: "portrait",
          background_color: "#111111",
          theme_color: "#111111",
          icons: [
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          ],
        });
      }

      if (url.pathname === "/icon.svg") {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#111111"/>
  <text x="50" y="66" font-size="58" text-anchor="middle">🔥</text>
</svg>`;
        return new Response(svg, { headers: { "content-type": "image/svg+xml" } });
      }

      if (url.pathname === "/sw.js") {
        const sw = `
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  // 네트워크 우선, 실패 시 그대로 실패 반환 (실시간 데이터라 캐싱 안 함)
  e.respondWith(fetch(e.request).catch(() => new Response('오프라인 상태입니다', { status: 503 })));
});`;
        return new Response(sw, { headers: { "content-type": "application/javascript" } });
      }

      if (url.pathname === "/app.js") {
        // 클라이언트 스크립트를 HTML에서 분리해서 서빙 (diff/유지보수 편하게)
        return new Response(clientScript(), {
          headers: { "content-type": "application/javascript; charset=UTF-8" },
        });
      }

      if (url.pathname === "/api/watchlist" && request.method === "GET") {
        try {
          const res = await env.DB.prepare(`SELECT * FROM watchlist ORDER BY added_at DESC`).all();
          return Response.json({ ok: true, items: res.results });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/watchlist" && request.method === "POST") {
        try {
          const { code, name, sourceBoard, addedState } = await request.json();
          if (!code || !name) return Response.json({ ok: false, error: "code, name 필요" }, { status: 400 });

          let entryPrice = 0;

          // 장 마감 후/휴일에는 실시간 조회가 부정확한 값을 줄 수 있어서(모달과 동일 문제) D1 마지막 시세를 그대로 진입가로 씀
          if (!isMarketHoursKST(new Date())) {
            const row = await env.DB.prepare(
              `SELECT price FROM snapshots WHERE code = ? ORDER BY captured_at DESC LIMIT 1`
            )
              .bind(code)
              .first();
            if (row) entryPrice = row.price;
          }

          // 장중이거나(정상 케이스), 위에서 D1에 데이터가 없었던 경우엔 실시간 조회
          // 진입가는 정확도가 제일 중요한 값이라 항상 키움에 새로 조회 (클라이언트가 들고 있던 캐시 가격은 안 씀)
          // 첫 시도 실패하면 잠깐 쉬었다가 한 번 더 시도 (일시적 오류로 0원 저장되는 것 방지)
          for (let attempt = 0; attempt < 2 && entryPrice === 0; attempt++) {
            try {
              if (attempt > 0) await sleep(500);
              const token = await kiwoomIssueToken(env);
              const quoteRaw = await kiwoomQuote(env, token, code);
              entryPrice = parseKiwoomQuote(quoteRaw).price || 0;
            } catch (e) {
              // 이번 시도 실패, 다음 루프에서 재시도 (마지막 시도까지 실패하면 0으로 저장, 프론트에서 재시도 유도)
            }
          }
          await env.DB.prepare(
            `INSERT OR REPLACE INTO watchlist (code, name, added_at, entry_price, source_board, added_state) VALUES (?, ?, ?, ?, ?, ?)`
          )
            .bind(code, name, new Date().toISOString(), entryPrice, sourceBoard || "", addedState || "")
            .run();
          return Response.json({ ok: true, entryPrice });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/watchlist" && request.method === "DELETE") {
        try {
          const code = url.searchParams.get("code");
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          await env.DB.prepare(`DELETE FROM watchlist WHERE code = ?`).bind(code).run();
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/latest") {
        const [data, watchlistRes] = await Promise.all([
          getLatest(env),
          env.DB.prepare(`SELECT * FROM watchlist ORDER BY added_at DESC`).all(),
        ]);
        data.watchlist = watchlistRes.results;

        // 밴드 밖(오늘 5~15% 목록에 없는) 관심종목은 D1에 저장된 가장 최근 시세로 대체
        // (키움 API 재조회 없이, 이미 수집해둔 데이터만 사용)
        const inBandCodes = new Set(data.latest.map((r) => r.code));
        const offBandCodes = data.watchlist.map((w) => w.code).filter((c) => !inBandCodes.has(c));
        if (offBandCodes.length > 0) {
          const placeholders = offBandCodes.map(() => "?").join(",");
          const lastKnownRes = await env.DB.prepare(
            `SELECT s.code, s.price, s.change_rate, s.volume
             FROM snapshots s
             INNER JOIN (
               SELECT code, MAX(captured_at) AS max_captured
               FROM snapshots WHERE code IN (${placeholders})
               GROUP BY code
             ) m ON s.code = m.code AND s.captured_at = m.max_captured`
          )
            .bind(...offBandCodes)
            .all();
          data.watchlistLastKnown = lastKnownRes.results;
        } else {
          data.watchlistLastKnown = [];
        }

        // cron이 미리 체크해둔 손절/익절 도달 상태 (모달 안 열어도 바로 보이게)
        if (data.watchlist.length) {
          try {
            const riskRes = await env.DB.prepare(`SELECT code, status, price, stop_loss, take_profit FROM watchlist_risk_status`).all();
            data.watchlistRisk = riskRes.results;
          } catch (e) {
            data.watchlistRisk = []; // watchlist_risk_status 테이블이 아직 없을 수 있음
          }
        } else {
          data.watchlistRisk = [];
        }

        // 관심종목 이탈신호(매도 고려): 손절선에 닿기 전에 미리 나타나는 약세 징후들.
        // 이미 D1에 있는 최근 스냅샷만 사용 - 추가 키움 조회 0건.
        data.watchlistExitSignals = [];
        if (data.watchlist.length) {
          try {
            const wlCodes = data.watchlist.map((w) => w.code);
            const ph = wlCodes.map(() => "?").join(",");
            const recentTimesRes = await env.DB.prepare(
              `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT 4`
            ).all();
            const recentTimes = recentTimesRes.results.map((r) => r.captured_at);
            if (recentTimes.length >= 2) {
              const tph = recentTimes.map(() => "?").join(",");
              const histRes = await env.DB.prepare(
                `SELECT code, change_rate, price, cntr_str, buy_req, sel_req, captured_at
                 FROM snapshots WHERE code IN (${ph}) AND captured_at IN (${tph})`
              )
                .bind(...wlCodes, ...recentTimes)
                .all();
              // 고점 기준을 "담은 시점 이후"로 잡음.
              // 오늘 전체 고점으로 잡으면, 이미 고점 찍고 내려온 종목을 담는 순간 바로 이탈신호가 떠서 무의미함.
              // 실제로 알고 싶은 건 "내가 담은 뒤로 어떻게 됐는지"이므로 added_at 이후만 집계.
              // (종목마다 담은 시점이 달라서 correlated subquery로 한 번에 처리 - 예전엔 종목 수만큼 D1 왕복이 순차로 돌았음)
              const wph = data.watchlist.map(() => "?").join(",");
              const maxRes = await env.DB.prepare(
                `SELECT w.code AS code,
                        (SELECT MAX(s.change_rate) FROM snapshots s WHERE s.code = w.code AND s.captured_at >= w.added_at) AS maxRate
                 FROM watchlist w WHERE w.code IN (${wph})`
              )
                .bind(...data.watchlist.map((w) => w.code))
                .all()
                .catch(() => ({ results: [] }));
              const maxMap = new Map(
                maxRes.results.filter((r) => r.maxRate !== null).map((r) => [r.code, r.maxRate])
              );
              const entryMap = new Map(data.watchlist.map((w) => [w.code, w.entry_price]));

              const byCode = new Map();
              for (const r of histRes.results) {
                if (!byCode.has(r.code)) byCode.set(r.code, new Map());
                byCode.get(r.code).set(r.captured_at, r);
              }

              for (const code of wlCodes) {
                const m = byCode.get(code);
                if (!m) continue;
                const cur = m.get(recentTimes[0]);
                const prev = m.get(recentTimes[1]);
                if (!cur || !prev) continue;
                const reasons = [];

                // 15:36 마감 정밀조회는 체결강도/매수잔량/매도잔량을 항상 0으로 저장함 - 그 틱이 cur로 잡히면
                // "체결강도 꺾임"/"매도잔량 역전"이 전 종목에 오판되어 뜸(실제값->0을 급락/역전으로 착각) - 걸러냄
                const isPlaceholderRow = (row) => row.cntr_str === 0 && row.buy_req === 0 && row.sel_req === 0;
                const hasOrderFlowData = !isPlaceholderRow(cur) && !isPlaceholderRow(prev);

                // 1) 체결강도가 매수우위(105+)에서 꺾여 내려옴
                if (hasOrderFlowData && (prev.cntr_str || 0) >= 105 && (cur.cntr_str || 0) < 100) reasons.push("체결강도 꺾임");
                // 2) 매수잔량 우위 -> 매도잔량 우위로 역전 ("매수전환"의 정반대)
                if (hasOrderFlowData && (prev.buy_req || 0) > (prev.sel_req || 0) && (cur.buy_req || 0) <= (cur.sel_req || 0)) {
                  reasons.push("매도잔량 역전");
                }
                // 3) 담은 뒤 고점 대비 3%p 이상 밀림 (내가 담은 이후 기준)
                const maxRate = maxMap.get(code);
                if (maxRate !== undefined && maxRate - cur.change_rate >= 3) {
                  reasons.push("담은후고점대비 -" + (maxRate - cur.change_rate).toFixed(2) + "%p");
                }
                // 4) 최근 3틱 연속 하락 (recentTimes[0]이 최신이라 0<1<2 순서로 비교)
                const t2 = m.get(recentTimes[2]);
                const t3 = m.get(recentTimes[3]);
                if (t2 && t3 && cur.change_rate < prev.change_rate && prev.change_rate < t2.change_rate && t2.change_rate < t3.change_rate) {
                  reasons.push("3틱 연속 하락");
                }
                // 5) 진입가 대비 2% 이상 하락 - 실제 내 손실이 커지는 중이라는 가장 직접적인 신호
                // (cur는 위에서 이미 byCode 맵으로 구해둔 값이라 재사용 - 예전엔 histRes.results 전체를 매번 find()로 훑었음)
                const entryPrice = entryMap.get(code);
                if (entryPrice > 0 && cur.price > 0) {
                  const pnlPct = ((cur.price - entryPrice) / entryPrice) * 100;
                  if (pnlPct <= -2) reasons.push("진입가대비 " + pnlPct.toFixed(2) + "%");
                }

                if (reasons.length) data.watchlistExitSignals.push({ code, reasons });
              }
            }
          } catch (e) {
            data.watchlistExitSignals = []; // 계산 실패해도 화면 전체는 정상 표시
          }
        }

        return Response.json(data);
      }

      if (url.pathname === "/api/buy" && request.method === "POST") {
        if (!checkAdminKeyHeaderOnly(request, env)) {
          return Response.json({ ok: false, error: "인증 필요 (X-Admin-Key 헤더)" }, { status: 401 });
        }
        try {
          const { code } = await request.json();
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const result = await kiwoomBuyOrder(env, code);
          return Response.json(result);
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/sell" && request.method === "POST") {
        if (!checkAdminKeyHeaderOnly(request, env)) {
          return Response.json({ ok: false, error: "인증 필요 (X-Admin-Key 헤더)" }, { status: 401 });
        }
        try {
          const { code } = await request.json();
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const result = await kiwoomSellOrder(env, code);
          return Response.json(result);
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/admin/sync-dart-codes") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        try {
          const count = await syncDartCorpCodes(env);
          return Response.json({ ok: true, synced: count });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/disclosures") {
        try {
          const code = url.searchParams.get("code");
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const corp = await getDartCorpCode(env, code);
          if (!corp) {
            return Response.json({ ok: false, error: "DART corp_code 매핑이 없습니다. /api/admin/sync-dart-codes를 먼저 실행하세요." });
          }
          const items = await fetchDartDisclosures(env, corp.corp_code);
          return Response.json({ ok: true, corpName: corp.corp_name, items });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/news") {
        try {
          const q = url.searchParams.get("q");
          if (!q) return Response.json({ ok: false, error: "q 누락" }, { status: 400 });
          const items = await naverNewsSearch(env, q);
          await classifyNewsSentiment(env, items);
          return Response.json({ ok: true, items });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/quote") {
        try {
          const code = url.searchParams.get("code");
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });

          // 장 마감 후에는 실시간 재조회 대신 15:35 최종 재조회로 D1에 박아둔 정확한 마감 데이터를 씀
          // (마감 후 키움 실전 조회는 기준이 달라져 리스트와 등락률이 어긋나는 문제 있었음)
          if (!isMarketHoursKST(new Date())) {
            const row = await env.DB.prepare(
              `SELECT price, change_rate AS rate, volume FROM snapshots WHERE code = ? ORDER BY captured_at DESC LIMIT 1`
            )
              .bind(code)
              .first();
            if (row) {
              return Response.json({
                ok: true,
                price: row.price,
                rate: row.rate,
                open: row.price,
                high: row.price,
                low: row.price,
                volume: row.volume,
              });
            }
            // D1에 해당 종목 기록이 없으면 아래로 폴백해서 실시간 조회 시도
          }

          const token = await kiwoomIssueToken(env);
          const raw = await kiwoomQuote(env, token, code);
          return Response.json({ ok: true, ...parseKiwoomQuote(raw) });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/ai-analysis" && request.method === "POST") {
        try {
          const body = await request.json();
          const { code, name } = body;
          if (!code || !name) {
            return Response.json({ ok: false, error: "code, name 필요" }, { status: 400 });
          }

          const token = await kiwoomIssueToken(env);
          const [quoteRaw, newsItems, corp] = await Promise.all([
            kiwoomQuote(env, token, code).catch(() => null),
            naverNewsSearch(env, name).catch(() => []),
            getDartCorpCode(env, code).catch(() => null),
          ]);
          const quote = quoteRaw ? parseKiwoomQuote(quoteRaw) : null;
          let disclosures = [];
          if (corp) {
            disclosures = await fetchDartDisclosures(env, corp.corp_code).catch(() => []);
          }

          const lines = [`종목: ${name} (${code})`];
          if (quote) {
            lines.push(`현재가: ${quote.price}원, 등락률: ${quote.rate}%`);
            lines.push(`오늘 시가: ${quote.open}, 고가: ${quote.high}, 저가: ${quote.low}, 거래량: ${quote.volume}`);
            if (quote.high) {
              const gapFromHigh = (((quote.price - quote.high) / quote.high) * 100).toFixed(2);
              lines.push(`오늘 고점 대비: ${gapFromHigh}% (${gapFromHigh < -3 ? "고점에서 꽤 밀림" : gapFromHigh < 0 ? "고점 대비 소폭 하락" : "고점 유지 중"})`);
            }
          }
          if (body.cntrStr) {
            lines.push(`체결강도: ${body.cntrStr} (${body.cntrStr >= 105 ? "매수세 우위" : body.cntrStr < 95 ? "매도세 우위" : "중립"})`);
          }
          if (body.buyReq && body.selReq) {
            lines.push(`매수잔량: ${body.buyReq}, 매도잔량: ${body.selReq} (${body.buyReq > body.selReq ? "매수 우위" : "매도 우위"})`);
          }
          if (body.signalChecks && body.signalChecks.length) {
            lines.push(`충족된 기술적 조건: ${body.signalChecks.join(", ")}`);
          }
          if (newsItems.length) {
            lines.push("최근 뉴스:");
            newsItems.forEach((n) => lines.push(`- ${n.title}: ${n.description}`));
          } else {
            lines.push("최근 뉴스: 검색된 것 없음");
          }
          if (disclosures.length) {
            lines.push("최근 30일 공시:");
            disclosures.forEach((d) => lines.push(`- ${d.date} ${d.title}`));
          } else {
            lines.push("최근 30일 공시: 없음");
          }
          lines.push(
            "위 항목을 단순 나열하지 말고 서로 연결지어 해석하세요. 예: 뉴스/공시 내용이 오늘 등락률과 " +
            "시점상 관련 있어 보이는지, 체결강도와 호가잔량이 같은 방향을 가리키는지 엇갈리는지, " +
            "고점 대비 낙폭이 신호들과 앞뒤가 맞는지. 실제로 확인되는 연결점이 없으면 " +
            "'특별한 연관성 확인 안 됨'이라고 명시하세요."
          );

          const analysis = await askStockExpert(env, lines.join("\n"));
          return Response.json({ ok: true, analysis });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/risk-levels") {
        try {
          const code = url.searchParams.get("code");
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const token = await kiwoomIssueToken(env);
          const ohlc = await getCachedDailyOHLC(env, token, code);
          const quoteRaw = await kiwoomQuote(env, token, code);
          const atr = computeATR(ohlc, 14);
          const goldenCross = computeGoldenCross(ohlc);
          const quote = parseKiwoomQuote(quoteRaw);
          if (!atr) {
            return Response.json({ ok: false, error: "ATR 계산에 필요한 일봉 데이터가 부족합니다" });
          }
          return Response.json({
            ok: true,
            atr,
            currentPrice: quote.price,
            stopLoss: Math.round(quote.price - atr * 1.5),
            takeProfit: Math.round(quote.price + atr * 2),
            goldenCross,
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/mini-candles") {
        try {
          const code = url.searchParams.get("code");
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const token = await kiwoomIssueToken(env);
          const raw = await kiwoomChart(env, token, code, "1");
          const parsed = parseKiwoomChartOHLC(raw);
          // 휴일 등으로 오늘자 데이터가 없으면, 이미 받아온 응답 안에서 가장 최근 거래일로 자동 폴백
          // (추가 조회 없음 - kiwoomChart가 원래 여러 날짜분을 한 번에 내려줌)
          const todayStr = todayYYYYMMDD();
          const hasToday = parsed.some((c) => c.time.slice(0, 8) === todayStr);
          const targetDate = hasToday
            ? todayStr
            : parsed.reduce((max, c) => (c.time.slice(0, 8) > max ? c.time.slice(0, 8) : max), "");
          const candles = parsed.filter((c) => c.time.slice(0, 8) === targetDate && c.time.slice(8, 12) >= "0900");
          return Response.json({ ok: true, candles, tradingDate: targetDate || null });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/chart") {
        try {
          const code = url.searchParams.get("code");
          const period = url.searchParams.get("period") || "5";
          if (!code) return Response.json({ ok: false, error: "code 누락" }, { status: 400 });
          const token = await kiwoomIssueToken(env);
          const raw = await kiwoomChart(env, token, code, period);
          const parsed = parseKiwoomChart(raw);
          return Response.json({
            ok: true,
            prices: parsed.map((p) => p.price),
            times: parsed.map((p) => p.time),
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/debug") {
        const result = await debugFetch(env);
        return Response.json(result);
      }

      if (url.pathname === "/api/debug-quote") {
        try {
          const code = url.searchParams.get("code") || "005930";
          const token = await kiwoomIssueToken(env);
          const raw = await kiwoomQuote(env, token, code);
          return Response.json({ ok: true, rawKeys: Object.keys(raw), raw });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/debug-chart") {
        try {
          const code = url.searchParams.get("code") || "005930";
          const period = url.searchParams.get("period") || "5";
          const token = await kiwoomIssueToken(env);
          const raw = await kiwoomChart(env, token, code, period);
          let rows = [];
          for (const k of Object.keys(raw)) {
            if (Array.isArray(raw[k])) { rows = raw[k]; break; }
          }
          const times = rows.map((r) => r.cntr_tm).filter(Boolean);
          const dates = [...new Set(times.map((t) => t.slice(0, 8)))].sort();
          return Response.json({
            ok: true,
            rawKeys: Object.keys(raw),
            totalRows: rows.length,
            uniqueDates: dates,
            earliestTm: times[times.length - 1],
            latestTm: times[0],
            rawSample: JSON.stringify(raw).slice(0, 800),
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/pattern-scan") {
        try {
          const timesRes = await env.DB.prepare(
            `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT 1`
          ).all();
          const times = timesRes.results.map((r) => r.captured_at);
          if (times.length === 0) {
            return Response.json({ ok: false, error: "오늘 수집된 데이터가 없습니다" });
          }

          // 같은 스냅샷 시각(2분 틱)에 대해 이미 스캔한 적 있으면 15종목×1.1초 재스캔 없이 캐시 반환
          const cached = await env.DB.prepare(
            `SELECT result_json FROM pattern_scan_cache WHERE captured_at = ?`
          )
            .bind(times[0])
            .first();
          if (cached) {
            return Response.json({ ok: true, cached: true, ...JSON.parse(cached.result_json) });
          }

          const candRes = await env.DB.prepare(
            `SELECT code, name, volume FROM snapshots WHERE captured_at = ? ORDER BY volume DESC LIMIT 15`
          )
            .bind(times[0])
            .all();
          const candidates = candRes.results;
          const { results, debugInfo } = await scanPatternMatches(env, candidates);
          const payload = { scanned: candidates.length, latestSnapshotAt: times[0], results, debugInfo };

          await env.DB.prepare(
            `INSERT OR REPLACE INTO pattern_scan_cache (captured_at, result_json, created_at) VALUES (?, ?, ?)`
          )
            .bind(times[0], JSON.stringify(payload), new Date().toISOString())
            .run();

          return Response.json({ ok: true, cached: false, ...payload });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/market-index") {
        // relay가 웹소켓으로 상시 물고 있는 실시간 지수를 그대로 읽어옴.
        // 키움 TR 호출 0건이라 초당1건 제한과 무관하고, D1 캐싱도 필요 없음(항상 최신).
        try {
          const res = await kiwoomRelayFetch(env, "/realtime/index", { method: "GET" });
          const data = await res.json();
          if (!data.ok || !data.kospi || !data.kosdaq) {
            // 웹소켓이 아직 연결 전이거나 장 시작 전이라 데이터가 없는 경우
            return Response.json({
              ok: false,
              error: "실시간 지수 데이터 대기 중",
              wsConnected: data.wsConnected,
              wsLoggedIn: data.wsLoggedIn,
            });
          }
          return Response.json({
            ok: true,
            realtime: true,
            kospi: { price: data.kospi.price, rate: data.kospi.rate },
            kosdaq: { price: data.kosdaq.price, rate: data.kosdaq.rate },
            updatedAt: data.kospi.updatedAt,
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/admin/performance-report") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        // 실제로 담았던 관심종목들의 결과를 보드별/신호별로 집계.
        // 백테스트(가상)와 달리 이건 "실제로 내가 담은 것"들의 성적표라 가중치 조정의 가장 강한 근거임.
        try {
          const horizon = parseInt(url.searchParams.get("horizon") || "30", 10) || 30;
          const res = await env.DB.prepare(
            `SELECT source_board, added_state, pnl_pct FROM watchlist_performance WHERE horizon_min = ?`
          )
            .bind(horizon)
            .all();
          const rows = res.results;
          if (!rows.length) {
            return Response.json({ ok: true, horizon, sampleSize: 0, note: "아직 기록된 성과 데이터가 없습니다. 관심종목을 담고 30분 이상 지나야 쌓입니다." });
          }

          const agg = (keyFn) => {
            const map = new Map();
            rows.forEach((r) => {
              for (const k of keyFn(r)) {
                if (!k) continue;
                if (!map.has(k)) map.set(k, { count: 0, sum: 0, wins: 0 });
                const s = map.get(k);
                s.count++;
                s.sum += r.pnl_pct;
                if (r.pnl_pct > 0) s.wins++;
              }
            });
            const out = {};
            for (const [k, s] of map) {
              out[k] = {
                sampleSize: s.count,
                avgPnlPct: +(s.sum / s.count).toFixed(3),
                winRatePct: +((s.wins / s.count) * 100).toFixed(1),
              };
            }
            return out;
          };

          const overallAvg = +(rows.reduce((s, r) => s + r.pnl_pct, 0) / rows.length).toFixed(3);
          const overallWinRate = +((rows.filter((r) => r.pnl_pct > 0).length / rows.length) * 100).toFixed(1);

          return Response.json({
            ok: true,
            horizon,
            sampleSize: rows.length,
            overall: { avgPnlPct: overallAvg, winRatePct: overallWinRate },
            byBoard: agg((r) => [r.source_board]),
            bySignal: agg((r) => (r.added_state || "").split(",").filter(Boolean)),
            interpretation:
              "byBoard/bySignal의 avgPnlPct가 overall보다 높으면 그 보드/신호가 실제로 효과 있었다는 뜻. " +
              "sampleSize가 작으면(대략 20 미만) 아직 우연일 수 있으니 데이터가 더 쌓인 뒤 판단할 것.",
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/admin/backtest-history") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        try {
          const days = Math.min(parseInt(url.searchParams.get("days") || "14", 10) || 14, 60);
          const res = await env.DB.prepare(
            `SELECT date, result_json FROM signal_backtest_history ORDER BY date DESC LIMIT ?`
          )
            .bind(days)
            .all();
          return Response.json({
            ok: true,
            days: res.results.map((r) => ({ date: r.date, ...JSON.parse(r.result_json) })),
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/admin/backtest-signals") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        // computeRecommendations가 쓰는 신호들(가속중/매수전환/체결강도개선/매수잔량급증/눌림목/거래량급증/당일신고가)
        // 각각이 "신호가 있었던 시점 다음 틱에 실제로 더 올랐는지"를 실측. 지금 가중치는 전부 직관으로 붙인 거라
        // 이 결과를 보고 효과 없는 건 빼고, 효과 큰 건 가중치를 올리는 식으로 재조정해야 함.
        try {
          const tickLimit = Math.min(parseInt(url.searchParams.get("ticks") || "300", 10) || 300, 1000);
          const result = await computeSignalBacktest(env, tickLimit);
          if (!result.ok) return Response.json(result);
          return Response.json({
            ...result,
            interpretation:
              "edgeVsBaseline이 뚜렷한 양수면 그 신호가 실제로 다음 틱 상승폭을 키우는 효과가 있다는 뜻(가중치 유지/상향 근거). " +
              "0에 가깝거나 음수면 그 신호는 추천점수에서 가중치를 낮추거나 빼는 걸 검토. " +
              "sampleSize가 너무 작으면(대략 30 미만) 우연일 수 있으니 ticks 파라미터를 늘려서 다시 확인.",
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/admin/backtest-momentum") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        // "직전 틱 대비 상승 중인 종목이 그 다음 틱에도 계속 오르는가?" 검증
        // (momentumScore/risingTop5가 근거로 쓰는 가정 자체가 맞는지 실제 데이터로 확인)
        try {
          const tickLimit = Math.min(parseInt(url.searchParams.get("ticks") || "300", 10) || 300, 1000);
          const timesRes = await env.DB.prepare(
            `SELECT DISTINCT captured_at FROM snapshots ORDER BY captured_at DESC LIMIT ?`
          )
            .bind(tickLimit)
            .all();
          const times = timesRes.results.map((r) => r.captured_at).reverse(); // 과거 -> 최신
          if (times.length < 3) {
            return Response.json({ ok: false, error: "분석할 틱이 부족합니다 (최소 3틱 필요)" });
          }

          const rowsRes = await env.DB.prepare(
            `SELECT code, change_rate, captured_at FROM snapshots WHERE captured_at >= ? AND captured_at <= ?`
          )
            .bind(times[0], times[times.length - 1])
            .all();

          // code별로 시간순 change_rate 배열 구성
          const byCode = new Map();
          for (const r of rowsRes.results) {
            if (!byCode.has(r.code)) byCode.set(r.code, new Map());
            byCode.get(r.code).set(r.captured_at, r.change_rate);
          }

          let posCount = 0, posForwardSum = 0;
          let negCount = 0, negForwardSum = 0;
          for (const rateByTime of byCode.values()) {
            for (let i = 1; i < times.length - 1; i++) {
              const prev = rateByTime.get(times[i - 1]);
              const cur = rateByTime.get(times[i]);
              const next = rateByTime.get(times[i + 1]);
              if (prev === undefined || cur === undefined || next === undefined) continue; // 그 구간에 리스트 밖이었던 종목
              const momentumDelta = cur - prev; // 지금 이 틱까지의 momentum
              const forwardDelta = next - cur; // 그 다음 틱에서 실제로 어떻게 됐는지
              if (momentumDelta > 0) {
                posCount++;
                posForwardSum += forwardDelta;
              } else if (momentumDelta < 0) {
                negCount++;
                negForwardSum += forwardDelta;
              }
            }
          }

          return Response.json({
            ok: true,
            ticksAnalyzed: times.length,
            momentumPositive: {
              sampleSize: posCount,
              avgForwardDeltaPct: posCount ? +(posForwardSum / posCount).toFixed(4) : null,
            },
            momentumNegative: {
              sampleSize: negCount,
              avgForwardDeltaPct: negCount ? +(negForwardSum / negCount).toFixed(4) : null,
            },
            interpretation:
              "momentumPositive.avgForwardDeltaPct가 momentumNegative보다 뚜렷하게 크면(양수 우세) " +
              "momentumScore/risingTop5 가정(상승 중이면 계속 상승)이 어느 정도 근거 있는 것. " +
              "차이가 거의 없거나 반대면 가중치 재검토 필요.",
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/realtime-condition") {
        // relay가 조건검색 웹소켓으로 실시간 감시 중인 결과를 그대로 반환.
        // 2분 cron 폴링과 달리, 조건에 편입되는 순간 즉시 목록에 나타남.
        try {
          const res = await kiwoomRelayFetch(env, "/realtime/condition", { method: "GET" });
          const data = await res.json();
          return Response.json({
            ok: true,
            wsConnected: data.wsConnected,
            seq: data.seq,
            codes: data.codes || [],
            count: data.count || 0,
            lastEventAt: data.lastEventAt,
            history: data.history || [],
            events: data.events || [],
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/realtime-all") {
        // 관심종목시세 + 리스트시세 + 지수 + 실시간포착을 한 번에 반환.
        // 전부 relay 메모리에서 읽는 거라 나눌 이유가 없어서 통합 - 클라이언트 폴링이 3개 API -> 1개로 줄어듦.
        try {
          const wlRes = await env.DB.prepare(`SELECT code FROM watchlist`).all();
          const codes = wlRes.results.map((r) => r.code);
          const listParam = url.searchParams.get("list") || "";
          const listCodes = listParam.split(",").filter((c) => /^[0-9A-Za-z]{6}$/.test(c)).slice(0, 180);

          await kiwoomRelayFetch(env, "/realtime/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codes, listCodes }),
          }).catch(() => {});

          const res = await kiwoomRelayFetch(env, "/realtime/all", { method: "GET" });
          const data = await res.json();

          // 관심종목만 30초 촘촘 기록 (응답을 막지 않도록 기다리지 않고 백그라운드로 실행)
          if (codes.length && data.stocks) {
            ctx.waitUntil(maybeWriteFineWatchlistSnapshot(env, codes, data.stocks));
          }

          return Response.json({
            ok: true,
            wsConnected: data.wsConnected,
            wsLoggedIn: data.wsLoggedIn,
            index: data.index || { kospi: null, kosdaq: null },
            stocks: data.stocks || {},
            condition: data.condition || { seq: null, codes: [], count: 0, history: [] },
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/realtime-watchlist") {
        // 관심종목 + 화면 리스트 종목을 relay 웹소켓으로 구독시키고, 실시간 체결값을 반환.
        // 키움 TR 호출 0건. 리스트 종목은 클라이언트가 지금 보고 있는 종목만 보내줌(그룹당 200 제한).
        try {
          const wlRes = await env.DB.prepare(`SELECT code FROM watchlist`).all();
          const codes = wlRes.results.map((r) => r.code);

          // 클라이언트가 ?list=코드,코드,... 로 화면에 뜬 종목을 알려줌
          const listParam = url.searchParams.get("list") || "";
          const listCodes = listParam.split(",").filter((c) => /^[0-9A-Za-z]{6}$/.test(c)).slice(0, 180);

          await kiwoomRelayFetch(env, "/realtime/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codes, listCodes }),
          }).catch(() => {});

          const res = await kiwoomRelayFetch(env, "/realtime/stocks", { method: "GET" });
          const data = await res.json();
          return Response.json({
            ok: true,
            wsConnected: data.wsConnected,
            wsLoggedIn: data.wsLoggedIn,
            stocks: data.stocks || {},
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/system-status-summary") {
        // 화면 상단 배너용 - 세부 메시지는 안 주고 "확인할 게 있는지"만 알려줌 (관리자키 불필요, 안전)
        try {
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const res = await env.DB.prepare(
            `SELECT kind, COUNT(*) as cnt, MAX(created_at) as latest FROM system_events
             WHERE created_at >= ? AND kind IN
               ('relay_unhealthy', 'cron_failure', 'final_quote_partial_failure', 'relay_memory_high')
             GROUP BY kind`
          )
            .bind(cutoff)
            .all()
            .catch(() => ({ results: [] }));
          const issues = res.results || [];
          const totalCount = issues.reduce((s, r) => s + r.cnt, 0);
          return Response.json({
            ok: true,
            hasIssues: totalCount > 0,
            totalCount,
            kinds: issues.map((r) => ({ kind: r.kind, count: r.cnt, latest: r.latest })),
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/relay-health") {
        // relay VM이 살아있는지 + 웹소켓이 실제로 연결/로그인 상태인지 한 번에 확인
        // (relay 프로세스는 살아있는데 웹소켓만 조용히 끊긴 경우를 잡기 위함)
        const startedAt = Date.now();
        try {
          if (!env.RELAY_URL || !env.RELAY_SECRET) {
            return Response.json({ ok: false, error: "RELAY_URL / RELAY_SECRET 시크릿 미설정" }, { status: 500 });
          }
          const res = await kiwoomRelayFetch(env, "/realtime/status", { method: "GET" });
          const elapsedMs = Date.now() - startedAt;
          let wsStatus = null;
          try {
            wsStatus = await res.json();
          } catch (e) {
            // 구버전 relay(웹소켓 없는 버전)면 이 엔드포인트가 없어서 JSON이 아닐 수 있음
          }
          return Response.json({
            ok: true,
            relayReachable: true,
            httpStatus: res.status,
            elapsedMs,
            wsConnected: wsStatus ? wsStatus.wsConnected : null,
            wsLoggedIn: wsStatus ? wsStatus.wsLoggedIn : null,
            wsLastMessageAt: wsStatus ? wsStatus.lastMessageAt : null,
          });
        } catch (e) {
          return Response.json(
            { ok: true, relayReachable: false, error: String(e.message || e), elapsedMs: Date.now() - startedAt },
            { status: 200 } // relay 다운은 이 API 자체의 실패가 아니라 정상적인 진단 결과이므로 200
          );
        }
      }

      if (url.pathname === "/api/admin/system-events") {
        if (!checkAdminKey(request, url, env)) {
          return Response.json({ ok: false, error: "인증 필요 (ADMIN_KEY)" }, { status: 401 });
        }
        try {
          const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
          const res = await env.DB.prepare(
            `SELECT kind, message, created_at FROM system_events ORDER BY created_at DESC LIMIT ?`
          )
            .bind(limit)
            .all();
          return Response.json({ ok: true, events: res.results });
        } catch (e) {
          return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
        }
      }

      if (url.pathname === "/api/run-now") {
        // 수동 테스트용 (배포 직후 cron 기다리지 않고 바로 확인)
        const result = await collectAndStore(env);
        return Response.json(result);
      }

      return new Response(renderDashboard(), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    } catch (e) {
      // 처리 안 된 예외를 Cloudflare의 1101 에러 페이지 대신 그대로 노출
      return Response.json(
        { ok: false, error: String(e.message || e), stack: String(e.stack || "") },
        { status: 500 }
      );
    }
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    if (!isMarketHoursKST(now)) return;
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const minutes = kst.getHours() * 60 + kst.getMinutes();
    // cron이 짝수분마다 도니까 15:35 정각은 못 맞고, 가장 가까운 15:36 틱에 한 번만 정확한 종가로 재조회
    const isFinalCloseTick = minutes === 15 * 60 + 36;
    // 15:36에 서브리퀘스트 한도 등으로 놓친 종목을 이어서 채우는 재시도 틱 (매 호출마다 한도가 리셋되므로 유효)
    const isRetryTick = [15 * 60 + 38, 15 * 60 + 40, 15 * 60 + 42, 15 * 60 + 44, 15 * 60 + 46].includes(minutes);

    ctx.waitUntil(
      (async () => {
        if (isFinalCloseTick) {
          await collectFinalAccurateQuotes(env);
          await runDailySignalBacktest(env).catch((e) => {
            console.error("일일 신호 백테스트 실패:", e.message || e);
          });
        } else if (isRetryTick) {
          await retryFinalQuotePending(env);
        } else {
          await collectAndStore(env);
          await checkWatchlistRiskLevels(env).catch((e) => {
            console.error("관심종목 리스크체크 실패:", e.message || e);
          });
          await trackWatchlistPerformance(env).catch((e) => {
            console.error("관심종목 성과추적 실패:", e.message || e);
          });
          await checkRelayHealthForCron(env).catch(() => {}); // 이것 자체가 실패해도 나머지 흐름엔 영향 없음
        }
      })().catch((e) => {
        console.error("scheduled 수집 실패:", e.message || e);
        return logSystemEvent(env, "cron_failure", `${isFinalCloseTick ? "최종재조회" : isRetryTick ? "종가재시도" : "배치수집"} 실패: ${e.message || e}`);
      })
    );
  },
};
