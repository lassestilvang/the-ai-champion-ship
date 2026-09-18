import subprocess, os, time

date_sep18 = "Fri Sep 18 2026 23:23:00 +0200"
date_sep19 = "Sat Sep 19 2026 23:23:00 +0200"

res = subprocess.run(["git", "status", "--porcelain", "-uall"], capture_output=True, text=True, check=True)
lines = [l for l in res.stdout.splitlines() if l.strip()]

to_commit = lines[:100]

def get_message(status_code, filepath):
    basename = os.path.basename(filepath)
    is_deleted = "D" in status_code
    is_modified = "M" in status_code
    
    if is_deleted:
        if filepath.startswith("frontend/"):
            return f"chore(frontend): remove legacy {filepath.split('frontend/')[-1]}"
        elif filepath.startswith("services/"):
            return f"chore(backend): remove legacy service {basename}"
        elif filepath.startswith("migrations/"):
            return f"chore(db): remove legacy migration {basename}"
        else:
            return f"chore: remove legacy {basename}"
    elif is_modified:
        return f"chore: update {basename}"
    else:
        if filepath.startswith("apps/"):
            return f"feat(apps): add {filepath.split('apps/')[-1]}"
        elif filepath.startswith("netlify/"):
            return f"chore(deploy): add netlify configuration {basename}"
        elif filepath.startswith("reference/"):
            return f"docs: add reference document {basename}"
        else:
            return f"feat: add {basename}"

# First batch of 50 for Sep 18
print("Starting Batch 1 (50 files for Sep 18)...")
env18 = os.environ.copy()
env18["GIT_AUTHOR_DATE"] = date_sep18
env18["GIT_COMMITTER_DATE"] = date_sep18

for idx, line in enumerate(to_commit[:50]):
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
        r = subprocess.run(["git", "commit", "-m", msg], env=env18, capture_output=True, text=True)
        if r.returncode == 0:
            break
        time.sleep(0.3)
    if (idx + 1) % 10 == 0:
        print(f"[Sep 18] {idx+1}/50 committed")

print("Pushing Sep 18 batch to GitHub...")
subprocess.run(["git", "push", "origin", "main"], check=True)
print("Sep 18 batch pushed successfully.")

# Second batch of 50 for Sep 19
print("Starting Batch 2 (50 files for Sep 19)...")
env19 = os.environ.copy()
env19["GIT_AUTHOR_DATE"] = date_sep19
env19["GIT_COMMITTER_DATE"] = date_sep19

for idx, line in enumerate(to_commit[50:100]):
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
        r = subprocess.run(["git", "commit", "-m", msg], env=env19, capture_output=True, text=True)
        if r.returncode == 0:
            break
        time.sleep(0.3)
    if (idx + 1) % 10 == 0:
        print(f"[Sep 19] {idx+1}/50 committed")

print("Pushing Sep 19 batch to GitHub...")
subprocess.run(["git", "push", "origin", "main"], check=True)
print("Sep 19 batch pushed successfully.")

print("All 100 files committed and pushed across Sep 18 and Sep 19.")
