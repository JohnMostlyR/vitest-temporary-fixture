# Commit Message Generation - Agent Guideline

Generate a concise and clear commit message based on the following commit diff.

Use the following format for the commit message:

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Where:

- `<type>` is the type of change (e.g., feat, fix, docs, style, refactor, test, chore).
- `<scope>` is an optional scope that provides additional context about the change (e.g., component or file name).
- `<subject>` is a brief summary of the change (max 50 characters).
- `<body>` is a more detailed description of the change, including the motivation and any relevant details (wrap at 72 characters).
- `<footer>` is an optional section for referencing issues or breaking changes (e.g., `Closes #123`, `BREAKING CHANGE: ...`).

Ensure that the generated commit message follows these guidelines and accurately reflects the changes made in the commit diff.
