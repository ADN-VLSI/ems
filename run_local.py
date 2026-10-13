#!/usr/bin/env python

import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
VITE_ENTRY = PROJECT_ROOT / "node_modules" / "vite" / "bin" / "vite.js"


def main():
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        print("Node.js 22+ and npm are required. Install Node.js, then run this script again.")
        return 1

    if not VITE_ENTRY.is_file():
        print("Installing project dependencies with npm ci...")
        result = subprocess.run("npm ci", cwd=PROJECT_ROOT, shell=True)
        if result.returncode:
            return result.returncode

    print("Starting the employee portal at http://localhost:5173/")
    print("Press Ctrl+C to stop the development server.")
    try:
        return subprocess.run(
            [node, str(VITE_ENTRY), "--host", "127.0.0.1", "--open"],
            cwd=PROJECT_ROOT,
            check=False,
        ).returncode
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
