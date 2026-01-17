# save as test_proxy_upload.py
import sys
import requests

if len(sys.argv) < 2:
    print("Usage: python test_proxy_upload.py /path/to/image.jpg [port]")
    sys.exit(1)

file_path = sys.argv[1]
port = int(sys.argv[2]) if len(sys.argv) > 2 else 38123
url = f"http://127.0.0.1:{port}/upload"

with open(file_path, "rb") as f:
    files = {"file": (file_path.split("/")[-1], f)}
    resp = requests.post(url, files=files, timeout=60)

print("status:", resp.status_code)
print("response:", resp.text)