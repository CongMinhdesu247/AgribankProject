"""Run once on HP in the project root. Never prints credentials or overwrites .env."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
os.chdir(root)
os.umask(0o077)
values = {
    "MYSQL_ROOT_PASSWORD": secrets.token_hex(32),
    "DB_PASSWORD": secrets.token_hex(32),
    "SESSION_SECRET": secrets.token_hex(48),
    "IT_REGISTRATION_CODE": secrets.token_hex(24),
    "WEB_PORT": "8093",
    "APP_VERSION": "hp-20261117-1",
}
with open(".env", "x", encoding="utf-8") as output:
    output.write("".join(f"{key}={value}\n" for key, value in values.items()))
print("Created .env with mode 600. Keep it private; do not paste its contents into chat.")
