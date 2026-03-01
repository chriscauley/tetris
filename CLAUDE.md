Don't build or start the dev server unless explicitly asked to.

## Code style

- Prefer compact single-line elements when they fit. Don't expand short attribute lists to multiple lines.
- Prefer inline expressions over named constants when the expression is short and used once.
- Don't destructure and reconstruct objects just to pass them through. Minimize data reshaping between layers.
- Push validation to boundaries rather than duplicating it at every layer.
- Use `const fn = () => {}` instead of `function fn() {}`. One-line the body when it's a single statement.
- Use Vue 3.4+ same-name shorthand for bindings: `:key` instead of `:key="key"`.

## Server

- Use the virtual environment at `server/.venv` for all Python/Django commands (e.g. `source server/.venv/bin/activate && python manage.py ...`).
