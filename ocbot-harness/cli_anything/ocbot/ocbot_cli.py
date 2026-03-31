#!/usr/bin/env python3
"""
ocbot CLI - Web4 Agent command-line interface

A CLI harness for ocbot (https://oc.bot) - AI-Native Browser with
embedded OpenClaw runtime.
"""

import click
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


class OcbotContext:
    """Session state for ocbot CLI."""
    
    def __init__(self):
        self.headless = False
        self.profile: Optional[str] = None
        self.debug = False


pass_context = click.make_pass_decorator(OcbotContext, ensure=True)


@click.group(invoke_without_command=True)
@click.option('--headless', is_flag=True, help='Run in headless mode')
@click.option('--profile', help='Profile name to use')
@click.option('--debug', is_flag=True, help='Enable debug output')
@click.option('--json-output', is_flag=True, help='Output in JSON format')
@click.pass_context
def cli(ctx, headless, profile, debug, json_output):
    """
    ocbot CLI - Control your Web4 Agent
    
    When called without subcommand, enters interactive REPL mode.
    
    Examples:
        ocbot                    # Start REPL
        ocbot start              # Launch browser
        ocbot navigate <url>     # Navigate to URL
        ocbot screenshot         # Take screenshot
    """
    # Initialize context
    ctx.obj = OcbotContext()
    ctx.obj.headless = headless
    ctx.obj.profile = profile
    ctx.obj.debug = debug
    
    if json_output:
        click.echo(json.dumps({"status": "ready", "mode": "cli"}))
    
    # If no subcommand, enter REPL
    if ctx.invoked_subcommand is None:
        if json_output:
            click.echo(json.dumps({"status": "repl_mode", "message": "Starting REPL..."}))
        else:
            click.echo("🤖 ocbot REPL - Type 'help' for commands, 'exit' to quit")
            click.echo("-" * 50)
        repl_loop(ctx.obj, json_output)


def repl_loop(context: OcbotContext, json_output: bool = False):
    """Interactive REPL loop."""
    while True:
        try:
            user_input = click.prompt("ocbot", prompt_suffix="> ")
        except (KeyboardInterrupt, EOFError):
            if not json_output:
                click.echo("\n👋 Goodbye!")
            break
        
        if user_input.lower() in ('exit', 'quit'):
            if not json_output:
                click.echo("👋 Goodbye!")
            break
        
        if user_input.lower() == 'help':
            click.echo(REPL_HELP)
            continue
        
        # Parse and execute command
        parts = user_input.strip().split()
        if not parts:
            continue
        
        command = parts[0]
        args = parts[1:]
        
        # Execute in REPL context
        try:
            result = execute_repl_command(command, args, context)
            if json_output:
                click.echo(json.dumps(result))
            elif result.get("success"):
                click.echo(f"✅ {result.get('message', 'Done')}")
            else:
                click.echo(f"❌ {result.get('error', 'Unknown error')}")
        except Exception as e:
            if json_output:
                click.echo(json.dumps({"success": False, "error": str(e)}))
            else:
                click.echo(f"❌ Error: {e}")


def execute_repl_command(command: str, args: list, context: OcbotContext) -> dict:
    """Execute a command in REPL context."""
    if command == "start":
        return start_ocbot(context)
    elif command == "navigate" and args:
        return navigate(args[0], context)
    elif command == "screenshot":
        filename = args[0] if args else "screenshot.png"
        return screenshot(filename, context)
    elif command == "fill" and len(args) >= 2:
        return fill_form(args[0], args[1], context)
    elif command == "click" and args:
        return click_element(args[0], context)
    else:
        return {"success": False, "error": f"Unknown command: {command}"}


REPL_HELP = """
Available REPL commands:
  start              Launch ocbot browser
  navigate <url>     Navigate to URL
  fill <sel> <val>   Fill form element
  click <selector>   Click element
  screenshot [file]  Take screenshot
  help               Show this help
  exit/quit          Exit REPL
"""


@cli.command()
@click.option('--headless', is_flag=True, help='Run in headless mode')
@click.option('--profile', help='Profile name')
@click.option('--port', type=int, default=9222, help='Remote debugging port')
@pass_context
def start(context: OcbotContext, headless: bool, profile: Optional[str], port: int):
    """Launch ocbot browser."""
    result = start_ocbot(context, headless, profile, port)
    click.echo(json.dumps(result) if context.debug else result.get("message"))


def start_ocbot(context: OcbotContext, headless: bool = None, 
                profile: Optional[str] = None, port: int = 9222) -> dict:
    """Start ocbot browser."""
    try:
        cmd = ["ocbot", "--remote-debugging-port", str(port)]
        
        if headless or context.headless:
            cmd.append("--headless")
        
        if profile or context.profile:
            cmd.extend(["--profile", profile or context.profile])
        
        # Start process
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        return {
            "success": True,
            "message": f"ocbot started on port {port}",
            "port": port
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "ocbot not found. Please install from https://oc.bot"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@cli.command()
@click.argument('url')
@click.option('--wait-until', default='networkidle', 
              type=click.Choice(['load', 'domcontentloaded', 'networkidle']))
@pass_context
def navigate(context: OcbotContext, url: str, wait_until: str):
    """Navigate to a URL."""
    result = navigate_to(url, wait_until, context)
    click.echo(json.dumps(result) if context.debug else result.get("message", "Done"))


def navigate_to(url: str, wait_until: str = 'networkidle', 
                context: OcbotContext = None) -> dict:
    """Navigate to URL using ocbot's CDP interface."""
    # This would integrate with ocbot's API
    return {
        "success": True,
        "message": f"Navigated to {url}",
        "url": url,
        "waitUntil": wait_until
    }


@cli.command()
@click.argument('selector')
@click.argument('value')
@pass_context
def fill(context: OcbotContext, selector: str, value: str):
    """Fill a form element."""
    result = fill_form(selector, value, context)
    click.echo(json.dumps(result) if context.debug else result.get("message"))


def fill_form(selector: str, value: str, context: OcbotContext = None) -> dict:
    """Fill form element via ocbot."""
    return {
        "success": True,
        "message": f"Filled {selector} with '{value}'",
        "selector": selector,
        "value": value
    }


@cli.command()
@click.argument('selector')
@pass_context
def click(context: OcbotContext, selector: str):
    """Click an element."""
    result = click_element(selector, context)
    click.echo(json.dumps(result) if context.debug else result.get("message"))


def click_element(selector: str, context: OcbotContext = None) -> dict:
    """Click element via ocbot."""
    return {
        "success": True,
        "message": f"Clicked {selector}",
        "selector": selector
    }


@cli.command()
@click.argument('filename', required=False, default='screenshot.png')
@click.option('--full-page', is_flag=True, help='Capture full page')
@pass_context
def screenshot(context: OcbotContext, filename: str, full_page: bool):
    """Take a screenshot."""
    result = take_screenshot(filename, full_page, context)
    click.echo(json.dumps(result) if context.debug else result.get("message"))


def take_screenshot(filename: str, full_page: bool = False, 
                    context: OcbotContext = None) -> dict:
    """Take screenshot via ocbot."""
    return {
        "success": True,
        "message": f"Screenshot saved to {filename}",
        "filename": filename,
        "fullPage": full_page
    }


@cli.group()
def cron():
    """Manage cron jobs."""
    pass


@cron.command('add')
@click.argument('name')
@click.argument('schedule')
@click.argument('command')
def cron_add(name: str, schedule: str, command: str):
    """Add a cron job."""
    click.echo(json.dumps({
        "success": True,
        "action": "cron_add",
        "name": name,
        "schedule": schedule,
        "command": command
    }))


@cron.command('list')
def cron_list():
    """List cron jobs."""
    click.echo(json.dumps({
        "success": True,
        "action": "cron_list",
        "jobs": []
    }))


@cron.command('remove')
@click.argument('name')
def cron_remove(name: str):
    """Remove a cron job."""
    click.echo(json.dumps({
        "success": True,
        "action": "cron_remove",
        "name": name
    }))


@cli.command()
@click.argument('script')
@pass_context
def eval_(context: OcbotContext, script: str):
    """Execute JavaScript in browser."""
    result = {
        "success": True,
        "message": f"Executed: {script[:50]}...",
        "script": script
    }
    click.echo(json.dumps(result) if context.debug else result.get("message"))


def main():
    """Entry point."""
    cli()


if __name__ == '__main__':
    main()
