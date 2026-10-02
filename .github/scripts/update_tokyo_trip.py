"""Compatibility entrypoint; never ask a model to replace the entire application."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2]/'scripts/build_tokyo.py'),run_name='__main__')
