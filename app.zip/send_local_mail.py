#!/usr/bin/env python3
import subprocess
import argparse
import sys

def send_mail_via_applescript(to_address, subject, body, send_immediately=False):
    """
    Sends an email using the native macOS Mail.app via AppleScript.
    Does not require any SMTP connection or server configuration.
    """
    # Escape quotes for AppleScript compatibility
    escaped_subject = subject.replace('"', '\\"')
    escaped_body = body.replace('"', '\\"')
    
    # Compile the AppleScript instructions
    applescript = f'''
    tell application "Mail"
        set newMessage to make new outgoing message with properties {{subject:"{escaped_subject}", content:"{escaped_body}"}}
        tell newMessage
            make new to recipient at end of to recipients with properties {{address:"{to_address}"}}
            set visible to true
        end tell
        activate
        {"send newMessage" if send_immediately else ""}
    end tell
    '''
    
    try:
        # Run AppleScript command using the macOS built-in osascript runner
        process = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True,
            check=True
        )
        
        print("\033[92m✔ AppleScript dispatched successfully!\033[0m")
        if send_immediately:
            print(f"\033[94m📨 Mail.app instructed to send email immediately to: {to_address}\033[0m")
        else:
            print(f"\033[94m📝 Draft opened in Mail.app for review. Recipient: {to_address}\033[0m")
            
    except subprocess.CalledProcessError as e:
        print("\033[91m❌ Failed to dispatch AppleScript!\033[0m", file=sys.stderr)
        print(f"Error details: {e.stderr}", file=sys.stderr)
        print("\n\033[93m💡 Make sure Mail.app is configured on your Mac and you have granted terminal accessibility permissions if prompted.\033[0m")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Send emails on macOS using AppleScript via native Mail.app (No SMTP needed!)"
    )
    parser.add_argument("--to", required=True, help="Recipient email address")
    parser.add_argument("--subject", default="IDfy Security Awareness Drill", help="Email subject line")
    parser.add_argument("--body", default="This is an automated compliance exercise.", help="Email content body")
    parser.add_argument(
        "--send-immediately", 
        action="store_true", 
        help="Send the email immediately without opening the draft editor preview first"
    )
    
    args = parser.parse_args()
    
    print("\033[95m🚀 Executing IDfy Local Mail Dispatcher (macOS native)...\033[0m")
    send_mail_via_applescript(args.to, args.subject, args.body, args.send_immediately)
