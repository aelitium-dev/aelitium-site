"""Run only with the separately installed public AELITIUM 0.4.0 release.

Usage: /tmp/aelitium-site-fixtures-venv/bin/python tools/prepare_fixtures.py
No network, credentials, provider calls, or browser-side verification.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shlex
import shutil
import socket
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

assert importlib.metadata.version("aelitium") == "0.4.0"
from engine.capture.openai import capture_chat_completion
from engine.canonical import canonical_json
from engine.ai_canonical import canonicalize_ai_output
from engine.ai_verify import verify_ai_bundle
import engine

ROOT = Path(__file__).resolve().parents[1]
STAMP = "2026-09-03T12:00:00Z"
COMMIT = "3506a4fdd8adc6a4c4aec25799cd2add2b2a1f73"
ARCHIVE_SHA256 = "5b2dd854ed03292da5e2f5c6d6c71c87887d06ccb07799cb06b4f2a9531514ae"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-archive", type=Path, default=Path("/tmp/aelitium-site-v040.tar.gz"))
parser.add_argument("--language", choices=("en", "fr"), default="en")
args = parser.parse_args()
OUT = ROOT / "assets" / "examples"
if args.language == "fr":
    OUT = OUT / "fr"

# Check the pinned release before writing any fixture. POSIX keys keep the
# provenance portable when preparation runs in an isolated Windows venv.
assert hashlib.sha256(args.source_archive.read_bytes()).hexdigest() == ARCHIVE_SHA256, "Release archive digest mismatch"
source = Path(engine.__file__).parent
source_files = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(source.rglob("*")) if p.suffix in {".py", ".json"}}
with tarfile.open(args.source_archive) as archive:
    archived = {member.name.split('/engine/', 1)[1]: hashlib.sha256(archive.extractfile(member).read()).hexdigest()
                for member in archive.getmembers() if member.isfile() and '/engine/' in member.name
                and Path(member.name).suffix in {'.py', '.json'}}
    assert source_files == archived, 'Installed engine differs from public release archive'
OUT.mkdir(parents=True, exist_ok=True)

def save(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

class FrozenTime:
    @staticmethod
    def now(tz=None):
        return datetime(2026, 9, 3, 12, tzinfo=timezone.utc)

def no_network(*args, **kwargs):
    raise RuntimeError("Fixture preparation must never access the network")

inputs = {}
if args.language == "fr":
    request_a = "Quelle est la conclusion de ce rapport d’incident ? Constats : requêtes en double, délais dépassés sans traitement et journaux de prompts non expurgés."
    request_c = "Combien de risques ce rapport d’incident relève-t-il ? Constats : requêtes en double, délais dépassés sans traitement et journaux de prompts non expurgés."
    response_a = "Le rapport relève trois risques opérationnels."
    response_b = response_a.replace("trois", "quatre")
else:
    request_a = "What is the main conclusion of this incident report? Findings: duplicate requests, unhandled timeouts, and unredacted prompt logs."
    request_c = "How many operational risks does this incident report identify? Findings: duplicate requests, unhandled timeouts, and unredacted prompt logs."
    response_a = "The report identifies three operational risks."
    response_b = response_a.replace("three", "four")
for name, request, response in [
    ("record-a", request_a, response_a),
    ("record-b", request_a, response_b),
    ("record-c", request_c, response_b),
]:
    inputs[name] = {"request": request, "response": response, "model": "gpt-4o-mini", "declared_time": STAMP}
    mock_response = SimpleNamespace(
        model="gpt-4o-mini", id="synthetic-website-example", created=None, usage=None,
        choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=response))],
    )
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs: mock_response)))
    with patch.dict(os.environ, {}, clear=True), patch("socket.socket", no_network), \
         patch("engine.capture.openai.datetime", FrozenTime), patch("engine.ai_pack.datetime", FrozenTime):
        capture_chat_completion(client, "gpt-4o-mini", [{"role": "user", "content": request}], OUT / name)
    # The unmodified release writer uses platform text newlines. Normalize only
    # the transport newline; canonical payload bytes and stored hashes are fixed.
    for filename in ("ai_canonical.json", "ai_manifest.json"):
        path = OUT / name / filename
        path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n"))

shutil.copytree(OUT / "record-a", OUT / "record-a-copy", dirs_exist_ok=True)
shutil.copytree(OUT / "record-a", OUT / "record-a-modified", dirs_exist_ok=True)
modified_file = OUT / "record-a-modified" / "ai_canonical.json"
modified = json.loads(modified_file.read_text(encoding="utf-8"))
modified["output"] = response_b
modified_file.write_text(canonical_json(modified) + "\n", encoding="utf-8", newline="\n")
save(OUT / "inputs.json", inputs)

raw = {}
def cli(name, *args):
    command = [sys.executable, "-m", "engine.ai_cli", *args]
    run = subprocess.run(command, cwd=OUT, text=True, encoding="utf-8", capture_output=True, check=False)
    raw[name] = {"argv": command, "cwd": OUT.relative_to(ROOT).as_posix(), "stdout": run.stdout, "stderr": run.stderr, "rc": run.returncode}
    return run

data = {"release": "0.4.0", "commit": COMMIT, "language": args.language, "records": {}, "comparisons": {}}
for name in ["record-a", "record-a-copy", "record-b", "record-c", "record-a-modified"]:
    cli("verify-" + name, "verify-bundle", name, "--json")
    result = verify_ai_bundle(OUT / name)
    obj = json.loads((OUT / name / "ai_canonical.json").read_text(encoding="utf-8"))
    manifest = json.loads((OUT / name / "ai_manifest.json").read_text(encoding="utf-8"))
    canonical, recomputed = canonicalize_ai_output(obj)
    record = {
        "payload": obj, "manifest": manifest,
        "verification": {"valid": result.valid, "reason": result.reason, **result.assurance_dict()},
        "recomputed_payload_hash": recomputed,
    }
    data["records"][name] = record
    raw["api-verify-" + name] = {"api": "engine.ai_verify.verify_ai_bundle", "input": name, "result": record["verification"]}

for name, b in [("changed", "record-b"), ("not-comparable", "record-c"), ("unchanged", "record-a-copy"), ("invalid", "record-a-modified")]:
    run = cli("compare-" + name, "compare", "record-a", b, "--json")
    result = json.loads(run.stdout)
    assert result["rc"] == run.returncode
    data["comparisons"][name] = {"a": "record-a", "b": b, "result": result}

# Exact UTF-8 byte offsets of serialized top-level VALUES, excluding keys and
# the transport newline. Construct each preceding key/value with the release's
# serializer, then assert that the byte slice is exactly that value's encoding.
obj = data["records"]["record-a"]["payload"]
canonical = canonical_json(obj)
ranges = {}
offset = 1  # opening brace
for key in sorted(obj):
    prefix = (canonical_json(key) + ":").encode()
    value = canonical_json(obj[key]).encode()
    start = offset + len(prefix)
    end = start + len(value)
    assert canonical.encode()[start:end] == value
    ranges["/" + key] = {"start": start, "end": end}
    offset = end + 1  # comma or closing brace
data["inspector"] = {"source": "record-a/ai_canonical.json", "canonical_utf8": canonical, "byte_ranges": ranges}
save(OUT / "results.json", data)
save(OUT / "raw-outputs.json", raw)

manifest = {
    "language": args.language,
    "repository": "https://github.com/aelitium-dev/aelitium-v3", "tag": "v0.4.0", "commit": COMMIT,
    "archive_url": "https://codeload.github.com/aelitium-dev/aelitium-v3/tar.gz/refs/tags/v0.4.0",
    "archive_sha256": hashlib.sha256(args.source_archive.read_bytes()).hexdigest(),
    "python": platform.python_version(),
    "dependencies": {p: importlib.metadata.version(p) for p in ["aelitium", "cryptography", "jsonschema", "referencing", "rpds-py", "attrs", "cffi", "jsonschema-specifications", "pycparser", "typing_extensions"]},
    "generation_command": subprocess.list2cmdline([sys.executable, "tools/prepare_fixtures.py", *sys.argv[1:]]) if os.name == "nt" else shlex.join([sys.executable, "tools/prepare_fixtures.py", *sys.argv[1:]]),
    "generation_argv": [sys.executable, "tools/prepare_fixtures.py", *sys.argv[1:]],
    "platform": platform.platform(),
    "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "source_files": source_files,
    "source_check": "Installed engine .py/.json files match the extracted public release archive byte for byte.",
    "files": {p.relative_to(OUT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(OUT.rglob("*")) if p.is_file() and p.name != "provenance.json"
              and (args.language == "fr" or p.relative_to(OUT).parts[0] != "fr")},
    "modification": "record-a-modified: only /output changed from " + ("trois to quatre" if args.language == "fr" else "three to four") + " in ai_canonical.json; original manifest and all metadata held fixed.",
    "conversion": "Comparison result is CLI --json verbatim. Verification dimensions use verify_ai_bundle.assurance_dict(); invalid CLI stdout remains key/value and is retained separately. No state is inferred in JavaScript.",
    "synthetic": True,
    "timestamp": "Fixed declared example timestamp, not evidence of historical time.",
}
save(OUT / "provenance.json", manifest)
print(json.dumps({k: {x: v["result"][x] for x in ["status", "comparison_basis", "comparison_reason", "rc"]} for k, v in data["comparisons"].items()}, indent=2))
