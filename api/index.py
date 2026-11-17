"""
Vercel Serverless Function Entrypoint for BEYOND THE CURE Platform
Exposes 'handler' (subclass of BaseHTTPRequestHandler) for Vercel Python runtime.
"""

import os
import sys

# Ensure project root is on sys.path so core/ and server.py are importable
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from server import BeyondTheCureHandler

class handler(BeyondTheCureHandler):
    pass
