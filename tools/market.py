# 오마주 오늘의 시세: 환율·금·은·코스피·코스닥·비트코인을 모아 Firestore settings/market 에 저장
# 한 시간마다 GitHub Actions가 실행한다. 키가 필요 없는 공개 출처만 쓴다.
import os, sys, json, datetime, urllib.request

KST = datetime.timezone(datetime.timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (omaju.kr daily market)"}


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def yahoo(sym):
    """야후 금융: 현재가와 '전날 종가'.
    야후가 주는 previousClose 는 가끔 그저께 값이 들어 있어(코스닥 2026-10-16) 믿지 않고,
    일봉(하루 막대)에서 '오늘이 아닌 가장 최근 날'의 종가를 직접 고른다."""
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=10d&interval=1d")
    r = j["chart"]["result"][0]; m = r["meta"]
    price = float(m["regularMarketPrice"])
    tz = datetime.timezone(datetime.timedelta(seconds=m.get("gmtoffset", 0)))
    today = datetime.datetime.fromtimestamp(m["regularMarketTime"], tz).date()
    closes = r["indicators"]["quote"][0]["close"]
    prev = None
    for ts, c in zip(r.get("timestamp", []), closes):
        if c is not None and datetime.datetime.fromtimestamp(ts, tz).date() < today:
            prev = float(c)
    return price, prev


def get_text(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode(r.headers.get_content_charset() or "euc-kr", "replace")


def naver_market(cd):
    """네이버 증권 시장지표(우리가 늘 보는 하나은행 매매기준율·한국거래소 금): 현재값과 전날 값.
    cd 예: FX_USDKRW, FX_JPYKRW(100엔), FX_EURKRW, M04020000(국내 금, 원/g)"""
    num = lambda x: float(str(x).replace(",", ""))
    cat = "metals" if cd.startswith("M0") else "exchange"
    try:  # 1) 모바일 증권 JSON
        j = get(f"https://m.stock.naver.com/front-api/marketIndex/productDetail?category={cat}&reutersCode={cd}")
        j = j.get("result", j)
        price = num(j["closePrice"]); diff = num(j["fluctuations"])
        kind = str((j.get("fluctuationsType") or {}).get("name", j.get("fluctuationsType", ""))).upper()
        if kind in ("FALLING", "LOWER_LIMIT") and diff > 0: diff = -diff
        return price, price - diff
    except Exception:
        pass
    # 2) PC 시장지표 화면
    import re
    html = get_text("https://finance.naver.com/marketindex/")
    i = html.index(f"marketindexCd={cd}")
    blk = html[i:i + 1500]
    price = num(re.search(r'class="value">([\d,.]+)<', blk).group(1))
    diff = num(re.search(r'class="change">\s*([\d,.]+)\s*<', blk).group(1))
    if re.search(r'point_dn|하락', blk[:blk.find('class="change"') + 200]): diff = -diff
    return price, price - diff


def naver_index(code):
    """네이버 증권 지수(코스피 KOSPI / 코스닥 KOSDAQ): 현재가와 전날 대비 → 전날 종가"""
    j = get(f"https://m.stock.naver.com/api/index/{code}/basic")
    num = lambda x: float(str(x).replace(",", ""))
    price = num(j["closePrice"]); diff = num(j["compareToPreviousClosePrice"])
    # 내림이면 diff 가 음수로 오지만, 부호 없이 오는 경우를 대비해 등락 구분 값을 본다
    kind = str((j.get("compareToPreviousPrice") or {}).get("name", "")).upper()
    if kind in ("FALLING", "LOWER_LIMIT") and diff > 0: diff = -diff
    return price, price - diff


def item(label, value, prev, unit, digits=0, note=""):
    chg = None if not prev else (value - prev) / prev * 100
    return {"label": label, "value": round(value, digits), "unit": unit, "change": None if chg is None else round(chg, 2), "note": note}


def main():
    out, errors = [], []
    usd = None
    # 1) 환율: 네이버(하나은행 매매기준율)를 먼저, 안 되면 야후 시장 환율, 그것도 안 되면 공개 환율
    fx = {}
    for cd, key in (("FX_USDKRW", "usd"), ("FX_JPYKRW", "jpy"), ("FX_EURKRW", "eur")):
        try: fx[key] = naver_market(cd)
        except Exception as e: errors.append(f"{key}(네이버): {e}")
    for sym, key, mul in (("KRW=X", "usd", 1), ("JPYKRW=X", "jpy", 100), ("EURKRW=X", "eur", 1)):
        if key in fx: continue
        try: v, v0 = yahoo(sym); fx[key] = (v * mul, (v0 * mul) if v0 else None)
        except Exception as e: errors.append(f"{key}(야후): {e}")
    if len(fx) < 3:
        try:
            r = get("https://open.er-api.com/v6/latest/USD")["rates"]; u = r["KRW"]
            fx.setdefault("usd", (u, None)); fx.setdefault("jpy", (u / r["JPY"] * 100, None)); fx.setdefault("eur", (u / r["EUR"], None))
        except Exception as e:
            errors.append(f"환율: {e}")
    for key, label in (("usd", "미국 달러"), ("jpy", "일본 엔 (100엔)"), ("eur", "유로")):
        if key in fx: out.append(item(label, fx[key][0], fx[key][1], "원", 2))
    usd = fx.get("usd", (None,))[0]
    # 2) 코스피·코스닥
    # 네이버 증권(우리가 늘 보는 숫자)을 먼저, 안 되면 야후
    for code, sym, label in (("KOSPI", "^KS11", "코스피"), ("KOSDAQ", "^KQ11", "코스닥")):
        try:
            p, prev = naver_index(code)
        except Exception as e:
            errors.append(f"{label}(네이버): {e}")
            try:
                p, prev = yahoo(sym)
            except Exception as e2:
                errors.append(f"{label}: {e2}"); continue
        # 하루에 ±15% 넘게 움직였다고 나오면 잘못 받은 값 → 등락은 비워 둠
        if prev and abs(p - prev) / prev > 0.15: prev = None
        out.append(item(label, p, prev, "", 2))
    # 3) 금: 한국거래소 금시장 1g 값 × 3.75 (네이버 '국내 금'과 같은 숫자). 안 되면 국제 시세 환산
    try:
        g, g0 = naver_market("M04020000")
        out.append(item("금 1돈", g * 3.75, (g0 * 3.75) if g0 else None, "원", 0, "한국거래소 기준"))
    except Exception as e:
        errors.append(f"금(네이버): {e}")
        if usd:
            try:
                p, prev = yahoo("GC=F"); k = usd / 31.1035 * 3.75
                out.append(item("금 1돈", p * k, (prev * k) if prev else None, "원", 0, "국제 시세 환산"))
            except Exception as e2: errors.append(f"금: {e2}")
    # 은: 국내 거래소가 없어 국제 시세를 원으로 환산 (1돈 = 3.75g, 1온스 = 31.1035g)
    if usd:
        try:
            p, prev = yahoo("SI=F"); k = usd / 31.1035 * 3.75
            out.append(item("은 1돈", p * k, (prev * k) if prev else None, "원", 0, "국제 시세 환산"))
        except Exception as e: errors.append(f"은: {e}")
    # 4) 비트코인·이더리움 (업비트, 원화)
    try:
        for t in get("https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH"):
            label = "비트코인" if t["market"] == "KRW-BTC" else "이더리움"
            out.append(item(label, t["trade_price"], t["prev_closing_price"], "원", 0))
    except Exception as e:
        errors.append(f"코인: {e}")

    if not out:
        raise SystemExit("시세를 하나도 못 받음: " + "; ".join(errors))
    doc = {"items": out, "updatedAt": datetime.datetime.now(KST).isoformat(), "errors": errors}
    for e in errors:
        print("[fail]", e, file=sys.stderr)
    print(json.dumps(doc, ensure_ascii=False, indent=1))

    from google.cloud import firestore as fs
    from google.oauth2 import service_account
    info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    db = fs.Client(project=info["project_id"], credentials=service_account.Credentials.from_service_account_info(info))
    db.collection("settings").document("market").set(doc)
    if os.environ.get("SAVE_LOG"):
        # 점검용: 화면과 같은 날씨 요청(서울, 기상청 모델) 결과도 함께 남겨 기상청·네이버와 맞춰 볼 수 있게
        doc["wx_seoul"] = {}
        for mdl in ("kma_seamless", "kma_ldps", "kma_gdps", ""):
            try:
                w = get("https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,weather_code"
                        "&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1" + (f"&models={mdl}" if mdl else ""))
                hr = [x for x in w["hourly"]["temperature_2m"] if x is not None]
                doc["wx_seoul"][mdl or "기본"] = {"now": w["current"]["temperature_2m"], "code": w["current"]["weather_code"],
                    "max": w["daily"]["temperature_2m_max"][0], "min": w["daily"]["temperature_2m_min"][0],
                    "hourly_max": max(hr) if hr else None, "hourly_min": min(hr) if hr else None}
            except Exception as e:
                doc["wx_seoul"][mdl or "기본"] = {"error": str(e)[:120]}
        # 점검용: 환율을 두 곳(모바일 JSON / PC 시장지표=하나은행 고시)에서 받은 값을 나란히 남김
        doc["fx_debug"] = {}
        for cd in ("FX_USDKRW", "FX_JPYKRW", "FX_EURKRW", "M04020000"):
            d = {}
            try:
                cat = "metals" if cd.startswith("M0") else "exchange"
                j = get(f"https://m.stock.naver.com/front-api/marketIndex/productDetail?category={cat}&reutersCode={cd}")
                j = j.get("result", j)
                d["mobile"] = {k: v for k, v in j.items() if not isinstance(v, (list, dict)) or k == "fluctuationsType"}
            except Exception as e: d["mobile"] = {"error": str(e)[:120]}
            try:
                import re
                html = get_text("https://finance.naver.com/marketindex/")
                i = html.index(f"marketindexCd={cd}"); blk = html[i:i + 1500]
                d["pc"] = {"value": re.search(r'class="value">([\d,.]+)<', blk).group(1),
                           "change": re.search(r'class="change">\s*([\d,.]+)\s*<', blk).group(1),
                           "down": bool(re.search(r'point_dn|하락', blk[:blk.find('class="change"') + 200])),
                           "time": (re.search(r'class="time">([^<]+)<', blk) or [None, None])[1],
                           "src": (re.search(r'class="source"[^>]*>([^<]+)<', blk) or [None, None])[1]}
            except Exception as e: d["pc"] = {"error": str(e)[:120]}
            doc["fx_debug"][cd] = d
        json.dump(doc, open(os.path.join(HERE, "last-market.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("저장 완료", doc["updatedAt"])


if __name__ == "__main__":
    main()
