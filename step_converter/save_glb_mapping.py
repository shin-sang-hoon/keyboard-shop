import os
import mysql.connector

# DB 연결
conn = mysql.connector.connect(
    host='localhost',
    port=3306,
    user='keyboard_user',
    password='keyboard1234',
    database='keyboard_db'
)
cursor = conn.cursor()

MODELS_DIR = r"C:\Users\TJ-BU-702-P03\keyboard-shop\frontend\public\models"

# GLB 파일 목록 수집
glb_files = []
for root, dirs, files in os.walk(MODELS_DIR):
    for f in files:
        if f.lower().endswith('.glb'):
            full_path = os.path.join(root, f)
            rel_path = full_path.replace(MODELS_DIR, '').replace('\\', '/')
            glb_files.append(rel_path)

print(f"GLB 파일 {len(glb_files)}개 발견")

# 상품 목록 가져오기
cursor.execute("SELECT id, name, source_id FROM products WHERE glb_url IS NULL")
products = cursor.fetchall()
print(f"매핑 필요 상품 {len(products)}개\n")

def normalize(s):
    return s.lower().replace(' ', '').replace('-', '').replace('_', '')

matched = 0
unmatched_list = []

for product_id, name, source_id in products:
    name_norm = normalize(name)
    best_glb = None

    candidates = []
    for glb_path in glb_files:
        glb_norm = normalize(glb_path)
        for keyword in ['k10', 'k8', 'k3', 'k2', 'k5', 'k1', 'k4', 'k6', 'k7', 'k9',
                        'k11', 'k12', 'k13', 'k14', 'k15', 'k17',
                        'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
                        'q11', 'q12', 'q13', 'q14', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6',
                        'v8', 'v10', 'b6', 'l1', 'l3']:
            if keyword in name_norm and keyword in glb_norm:
                candidates.append(glb_path)
                break

    # Full-Model 우선
    for c in candidates:
        if 'fullmodel' in normalize(c) or 'full-model' in c.lower():
            best_glb = c
            break
    # Full-Model 없으면 첫 번째
    if not best_glb and candidates:
        best_glb = candidates[0]

    if best_glb:
        glb_url = f"/models{best_glb}"
        cursor.execute("UPDATE products SET glb_url = %s WHERE id = %s", (glb_url, product_id))
        matched += 1
        print(f"✓ [{product_id}] {name[:35]} → {best_glb}")
    else:
        unmatched_list.append((product_id, name))

# B1 시리즈 → B6 Pro GLB로 임시 매핑
print("\n--- B1 시리즈 임시 매핑 ---")
B1_IDS = [8, 25, 37, 47, 53, 54, 59, 64, 66, 67, 73, 74, 82, 91]
GLB_URL = '/models/B-Pro-Series/B6 Pro/B6_PRO_BOTTOM_CASE.glb'
for pid in B1_IDS:
    cursor.execute("UPDATE products SET glb_url = %s WHERE id = %s", (GLB_URL, pid))
    print(f"✓ [{pid}] B1 시리즈 → B6 Pro GLB 임시 매핑")
matched += len(B1_IDS)

conn.commit()
cursor.close()
conn.close()

print(f"\n완료: 총 매핑 {matched}개")
if unmatched_list:
    print(f"미매핑 {len(unmatched_list)}개:")
    for pid, name in unmatched_list:
        print(f"  [{pid}] {name}")
