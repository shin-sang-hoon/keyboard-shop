import mysql.connector

conn = mysql.connector.connect(
    host='localhost', port=3306,
    user='keyboard_user', password='keyboard1234',
    database='keyboard_db'
)
cursor = conn.cursor()
cursor.execute("SELECT id, name FROM products WHERE glb_url IS NULL")
rows = cursor.fetchall()
print(f"미매핑 {len(rows)}개:")
for id, name in rows:
    print(f"  [{id}] {name}")
cursor.close()
conn.close()
