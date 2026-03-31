"""
ocbot CLI - Web4 Agent command-line interface

Usage:
    python -m ocbot [OPTIONS] [COMMAND]
    
Examples:
    python -m ocbot                    # Start REPL
    python -m ocbot start              # Launch browser
    python -m ocbot navigate <url>     # Navigate to URL
"""

from .ocbot_cli import main

if __name__ == '__main__':
    main()
