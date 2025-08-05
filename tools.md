Claude Code Tools and Execution Points Guide
Available Tools in Claude Code
Claude Code provides the following tools that can be used during development:
Core Development Tools

Task - Launches agent subtasks for complex operations

Used for delegating work to subagents
Can break down complex problems into smaller tasks


Bash - Executes shell commands

Runs any command-line tool or script
Full access to system commands and utilities
Can run build tools, linters, formatters, test suites


Read - Reads file contents

Opens and reads any file in the project
Can read configuration files, source code, documentation


Edit - Edits single files

Makes targeted changes to individual files
Preserves file structure and formatting


MultiEdit - Batch edits multiple files

Efficiently updates multiple files in one operation
Useful for refactoring across codebase


Write - Creates new files or overwrites existing ones

Creates new source files, configurations, documentation
Can generate entire file structures



Search and Pattern Tools

Glob - File pattern matching

Finds files matching specific patterns (e.g., .swift, **/.test.js)
Useful for identifying all files of a certain type


Grep - Content searching across files

Searches for patterns within file contents
Can find function usage, imports, specific code patterns



External Integration Tools

WebFetch - Fetches web content

Downloads documentation, API responses, resources
Can retrieve external dependencies or references


WebSearch - Performs web searches

Finds solutions, documentation, best practices
Researches new technologies or approaches



MCP (Model Context Protocol) Tools

Pattern: mcp__<server>__<tool>
Examples:

mcp__memory__create_entities - Memory operations
mcp__filesystem__read_file - File system operations
mcp__github__search_repositories - GitHub integration



Execution Points (When Actions Can Be Triggered)
Claude Code provides specific points in its execution flow where automated actions can be triggered:
1. PreToolUse

When: BEFORE any tool is executed
Purpose: Validation, security checks, environment setup
Use Cases:

Validate file paths before reading
Check for sensitive data before writing
Ensure prerequisites before running commands
Set up test environments before execution



2. PostToolUse

When: AFTER a tool completes successfully
Purpose: Cleanup, validation, automated workflows
Use Cases:

Run formatters after code changes
Execute tests after modifications
Build project after file updates
Lint code after editing
Update documentation after changes



3. Stop

When: When Claude Code finishes responding to a task
Purpose: Final checks, summaries, cleanup
Use Cases:

Generate final status report
Run comprehensive test suite
Commit changes to version control
Clean up temporary files



4. UserPromptSubmit

When: When user submits a prompt, BEFORE Claude processes it
Purpose: Context loading, validation, prompt enhancement
Use Cases:

Load project context
Validate user requests
Add relevant documentation to context
Check for security concerns in prompts



5. SessionStart

When: When Claude Code starts a new session or resumes
Purpose: Environment setup, context loading
Use Cases:

Load development environment
Restore previous session state
Initialize project-specific settings
Load recent changes and context



6. SubagentStop

When: When a subagent (Task tool) completes
Purpose: Subagent cleanup, result processing
Use Cases:

Process subagent results
Clean up after delegated tasks
Aggregate multiple subagent outputs



7. PreCompact

When: Before conversation history is compressed
Purpose: Save important context before compression
Use Cases:

Save critical information
Export conversation state
Backup important context



8. Notification

When: When Claude Code sends notifications
Purpose: User alerts, permission requests
Use Cases:

Alert user to important events
Request permissions for sensitive operations



How Developers Use These Tools for Clean Code
Typical Development Workflow

Before Writing Code (PreToolUse points):

Check existing code patterns
Validate architecture decisions
Ensure dependencies are installed
Set up test environment


During Development (Tool usage):

Use Read to understand existing code
Use Grep to find similar patterns
Use Edit/MultiEdit to make changes
Use Bash to run quick validations


After Making Changes (PostToolUse points):

Format code automatically
Run unit tests
Check lint errors
Update documentation


Task Completion (Stop point):

Run full test suite
Generate coverage reports
Create summary of changes
Prepare for code review



iOS Development Specific Workflow
For iOS development, these tools enable:

Swift Code Management:

Read existing Swift files to understand patterns
Edit Swift files with proper formatting
Use Bash to run swiftlint and swiftformat
Execute xcodebuild for compilation checks


Testing Integration:

Run XCTest suites after changes
Execute UI tests for interface changes
Generate test coverage reports
Validate against different iOS versions


Build and Validation:

Check for build errors immediately
Run static analysis tools
Validate Info.plist configurations
Ensure proper code signing setup


Documentation and Standards:

Generate documentation from code comments
Ensure adherence to Swift style guides
Check for deprecated API usage
Validate accessibility compliance



Key Capabilities for Clean Code Rules

Immediate Feedback: Tools can provide instant validation after every change
Automated Quality Checks: Can run formatters, linters, and tests automatically
Contextual Awareness: Can understand project structure and dependencies
Incremental Development: Supports test-driven development with rapid feedback
Multi-file Operations: Can refactor across entire codebase safely
External Integration: Can fetch best practices and validate against standards

Environment Context

Claude Code has full access to the project directory
Can execute any command-line tool available in the system
Runs with user permissions
Has access to environment variables
Can integrate with any development tool through Bash

This structure allows developers to create comprehensive clean code rules that leverage automated validation at every step of the development process, ensuring high-quality code output for iOS applications.