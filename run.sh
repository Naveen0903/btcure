#!/usr/bin/env bash
# ==============================================================================
# BEYOND THE CURE: Karnataka NTEP Surveillance & Clinical Decision Platform
# Operational Research Surveillance (2021-2025, N = 3,72,863)
# ==============================================================================

PORT=${1:-8000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect virtual environment
if [ -f "${SCRIPT_DIR}/.venv/bin/python" ]; then
    PYTHON_BIN="${SCRIPT_DIR}/.venv/bin/python"
    echo ">> Using virtual environment Python: ${PYTHON_BIN}"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
    echo ">> Using system Python: $(which python3)"
else
    echo "Error: Python interpreter not found."
    exit 1
fi

echo "=================================================================="
echo " Starting BEYOND THE CURE Platform on port ${PORT}..."
echo " Access URL: http://localhost:${PORT}"
echo " Python: $(${PYTHON_BIN} --version)"
echo "=================================================================="

exec "${PYTHON_BIN}" "${SCRIPT_DIR}/server.py" "${PORT}"
