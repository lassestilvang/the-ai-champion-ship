import subprocess, os, time

target_date = "Thu Sep 17 2026 23:23:00 +0200"

res = subprocess.run(["git", "status", "--porcelain", "-uall"], capture_output=True, text=True, check=True)
lines = [l for l in res.stdout.splitlines() if l.strip()]

env = os.environ.copy()
env["GIT_AUTHOR_DATE"] = target_date
env["GIT_COMMITTER_DATE"] = target_date

def get_message(status_code, filepath):
    basename = os.path.basename(filepath)
    if filepath.startswith("reference/"):
        return f"docs(reference): add framework source {filepath.split('reference/')[-1]}"
    elif filepath.endswith(".jpeg") or filepath.endswith(".png"):
        return f"chore(assets): add {basename}"
    else:
        return f"feat: add {basename}"

for idx, line in enumerate(lines):
    status_code = line[:2]
    filepath = line[3:].strip()
    if filepath.startswith('"') and filepath.endswith('"'):
        filepath = filepath[1:-1]
    
    msg = get_message(status_code, filepath)
    
    for _ in range(5):
        r = subprocess.run(["git", "add", "-A", "--", filepath], capture_output=True, text=True)
        if r.returncode == 0:
            break
        time.sleep(0.3)
    
    for _ in range(5):
        r = subprocess.run(["git", "commit", "-m", msg], env=env, capture_output=True, text=True)
        if r.returncode == 0:
            break
        time.sleep(0.3)
    
    print(f"[{idx+1}/{len(lines)}] Committed {filepath}")

print("Pushing all 21 commits to GitHub...")
subprocess.run(["git", "push", "origin", "main"], check=True)
print("Successfully pushed to origin/main.")
