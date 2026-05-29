#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
P3 상세정보 시연 시드 (5/29) — Mac 에서 실행.

ACTIVE 상품 중 description 이 비었거나(또는 XSS 테스트 잔재) 인 것만 골라,
각 상품의 실제 스펙(브랜드/타입/레이아웃/스위치/연결)을 읽어 상품마다 다른
한글 상세정보 HTML 을 생성해 UPDATE 한다.

- 단순 복붙 템플릿 아님: 보유 스펙만 골라 사양 목록 구성 → 상품별로 내용이 다름.
- 이미 사람이 손본 상세정보(위 조건에 안 걸림)는 건드리지 않음 (idempotent-safe).
- 텍스트 전용(이미지 없음) → SQL 인용부호 안전. 한글이라 Mac 에서 실행(utf8mb4).

실행:
  python3 seed_descriptions.py            # 적용
  python3 seed_descriptions.py --dry-run  # SQL 만 생성/미리보기 (DB 미변경)
"""
import subprocess, sys, html

CONTAINER = "keyboard_mysql"
DB = "keyboard_db"
MYSQL = ["docker", "exec", CONTAINER, "mysql", "-uroot", "-proot1234",
         "--default-character-set=utf8mb4", "-N", "-B", DB]

DRY = "--dry-run" in sys.argv

LAYOUT_MAP = {
    "full": "풀배열(100%)", "100": "풀배열(100%)", "풀배열": "풀배열(100%)",
    "tkl": "텐키리스(TKL)", "87": "텐키리스(TKL)",
    "96": "96%(1800 콤팩트)", "1800": "96%(1800 콤팩트)",
    "75": "75%", "80": "75%",
    "65": "65%", "68": "65%",
    "60": "60%",
}
SWITCH_MAP = {
    "linear": "리니어 (적축 계열 · 부드러운 직선 입력)",
    "tactile": "택타일 (갈축 계열 · 구분감 있는 입력)",
    "clicky": "클릭 (청축 계열 · 또렷한 클릭음)",
    "magnetic": "자석축 (홀이펙트 · 액추에이션 조절)",
    "저소음": "저소음 (정음 설계)", "silent": "저소음 (정음 설계)",
}
CONN_MAP = {
    "wireless": "무선 (블루투스 / 2.4GHz)", "bluetooth": "블루투스 무선",
    "wired": "유선 (USB)",
    "both": "유무선 겸용", "dual": "유무선 겸용", "wired_wireless": "유무선 겸용",
}
INTRO = {
    "KEYBOARD": "기계식 키보드입니다. 안정적인 타건감과 마감 품질로 사무 · 게이밍 · 작업 환경에 두루 어울립니다.",
    "KEYCAP":   "키보드의 인상을 좌우하는 키캡 세트입니다. 내구성과 색 표현을 고려해 제작되었습니다.",
    "SWITCH_PART": "타건감을 결정하는 핵심 부품, 스위치입니다.",
    "ACCESSORY": "키보드 환경을 완성하는 액세서리입니다.",
}

def q(raw, table):
    v = (raw or "").strip()
    return table.get(v.lower(), v) if v else ""

def build(name, brand, ptype, layout, stype, sname, mount, conn):
    name = name.strip()
    brand = (brand or "").strip()
    parts = []
    # 제품 소개
    lead = INTRO.get(ptype, "")
    brand_phrase = f"{brand} — " if brand else ""
    parts.append("<h3>제품 소개</h3>")
    parts.append(f"<p>{html.escape(brand_phrase + name)} {html.escape(lead)}</p>")
    # 주요 사양 (보유 필드만)
    specs = []
    if ptype == "KEYBOARD":
        L = q(layout, LAYOUT_MAP)
        if L: specs.append(("레이아웃", L))
        S = q(stype, SWITCH_MAP)
        if S:
            if (sname or "").strip(): S = f"{S} · {sname.strip()}"
            specs.append(("스위치", S))
        elif (sname or "").strip():
            specs.append(("스위치", sname.strip()))
        C = q(conn, CONN_MAP)
        if C: specs.append(("연결 방식", C))
        if (mount or "").strip(): specs.append(("마운트", mount.strip()))
    if brand: specs.append(("브랜드", brand))
    if specs:
        parts.append("<h3>주요 사양</h3>")
        parts.append("<ul>" + "".join(
            f"<li>{html.escape(k)}: {html.escape(v)}</li>" for k, v in specs) + "</ul>")
    # 구매 안내
    parts.append("<h3>구매 안내</h3>")
    if ptype == "KEYBOARD":
        comp = "키보드 본품, USB 케이블, 키캡/스위치 풀러, 사용 설명서"
    elif ptype == "KEYCAP":
        comp = "키캡 세트, 키캡 풀러"
    else:
        comp = "제품 본품, 사용 설명서"
    parts.append(
        "<ul>"
        f"<li>구성품: {comp}</li>"
        "<li>품질보증: 구입일로부터 1년 (소모품 · 단순 변심 · 외관 하자 제외)</li>"
        "<li>배송: 평일 기준 영업일 1~3일 이내 출고</li>"
        "</ul>")
    return "".join(parts)

# 1) 시드 대상 조회 (description 비었거나 XSS 잔재)
sql_select = (
    "SELECT p.id, p.name, COALESCE(b.name,''), p.product_type, "
    "COALESCE(p.layout,''), COALESCE(p.switch_type,''), COALESCE(p.switch_name,''), "
    "COALESCE(p.mounting_type,''), COALESCE(p.connection_type,'') "
    "FROM products p LEFT JOIN brands b ON p.brand_id=b.id "
    "WHERE p.status='ACTIVE' AND ("
    "p.description IS NULL OR TRIM(p.description)='' OR TRIM(p.description)='<p></p>' "
    "OR p.description LIKE '%XSS 테스트%')"
)
out = subprocess.run(MYSQL + ["-e", sql_select], capture_output=True, text=True)
if out.returncode != 0:
    print("SELECT 실패:", out.stderr); sys.exit(1)

rows = [line.split("\t") for line in out.stdout.splitlines() if line.strip()]
print(f"시드 대상 ACTIVE 상품: {len(rows)}개")
if not rows:
    print("대상 없음 — 종료"); sys.exit(0)

# 2) UPDATE SQL 생성
stmts = []
for r in rows:
    pid, name, brand, ptype, layout, stype, sname, mount, conn = (r + [""]*9)[:9]
    desc = build(name, brand, ptype, layout, stype, sname, mount, conn)
    desc_sql = desc.replace("'", "''")  # SQL 인용부호 escape (방어적)
    stmts.append(f"UPDATE products SET description='{desc_sql}' WHERE id={int(pid)};")

sql_text = "\n".join(stmts) + "\n"
with open("/tmp/seed_desc.sql", "w", encoding="utf-8") as f:
    f.write(sql_text)

# 미리보기 (첫 상품)
print("\n──── 샘플 (첫 상품) ────")
print(f"id={rows[0][0]}  {rows[0][1]}")
print(build(rows[0][1], rows[0][2], rows[0][3], rows[0][4], rows[0][5], rows[0][6], rows[0][7], rows[0][8]))

if DRY:
    print("\n[DRY-RUN] /tmp/seed_desc.sql 생성만 함 (DB 미변경).")
    sys.exit(0)

# 3) 적용 (docker cp + source)
subprocess.run(["docker", "cp", "/tmp/seed_desc.sql", f"{CONTAINER}:/tmp/seed_desc.sql"], check=True)
ap = subprocess.run(
    ["docker", "exec", CONTAINER, "sh", "-c",
     f"mysql -uroot -proot1234 --default-character-set=utf8mb4 {DB} < /tmp/seed_desc.sql"],
    capture_output=True, text=True)
if ap.returncode != 0:
    print("적용 실패:", ap.stderr); sys.exit(1)
print(f"\n✅ {len(rows)}개 상품 description 시드 완료.")
